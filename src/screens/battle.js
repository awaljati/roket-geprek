// Mode Battle: layar skor (host, misalnya laptop di proyektor) dan layar tunggu pemain.
// Semua tim memainkan level yang sama dengan kejadian acak yang sama (seed), lalu skor dibandingkan.
import { openBattle, TEAMS, teamById, teamChannel, rankLevel, totals } from '../net/battle.js';
import { makeRoomCode, openRoom } from '../net/room.js';
import { LEVELS } from '../data/levels.js';
import { FAIL_CODES } from '../data/failcodes.js';

export const BATTLE_LIMITS = { rakitSec: 180, flightSec: 300 }; // Game Design Final: Rakit 3 menit, Terbang 5 menit
const PLAYABLE = [1, 2];

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---------- Pemain: bergabung dan mengikuti perintah host ----------
// Dipanggil dari Lobby. Langganan data battle disimpan di app.battle supaya tetap jalan saat pindah layar.
export async function joinBattle(app, { code, team, role, name }) {
  const store = await openBattle(code);
  store.join(team, role, name || (role === 'navigator' ? 'Navigator' : 'Spesialis'));
  app.battle = { code, team, role, store, state: { meta: null, teams: {} }, round: null, listeners: new Set() };
  app.role = role;
  app.code = teamChannel(code, team);
  if (role === 'navigator') app.room = await openRoom(app.code, { onCmd: (cmd) => app.onCmd && app.onCmd(cmd) });

  store.onChange((state) => {
    const b = app.battle;
    if (!b || b.code !== code) return;
    b.state = state;
    b.listeners.forEach((f) => f(state));
    const m = state.meta;
    if (!m) return;
    if (m.phase === 'playing' && m.round !== b.round) {
      // Ronde baru dimulai host
      b.round = m.round;
      b.rakitDeadline = Date.now() + BATTLE_LIMITS.rakitSec * 1000;
      b.flightDeadline = null;
      app.level = m.level;
      if (role === 'navigator') app.go('rakit');
      else app.go('spesialis');
    }
    if (m.phase === 'final' && b.shownFinal !== m.round) {
      b.shownFinal = m.round;
      app.go('battle');
    }
  });
}

export function leaveBattle(app) {
  if (app.battle) app.battle.store.close();
  app.battle = null;
}

// Layar pemain: menunggu ronde, lalu papan skor setelah misi.
export function battleScreen(app, el) {
  const b = app.battle;
  if (!b) return app.go('lobby');
  const t = teamById(b.team);
  el.className = 'screen';
  const render = (state) => {
    const m = state.meta || {};
    const me = (state.teams[b.team] || { members: {} }).members;
    let body = '';
    if (!m.phase || m.phase === 'lobby') body = '<p class="status">Menunggu layar skor memulai level…</p>';
    else if (m.phase === 'playing') body = `<p class="status">Level ${m.level} berlangsung. Menunggu tim lain selesai…</p>${levelTable(state.teams, m.level)}`;
    else if (m.phase === 'between') body = `<p class="status">Menunggu level berikutnya…</p>${levelTable(state.teams, m.level)}`;
    else if (m.phase === 'final') body = finalTable(state.teams, m.levelsPlayed || []);
    el.innerHTML = `
      <h2>Battle <span class="code">${b.code}</span></h2>
      <p><span class="team-dot" style="background:${t.color}"></span><b>${t.label}</b> · kamu ${b.role === 'navigator' ? 'Navigator' : 'Spesialis'}
        <br><small class="muted">Navigator: ${me.navigator ? me.navigator.name : '—'} · Spesialis: ${me.spesialis ? me.spesialis.name : '—'}</small></p>
      ${body}
      <button id="leave">Keluar dari battle</button>`;
    el.querySelector('#leave').onclick = () => {
      leaveBattle(app);
      app.go('lobby');
    };
  };
  b.listeners.add(render);
  render(b.state);
  return () => b.listeners.delete(render);
}

