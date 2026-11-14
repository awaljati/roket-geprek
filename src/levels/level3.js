// Level 3: Kutub Selatan Bulan (terinspirasi Artemis III). Tahap pertama: inti pendaratan.
//
// Tampilan samping: permukaan Bulan berupa garis berbukit (y = ketinggian, x = jarak menyamping).
// Misi dimulai di orbit rendah Bulan, tanpa peluncuran dari Bumi.
//
// Model "orbit datar": permukaan dianggap datar, tapi gravitasi efektif berkurang kalau pendarat bergerak
// menyamping cepat: g_efektif = g * (1 - (vx / orbitSpeed)^2). Pada kecepatan orbit pendarat tidak jatuh.
// Pemain harus mengerem kecepatan menyamping (deorbit), lalu turun pelan dan tegak.
// Tanpa atmosfer: tidak ada parasut atau pelindung panas, semua pengereman dari mesin.
//
// Fase: orbit -> descent -> landed -> done

import { applyControls } from '../engine/attitude.js';
import { stepLanderAssist, targetDescent } from '../engine/landerAssist.js';
import { EARTH } from '../engine/flight.js';
import { makeRng } from '../engine/rng.js';
import { LEVELS, ROCKETS, BODIES } from '../data/levels.js';
import { missionReward } from './reward.js';
import { itemById, ITEMS } from '../data/items.js';

const L = LEVELS[3];
const DEG = Math.PI / 180;
// Gravitasi permukaan Bumi dalam satuan game (gm / r^2), lalu 1/6 untuk Bulan.
export const MOON_G = (EARTH.gm / (EARTH.radius * EARTH.radius)) * L.moonGravityShare;

// ---------- Rakit ----------
export const RAKIT_ITEMS = ITEMS.filter((it) => !it.cubesat && it.id !== 'fuel' && it.level <= 3);
export const DEFAULT_BUILD = { items: ['lander-engine', 'battery', 'panel-s', 'antenna-s'], fuel: 0.7, assist: true };

export function buildCheck(build) {
  const body = BODIES[L.body];
  const items = build.items.map(itemById);
  const fuelMass = Math.round(build.fuel * 10) * itemById('fuel').mass;
  const mass = body.mass + items.reduce((m, it) => m + it.mass, 0) + fuelMass;
  const price = items.reduce((p, it) => p + it.price, 0) + Math.round(build.fuel * 10) * itemById('fuel').price;
  const cap = ROCKETS[L.rocket].capacityKg;
  const missingEngine = !build.items.includes(L.requiredItem);
  return {
    mass,
    massLimit: cap,
    price,
    budget: L.budget + (build.extraBudget || 0),
    extraBudget: build.extraBudget || 0,
    slotsUsed: items.length,
    slots: 6,
    tooHeavy: mass > cap,
    overBudget: price > L.budget + (build.extraBudget || 0),
    tooManyItems: items.length > 6,
    missingEngine,
    // Peringatan tetap boleh diluncurkan, supaya pemain melihat akibatnya di Debrief.
    warn: missingEngine ? `Tanpa ${itemById(L.requiredItem).name.toLowerCase()}, pendarat tidak bisa mengerem (F-CRASH).` : null,
  };
}

// ---------- Permukaan ----------
function makeTerrain(rng) {
  const waves = L.terrain.map(([amp, len]) => ({ amp, k: (2 * Math.PI) / len, ph: rng() * 2 * Math.PI }));
  return (x) => waves.reduce((h, w) => h + w.amp * Math.sin(x * w.k + w.ph), 0);
}

// ---------- Mulai ----------
export function createLevel3(build, seed = 'solo') {
  const rng = makeRng(seed + '-L3');
  const check = buildCheck(build);
  const massRatio = Math.max(1, check.mass / L.refMassKg);
  const game = {
    level: 3,
    build,
    check,
    phase: 'orbit',
    assist: build.assist !== false,
    coach: null,
    terrainSeed: seed,
    terrain: makeTerrain(rng),
    t: 0,
    craft: { x: 0, y: L.startAltitude, vx: L.orbitSpeed, vy: 0, angle: 0 },
    hasEngine: !check.missingEngine,
    massRatio,
    maxAccel: (L.thrustToWeight * MOON_G) / massRatio,
    hoverThrottle: massRatio / L.thrustToWeight,
    fuel: build.fuel,
    thrusting: false,
    touchdown: null,
    landedT: 0,
    log: ['Pendarat di orbit rendah Bulan, di atas wilayah kutub selatan.'],
    result: null,
    trail: [],
  };
  if (check.tooHeavy) return finish(game, false, 'F-HEAVY');
  if (!game.hasEngine) {
    game.log.push('Tidak ada mesin pendarat: pendarat tidak bisa mengerem dan jatuh.');
    return finish(game, false, 'F-CRASH');
  }
  return game;
}

function altitude(game) {
  return game.craft.y - game.terrain(game.craft.x);
}

