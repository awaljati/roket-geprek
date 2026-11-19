// Router layar sederhana. Setiap layar = fungsi (app, el) yang mengisi el dan boleh mengembalikan fungsi bersih-bersih.
import { homeScreen } from './screens/home.js';
import { lobbyScreen } from './screens/lobby.js';
import { rakitScreen } from './screens/rakit.js';
import { levelsScreen } from './screens/levels.js';
import { flightScreen } from './screens/flight.js';
import { spesialisScreen } from './screens/spesialis.js';
import { debriefScreen } from './screens/debrief.js';
import { startI18n } from './i18n.js';
import { startMusic } from './music.js';

const SCREENS = {
  home: homeScreen,
  lobby: lobbyScreen,
  levels: levelsScreen,
  rakit: rakitScreen,
  flight: flightScreen,
  spesialis: spesialisScreen,
  debrief: debriefScreen,
};

const root = document.getElementById('app');
let cleanup = null;

// Layar "induk" untuk tombol Back: Back tidak menutup web, tapi kembali satu layar.
const PARENT = { lobby: 'home', levels: 'lobby', rakit: 'levels', flight: 'rakit', debrief: 'rakit', spesialis: 'lobby' };
let current = null;

export const app = {
  role: 'solo', // solo | navigator | spesialis
  code: null,
  room: null,
  level: 1,
  build: { size: '1U', items: ['cs-battery', 'cs-antenna-uhf'], fuel: 0.7 },
  result: null,
  onBack: null,
  go(name, { fromBack = false } = {}) {
    if (!fromBack) history.pushState({ screen: name }, '');
    current = name;
    if (cleanup) cleanup();
    root.innerHTML = '';
    const el = document.createElement('div');
    root.appendChild(el);
    cleanup = SCREENS[name](app, el) || null;
  },
  // Gambar ulang layar yang sedang tampil (mis. setelah progres dihapus di Pengaturan).
  refresh() {
    if (current) app.go(current, { fromBack: true });
  },
};

window.addEventListener('popstate', () => {
  // Layar terbang menangani Back sendiri (membuka menu jeda).
  if (app.onBack && app.onBack()) {
    history.pushState({ screen: current }, '');
    return;
  }
  const parent = PARENT[current];
  if (parent) {
    history.pushState({ screen: parent }, '');
    app.go(parent, { fromBack: true });
  }
});

window.roketGeprek = app; // memudahkan cek dari console
startI18n();
startMusic();
history.replaceState({ screen: 'home' }, '');
app.go('home', { fromBack: true });
