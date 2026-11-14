// Level 1: CubeSat Transmisi.
// Fase: launch -> release -> countdown -> deploy -> transmit -> selesai.
// Semua aturan Level 1 ada di sini; tampilan cukup membaca `game` dan memanggil command().

import { createFlight, stepFlight, EARTH } from '../engine/flight.js';
import { LEVELS, CUBESAT_SIZES } from '../data/levels.js';
import { itemById } from '../data/items.js';

const L = LEVELS[1];
const WH_PER_WATT_SECOND = 0.1; // skala daya game supaya terasa dalam hitungan detik

export function buildCheck(build) {
  const size = CUBESAT_SIZES[build.size];
  const items = build.items.map(itemById);
  const mass = size.bodyMass + items.reduce((m, it) => m + it.mass, 0);
  const price = items.reduce((p, it) => p + it.price, 0) + Math.round(build.fuel * 10) * itemById('fuel').price;
  return {
    mass,
    massLimit: size.massLimit,
    slotsUsed: items.length,
    slots: size.slots,
    price,
    budget: L.budget,
    tooHeavy: mass > size.massLimit,
    overBudget: price > L.budget,
    tooManyItems: items.length > size.slots,
  };
}

export function createLevel1(build) {
  const size = CUBESAT_SIZES[build.size];
  const items = build.items.map(itemById);
  const has = (id) => build.items.includes(id);
  const check = buildCheck(build);

  const game = {
    level: 1,
    build,
    check,
    phase: 'launch',
    flight: createFlight({ planet: EARTH, fuel: build.fuel, orbitHoldSec: L.orbitHoldSec }),
    countdown: L.safeCountdownSec,
    panelsOpen: false,
    antennaOpen: false,
    transmitting: false,
    battery: Math.max(2, items.reduce((s, it) => s + it.storeWh, 0)),
    batteryMax: Math.max(2, items.reduce((s, it) => s + it.storeWh, 0)),
    data: 0,
    passIndex: 0,
    passTimer: 0, // detik sejak fase transmit mulai
    inPass: false,
    log: [],
    result: null,
    // nilai turunan
    basePower: size.basePower,
    hasFoldPanel: has('cs-panel-fold'),
    hasUhf: has('cs-antenna-uhf'),
    dataRate: items.reduce((s, it) => s + (it.data || 0), 0),
  };

  if (check.tooHeavy) finish(game, false, 'F-HEAVY');
  if (game.dataRate === 0) game.log.push('Tidak ada antena: sinyal tidak akan bisa dikirim.');
  return game;
}

function netPower(game) {
  let w = game.basePower;
  for (const it of game.build.items.map(itemById)) {
    if (it.id === 'cs-panel-fold') w += game.panelsOpen ? it.power : 0;
    else if (it.id.startsWith('cs-antenna')) w += game.transmitting ? it.power : 0;
    else w += it.power;
  }
  return w;
}

export function stepLevel1(game, ctrl, dt) {
  if (game.result) return game;

  if (game.phase === 'launch' || game.phase === 'release') {
    stepFlight(game.flight, ctrl, dt);
    if (game.flight.failCode) return finish(game, false, game.flight.failCode);
    if (game.phase === 'launch' && game.flight.status === 'orbit') {
      game.phase = 'release';
      game.log.push('Orbit tercapai. Spesialis: lepaskan CubeSat.');
    }
    return game;
  }

  // Setelah dilepas, CubeSat tetap mengorbit (tanpa dorongan).
  stepFlight(game.flight, null, dt);

  game.battery = Math.min(game.batteryMax, game.battery + netPower(game) * WH_PER_WATT_SECOND * dt);
  if (game.battery <= 0) return finish(game, false, 'F-POWER');

  if (game.phase === 'countdown') {
    game.countdown = Math.max(0, game.countdown - dt);
    if (game.countdown === 0) {
      game.phase = 'deploy';
      game.log.push('Hitung mundur selesai. Buka panel dan antena.');
    }
    return game;
  }

  if (game.phase === 'deploy' || game.phase === 'transmit') {
    // Jadwal lintasan stasiun Bumi dimulai begitu hitung mundur selesai.
    game.passTimer += dt;
    const cycle = L.nextPassSec + L.passWindowSec;
    const tInCycle = game.passTimer % cycle;
    game.passIndex = Math.floor(game.passTimer / cycle);
    game.inPass = tInCycle >= L.nextPassSec;
    game.secondsToPass = game.inPass ? 0 : L.nextPassSec - tInCycle;
    game.secondsLeftInPass = game.inPass ? cycle - tInCycle : 0;

    if (game.transmitting && game.inPass && antennaReady(game)) {
      game.data = Math.min(L.dataForFullSignal, game.data + game.dataRate * dt);
    }
    if (game.data >= L.dataForFullSignal) return finish(game, true, null);

    // Misi berakhir setelah lintasan kedua selesai.
    if (game.passIndex >= 2) {
      if (game.data > 0) return finish(game, true, 'P-SIGNAL');
      return finish(game, false, game.hasFoldPanel && !game.panelsOpen ? 'F-PANEL' : 'P-SIGNAL');
    }
  }
  return game;
}

