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

// Tombol layar untuk HP / mouse.
export const BUTTONS = [
  ['turnLeft', '⟲ 15°'],
  ['turnRight', '⟳ 15°'],
  ['prograde', 'Searah gerak'],
  ['retrograde', 'Lawan arah'],
  ['left', 'Kiri jalur'],
  ['right', 'Kanan jalur'],
  ['warp', 'Percepat'],
  ['throttleDown', 'Gas −'],
  ['throttleUp', 'Gas +'],
  ['pulse', 'Dorong pendek'],
  ['engineCut', 'Mesin mati'],
];

// Memasang keyboard + tombol. onAction(action) dipanggil per ketukan.
export function bindControls(buttonBox, onAction) {
  buttonBox.innerHTML = BUTTONS.map(([a, label]) => `<button data-a="${a}">${label}</button>`).join('');
  buttonBox.querySelectorAll('button').forEach((b) => (b.onclick = () => onAction(b.dataset.a)));
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