// ---------- Langkah per frame ----------
export function stepLevel3(game, ctrl, rawDt) {
  if (game.result) return game;
  const dt = rawDt * L.timeScale;

  if (game.phase === 'landed') {
    game.landedT += rawDt;
    if (game.landedT >= L.landedHoldSec) finishLanded(game);
    return game;
  }

  game.t += dt;
  const c = game.craft;
  const alt = altitude(game);

  if (game.assist && ctrl) {
    const a = stepLanderAssist({ alt, vx: c.vx, vy: c.vy, hoverThrottle: game.hoverThrottle, fuel: game.fuel, phase: game.phase }, ctrl);
    game.coach = { msg: a.msg, urgent: a.urgent };
  }
  const throttle = ctrl ? applyControls(ctrl, c, L.turnRate, dt) : 0;
  game.thrusting = throttle > 0 && game.fuel > 0;

  let ax = 0;
  let ay = -MOON_G * Math.max(0, 1 - (c.vx / L.orbitSpeed) ** 2);
  if (game.thrusting) {
    const a = game.maxAccel * throttle;
    ax += Math.sin(c.angle) * a;
    ay += Math.cos(c.angle) * a;
    game.fuel = Math.max(0, game.fuel - L.fuelBurnPerSec * throttle * dt);
    if (game.fuel === 0) game.log.push('Bahan bakar habis!');
    if (game.phase === 'orbit') {
      game.phase = 'descent';
      game.log.push('Mesin menyala: mengerem, keluar dari orbit.');
    }
  }
  c.vx += ax * dt;
  c.vy += ay * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (game.trail.length === 0 || game.t - game.trail[game.trail.length - 1].t > 0.2) {
    game.trail.push({ x: c.x, y: c.y, t: game.t });
    if (game.trail.length > 200) game.trail.shift();
  }

  // Menyentuh permukaan
  const ground = game.terrain(c.x);
  if (c.y <= ground) {
    c.y = ground;
    const speed = Math.hypot(c.vx, c.vy);
    const tilt = Math.abs(Math.atan2(Math.sin(c.angle), Math.cos(c.angle))) / DEG;
    game.touchdown = { speed: +speed.toFixed(2), tiltDeg: Math.round(tilt) };
    game.thrusting = false;
    if (ctrl) ctrl.throttle = 0;
    if (speed > L.maxLandingSpeed || tilt > L.maxLandingTiltDeg) {
      c.crashed = true;
      game.log.push(
        speed > L.maxLandingSpeed
          ? `Terlalu cepat: ${speed.toFixed(1)} u/s (maks. ${L.maxLandingSpeed}). Pendarat hancur.`
          : `Terlalu miring: ${Math.round(tilt)}° (maks. ${L.maxLandingTiltDeg}°). Pendarat terguling.`,
      );
      return finish(game, false, 'F-CRASH');
    }
    c.vx = c.vy = 0;
    game.phase = 'landed';
    game.coach = { msg: 'Mendarat! Pendarat sudah berdiri di kutub selatan Bulan.', urgent: false };
    game.log.push(`Mendarat dengan selamat: ${speed.toFixed(1)} u/s, miring ${Math.round(tilt)}°.`);
  }
  return game;
}

// ---------- Perintah Spesialis ----------
// Tahap pertama belum ada tombol wahana khusus (spektrometer dan panel menyusul).
export function command(game) {
  return game;
}

// ---------- Selesai ----------
function finishLanded(game) {
  finish(game, true, null);
}

function finish(game, success, failCode) {
  const fuelLeft = game.fuel;
  let stars = 0;
  if (success) stars = 2;
  if (success && fuelLeft >= L.minFuelFor3Stars && !game.check.overBudget) stars = 3;
  const score = success ? stars * 1000 + Math.round(fuelLeft * 500) + Math.max(0, (L.budget - game.check.price) * 5) : 0;
  const reward = missionReward({ success, stars, budget: game.check.budget, price: game.check.price });
  game.result = {
    success,
    failCode,
    stars,
    score,
    fuelLeft,
    photos: 0,
    reward,
    landingSpeed: game.touchdown ? game.touchdown.speed : null,
    landingTiltDeg: game.touchdown ? game.touchdown.tiltDeg : null,
  };
  game.phase = 'done';
  return game;
}

// ---------- Untuk tampilan dan Spesialis ----------
export function snapshotLevel3(game, withPaths = true) {
  const c = game.craft;
  const alt = altitude(game);
  // Permukaan dikirim sebagai titik-titik di sekitar pendarat (tampilan tidak menghitung permukaan sendiri).
  const half = Math.max(160, Math.min(1400, alt * 1.8 + 120));
  const n = withPaths ? 160 : 60;
  const terrain = [];
  for (let i = 0; i <= n; i++) {
    const x = c.x - half + (2 * half * i) / n;
    terrain.push({ x: Math.round(x * 10) / 10, y: Math.round(game.terrain(x) * 10) / 10 });
  }
  const tilt = Math.atan2(Math.sin(c.angle), Math.cos(c.angle)) / DEG;
  return {
    level: 3,
    phase: game.phase,
    t: game.t,
    craft: { x: c.x, y: c.y, angle: c.angle, thrusting: game.thrusting, crashed: !!c.crashed },
    altitude: Math.max(0, alt),
    vDown: -c.vy,
    vSide: c.vx,
    tiltDeg: tilt,
    targetDescent: targetDescent(alt),
    hoverThrottle: game.hoverThrottle,
    fuel: game.fuel,
    hasEngine: game.hasEngine,
    maxLandingSpeed: L.maxLandingSpeed,
    maxLandingTiltDeg: L.maxLandingTiltDeg,
    touchdown: game.touchdown,
    terrain,
    trail: withPaths ? game.trail : [],
    lastLog: game.log[game.log.length - 1] || '',
    coach: game.assist ? game.coach : null,
    result: game.result,
  };
}
