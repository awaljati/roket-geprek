// Level 2: Memutari Bulan dan Pulang (terinspirasi Artemis II).
//
// Model "jalur + penyimpangan": kapsul mengikuti lintasan free return nominal (hasil simulasi fisika Bumi-Bulan),
// ditambah penyimpangan menyamping `dev` yang tumbuh sendiri (devRate) kalau tidak dikoreksi.
// Dorongan menyamping (kapsul diputar ke kiri/kanan jalur) mengubah devRate. Koreksi awal butuh dorongan kecil,
// koreksi terlambat butuh dorongan besar: itu pelajaran utama level ini.
//
// Fase: tli -> outbound (MCC-1, MCC-2) -> flyby (foto) -> return (MCC pulang) -> entry -> splash -> done

import { CISLUNAR, stepBody, predict } from '../engine/cislunar.js';
import { applyControls } from '../engine/attitude.js';
import { createFlight, stepFlight, EARTH, positionAngle } from '../engine/flight.js';
import { createAssist, stepAssist } from '../engine/assist.js';
import { makeRng } from '../engine/rng.js';
import { LEVELS, ROCKETS, BODIES, REWARD } from '../data/levels.js';
import { missionReward } from './reward.js';
import { itemById, ITEMS } from '../data/items.js';

const L = LEVELS[2];
const DEG = Math.PI / 180;
const TURN_RATE = 1.6;
const WH_PER_WATT_SECOND = 0.02;

// ---------- Lintasan nominal (dihitung sekali) ----------
const START = { theta: 168 * DEG, speed: 105 };
let NOMINAL = null;
function nominal() {
  if (NOMINAL) return NOMINAL;
  const r0 = CISLUNAR.parkingRadius;
  const s = {
    x: Math.sin(START.theta) * r0,
    y: Math.cos(START.theta) * r0,
    vx: Math.cos(START.theta) * START.speed,
    vy: -Math.sin(START.theta) * START.speed,
  };
  const dt = 1 / 30;
  const pts = [];
  const bodies = [CISLUNAR.earth, CISLUNAR.moon];
  let t = 0;
  let flyT = 0;
  let flyD = Infinity;
  while (t < 200) {
    pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
    const dm = Math.hypot(s.x - CISLUNAR.moon.x, s.y - CISLUNAR.moon.y);
    if (dm < flyD) {
      flyD = dm;
      flyT = t;
    }
    if (t > 20 && Math.hypot(s.x, s.y) <= CISLUNAR.atmosphere) break;
    stepBody(s, bodies, 0, 0, dt);
    t += dt;
  }
  NOMINAL = { pts, dt, flybyT: flyT, entryT: t, flybyDist: flyD - CISLUNAR.moon.radius };
  return NOMINAL;
}

function sampleAt(t) {
  const n = nominal();
  const i = Math.max(0, Math.min(n.pts.length - 2, Math.floor(t / n.dt)));
  const a = n.pts[i];
  const b = n.pts[i + 1];
  const f = Math.max(0, Math.min(1, (t - a.t) / n.dt));
  const x = a.x + (b.x - a.x) * f;
  const y = a.y + (b.y - a.y) * f;
  const vx = a.vx + (b.vx - a.vx) * f;
  const vy = a.vy + (b.vy - a.vy) * f;
  const v = Math.hypot(vx, vy);
  // normal kiri dari arah gerak
  return { x, y, vx, vy, nx: -vy / v, ny: vx / v, heading: Math.atan2(vx, vy) };
}

function posAt(t, dev) {
  const s = sampleAt(t);
  return { x: s.x + s.nx * dev, y: s.y + s.ny * dev, s };
}

function moonSurfaceDist(p) {
  return Math.hypot(p.x - CISLUNAR.moon.x, p.y - CISLUNAR.moon.y) - CISLUNAR.moon.radius;
}