// ---------- Host: layar skor ----------
export function battleHostScreen(app, el) {
  el.className = 'screen';
  const code = app.hostCode || (app.hostCode = makeRoomCode());
  let store = null;
  let state = { meta: null, teams: {} };

  const setMeta = (patch) => store.setMeta({ ...(state.meta || {}), ...patch });

  function render() {
    const m = state.meta || { phase: 'lobby', round: 0, levelsPlayed: [] };
    const ready = TEAMS.filter((t) => state.teams[t.id] && state.teams[t.id].members && state.teams[t.id].members.navigator);
    const canStart = ready.length >= 2;
    const allDone = m.phase === 'playing' && ready.every((t) => (state.teams[t.id].results || {})['level' + m.level]);
    const startButtons = PLAYABLE.map(
      (l) => `<button class="${l === 1 ? 'primary' : ''}" data-start="${l}" ${canStart ? '' : 'disabled'}>Mulai Level ${l}: ${LEVELS[l].name.split(': ')[1]}</button>`,
    ).join('');

    el.innerHTML = `
      <h2>Layar Skor Battle</h2>
      <div class="card center-text">
        <div class="muted">Kode battle</div>
        <div class="code big-code">${code}</div>
        <small class="muted">Pemain: Main → Lobby → Gabung battle → masukkan kode, pilih tim dan peran</small>
      </div>
      <div class="card">
        <b>Tim</b>
        <table class="score">
          <tr><th>Tim</th><th>Navigator</th><th>Spesialis</th><th>Status</th></tr>
          ${TEAMS.map((t) => {
            const tm = state.teams[t.id];
            const mem = (tm && tm.members) || {};
            const res = tm && m.level ? (tm.results || {})['level' + m.level] : null;
            const status = m.phase === 'playing' ? (res ? `Selesai ${stars(res.stars)}` : mem.navigator ? 'Sedang main…' : '—') : mem.navigator ? 'Siap' : 'Belum ada Navigator';
            return `<tr><td><span class="team-dot" style="background:${t.color}"></span>${t.label}</td><td>${mem.navigator ? mem.navigator.name : '—'}</td><td>${mem.spesialis ? mem.spesialis.name : '—'}</td><td>${tm ? status : '—'}</td></tr>`;
          }).join('')}
        </table>
        ${canStart ? '' : '<small class="muted">Butuh minimal 2 tim yang punya Navigator.</small>'}
      </div>
      ${m.phase === 'playing' || m.phase === 'between' ? `<div class="card"><b>Level ${m.level}</b>${levelTable(state.teams, m.level)}</div>` : ''}
      ${m.phase === 'final' ? `<div class="card">${finalTable(state.teams, m.levelsPlayed || [])}</div>` : ''}
      <div class="row">
        ${m.phase === 'playing' && !allDone ? `<span class="status">Level ${m.level} berlangsung (Rakit ${BATTLE_LIMITS.rakitSec / 60} menit, Terbang ${BATTLE_LIMITS.flightSec / 60} menit)</span><button id="endRound">Akhiri level sekarang</button>` : startButtons}
        ${(m.levelsPlayed || []).length && m.phase !== 'final' && m.phase !== 'playing' ? '<button id="final">Tampilkan hasil akhir</button>' : ''}
        ${m.phase === 'playing' && allDone ? '<button id="final">Tampilkan hasil akhir</button>' : ''}
      </div>
      <button id="back">Tutup layar skor</button>`;

    el.querySelectorAll('[data-start]').forEach((btn) => {
      btn.onclick = () => {
        const level = Number(btn.dataset.start);
        const played = new Set(m.levelsPlayed || []);
        played.add(level);
        setMeta({ phase: 'playing', level, round: (m.round || 0) + 1, startedAt: Date.now(), levelsPlayed: [...played] });
      };
    });
    const end = el.querySelector('#endRound');
    if (end) end.onclick = () => setMeta({ phase: 'between' });
    const fin = el.querySelector('#final');
    if (fin) fin.onclick = () => setMeta({ phase: 'final' });
    el.querySelector('#back').onclick = () => {
      app.hostCode = null;
      app.go('lobby');
    };
  }

  el.innerHTML = '<p class="status">Menyiapkan battle…</p>';
  let closed = false;
  openBattle(code).then((s) => {
    if (closed) return s.close();
    store = s;
    store.onChange((st) => {
      state = st;
      if (!st.meta) store.setMeta({ phase: 'lobby', round: 0, levelsPlayed: [] });
      else render();
    });
  });
  return () => {
    closed = true;
    if (store) store.close();
  };
}

// ---------- Tabel ----------
function levelTable(teams, level) {
  const { rows, reason } = rankLevel(teams, level);
  return `
    <table class="score">
      <tr><th>#</th><th>Tim</th><th>Hasil</th><th>Skor</th><th>Bahan bakar</th>${level === 2 ? '<th>Foto</th>' : '<th>Orbit</th>'}</tr>
      ${rows
        .map((r, i) => {
          const x = r.result;
          if (!x) return `<tr><td>${i + 1}</td><td>${dot(r.team)}</td><td colspan="4" class="muted">belum selesai</td></tr>`;
          return `<tr><td>${i + 1}</td><td>${dot(r.team)}</td><td>${stars(x.stars)}${x.failCode ? ` <small class="muted">${x.failCode}</small>` : ''}</td><td><b>${x.score}</b></td><td>${Math.round(x.fuelLeft * 100)}%</td><td>${
            level === 2 ? x.photos : x.orbitErrorPct != null ? `meleset ${String(x.orbitErrorPct).replace('.', ',')}%` : '—'
          }</td></tr>`;
        })
        .join('')}
    </table>
    ${reason ? `<p class="winner">${reason}</p>` : ''}
    ${rows
      .filter((r) => r.result && r.result.failCode && FAIL_CODES[r.result.failCode])
      .map((r) => `<small class="muted">${r.team.label}: ${FAIL_CODES[r.result.failCode]}</small>`)
      .join('<br>')}`;
}

function finalTable(teams, levels) {
  const list = totals(teams, levels);
  if (!list.length) return '<p class="muted">Belum ada hasil.</p>';
  return `
    <h3>Hasil akhir (Level ${levels.join(', ')})</h3>
    <table class="score"><tr><th>#</th><th>Tim</th><th>Total skor</th></tr>
      ${list.map((r, i) => `<tr><td>${i + 1}</td><td>${dot(r.team)}</td><td><b>${r.total}</b></td></tr>`).join('')}
    </table>
    <p class="winner">${
      list.length > 1 && list[0].total === list[1].total
        ? `Seri: ${list.filter((r) => r.total === list[0].total).map((r) => r.team.label).join(' dan ')}`
        : `🏆 Pemenang: ${list[0].team.label}`
    }</p>`;
}

const dot = (t) => `<span class="team-dot" style="background:${t.color}"></span>${t.label}`;
