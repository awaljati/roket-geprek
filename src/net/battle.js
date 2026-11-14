// Data mode Battle yang dibagi semua perangkat: status battle (meta) dan tim beserta hasilnya.
// Firebase: battle/<kode>/meta dan battle/<kode>/teams. Tanpa Firebase: localStorage + BroadcastChannel (tes di beberapa tab).
//
//   const b = await openBattle(code);
//   b.onChange(({ meta, teams }) => ...);
//   b.setMeta({ phase: 'playing', level: 1, round: 1 });   // dari layar skor (host)
//   b.join('a', 'navigator', 'Nama Tim');                   // dari pemain
//   b.saveResult('a', 1, result);                           // dari Navigator setelah misi
import { hasFirebase, getFirebase } from './firebase.js';

export const TEAMS = [
  { id: 'a', label: 'Tim Merah', color: '#ff5d5d' },
  { id: 'b', label: 'Tim Biru', color: '#5da9ff' },
  { id: 'c', label: 'Tim Hijau', color: '#3fd17a' },
];
export const teamById = (id) => TEAMS.find((t) => t.id === id);

// Kode room co-op untuk satu tim di dalam battle (Navigator dan Spesialis tim itu).
export const teamChannel = (code, teamId) => `${code}-${teamId}`;

export async function openBattle(code) {
  return hasFirebase ? openFirebaseBattle(code) : openLocalBattle(code);
}

function openLocalBattle(code) {
  const key = 'roket-geprek-battle-' + code;
  const ch = new BroadcastChannel(key);
  const listeners = [];
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key)) || { meta: null, teams: {} };
    } catch (_) {
      return { meta: null, teams: {} };
    }
  };
  const emit = () => listeners.forEach((f) => f(read()));
  const write = (fn) => {
    const s = read();
    fn(s);
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch (_) {}
    ch.postMessage('changed');
    emit();
  };
  ch.onmessage = emit;
  return {
    mode: 'lokal',
    onChange(f) {
      listeners.push(f);
      f(read());
    },
    setMeta: (meta) => write((s) => (s.meta = meta)),
    join: (team, role, name) =>
      write((s) => {
        s.teams[team] = s.teams[team] || { members: {}, results: {} };
        s.teams[team].members[role] = { name, at: Date.now() };
      }),
    saveResult: (team, level, result) =>
      write((s) => {
        s.teams[team] = s.teams[team] || { members: {}, results: {} };
        s.teams[team].results = s.teams[team].results || {};
        s.teams[team].results['level' + level] = result;
      }),
    close: () => ch.close(),
  };
}

async function openFirebaseBattle(code) {
  const { db, fb } = await getFirebase();
  const { ref, set, onValue, off } = fb;
  const root = ref(db, `battle/${code}`);
  return {
    mode: 'online',
    onChange(f) {
      onValue(root, (snap) => {
        const v = snap.val() || {};
        f({ meta: v.meta || null, teams: v.teams || {} });
      });
    },
    setMeta: (meta) => set(ref(db, `battle/${code}/meta`), meta),
    join: (team, role, name) => set(ref(db, `battle/${code}/teams/${team}/members/${role}`), { name, at: Date.now() }),
    saveResult: (team, level, result) => set(ref(db, `battle/${code}/teams/${team}/results/level${level}`), result),
    close: () => off(root),
  };
}

// Mengurutkan tim untuk satu level dan menjelaskan kenapa pemenangnya unggul.
export function rankLevel(teams, level) {
  const rows = TEAMS.filter((t) => teams[t.id])
    .map((t) => ({ team: t, result: (teams[t.id].results || {})['level' + level] || null }))
    .sort((a, b) => (b.result ? b.result.score : -1) - (a.result ? a.result.score : -1));
  const done = rows.filter((r) => r.result);
  let reason = '';
  if (done.length >= 2 && done[0].result.score > 0) {
    const w = done[0].result;
    const others = done.slice(1).map((r) => r.result);
    const why = [];
    if (others.every((o) => w.stars > o.stars)) why.push(`bintang paling banyak (${w.stars})`);
    if (others.every((o) => w.fuelLeft > o.fuelLeft)) why.push(`bahan bakar paling hemat (sisa ${Math.round(w.fuelLeft * 100)}%)`);
    if (level === 2 && others.every((o) => w.photos > o.photos)) why.push(`foto berguna paling banyak (${w.photos})`);
    if (level === 1 && w.orbitErrorPct != null && others.every((o) => o.orbitErrorPct == null || w.orbitErrorPct < o.orbitErrorPct))
      why.push(`orbit paling tepat (meleset ${String(w.orbitErrorPct).replace('.', ',')}%)`);
    if (others.every((o) => !o.success) && w.success) why.push('satu-satunya tim yang berhasil');
    reason = `${done[0].team.label} unggul: ${why.length ? why.join(', ') : 'skor total tertinggi'}.`;
  }
  return { rows, reason };
}

export function totals(teams, levels) {
  return TEAMS.filter((t) => teams[t.id])
    .map((t) => {
      const res = teams[t.id].results || {};
      const total = levels.reduce((s, l) => s + ((res['level' + l] && res['level' + l].score) || 0), 0);
      return { team: t, total };
    })
    .sort((a, b) => b.total - a.total);
}
