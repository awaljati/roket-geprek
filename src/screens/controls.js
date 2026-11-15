// Pemetaan keyboard dan tombol layar -> aksi kendali (lihat engine/attitude.js).
// Semua aksi cukup diketuk, tidak perlu ditahan.

export const KEYMAP = {
  w: 'throttleUp',
  arrowup: 'throttleUp',
  s: 'throttleDown',
  arrowdown: 'throttleDown',
  ' ': 'engineToggle',
  x: 'engineCut',
  f: 'pulse',
  a: 'turnLeft',
  arrowleft: 'turnLeft',
  d: 'turnRight',
  arrowright: 'turnRight',
  q: 'prograde',
  e: 'retrograde',
  z: 'left',
  c: 'right',
  t: 'warp',
};

export const HELP = [
  ['W / S', 'gas naik / turun 25%'],
  ['Spasi', 'mesin nyala / mati'],
  ['X', 'matikan mesin'],
  ['F', 'dorongan pendek'],
  ['A / D', 'putar 15°'],
  ['Q', 'arahkan searah gerak'],
  ['E', 'arahkan lawan arah gerak'],
  ['Z / C', 'arahkan ke kiri / kanan jalur (koreksi MCC)'],
  ['T', 'percepat waktu (saat mesin mati)'],
];

// Tombol layar untuk HP / mouse. Tombol utama (gas dan mesin) dibuat besar.
const LABELS = {
  turnLeft: '⟲ 15°',
  turnRight: '⟳ 15°',
  prograde: 'Searah gerak',
  retrograde: 'Lawan arah',
  left: 'Kiri jalur',
  right: 'Kanan jalur',
  warp: 'Percepat ⏩',
  pulse: 'Dorong pendek',
  throttleDown: 'Gas −',
  throttleUp: 'Gas +',
  engineCut: 'Mesin mati',
};
const MAIN = ['throttleDown', 'throttleUp', 'engineCut'];
export const BUTTON_SETS = {
  basic: [],
  manual: ['turnLeft', 'turnRight', 'prograde', 'retrograde'],
  moon: ['turnLeft', 'turnRight', 'prograde', 'left', 'right', 'retrograde', 'pulse', 'warp'],
  moonAssist: ['warp'],
  lander: ['turnLeft', 'turnRight', 'retrograde', 'pulse'],
  // Level 3 tanpa bantuan: peluncuran, mengerem masuk orbit Bulan, lalu mendarat.
  lunar: ['turnLeft', 'turnRight', 'prograde', 'retrograde', 'pulse', 'warp'],
};

// Memasang keyboard + tombol. onAction(action) dipanggil per ketukan.
export function bindControls(buttonBox, onAction, set = 'manual') {
  const extra = BUTTON_SETS[set] || [];
  buttonBox.innerHTML =
    `<div class="pad-main">${MAIN.map((a) => `<button class="big ${a === 'throttleUp' ? 'primary' : ''}" data-a="${a}">${LABELS[a]}</button>`).join('')}</div>` +
    (extra.length ? `<div class="pad-extra">${extra.map((a) => `<button data-a="${a}">${LABELS[a]}</button>`).join('')}</div>` : '');
  buttonBox.querySelectorAll('button').forEach((b) => {
    // pointerdown supaya langsung bereaksi di layar sentuh
    b.onpointerdown = (e) => {
      e.preventDefault();
      onAction(b.dataset.a);
    };
  });
  const onKey = (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const action = KEYMAP[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    // Putar boleh diulang saat tombol ditahan; aksi lain hanya sekali per ketukan.
    if (e.repeat && action !== 'turnLeft' && action !== 'turnRight') return;
    onAction(action);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

export function helpHtml() {
  return HELP.map(([k, t]) => `<span><b>${k}</b> ${t}</span>`).join('');
}
