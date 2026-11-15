// Layar terbang (perangkat Navigator / solo). Menjalankan fisika, menggambar, dan mengirim snapshot ke Spesialis.
import { LEVEL_MODULES } from '../levels/index.js';
import { LAUNCH_SITE } from '../data/levels.js';
import { orbitCheck, orbitExtremes } from '../engine/flight.js';
import { createView, prefers3D, setPrefer3D } from '../render/view.js';
import { mountPanelFor, progRowHtml, bindProgRows, updateProgRows } from './specialistPanel.js';
import { createControls, controlAction } from '../engine/attitude.js';
import { bindControls, helpHtml } from './controls.js';
import { spendFunds } from './progress.js';

const DT = 1 / 60;
const MODE_NAME = { manual: 'manual', prograde: 'searah gerak', retrograde: 'lawan arah', left: 'kiri jalur', right: 'kanan jalur' };

export function flightScreen(app, el) {
  const M = LEVEL_MODULES[app.level];
  el.className = 'flight';
  el.innerHTML = `
    <div class="view">
      <div class="stage" id="stage"><canvas id="cv"></canvas></div>
      <div class="coach" id="coach"><img class="pokpok" id="pokpok" alt="" hidden><div class="bubble" id="coachMsg"></div></div>
      <div class="timeline" id="timeline"></div>
      <div class="hud"><div id="hud"></div>
        <details><summary class="muted">Kontrol</summary><div class="keys">${helpHtml()}</div></details>
      </div>
      <button class="menu-btn" id="menuBtn">☰ Menu</button>
      <div class="touch" id="pad"></div>
      <div class="touch" id="nav4" style="display:none"></div>
      <div class="prog4" id="prog4" style="display:none"></div>
      <div class="overlay" id="pause">
        <div class="card pause-card">
          <h2>Misi dijeda</h2>
          <button class="primary" id="pResume">Lanjutkan</button>
          <button id="pRestart">Ulangi misi</button>
          <button id="pRakit">Ubah rakitan</button>
          <button id="pView"></button>
          <button id="pHome">Keluar ke menu utama</button>
        </div>
      </div>
    </div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createView($('#stage'));
  // Dana cadangan yang dipakai terpotong setiap kali misi dimulai (termasuk Ulangi misi).
  if (app.build.extraBudget) app.build.extraBudget = spendFunds(app.build.extraBudget);
  const game = M.create(app.build, app.code || 'solo');
  // Wahana yang sedang dikendalikan: roket di orbit Bumi, wahana di jalur Bumi-Bulan (Level 3), atau pendarat.
  const craft = () => game.flight || game.space || game.craft;
  const ctrl = createControls();
  let warp = 1;

  // Panel kanan: Spesialis (solo) atau status room (navigator).
  let updatePanel = () => {};
  if (app.role === 'solo') {
    updatePanel = mountPanelFor(app.level, $('#side'), (cmd) => M.command(game, cmd), { solo: true });
  } else {
    $('#side').innerHTML = `<h2>Navigator</h2><p>Room <span class="code">${app.code}</span></p><p class="muted">Tombol wahana dipegang Spesialis di perangkatnya. Dengarkan aba-abanya.</p><div class="status" id="navst"></div>`;
    app.onCmd = (cmd) => M.command(game, cmd);
    updatePanel = (v) => ($('#navst').textContent = v.lastLog);
  }

  const padSet =
    app.level === 2 ? (game.assist ? 'moonAssist' : 'moon') : app.level >= 3 ? (game.assist ? 'moonAssist' : 'lunar') : game.assist ? 'basic' : 'manual';
  const unbind = bindControls(
    $('#pad'),
    (action) => {
      if (paused) return;
      if (action === 'warp') warp = warp === 1 ? 3 : 1;
      else controlAction(ctrl, action, craft());
    },
    padSet,
  );

  // Level 4: tombol Navigator untuk instrumen dan program pendaratan (dijalankan langsung di perangkat ini).
  const nav4 = app.level === 4 ? mountNav4($('#nav4'), $('#prog4'), (cmd) => !paused && M.command(game, cmd), app.role === 'solo') : null;

  // ---------- Menu jeda ----------
  let paused = false;
  const setPaused = (on) => {
    paused = on;
    $('#pause').style.display = on ? 'flex' : 'none';
  };
  $('#menuBtn').onclick = () => setPaused(true);
  $('#pResume').onclick = () => setPaused(false);
  $('#pRestart').onclick = () => app.go('flight');
  $('#pRakit').onclick = () => app.go('rakit');
  $('#pHome').onclick = () => app.go('home');
  // Ganti tampilan 2D/3D: misi diulang dengan tampilan baru.
  $('#pView').textContent = prefers3D() ? 'Pakai tampilan 2D (lebih ringan)' : 'Pakai tampilan 3D';
  $('#pView').onclick = () => {
    setPrefer3D(!prefers3D());
    app.go('flight');
  };
  const onEsc = (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') setPaused(!paused);
  };
  window.addEventListener('keydown', onEsc);
  // Tombol Back di HP / browser membuka menu jeda, bukan keluar dari web.
  app.onBack = () => {
    setPaused(!paused);
    return true;
  };
  const onUnload = (e) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', onUnload);

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let lastSend = 0;
  let prevPhase = null;
  function frame(now) {
    if (paused) {
      last = now;
      if (app.room && now - lastSend > 500) {
        app.room.sendState({ ...M.snapshot(game, false), paused: true });
        lastSend = now;
      }
      raf = requestAnimationFrame(frame);
      return;
    }
    // Percepat waktu dimatikan saat mendarat, supaya waktu di permukaan (Level 3) tidak ikut berjalan 3× tanpa disadari.
    // Pemain boleh menekan T lagi kalau memang ingin mempercepat.
    if (game.phase === 'landed' && prevPhase !== 'landed') warp = 1;
    prevPhase = game.phase;
    // Percepat waktu hanya saat mesin mati dan tidak di fase genting.
    // Level 4: game.noWarp saat badai matahari mendekat, supaya peringatan 8 detik tidak terlewat.
    const calm = ctrl.throttle === 0 && ctrl.pulseLeft === 0 && !['flyby', 'entry', 'launch', 'descent', 'loi', 'edl'].includes(game.phase) && !game.noWarp;
    const speed = calm ? warp : 1;
    acc += Math.min(0.1, (now - last) / 1000) * speed;
    last = now;
    while (acc >= DT) {
      M.step(game, ctrl, DT);
      acc -= DT;
    }
    const view = M.snapshot(game);
    renderer.draw(view);
    drawHud(view, speed);
    updatePanel(view);
    if (app.room && now - lastSend > 100) {
      app.room.sendState(M.snapshot(game, false));
      lastSend = now;
    }
    if (game.result) {
      app.result = game.result;
      if (app.room) {
        app.room.sendState(M.snapshot(game, false));
        app.room.saveResult('tim', app.level, game.result);
      }
      setTimeout(() => app.go('debrief'), 1200);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function controlLine(v, speed) {
    const fuel = v.flight ? v.flight.fuel : v.fuel;
    return `<b>Bahan bakar ${Math.round(fuel * 100)}%</b>
      <span>Gas ${Math.round(ctrl.throttle * 100)}%${ctrl.pulseLeft > 0 ? ' (dorongan pendek)' : ''} · Arah: ${MODE_NAME[ctrl.mode]}${speed > 1 ? ' · Waktu ×' + speed : ''}</span>`;
  }

  function drawHud(v, speed) {
    if (app.level === 4) return drawHud4(v, speed);
    if (app.level === 3) return drawHud3(v, speed);
    if (app.level === 1 || v.phase === 'launch') return drawHud1(v, speed);
    drawHud2(v, speed);
  }

  // Pelatih: maskot Pok-Pok dan balon kata. Kalau gambarnya belum ada, hanya balon yang tampil.
  const pok = $('#pokpok');
  // Muat ketiga ekspresi sejak awal supaya tidak berkedip saat berganti.
  ['netral', 'cemas', 'senang'].forEach((n) => (new Image().src = `/assets/${n}.svg`));
  pok.onload = () => (pok.hidden = false);
  pok.onerror = () => (pok.hidden = true);
  let coachKey = '';
  function drawCoach(v) {
    const box = $('#coach');
    const c = v.coach && v.coach.msg ? v.coach : null;
    const key = c ? (c.urgent ? '!' : '') + c.msg : '';
    if (key === coachKey) return;
    coachKey = key;
    if (!c) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'flex';
    box.className = 'coach' + (c.urgent ? ' urgent' : '');
    $('#coachMsg').textContent = c.msg;
    const src = `/assets/${c.urgent ? 'cemas' : 'netral'}.svg`;
    if (pok.getAttribute('src') !== src) pok.src = src;
  }

  function drawHud1(v, speed) {
    drawCoach(v);
    const f = game.flight;
    const o = orbitCheck(f);
    const p = f.planet;
    const mark = (ok) => (ok ? '✓' : '·');
    const { apo, peri } = orbitExtremes(f);
    const fmt = (r) => (r === Infinity ? 'lepas' : Math.round(r - p.radius));
    const near = (r) => r !== null && Math.abs(r - p.orbitRadius) < 14;
    $('#timeline').innerHTML = '';
    $('#hud').innerHTML = `${controlLine(v, speed)}
      ${v.flight.status === 'pad' ? `<span>Landasan: ${LAUNCH_SITE.name} (dekat khatulistiwa)</span>` : ''}
      <span>Titik tertinggi ${fmt(apo)}${near(apo) ? ' ✓' : ''} · terendah ${peri === null ? '-' : fmt(peri)}${near(peri) ? ' ✓' : ''} (target ${p.orbitRadius - p.radius})</span>
      <span>${mark(o.altOk)} Ketinggian ${Math.round(o.r - p.radius)} / ${p.orbitRadius - p.radius}</span>
      <span>${mark(o.speedOk)} Kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}</span>
      <span>${mark(o.flatOk)} Naik/turun ${o.radial.toFixed(0)}</span>
      ${v.phase === 'launch' && v.flight.inRing ? `<span style="color:var(--ok)">Tahan di cincin ${v.flight.inRingFor.toFixed(1)} s</span>` : ''}`;
  }

  function drawHud2(v, speed) {
    drawCoach(v);
    const steps = [
      ['Peluncuran', v.phase === 'launch'],
      ['TLI', v.phase === 'tli'],
      ...v.mccWindows.slice(0, 2).map((w) => [w.id, v.mcc === w.id]),
      ['Bulan', v.phase === 'flyby'],
      [v.mccWindows[2].id, v.mcc === v.mccWindows[2].id],
      ['Masuk atmosfer', v.phase === 'entry' || v.phase === 'splash'],
    ];
    $('#timeline').innerHTML = steps.map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join('');
    let status;
    if (v.phase === 'tli') status = v.secondsToTli !== null && game.tliArmed ? `TLI dalam ${Math.ceil(v.secondsToTli)} detik` : 'Tekan Gas + (W) untuk berangkat ke Bulan (TLI).';
    else if (v.phase === 'entry') status = 'Masuk atmosfer: tekan E supaya pelindung panas menghadap depan.';
    else if (v.mcc) status = `<span style="color:var(--ok)">${v.mcc}: mesin boleh dinyalakan</span>`;
    else if (v.nextMcc) status = `Mesin terkunci. ${v.nextMcc.id} dalam ${Math.ceil(v.nextMcc.from - v.t)} s${speed === 1 ? ' (T = percepat)' : ''}`;
    else status = 'Mesin terkunci.';
    const adv = app.role === 'solo' && !game.assist && v.advice && v.mcc ? `<span>Saran Spesialis: dorong ke <b>${v.advice === 'left' ? 'KIRI (Z)' : 'KANAN (C)'}</b> jalur</span>` : '';
    $('#hud').innerHTML = `${controlLine(v, speed)}<span>${status}</span>${adv}
      ${v.phase === 'flyby' ? `<span>${aimText(v.aimOff)} · Kualitas foto ${Math.round(v.photoQuality * 100)}%</span>` : ''}`;
  }

  // Level 3: ketinggian, kecepatan turun, kecepatan menyamping, bahan bakar (di controlLine), kemiringan.
  function drawHud3(v, speed) {
    const steps = [
      ['Peluncuran', v.stage === 'launch'],
      ['Ke Bulan', v.stage === 'transfer'],
      ['Masuk orbit', v.stage === 'loi'],
      ['Pilih titik', v.stage === 'pick'],
      ['Turun', v.stage === 'deorbit' || v.stage === 'descent'],
      ['Mendarat', v.stage === 'landed'],
      ['Pindai es', v.stage === 'scan'],
      ['Kirim data', v.stage === 'send'],
    ];
    const timeline = () => ($('#timeline').innerHTML = steps.map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join(''));
    if (v.space) {
      if (v.flight) drawHud1(v, speed);
      else drawHudSpace3(v, speed);
      return timeline();
    }
    drawCoach(v);
    timeline();
    const max = v.maxLandingSpeed;
    const speedNow = Math.hypot(v.vDown, v.vSide);
    const warn = (bad) => (bad ? ' style="color:var(--bad)"' : '');
    const lowAndFast = v.altitude < 40 && speedNow > max;
    const tiltBad = Math.abs(v.tiltDeg) > v.maxLandingTiltDeg;
    const sf = v.surface;
    if (sf) {
      const pct = (a, b) => Math.round((a / b) * 100);
      $('#hud').innerHTML = `<b>Di permukaan · sisa ${Math.ceil(sf.timeLeft)} detik${speed > 1 ? ' · Waktu ×' + speed : ''}</b>
        <span${warn(sf.battery / sf.batteryMax < sf.lowPowerShare)}>Baterai ${pct(sf.battery, sf.batteryMax)}% · daya ${sf.powerNet > 0 ? '+' : ''}${sf.powerNet} W</span>
        <span>Matahari: ${sf.alwaysDark ? 'selalu bayangan' : sf.sunlit ? 'terang' : 'bayangan bukit lewat'}</span>
        <span>Spektrometer ${sf.spectrometer.has ? (sf.spectrometer.on ? 'menyala' : 'mati') : '-'} · Es ${sf.iceFound ? '✓ terdeteksi' : sf.scan ? 'memindai…' : 'belum'}</span>
        <span${sf.antenna.sending ? ' style="color:var(--ok)"' : ''}>Antena ${sf.antenna.has ? `${sf.antenna.deg}° (Bumi ${sf.earthDeg}°)${sf.antenna.sending ? ' mengirim' : ''}` : '-'} · Data ${pct(sf.data, sf.dataTarget)}%</span>
        <small class="muted">Tombol permukaan dipegang Spesialis</small>`;
      return;
    }
    $('#hud').innerHTML = `${controlLine(v, speed)}
      ${v.hasEngine ? '' : '<span style="color:var(--bad)">Tidak ada mesin pendarat!</span>'}
      ${v.engineLocked ? '<span style="color:var(--bad)">Mesin terkunci: Spesialis, pilih titik pendaratan dulu</span>' : ''}
      ${v.burnInSec !== null && v.burnInSec !== undefined ? `<span>Mulai mengerem ${v.burnInSec > 0.5 ? `dalam ${Math.ceil(v.burnInSec)} detik` : '<b>SEKARANG</b>'}</span>` : ''}
      ${v.direction ? `<span${v.target && v.target.over ? ' style="color:var(--ok)"' : ''}>${v.direction}</span>` : ''}
      <span>Ketinggian ${v.altitude.toFixed(0)} u</span>
      <span${warn(lowAndFast)}>Kecepatan turun ${v.vDown.toFixed(1)} u/s${v.vDown < 0 ? ' (naik)' : ''}</span>
      <span${warn(v.altitude < 40 && Math.abs(v.vSide) > max)}>Kecepatan menyamping ${Math.abs(v.vSide).toFixed(1)} u/s${Math.abs(v.vSide) > 0.2 ? (v.vSide > 0 ? ' →' : ' ←') : ''}</span>
      <span${warn(tiltBad && v.altitude < 40)}>Kemiringan ${Math.round(Math.abs(v.tiltDeg))}° ${tiltBad ? '' : '✓'}</span>
      <small class="muted">Aman mendarat: kecepatan ≤ ${max} u/s, miring ≤ ${v.maxLandingTiltDeg}° · gas ${Math.round(v.hoverThrottle * 100)}% = melayang</small>`;
  }

  // Level 3 fase awal setelah peluncuran: orbit parkir, perjalanan ke Bulan, masuk orbit Bulan.
  function drawHudSpace3(v, speed) {
    drawCoach(v);
    const fuelLine = `<b>Bahan bakar roket ${Math.round(v.rocketFuel * 100)}% · pendarat ${Math.round(v.fuel * 100)}%</b>
      <span>Gas ${Math.round(ctrl.throttle * 100)}% · Arah: ${MODE_NAME[ctrl.mode]}${speed > 1 ? ' · Waktu ×' + speed : ''}</span>`;
    let lines = '';
    if (v.phase === 'tli') lines = `<span>${v.secondsToTli !== null && v.tliArmed ? `TLI dalam ${Math.ceil(v.secondsToTli)} detik` : 'Tekan Gas + (W) untuk berangkat ke Bulan (TLI).'}</span>`;
    else if (v.phase === 'transfer') lines = `<span>Mesin terkunci selama perjalanan. Tiba di wilayah Bulan dalam ${Math.ceil(v.arriveInSec)} s${speed === 1 ? ' (T = percepat)' : ''}</span>`;
    else if (v.loi) {
      const o = v.loi;
      const mark = (ok) => (ok ? '✓' : '·');
      const when = o.burnInSec === null || o.burnInSec === undefined ? '' : o.burnInSec > 0.5 ? `Mengerem dalam ${Math.ceil(o.burnInSec)} detik` : '<b>Mengerem SEKARANG</b> (lawan arah gerak, E)';
      lines = `${when ? `<span>${when}</span>` : ''}
        <span>${mark(o.altOk)} Ketinggian ${o.alt.toFixed(0)} / ${o.ringAlt} u</span>
        <span>${mark(o.speedOk)} Kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)} u/s${o.status ? ` (${o.status})` : ''}</span>
        <span>${mark(o.flatOk)} Naik/turun ${o.radial.toFixed(0)}</span>
        ${o.captured ? '<span style="color:var(--ok)">Masuk orbit polar Bulan ✓</span>' : o.inRing ? `<span style="color:var(--ok)">Tahan di cincin ${o.inRingFor.toFixed(1)} / ${o.hold} s</span>` : ''}`;
    }
    $('#hud').innerHTML = fuelLine + lines;
  }

  // Level 4: peluncuran seperti Level 1, lalu perjalanan ke Mars, program pendaratan, tujuh menit, foto pertama.
  function drawHud4(v, speed) {
    const steps = [
      ['Peluncuran', v.stage === 'launch'],
      ['Ke Mars', v.stage === 'cruise'],
      ['Program', v.stage === 'program'],
      ['Masuk atmosfer', v.stage === 'entry'],
      ['Parasut', v.stage === 'chute'],
      ['Roket pendarat', v.stage === 'retro'],
      ['Mendarat', v.stage === 'landed'],
      ['Foto pertama', v.stage === 'photo'],
    ];
    // Setelah peluncuran tombol gas tidak dipakai lagi; Percepat ⏩ tetap ada untuk perjalanan ke Mars.
    const padMain = $('#pad .pad-main');
    const padExtra = $('#pad .pad-extra');
    if (padMain) padMain.style.display = v.flight ? '' : 'none';
    $('#pad').style.display = v.flight || (padExtra && v.view === 'cruise') ? '' : 'none';
    if (nav4) nav4(v);
    if (v.flight) {
      drawHud1(v, speed);
      if (v.view === 'park' && !game.assist) $('#hud').innerHTML += '<span>Orbit parkir: tekan Gas + (W) untuk berangkat ke Mars (TMI).</span>';
    } else {
      drawCoach(v);
      const bad = (t) => `<span style="color:var(--bad)">${t}</span>`;
      const ok = (t) => `<span style="color:var(--ok)">${t}</span>`;
      const n = (x) => String(x).replace('.', ',');
      const fuel = `<b>Bahan bakar roket pendarat ${Math.round(v.fuel * 100)}%</b>`;
      let lines = '';
      if (v.view === 'cruise') {
        const c = v.cruise;
        lines = `<span>Tiba di Mars dalam ${Math.ceil(c.arriveInSec)} s${speed > 1 ? ' · Waktu ×' + speed : game.noWarp ? ' · percepat dimatikan (badai)' : ' (T = percepat)'}</span>
          ${v.instrumentsOn ? '<span>Instrumen: menyala</span>' : bad('Instrumen: mati')}
          ${v.radShield ? ok('Pelindung radiasi terpasang') : ''}
          ${c.stormActive ? bad('BADAI MATAHARI sedang lewat') : game.assist && c.stormInSec !== null ? bad(`Badai dalam ${Math.ceil(c.stormInSec)} s (radar Spesialis)`) : ''}
          ${v.cameraDamaged ? bad('Kamera rusak terkena badai') : ''}
          <small class="muted">Dengarkan Spesialis: dia melihat radar badai.</small>`;
      } else if (v.view === 'program') {
        lines = ''; // angka program ada di kartu tengah layar
      } else if (v.view === 'edl' && v.edl) {
        lines = `<b>Otomatis: tidak bisa dikendalikan</b>
          <span>Ketinggian ${v.edl.alt >= 10 ? Math.round(v.edl.alt) : n(v.edl.alt.toFixed(1))} km · ${Math.round(v.edl.speed)} m/s</span>`;
      } else if (v.surface) {
        const sf = v.surface;
        lines = `<b>Di permukaan Mars${sf.pressed ? '' : ` · sisa ${Math.ceil(sf.timeLeft)} detik`}</b>
          <span>Baterai ${Math.round((sf.battery / sf.batteryMax) * 100)}% · panel surya ${sf.solar} W (${Math.round(sf.solarShare * 100)}% dari ${sf.solarFull} W)${sf.rtg ? ` · RTG ${sf.rtg} W` : ''}</span>
          <span>Foto ${Math.round(sf.progress * 100)}%${sf.sending ? ' · mengirim' : ''}</span>
          <small class="muted">Tombol Kirim foto dipegang Spesialis</small>`;
      }
      $('#hud').innerHTML = fuel + lines;
    }
    $('#timeline').innerHTML = steps.map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join('');
  }

  function aimText(off) {
    if (off === null) return 'Arahkan kapsul ke Bulan (A/D)';
    if (Math.abs(off) <= 10) return '<span style="color:var(--ok)">Kamera mengarah ke Bulan ✓</span>';
    return `Arahkan kapsul ke Bulan: putar ${off > 0 ? 'kanan (D)' : 'kiri (A)'} ${Math.round(Math.abs(off))}°`;
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    unbind();
    window.removeEventListener('keydown', onEsc);
    window.removeEventListener('beforeunload', onUnload);
    if (nav4) nav4.dispose();
    app.onCmd = null;
    app.onBack = null;
    renderer.dispose();
  };
}

// Level 4: tombol Navigator. Instrumen saat perjalanan (bar bawah); saat program, satu kartu di tengah layar.
// solo: semua baris bisa diatur di kartu dan Spesialis otomatis Siap. Online: parasut hanya dari panel Spesialis.
// Mengembalikan update(view); update.dispose() melepas keyboard.
function mountNav4(box, card, send, solo) {
  box.innerHTML = `<div class="pad-extra"><button id="n4-instr">Instrumen (I)</button></div>`;
  card.innerHTML = `
    <div class="card prog4-card">
      <h2>Program pendaratan</h2>
      ${progRowHtml('entry')}
      ${progRowHtml('chute', solo ? {} : { buttons: false, note: 'diatur Spesialis' })}
      ${progRowHtml('retro')}
      <button class="primary big" id="n4-lock">Mulai masuk atmosfer</button>
      <small class="muted" id="n4-note"></small>
    </div>`;
  const $ = (s) => box.querySelector(s) || card.querySelector(s);
  bindProgRows(card, send);
  for (const [id, cmd] of [['#n4-instr', 'instrumentsToggle'], ['#n4-lock', 'lockProgram']]) {
    $(id).onpointerdown = (e) => {
      e.preventDefault();
      if (!$(id).disabled) send(cmd);
    };
  }
  const KEYS = { i: 'instrumentsToggle', u: 'entryDown', o: 'entryUp', j: 'retroDown', l: 'retroUp', enter: 'lockProgram' };
  if (solo) Object.assign(KEYS, { 1: 'chuteDown', 2: 'chuteUp' });
  let view = null;
  const onKey = (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const cmd = KEYS[e.key.toLowerCase()];
    if (!cmd || (e.repeat && (cmd === 'instrumentsToggle' || cmd === 'lockProgram'))) return;
    if (cmd === 'instrumentsToggle' && view !== 'cruise') return; // saat program tombol instrumen disembunyikan
    e.preventDefault();
    send(cmd);
  };
  window.addEventListener('keydown', onKey);
  function update(v) {
    view = v.result ? null : v.view;
    const prog = view === 'program';
    box.style.display = view === 'cruise' ? '' : 'none';
    card.style.display = prog ? '' : 'none';
    if (view === 'cruise') {
      const instr = $('#n4-instr');
      instr.textContent = v.instrumentsOn ? 'Instrumen: MENYALA (matikan) (I)' : 'Instrumen: MATI (nyalakan) (I)';
      instr.className = v.instrumentsOn ? '' : 'primary';
    }
    if (!prog) return;
    const p = v.program;
    // Program butuh instrumen: dinyalakan otomatis. Di solo Spesialis otomatis siap.
    if (!v.instrumentsOn) send('instrumentsToggle');
    if (solo && !p.ready) send('programReady');
    updateProgRows(card, p);
    const lock = $('#n4-lock');
    lock.disabled = !p.ready || !v.instrumentsOn;
    $('#n4-note').innerHTML = !v.hasEdl
      ? '<b style="color:var(--bad)">Tidak ada Paket Pendaratan Mars!</b>'
      : p.ready ? (solo ? 'Enter = mulai' : 'Spesialis siap ✓ · Enter = mulai') : 'Tunggu Spesialis menekan Siap.';
  }
  update.dispose = () => window.removeEventListener('keydown', onKey);
  return update;
}