// Perkiraan jarak terdekat ke permukaan Bulan dan sudut masuk atmosfer kalau tidak ada koreksi lagi.
function forecast(game, devNow = game.dev, rateNow = game.devRate, extraBack = 0) {
  const n = nominal();
  const devAt = (t) => devNow + rateNow * (t - game.t) + (t > n.flybyT ? extraBack * (t - Math.max(n.flybyT, game.t)) : 0);
  let closest = Infinity;
  if (game.t <= n.flybyT + 2) {
    for (let t = Math.max(game.t, n.flybyT - 6); t <= n.flybyT + 6; t += 0.1) {
      closest = Math.min(closest, moonSurfaceDist(posAt(t, devAt(t))));
    }
  }
  const e = sampleAt(n.entryT);
  const rHat = { x: e.x / Math.hypot(e.x, e.y), y: e.y / Math.hypot(e.x, e.y) };
  const outward = devAt(n.entryT) * (e.nx * rHat.x + e.ny * rHat.y);
  // menjauh dari Bumi -> lebih landai (angka naik), mendekat -> lebih curam
  const entryAngle = NOMINAL_ENTRY_DEG + 0.15 * outward;
  return { closest, entryAngle, devAtEntry: devAt(n.entryT) };
}
const NOMINAL_ENTRY_DEG = -8;
const FLYBY_AIM = 35; // jarak terdekat ideal (u dari permukaan)

// Saran arah dorongan untuk Spesialis: 'left' | 'right' | null (sudah pas).
// Dorong ke kiri jalur menaikkan devRate, ke kanan menurunkannya.
export function advice(game, tight = false) {
  if (!['outbound', 'flyby', 'return'].includes(game.phase)) return { dir: null, ok: true };
  const n = nominal();
  const before = game.t < n.flybyT - 1;
  const metric = (rate) => {
    const f = forecast(game, game.dev, rate);
    return before ? Math.abs(f.closest - FLYBY_AIM) : Math.abs(f.entryAngle - NOMINAL_ENTRY_DEG);
  };
  const f = forecast(game);
  const ok = before
    ? Math.abs(f.closest - FLYBY_AIM) <= (tight ? 6 : 15)
    : tight
      ? Math.abs(f.entryAngle - NOMINAL_ENTRY_DEG) <= 0.8
      : f.entryAngle >= L.entryCorridorDeg[0] + 1 && f.entryAngle <= L.entryCorridorDeg[1] - 1;
  if (ok) return { dir: null, ok: true };
  const up = metric(game.devRate + 0.05);
  const down = metric(game.devRate - 0.05);
  return { dir: up < down ? 'left' : 'right', ok: false };
}

// ---------- Rakit ----------
export function buildCheck(build) {
  const body = BODIES[L.body];
  const items = build.items.map(itemById);
  const fuelMass = Math.round(build.fuel * 10) * itemById('fuel').mass;
  const mass = body.mass + items.reduce((m, it) => m + it.mass, 0) + fuelMass;
  const price = items.reduce((p, it) => p + it.price, 0) + Math.round(build.fuel * 10) * itemById('fuel').price;
  const cap = ROCKETS[L.rocket].capacityKg;
  return {
    mass,
    massLimit: cap,
    price,
    budget: L.budget + (build.extraBudget || 0), // + dana cadangan yang dipakai
    extraBudget: build.extraBudget || 0,
    slotsUsed: items.length,
    slots: 6,
    tooHeavy: mass > cap,
    overBudget: price > L.budget + (build.extraBudget || 0),
    tooManyItems: items.length > 6,
  };
}

export const RAKIT_ITEMS = ITEMS.filter((it) => !it.cubesat && it.id !== 'fuel' && it.level <= 2);
export const DEFAULT_BUILD = { items: ['battery', 'panel-s', 'antenna-s', 'camera', 'heatshield'], fuel: 0.6, assist: true };

