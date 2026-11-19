// Musik latar: satu lagu berulang untuk semua layar.
// Browser melarang suara sebelum pemain menyentuh halaman, jadi musik baru mulai setelah klik/tap/tombol pertama.
// Pilihan Nyala/Mati disimpan di browser (menu Pengaturan). Musik berhenti sementara saat tab disembunyikan.

const KEY = 'roket-geprek-musik';
const SRC = '/assets/music/background.mp3';
const VOLUME = 0.4;

let audio = null;
let unlocked = false;

export function musicOn() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch (_) {
    return true;
  }
}

function sync() {
  if (!audio) return;
  if (musicOn() && unlocked && !document.hidden) audio.play().catch(() => {});
  else audio.pause();
}

export function setMusicOn(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch (_) {}
  sync();
}

export function startMusic() {
  if (audio) return;
  audio = new Audio(SRC);
  audio.loop = true;
  audio.volume = VOLUME;
  audio.preload = 'auto';
  const unlock = () => {
    unlocked = true;
    sync();
    ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.removeEventListener(t, unlock, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, unlock, true));
  document.addEventListener('visibilitychange', sync);
}
