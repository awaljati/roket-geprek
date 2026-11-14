// Router layar sederhana. Setiap layar = fungsi (app, el) yang mengisi el dan boleh mengembalikan fungsi bersih-bersih.
import { homeScreen } from './screens/home.js';
import { lobbyScreen } from './screens/lobby.js';
import { rakitScreen } from './screens/rakit.js';
import { flightScreen } from './screens/flight.js';
import { spesialisScreen } from './screens/spesialis.js';
import { debriefScreen } from './screens/debrief.js';

const SCREENS = {
  home: homeScreen,
  lobby: lobbyScreen,
  rakit: rakitScreen,
  flight: flightScreen,
  spesialis: spesialisScreen,
  debrief: debriefScreen,
};

const root = document.getElementById('app');
let cleanup = null;

export const app = {
  role: 'solo', // solo | navigator | spesialis
  code: null,
  room: null,
  level: 1,
  build: { size: '1U', items: ['cs-battery', 'cs-antenna-uhf'], fuel: 0.7 },
  result: null,
  go(name) {
    if (cleanup) cleanup();
    root.innerHTML = '';
    const el = document.createElement('div');
    root.appendChild(el);
    cleanup = SCREENS[name](app, el) || null;
  },
};

window.roketGeprek = app; // memudahkan cek dari console
app.go('home');