// ---------- Mulai ----------
export function createLevel2(build, seed = 'solo') {
  const rng = makeRng(seed + '-L2');
  const items = build.items.map(itemById);
  const has = (id) => build.items.includes(id);
  const check = buildCheck(build);
  const between = ([a, b]) => a + (b - a) * rng();
  const sign = () => (rng() < 0.5 ? -1 : 1);
  const store = items.reduce((s, it) => s + it.storeWh, 0) + 40; // kapsul punya baterai kecil bawaan

  const game = {
    level: 2,
    build,
    check,
    phase: 'launch',
    // Peluncuran dari Bumi ke orbit parkir memakai engine yang sama dengan Level 1.
    // Bahan bakar roket terpisah dari bahan bakar kapsul (slider di Rakit = bahan bakar kapsul untuk MCC).
    flight: createFlight({ planet: EARTH, fuel: 1, orbitHoldSec: 3 }),
    assist: build.assist !== false,
    launchAssist: build.assist !== false ? createAssist() : null,
    tliArmed: false,
    coach: null,
    holdThrust: false,
    t: 0,
    dev: 0,
    devRate: sign() * between(L.driftOut),
    driftBack: sign() * between(L.driftBack),
    craft: { x: 0, y: CISLUNAR.parkingRadius, vx: 0, vy: 0, angle: 0 },
    parkingAngle: START.theta - 0.6,
    fuel: build.fuel,
    massRatio: Math.max(1, check.mass / 900),
    thrusting: false,
    panelsOpen: false,
    hasCamera: has('camera'),
    hasShield: has('heatshield'),
    battery: store,
    batteryMax: store,
    panelPower: items.reduce((s, it) => s + (it.deployable && it.power > 0 ? it.power : 0), 0),
    basePower: BODIES[L.body].basePower + items.reduce((s, it) => s + (!it.deployable && it.power < 0 && it.id !== 'camera' ? it.power : 0), 0),
    photos: 0,
    photoAttempts: 0,
    lastPhoto: null,
    photoCooldown: 0,
    closestMoon: Infinity,
    signalLost: false,
    entry: null,
    splashT: 0,
    log: ['Luncurkan roket dari Bumi ke orbit parkir.'],
    result: null,
    trail: [],
  };
  if (check.tooHeavy) finish(game, false, 'F-HEAVY');
  return game;
}

function mccWindow(t) {
  return L.mccWindows.find((w) => t >= w.from && t <= w.to) || null;
}