function antennaReady(game) {
  return game.hasUhf ? game.antennaOpen : game.dataRate > 0;
}

// Perintah dari Spesialis (atau Navigator di mode solo).
export function command(game, cmd) {
  if (game.result) return game;
  switch (cmd) {
    case 'release':
      if (game.phase === 'launch') return finish(game, false, 'F-DEPLOY');
      if (game.phase === 'release') {
        game.phase = 'countdown';
        game.releasedOnce = true;
        game.log.push('CubeSat dilepas dari dispenser. Tunggu hitung mundur.');
      }
      break;
    case 'deployPanels':
    case 'deployAntenna':
    case 'transmit':
      if (game.phase === 'countdown') return finish(game, false, 'F-EARLY');
      if (game.phase === 'launch' || game.phase === 'release') break;
      if (cmd === 'deployPanels' && game.hasFoldPanel) game.panelsOpen = true;
      if (cmd === 'deployAntenna' && game.hasUhf) game.antennaOpen = true;
      if (cmd === 'transmit') game.transmitting = !game.transmitting;
      if (game.phase === 'deploy' && (game.antennaOpen || !game.hasUhf)) game.phase = 'transmit';
      break;
  }
  return game;
}

function finish(game, success, failCode) {
  const fuelLeft = game.flight.fuel;
  const full = success && !failCode;
  let stars = 0;
  if (success) stars = full ? 2 : 1;
  if (full && game.passIndex === 0 && fuelLeft >= L.minFuelFor3Stars && !game.check.overBudget) stars = 3;
  const score = stars * 1000 + Math.round(fuelLeft * 500) + Math.max(0, (L.budget - game.check.price) * 10);
  game.result = { success, failCode, stars, score: success ? score : 0, fuelLeft, photos: 0 };
  game.phase = 'done';
  return game;
}

// Data ringkas untuk tampilan dan untuk dikirim ke perangkat Spesialis.
export function snapshotLevel1(game, withTrail = true) {
  const f = game.flight;
  return {
    level: 1,
    phase: game.phase,
    released: !!game.releasedOnce,
    flight: {
      x: f.x, y: f.y, vx: f.vx, vy: f.vy, angle: f.angle, fuel: f.fuel,
      status: f.status, thrusting: !!f.thrusting, inRing: !!f.inRing, inRingFor: f.inRingFor,
      trail: withTrail ? f.trail : [],
    },
    countdown: game.countdown,
    panelsOpen: game.panelsOpen,
    antennaOpen: game.antennaOpen,
    transmitting: game.transmitting,
    hasFoldPanel: game.hasFoldPanel,
    hasUhf: game.hasUhf,
    battery: game.battery,
    batteryMax: game.batteryMax,
    data: game.data,
    dataTarget: L.dataForFullSignal,
    inPass: game.inPass,
    secondsToPass: game.secondsToPass ?? null,
    secondsLeftInPass: game.secondsLeftInPass ?? null,
    lastLog: game.log[game.log.length - 1] || '',
    result: game.result,
  };
}