// ---------- Langkah per frame ----------
export function stepLevel2(game, ctrl, dt) {
  if (game.result) return game;
  const n = nominal();

  if (game.phase === 'launch') {
    const fdt = dt * LEVELS[1].launchTimeScale;
    if (game.launchAssist && ctrl) {
      stepAssist(game.launchAssist, game.flight, ctrl);
      game.coach = { msg: game.launchAssist.msg, urgent: game.launchAssist.urgent };
    }
    stepFlight(game.flight, ctrl, fdt);
    syncCraftFromFlight(game);
    if (game.flight.failCode) return finish(game, false, game.flight.failCode);
    if (game.flight.status === 'orbit') {
      game.phase = 'tli';
      if (ctrl) {
        ctrl.throttle = 0;
        ctrl.mode = 'prograde';
      }
      game.log.push('Orbit parkir tercapai. Tekan Gas + untuk berangkat ke Bulan (TLI).');
    }
    return game;
  }

  if (game.phase === 'tli') {
    // Kapsul mengorbit Bumi. TLI dijalankan saat kapsul tiba di titik berangkat yang tepat.
    stepFlight(game.flight, null, dt);
    syncCraftFromFlight(game);
    if (ctrl && (ctrl.throttle > 0 || ctrl.pulseLeft > 0) && !game.tliArmed) {
      game.tliArmed = true;
      game.log.push('TLI dijadwalkan: menunggu kapsul tiba di titik berangkat.');
    }
    if (ctrl) {
      ctrl.throttle = 0;
      ctrl.pulseLeft = 0;
    }
    const f = game.flight;
    const omega = Math.hypot(f.vx, f.vy) / Math.hypot(f.x, f.y);
    let diff = START.theta - positionAngle(f);
    diff = ((diff % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    game.secondsToTli = diff / omega;
    game.coach = game.assist
      ? game.tliArmed
        ? { msg: `TLI dijadwalkan. Mesin menyala otomatis dalam ${Math.ceil(game.secondsToTli)} detik…`, urgent: false }
        : { msg: 'Orbit parkir tercapai! Tekan Gas + untuk berangkat ke Bulan (TLI).', urgent: true }
      : null;
    if (game.tliArmed && (diff < 0.05 || diff > 2 * Math.PI - 0.01)) {
      game.phase = 'outbound';
      if (ctrl) ctrl.mode = 'prograde';
      game.log.push('TLI selesai, menuju Bulan. Lintasan sedikit menyimpang: lihat garis prediksi.');
    }
    return game;
  }

  if (game.phase === 'splash') {
    game.splashT += dt;
    if (game.splashT > 3) finishSafe(game);
    return game;
  }

  game.t += dt;

  // Kendali arah dan gas
  const s = sampleAt(game.t);
  game.craft.vx = s.vx;
  game.craft.vy = s.vy;
  const win = mccWindow(game.t);
  if (game.assist && ctrl) assistStep(game, ctrl, win);
  let throttle = ctrl ? applyControls(ctrl, game.craft, TURN_RATE, dt) : 0;
  if (!win) throttle = 0; // mesin hanya boleh dinyalakan di jendela MCC
  if (game.holdThrust) throttle = 0; // bantuan pilot menunggu kapsul selesai berputar
  game.mcc = win ? win.id : null;
  game.thrusting = throttle > 0 && game.fuel > 0 && game.phase !== 'entry';
  if (game.thrusting) {
    const a = (L.capsuleAccel * throttle) / game.massRatio;
    // komponen dorongan yang tegak lurus jalur mengubah laju penyimpangan
    const side = Math.sin(game.craft.angle - s.heading); // +1 = kanan jalur
    game.devRate -= a * side * dt;
    game.fuel = Math.max(0, game.fuel - L.fuelBurnPerSec * throttle * dt);
  }

  // Penyimpangan bertambah sendiri
  game.dev += game.devRate * dt;
  const p = posAt(game.t, game.dev);
  game.craft.x = p.x;
  game.craft.y = p.y;
  if (game.trail.length === 0 || game.t - game.trail[game.trail.length - 1].t > 0.25) game.trail.push({ x: p.x, y: p.y, t: game.t });

  // Daya
  const solar = game.panelsOpen ? game.panelPower : 0;
  game.battery = Math.min(game.batteryMax, game.battery + (game.basePower + solar) * WH_PER_WATT_SECOND * dt);
  if (game.battery <= 0) return finish(game, false, 'F-POWER');

  // Bulan
  const dMoon = moonSurfaceDist(p);
  game.closestMoon = Math.min(game.closestMoon, dMoon);
  if (dMoon <= 0) return finish(game, false, 'F-CRASH');
  game.signalLost = behindMoon(p);
  game.photoCooldown = Math.max(0, game.photoCooldown - dt);
  game.photoQuality = photoQuality(game, p, dMoon);

  if (game.phase === 'outbound' && game.t > n.flybyT - 10) {
    game.phase = 'flyby';
    game.log.push('Mendekati Bulan. Navigator arahkan kapsul ke Bulan, Spesialis ambil foto.');
  }
  if (game.phase === 'flyby' && game.t > n.flybyT + 10) {
    game.phase = 'return';
    game.devRate += game.driftBack;
    if (game.closestMoon > L.flybyTarget[1] && game.photos < L.photoTarget) game.log.push('Terlalu jauh dari Bulan, foto kurang tajam.');
    game.log.push(`Pulang ke Bumi. ${game.photos} foto berguna. Siapkan MCC pulang.`);
  }
  if (game.phase === 'return' && game.t >= n.entryT - 6) {
    game.phase = 'entry';
    if (ctrl) ctrl.throttle = 0;
    game.log.push('Masuk atmosfer! Arahkan pelindung panas ke depan (E).');
  }
  if (game.phase === 'entry' && game.t >= n.entryT) {
    const f = forecast(game);
    game.entry = { angle: f.entryAngle };
    if (!game.hasShield) return finish(game, false, 'F-HEAT');
    const [lo, hi] = L.entryCorridorDeg;
    if (f.entryAngle < lo || f.entryAngle > hi) return finish(game, false, 'F-ENTRY');
    const back = s.heading + Math.PI;
    const off = Math.abs(Math.atan2(Math.sin(game.craft.angle - back), Math.cos(game.craft.angle - back)));
    if (off > L.shieldPointTolDeg * DEG) return finish(game, false, 'F-HEAT');
    game.phase = 'splash';
    game.log.push('Parasut terbuka. Kapsul mendarat di laut!');
  }
  return game;
}

function syncCraftFromFlight(game) {
  const f = game.flight;
  game.craft.x = f.x;
  game.craft.y = f.y;
  game.craft.vx = f.vx;
  game.craft.vy = f.vy;
  game.craft.angle = f.angle;
}

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

// Bantuan pilot Level 2: mengatur arah kapsul, mematikan mesin saat lintasan sudah pas,
// dan memberi tahu pemain apa yang harus ditekan. Pemain tetap menekan Gas + dan Ambil foto.
function assistStep(game, ctrl, win) {
  const n = nominal();
  game.holdThrust = false;
  let msg = '';
  let urgent = false;

  if (game.phase === 'entry') {
    ctrl.mode = 'retrograde';
    ctrl.throttle = 0;
    msg = 'Masuk atmosfer. Pelindung panas diarahkan ke depan otomatis.';
  } else if (game.phase === 'flyby') {
    ctrl.mode = 'manual';
    ctrl.targetAngle = Math.atan2(CISLUNAR.moon.x - game.craft.x, CISLUNAR.moon.y - game.craft.y);
    ctrl.throttle = 0;
    if (!game.hasCamera) msg = 'Melewati Bulan (tanpa kamera, tidak bisa memotret).';
    else if ((game.photoQuality || 0) >= 0.6) {
      msg = `FOTO SEKARANG! Spesialis tekan Ambil foto (${game.photos}/${L.photoTarget})`;
      urgent = true;
    } else msg = 'Mendekati Bulan. Kamera diarahkan otomatis, tunggu sampai cukup dekat…';
  } else if (win) {
    // Bantuan pilot membidik lebih tepat (ke tengah target) supaya foto dan sudut masuk aman.
    const adv = advice(game, true);
    if (adv.dir) {
      ctrl.mode = adv.dir;
      const target = Math.atan2(game.craft.vx, game.craft.vy) + (adv.dir === 'left' ? -Math.PI / 2 : Math.PI / 2);
      game.holdThrust = Math.abs(angleDiff(game.craft.angle, target)) > 0.35;
      const what = game.t < n.flybyT ? 'jarak ke Bulan' : 'sudut masuk atmosfer';
      if (ctrl.throttle > 0) msg = `${win.id}: mengoreksi ${what}… garis putus-putus mendekati jalur hijau.`;
      else {
        msg = `${win.id}: lintasan menyimpang! Tekan Gas + untuk koreksi.`;
        urgent = true;
      }
    } else {
      if (ctrl.throttle > 0) ctrl.throttle = 0;
      ctrl.mode = 'prograde';
      msg = `${win.id}: lintasan sudah pas ✓ Mesin dimatikan.`;
    }
  } else {
    ctrl.mode = 'prograde';
    ctrl.throttle = 0;
    const next = L.mccWindows.find((w) => w.from > game.t);
    msg = next ? `Meluncur. ${next.id} dalam ${Math.ceil(next.from - game.t)} detik (Percepat ⏩ untuk mempercepat).` : 'Meluncur pulang ke Bumi.';
  }
  if (!game.panelsOpen && game.panelPower > 0 && game.phase === 'outbound' && !urgent) msg += ' Spesialis: buka panel surya.';
  game.coach = { msg, urgent };
}

function behindMoon(p) {
  // Garis dari Bumi ke kapsul terhalang piringan Bulan?
  const m = CISLUNAR.moon;
  const len2 = p.x * p.x + p.y * p.y;
  const u = Math.max(0, Math.min(1, (m.x * p.x + m.y * p.y) / len2));
  const cx = u * p.x;
  const cy = u * p.y;
  return u > 0 && u < 1 && Math.hypot(cx - m.x, cy - m.y) < m.radius && Math.hypot(p.x, p.y) > Math.hypot(m.x, m.y);
}

function photoQuality(game, p, dMoon) {
  if (!game.hasCamera || dMoon > L.photoRange) {
    game.aimOff = null;
    return 0;
  }
  const toMoon = Math.atan2(CISLUNAR.moon.x - p.x, CISLUNAR.moon.y - p.y);
  const signed = Math.atan2(Math.sin(toMoon - game.craft.angle), Math.cos(toMoon - game.craft.angle)) / DEG;
  game.aimOff = signed; // + = Bulan di kanan (putar D), - = di kiri (putar A)
  const off = Math.abs(signed);
  const aim = off <= L.photoPointTolDeg ? 1 - (off / L.photoPointTolDeg) * 0.4 : 0;
  const near = dMoon <= 40 ? 1 : Math.max(0, 1 - (dMoon - 40) / 160);
  return +(aim * near).toFixed(2);
}

// ---------- Perintah Spesialis ----------
export function command(game, cmd) {
  if (game.result) return game;
  if (cmd === 'deployPanels' && game.phase !== 'launch' && game.panelPower > 0) {
    game.panelsOpen = true;
    game.log.push('Panel surya terbuka.');
  }
  if (cmd === 'photo') {
    if (!game.hasCamera) game.log.push('Tidak ada kamera.');
    else if (game.photoCooldown > 0) return game;
    else {
      game.photoAttempts++;
      game.photoCooldown = 0.6;
      const q = game.photoQuality || 0;
      game.lastPhoto = q;
      if (q >= 0.6) {
        game.photos++;
        game.log.push(`Foto berguna! (${game.photos}/${L.photoTarget})`);
      } else game.log.push(q > 0 ? 'Foto buram: arahkan kapsul ke Bulan dan dekati.' : 'Bulan tidak terlihat di kamera.');
    }
  }
  return game;
}

// ---------- Selesai ----------
function finishSafe(game) {
  const fullPhotos = game.photos >= L.photoTarget;
  finish(game, true, fullPhotos ? null : 'P-PHOTO');
}

function finish(game, success, failCode) {
  const fuelLeft = game.fuel;
  let stars = 0;
  if (success) stars = failCode ? 1 : 2;
  if (success && !failCode && fuelLeft >= L.minFuelFor3Stars && !game.check.overBudget) stars = 3;
  const score = success ? stars * 1000 + Math.round(fuelLeft * 500) + game.photos * 50 + Math.max(0, (L.budget - game.check.price) * 5) : 0;
  const reward = missionReward({ success, stars, budget: game.check.budget, price: game.check.price, bonus: game.photos >= L.photoTarget ? REWARD.photoBonus : 0 });
  game.result = { success, failCode, stars, score, fuelLeft, photos: game.photos, reward };
  game.phase = 'done';
  return game;
}

// ---------- Untuk tampilan dan Spesialis ----------
export function snapshotLevel2(game, withPaths = true) {
  const n = nominal();
  const before = game.phase === 'launch' || game.phase === 'tli';
  const f = before ? forecast({ ...game, t: 0 }) : forecast(game);
  let prediction = [];
  if (!before && game.phase !== 'done') {
    // Snapshot untuk Spesialis lebih jarang titiknya supaya ringan dikirim lewat room.
    for (let t = game.t; t <= n.entryT; t += withPaths ? 0.5 : 1.5) {
      const d = game.dev + game.devRate * (t - game.t);
      const q = posAt(t, d);
      prediction.push({ x: Math.round(q.x), y: Math.round(q.y) });
    }
  }
  return {
    level: 2,
    phase: game.phase,
    t: game.t,
    flybyT: n.flybyT,
    entryT: n.entryT,
    craft: { x: game.craft.x, y: game.craft.y, angle: game.craft.angle, thrusting: game.thrusting },
    fuel: game.fuel,
    mcc: game.mcc || null,
    nextMcc: L.mccWindows.find((w) => w.from > game.t) || null,
    mccWindows: L.mccWindows,
    forecast: { closestMoon: f.closest, entryAngle: f.entryAngle },
    advice: advice(game).dir,
    flybyTarget: L.flybyTarget,
    entryCorridor: L.entryCorridorDeg,
    kmPerU: 1 / L.uPerKm,
    photos: game.photos,
    photoTarget: L.photoTarget,
    photoQuality: game.photoQuality || 0,
    aimOff: game.aimOff ?? null,
    lastPhoto: game.lastPhoto,
    hasCamera: game.hasCamera,
    panelsOpen: game.panelsOpen,
    panelPower: game.panelPower,
    battery: game.battery,
    batteryMax: game.batteryMax,
    signalLost: game.signalLost,
    lastLog: game.log[game.log.length - 1] || '',
    coach: game.assist ? game.coach : null,
    earthAngle: game.flight.earthAngle + game.t * EARTH.spin,
    secondsToTli: game.phase === 'tli' ? game.secondsToTli : null,
    // Saat peluncuran, tampilan memakai gambar orbit Bumi seperti Level 1.
    flight:
      game.phase === 'launch'
        ? {
            x: game.flight.x,
            y: game.flight.y,
            vx: game.flight.vx,
            vy: game.flight.vy,
            angle: game.flight.angle,
            fuel: game.flight.fuel,
            status: game.flight.status,
            thrusting: !!game.flight.thrusting,
            earthAngle: game.flight.earthAngle,
            inRing: !!game.flight.inRing,
            inRingFor: game.flight.inRingFor,
            trail: withPaths ? game.flight.trail : [],
          }
        : null,
    result: game.result,
    nominal: withPaths ? nominalPathPoints() : [],
    prediction,
    trail: withPaths ? game.trail : [],
  };
}

let NOMINAL_POINTS = null;
export function nominalPathPoints() {
  if (!NOMINAL_POINTS) NOMINAL_POINTS = nominal().pts.filter((_, i) => i % 6 === 0).map((p) => ({ x: p.x, y: p.y }));
  return NOMINAL_POINTS;
}

export { predict };
