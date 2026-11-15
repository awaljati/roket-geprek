// Level 3: Kutub Selatan Bulan (terinspirasi Artemis III).
// Tahap 1: inti pendaratan. Tahap 2: pilihan titik pendaratan dan bayangan panjang dari Matahari rendah.
// Tahap 3: di permukaan (daya, pindai es, kirim data ke Bumi).
//
// Tampilan samping: permukaan Bulan berupa garis berbukit (y = ketinggian, x = jarak menyamping).
// Misi dimulai di orbit rendah Bulan, tanpa peluncuran dari Bumi.
//
// Model "orbit datar": permukaan dianggap datar, tapi gravitasi efektif berkurang kalau pendarat bergerak
// menyamping cepat: g_efektif = g * (1 - (vx / orbitSpeed)^2). Pada kecepatan orbit pendarat tidak jatuh.
// Pemain harus mengerem kecepatan menyamping (deorbit), lalu turun pelan dan tegak.
//
// Titik pendaratan: permukaan punya sepasang tempat yang berulang setiap sitePeriod u:
//   - Puncak bukit: landasan lebar dan tinggi, hampir selalu terang, sedikit es (bintang maks. 2).
//   - Dekat kawah gelap: landasan sempit di tepi kawah, di balik bukit kecil sehingga sering dalam bayangan,
//     toleransi miring lebih kecil, banyak es (bintang 3 kalau mendarat mulus).
// Kedua penanda sudah terlihat sejak di orbit. Mesin terkunci sampai Spesialis memilih titik. Setelah itu
// pelatih menghitung kapan mulai mengerem (simulasi pendaratan berbantuan) dan memberi aba-aba "SEKARANG!".
//
// Di permukaan (fase landed, selama surface.timeSec):
//   - Daya: dekat kawah selalu bayangan (panel surya 0 W, perlu RTG/baterai). Di puncak bukit panel bekerja,
//     kecuali saat bayangan bukit lain lewat (waktunya dari seed). Instrumen memakai daya. Baterai habis: F-POWER.
//   - Pindai es: spektrometer menyala selama scanSec. Peluang es tergantung titik.
//   - Kirim data: antena menyala, mengarah ke Bumi (rendah di cakrawala kanan), dan daya cukup.
//     Selesai saat data penuh atau waktu habis; data sebagian: P-ANTENNA.
//
// Fase: orbit -> descent -> landed (permukaan) -> done
// Tahap (untuk timeline): pick (pilih titik) -> deorbit (keluar orbit) -> descent (turun) -> landed -> scan / send

import { applyControls, createControls } from '../engine/attitude.js';
import { stepLanderAssist, targetDescent, directionText } from '../engine/landerAssist.js';
import { EARTH } from '../engine/flight.js';
import { makeRng } from '../engine/rng.js';
import { LEVELS, ROCKETS, BODIES } from '../data/levels.js';
import { missionReward } from './reward.js';
import { itemById, ITEMS } from '../data/items.js';

const L = LEVELS[3];
const S = L.sites;
const SF = L.surface;
const DEG = Math.PI / 180;
const SUN_SLOPE = Math.tan(L.sunElevationDeg * DEG);
const LANDER_HEIGHT = 6; // u, untuk bayangan pendarat
// Gravitasi permukaan Bumi dalam satuan game (gm / r^2), lalu 1/6 untuk Bulan.
export const MOON_G = (EARTH.gm / (EARTH.radius * EARTH.radius)) * L.moonGravityShare;

// ---------- Rakit ----------
export const RAKIT_ITEMS = ITEMS.filter((it) => !it.cubesat && it.id !== 'fuel' && it.level <= 3);
export const DEFAULT_BUILD = { items: ['lander-engine', 'battery', 'panel-s', 'antenna-s', 'spectrometer'], fuel: 0.7, assist: true };

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
const smooth = (t) => t * t * (3 - 2 * t);

// Meratakan permukaan ke ketinggian h di sekitar cx (landasan), dengan lereng halus selebar ramp.
function flatten(y, x, cx, half, ramp, h) {
  const d = Math.abs(x - cx) - half;
  const w = d <= 0 ? 1 : d >= ramp ? 0 : smooth(1 - d / ramp);
  return y + (h - y) * w;
}

function makeTerrain(rng) {
  const waves = L.terrain.map(([amp, len]) => ({ amp, k: (2 * Math.PI) / len, ph: rng() * 2 * Math.PI }));
  const base = (x) => waves.reduce((h, w) => h + w.amp * Math.sin(x * w.k + w.ph), 0);
  const P = L.sitePeriod;
  const rawCache = new Map();
  const cache = new Map();
  // Setiap x hanya dipengaruhi satu pasangan (semua bentuknya muat dalam satu periode).
  const pairIndex = (x) => Math.floor((x - L.sitePhase + P / 4) / P);

  // Pasangan titik ke-k: puncak bukit di k*P + sitePhase, dekat kawah offset u di kanannya.
  // "Mentah" = sebelum puncak bukit dinaikkan supaya terkena Matahari.
  function rawSitesAt(k) {
    if (!rawCache.has(k)) {
      const rx = k * P + L.sitePhase;
      let top = -Infinity;
      for (let x = rx - S.ridge.halfWidth - 20; x <= rx + S.ridge.halfWidth + 20; x += 4) top = Math.max(top, base(x));
      const cx = rx + S.crater.offset;
      const craterY = base(cx);
      // Puncak bukit harus benar-benar tertinggi di pasangannya (lebih tinggi dari bukit kecil di dekat kawah).
      const ridgeY = Math.max(top, craterY + S.crater.rimHeight) + S.ridge.raise;
      const bowlX = cx + S.crater.halfWidth + S.crater.craterGap + S.crater.craterRadius;
      rawCache.set(k, { k, ridge: { id: 'ridge', x: rx, y: ridgeY }, crater: { id: 'crater', x: cx, y: craterY, bowlX } });
    }
    return rawCache.get(k);
  }

  // Puncak bukit "hampir selalu terang": landasannya dinaikkan sampai berada di atas garis sinar Matahari
  // dari medan di sebelah kirinya (dihitung dari bentuk mentah supaya tidak berputar-putar).
  function sitesAt(k) {
    if (!cache.has(k)) {
      const raw = rawSitesAt(k);
      const edge = raw.ridge.x - S.ridge.halfWidth;
      let need = -Infinity;
      for (let x = edge - L.shadowLookback; x <= edge - S.ridge.ramp; x += 4) need = Math.max(need, shape(x, rawSitesAt(pairIndex(x))) - SUN_SLOPE * (edge - x));
      cache.set(k, { ...raw, ridge: { ...raw.ridge, y: Math.max(raw.ridge.y, need + 2) } });
    }
    return cache.get(k);
  }

  // Bentuk permukaan di x untuk pasangan f.
  function shape(x, f) {
    let y = base(x);
    const c = S.crater;
    // kawah di kanan landasan, dengan bibir di kedua tepinya
    const bowl = f.crater.bowlX;
    const db = Math.abs(x - bowl);
    if (db < c.craterRadius) y = Math.min(y, f.crater.y - c.craterDepth * Math.cos((db / c.craterRadius) * (Math.PI / 2)) ** 2);
    for (const edge of [bowl - c.craterRadius, bowl + c.craterRadius]) {
      const dl = (x - edge) / c.lipWidth;
      if (Math.abs(dl) < 3) y = Math.max(y, f.crater.y + c.lipHeight * Math.exp(-dl * dl));
    }
    // bukit kecil di sisi Matahari (membuat bayangan di landasan dan kawah)
    const dh = (x - (f.crater.x + c.rimOffset)) / c.rimWidth;
    if (Math.abs(dh) < 2.5) y = Math.max(y, f.crater.y + c.rimHeight * Math.exp(-dh * dh));
    y = flatten(y, x, f.crater.x, c.halfWidth, c.ramp, f.crater.y);
    y = flatten(y, x, f.ridge.x, S.ridge.halfWidth, S.ridge.ramp, f.ridge.y);
    return y;
  }

  const height = (x) => shape(x, sitesAt(pairIndex(x)));

  // Titik pendaratan di posisi x (dari pasangan mana pun), atau null.
  function siteAt(x) {
    const f = sitesAt(pairIndex(x));
    for (const id of ['ridge', 'crater']) if (Math.abs(x - f[id].x) <= S[id].halfWidth) return id;
    return null;
  }

  // Pasangan pertama yang puncak bukitnya di depan x (pendarat selalu bergerak ke kanan di orbit).
  const firstPairAfter = (x) => Math.ceil((x - L.sitePhase) / P);

  return { height, siteAt, pair: sitesAt, firstPairAfter };
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
    ground: makeTerrain(rng),
    t: 0,
    craft: { x: 0, y: L.startAltitude, vx: L.orbitSpeed, vy: 0, angle: 0 },
    hasEngine: !check.missingEngine,
    massRatio,
    maxAccel: (L.thrustToWeight * MOON_G) / massRatio,
    hoverThrottle: massRatio / L.thrustToWeight,
    fuel: build.fuel,
    thrusting: false,
    sites: null, // pasangan titik yang diberi penanda (sejak di orbit)
    burnPlan: null, // { ridge, crater }: x tempat mulai mengerem untuk tiap titik (dihitung pelatih)
    siteChoice: null, // 'ridge' | 'crater' (dipilih Spesialis)
    precision: false, // dekat landasan kawah dan rendah: waktu diperlambat, garis panduan
    touchdown: null,
    surface: null, // keadaan di permukaan setelah mendarat (lihat startSurface)
    surfaceRng: makeRng(seed + '-L3-surface'), // terpisah supaya permukaan dan bentuk medan tidak saling memengaruhi
    log: ['Pendarat di orbit rendah Bulan, di atas wilayah kutub selatan. Spesialis: pilih titik pendaratan.'],
    result: null,
    trail: [],
  };
  if (check.tooHeavy) return finish(game, false, 'F-HEAVY');
  if (!game.hasEngine) {
    game.log.push('Tidak ada mesin pendarat: pendarat tidak bisa mengerem dan jatuh.');
    return finish(game, false, 'F-CRASH');
  }
  // Pasangan pertama: titik mulai mengerem cukup jauh di depan supaya Spesialis sempat memilih.
  let k = game.ground.firstPairAfter(game.craft.x);
  while (!setPair(game, k, L.pickLeadU)) k++;
  return game;
}

// Memasang pasangan ke-k sebagai penanda, kalau titik mulai mengerem untuk puncak bukit masih minimal lead u di depan.
function setPair(game, k, lead) {
  const pair = game.ground.pair(k);
  const plan = { ridge: planBurn(game, pair.ridge), crater: planBurn(game, pair.crater) };
  if (plan.ridge - game.craft.x < lead) return false;
  game.sites = pair;
  game.burnPlan = plan;
  return true;
}

// ---------- Fisika ----------
// Satu langkah gerak. s = { craft, fuel, maxAccel }. Dipakai permainan dan simulasi rencana pengereman.
function move(s, throttle, dt) {
  const c = s.craft;
  const thrusting = throttle > 0 && s.fuel > 0;
  let ax = 0;
  let ay = -MOON_G * Math.max(0, 1 - (c.vx / L.orbitSpeed) ** 2);
  if (thrusting) {
    const a = s.maxAccel * throttle;
    ax += Math.sin(c.angle) * a;
    ay += Math.cos(c.angle) * a;
    s.fuel = Math.max(0, s.fuel - L.fuelBurnPerSec * throttle * dt);
  }
  c.vx += ax * dt;
  c.vy += ay * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  return thrusting;
}

// Hasil pendaratan berbantuan kalau mulai mengerem di burnX (pemain mengikuti saran gas pelatih).
function simulateLanding(game, site, burnX) {
  const H = game.ground.height;
  const s = {
    craft: { x: burnX, y: game.craft.y, vx: game.craft.vx, vy: game.craft.vy, angle: -Math.PI / 2 },
    fuel: game.fuel,
    maxAccel: game.maxAccel,
  };
  const c = s.craft;
  const ctrl = createControls();
  const target = { id: site.id, name: S[site.id].name, halfWidth: S[site.id].halfWidth, dx: 0 };
  const dt = 1 / 60;
  for (let t = 0; t < 150; t += dt) {
    const alt = c.y - H(c.x);
    target.dx = site.x - c.x;
    const a = stepLanderAssist({ alt, vx: c.vx, vy: c.vy, hoverThrottle: game.hoverThrottle, fuel: s.fuel, phase: 'descent', target }, ctrl);
    ctrl.throttle = a.rec;
    move(s, applyControls(ctrl, c, L.turnRate, dt), dt);
    if (c.y <= H(c.x)) {
      const ok = Math.hypot(c.vx, c.vy) <= L.maxLandingSpeed && Math.abs(c.x - site.x) <= S[site.id].halfWidth;
      return { ok, fuelUsed: game.fuel - s.fuel, t };
    }
  }
  return { ok: false, fuelUsed: Infinity, t: Infinity };
}

// Pelatih: x tempat mulai mengerem supaya pendarat turun tepat di atas titik dengan bahan bakar paling sedikit.
// Dicoba beberapa jarak, lalu dihaluskan di sekitar yang terbaik.
function planBurn(game, site) {
  const tryAt = (d) => ({ d, ...simulateLanding(game, site, site.x - d) });
  const better = (a, b) => (a.ok !== b.ok ? a.ok : a.fuelUsed < b.fuelUsed);
  let best = { d: 200, ok: false, fuelUsed: Infinity };
  for (let d = 40; d <= 800; d += 40) {
    const r = tryAt(d);
    if (better(r, best)) best = r;
  }
  for (let d = best.d - 30; d <= best.d + 30; d += 10) {
    const r = tryAt(d);
    if (better(r, best)) best = r;
  }
  return site.x - best.d;
}

function altitude(game) {
  return game.craft.y - game.ground.height(game.craft.x);
}

// Tahap untuk timeline: pilih titik -> keluar orbit -> turun -> mendarat.
function stage(game) {
  if (game.phase === 'orbit') return game.siteChoice ? 'deorbit' : 'pick';
  if (game.phase === 'descent') return Math.abs(game.craft.vx) > L.orbitSpeed * L.deorbitDoneShare ? 'deorbit' : 'descent';
  if (game.phase === 'landed') {
    const sf = game.surface;
    if (sf.t < L.landedHoldSec) return 'landed';
    return sf.spectrometer.has && !sf.iceFound && !sf.antenna.sending ? 'scan' : 'send';
  }
  if (game.result && game.result.success) return 'send';
  return game.phase;
}

// Detik layar sampai titik mulai mengerem (negatif = sudah lewat).
function secondsToBurn(game) {
  if (!game.siteChoice || game.phase !== 'orbit') return null;
  return (game.burnPlan[game.siteChoice] - game.craft.x) / (game.craft.vx * L.timeScale);
}

function target(game) {
  if (!game.sites || !game.siteChoice) return null;
  const s = game.sites[game.siteChoice];
  return { id: s.id, name: S[s.id].name, dx: s.x - game.craft.x, halfWidth: S[s.id].halfWidth };
}

// ---------- Langkah per frame ----------
export function stepLevel3(game, ctrl, rawDt) {
  if (game.result) return game;

  if (game.phase === 'landed') {
    if (ctrl) ctrl.throttle = 0;
    return surfaceStep(game, rawDt);
  }

  const c = game.craft;
  const alt = altitude(game);
  // Dekat landasan kawah dan rendah: waktu diperlambat supaya sempat menjaga pendarat tetap tegak.
  const cr = S.crater;
  game.precision = game.phase === 'descent' && alt < cr.slowAltitude && Math.abs(c.x - game.sites.crater.x) <= cr.halfWidth + cr.slowNearU;
  const dt = rawDt * L.timeScale * (game.precision ? cr.slowFactor : 1);
  game.t += dt;

  if (game.phase === 'orbit') orbitStep(game, ctrl);
  if (game.assist && ctrl && game.phase === 'descent') {
    const a = stepLanderAssist({ alt, vx: c.vx, vy: c.vy, hoverThrottle: game.hoverThrottle, fuel: game.fuel, phase: game.phase, target: target(game) }, ctrl);
    game.coach = { msg: a.msg, urgent: a.urgent };
  }
  const throttle = ctrl ? applyControls(ctrl, c, L.turnRate, dt) : 0;
  const fuelBefore = game.fuel;
  game.thrusting = move(game, throttle, dt);
  if (game.thrusting) {
    if (game.fuel === 0 && fuelBefore > 0) game.log.push('Bahan bakar habis!');
    if (game.phase === 'orbit') startDescent(game);
  }
  if (game.trail.length === 0 || game.t - game.trail[game.trail.length - 1].t > 0.2) {
    game.trail.push({ x: c.x, y: c.y, t: game.t });
    if (game.trail.length > 200) game.trail.shift();
  }

  // Menyentuh permukaan
  const ground = game.ground.height(c.x);
  if (c.y <= ground) {
    c.y = ground;
    const speed = Math.hypot(c.vx, c.vy);
    const tilt = Math.abs(Math.atan2(Math.sin(c.angle), Math.cos(c.angle))) / DEG;
    const site = game.ground.siteAt(c.x);
    const maxTilt = site ? S[site].maxTiltDeg : L.maxLandingTiltDeg;
    game.touchdown = { speed: +speed.toFixed(2), tiltDeg: Math.round(tilt), site };
    game.thrusting = false;
    if (ctrl) ctrl.throttle = 0;
    if (speed > L.maxLandingSpeed || tilt > maxTilt) {
      c.crashed = true;
      game.log.push(
        speed > L.maxLandingSpeed
          ? `Terlalu cepat: ${speed.toFixed(1)} u/s (maks. ${L.maxLandingSpeed}). Pendarat hancur.`
          : `Terlalu miring: ${Math.round(tilt)}° (maks. ${maxTilt}°${site ? ' di ' + S[site].name : ''}). Pendarat terguling.`,
      );
      return finish(game, false, 'F-CRASH');
    }
    c.vx = c.vy = 0;
    game.phase = 'landed';
    const where = site ? `di ${S[site].name} (es ${S[site].ice})` : 'di luar titik pendaratan';
    game.coach = { msg: `Mendarat ${where}!`, urgent: false };
    game.log.push(`Mendarat ${where}: ${speed.toFixed(1)} u/s, miring ${Math.round(tilt)}°.`);
    startSurface(game);
  }
  return game;
}

// Di orbit: mesin terkunci sampai Spesialis memilih titik, lalu pelatih menghitung mundur ke titik mulai mengerem.
function orbitStep(game, ctrl) {
  if (ctrl && game.assist) ctrl.mode = 'retrograde'; // siap mengerem: mesin menghadap lawan arah gerak
  const x = game.craft.x;
  if (!game.siteChoice) {
    if (ctrl) ctrl.throttle = 0;
    game.coach = { msg: 'Spesialis, pilih titik pendaratan dulu.', urgent: true };
    if (x > game.burnPlan.ridge - L.pickMinLeadU) {
      setPair(game, game.sites.k + 1, -Infinity);
      game.log.push('Titik terlewat. Penanda pindah ke pasangan berikutnya.');
    }
    return;
  }
  const burnX = game.burnPlan[game.siteChoice];
  if (x > burnX + L.burnWindowU) {
    setPair(game, game.sites.k + 1, -Infinity);
    game.log.push('Titik mulai mengerem terlewat. Pakai pasangan berikutnya.');
    return orbitStep(game, ctrl);
  }
  if (!game.assist) {
    game.coach = null;
    return;
  }
  const sec = secondsToBurn(game);
  const name = S[game.siteChoice].name;
  if (x >= burnX - L.burnWindowU) game.coach = { msg: 'SEKARANG! Tekan Gas +', urgent: true };
  else if (sec <= L.burnCountdownSec) game.coach = { msg: `Siap mengerem… ${Math.ceil(sec)}`, urgent: true };
  else game.coach = { msg: `${name} dipilih. Pelatih memberi aba-aba kapan mulai mengerem (${Math.ceil(sec)} detik lagi).`, urgent: false };
}

function startDescent(game) {
  game.phase = 'descent';
  const off = Math.round(game.burnPlan[game.siteChoice] - game.craft.x);
  const when = Math.abs(off) <= L.burnWindowU ? 'tepat waktu' : off > 0 ? `${off} u terlalu awal` : `${-off} u terlambat`;
  game.log.push(`Mesin menyala: keluar dari orbit (${when}).`);
}

// ---------- Di permukaan (fase 5–6) ----------
const SURFACE_COMMANDS = ['spectrometerToggle', 'scan', 'antennaToggle', 'antennaLeft', 'antennaRight'];
const angleTo = (a, b) => Math.abs(a - b);

// Titik permukaan di x dalam bayangan bukit di sebelah kiri (arah Matahari)?
function inShadowAt(game, x) {
  const H = game.ground.height;
  const y = H(x);
  for (let d = 4; d <= L.shadowLookback; d += 4) if (H(x - d) > y + SUN_SLOPE * d + 0.05) return true;
  return false;
}

function startSurface(game) {
  const items = game.build.items.map(itemById);
  const has = (id) => game.build.items.includes(id);
  const site = game.touchdown.site;
  const rng = game.surfaceRng;
  const between = ([a, b]) => a + rng() * (b - a);
  const store = SF.landerBatteryWh + items.reduce((s, it) => s + it.storeWh, 0);
  // Bayangan bukit lain di puncak bukit: waktunya dari seed (sama untuk semua tim battle).
  // Rentang waktu mulai dibagi rata, satu bagian untuk tiap bayangan, supaya bayangan tidak bertumpuk.
  const passes = [];
  const [s0, s1] = SF.shadowStartSec;
  const slot = (s1 - s0) / SF.shadowPasses;
  for (let i = 0; i < SF.shadowPasses; i++) {
    const from = between([s0 + i * slot, s0 + (i + 0.5) * slot]);
    passes.push({ from, to: from + between(SF.shadowSec) });
  }
  const antennas = items.filter((it) => it.id.startsWith('antenna'));
  game.surface = {
    t: 0,
    site,
    // Dekat kawah: selalu bayangan. Puncak bukit: terang. Di luar titik: tergantung medan.
    alwaysDark: site === 'crater' || (site === null && inShadowAt(game, game.craft.x)),
    passes: site === 'ridge' ? passes : [],
    battery: store,
    batteryMax: store,
    panelPower: items.reduce((s, it) => s + (it.deployable && it.power > 0 ? it.power : 0), 0),
    rtgPower: items.reduce((s, it) => s + (!it.deployable && it.power > 0 ? it.power : 0), 0),
    basePower: BODIES[L.body].basePower,
    spectrometer: { has: has('spectrometer'), on: false, power: has('spectrometer') ? itemById('spectrometer').power : 0 },
    antenna: {
      has: antennas.length > 0,
      on: false,
      deg: SF.antennaStartDeg,
      power: antennas.reduce((s, it) => s + it.power, 0),
      rate: antennas.reduce((s, it) => s + it.data, 0), // unit data per detik
      sending: false,
    },
    scan: null, // { t } selama memindai
    scans: 0,
    iceFound: false,
    data: 0,
    pointedSec: 0,
    sunlit: false,
    powerNet: 0,
  };
  game.log.push(
    site === 'crater'
      ? 'Dekat kawah: selalu dalam bayangan, panel surya tidak menghasilkan daya.'
      : 'Di permukaan. Pindai es dan kirim data ke Bumi sebelum waktu habis.',
  );
}

const earthDeg = () => L.earth.elevationDeg;
// Kekuatan sinyal 0..1: 1 tepat ke Bumi, 0 kalau selisih > signalZeroDeg.
const signal = (sf) => Math.max(0, 1 - angleTo(sf.antenna.deg, earthDeg()) / SF.signalZeroDeg);
const pointed = (sf) => signal(sf) >= SF.minSignal;
const inPass = (sf, t) => sf.passes.find((p) => t >= p.from && t < p.to);
const nextPass = (sf, t) => sf.passes.find((p) => p.from > t);

function surfaceStep(game, rawDt) {
  const sf = game.surface;
  const dt = rawDt; // detik layar
  sf.t += dt;
  const sp = sf.spectrometer;
  const an = sf.antenna;

  // Daya
  sf.sunlit = !sf.alwaysDark && !inPass(sf, sf.t);
  const solar = sf.sunlit ? sf.panelPower : 0;
  const load = sf.basePower + (sp.on ? sp.power : 0) + (an.on ? an.power : 0);
  sf.powerNet = solar + sf.rtgPower + load;
  const wasSunlit = sf.prevSunlit;
  if (wasSunlit !== undefined && wasSunlit !== sf.sunlit && sf.passes.length) {
    game.log.push(sf.sunlit ? 'Bayangan bukit lewat. Panel surya kembali menghasilkan daya.' : 'Bayangan bukit lain menutupi pendarat: panel surya 0 W.');
  }
  sf.prevSunlit = sf.sunlit;
  sf.battery = Math.min(sf.batteryMax, sf.battery + sf.powerNet * SF.whPerWattSec * dt);
  if (sf.battery <= 0) {
    sf.battery = 0;
    game.log.push('Baterai habis! Pendarat mati.');
    return finish(game, false, 'F-POWER');
  }

  // Pindai es
  if (sf.scan) {
    if (!sp.on) {
      sf.scan = null;
      game.log.push('Pindai dibatalkan: spektrometer dimatikan.');
    } else if ((sf.scan.t += dt) >= SF.scanSec) {
      sf.scan = null;
      sf.scans++;
      const chance = SF.iceChance[sf.site || 'outside'];
      sf.iceFound = game.surfaceRng() < chance;
      game.log.push(sf.iceFound ? 'ES AIR TERDETEKSI di tanah sekitar pendarat!' : 'Pindai selesai: tidak ada tanda es di sini.');
    }
  }

  // Kirim data
  const powerOk = sf.battery > SF.lowPowerShare * sf.batteryMax;
  an.sending = an.has && an.on && pointed(sf) && powerOk && sf.data < SF.dataTarget;
  if (an.on && pointed(sf)) sf.pointedSec += dt;
  if (an.sending) {
    sf.data = Math.min(SF.dataTarget, sf.data + an.rate * signal(sf) * dt);
    if (sf.data >= SF.dataTarget) {
      game.log.push('Data terkirim penuh ke Bumi!');
      return finish(game, true, null);
    }
  }
  if (sf.t >= SF.timeSec) {
    game.log.push('Waktu di permukaan habis.');
    return finish(game, true, sf.data >= SF.dataTarget ? null : 'P-ANTENNA');
  }
  if (game.assist) game.coach = surfaceCoach(game);
  return game;
}

// Pelatih di permukaan: kapan mematikan instrumen, kapan memindai, ke mana antena diputar.
function surfaceCoach(game) {
  const sf = game.surface;
  const sp = sf.spectrometer;
  const an = sf.antenna;
  const t = sf.t;
  if (t < L.landedHoldSec) return game.coach;
  const share = sf.battery / sf.batteryMax;
  const draining = sf.powerNet < 0;
  const secLeft = draining ? sf.battery / (-sf.powerNet * SF.whPerWattSec) : Infinity;
  const pass = nextPass(sf, t);
  if (draining && secLeft < SF.timeSec - t && sp.on && !sf.scan)
    return { msg: `Daya tinggal ${Math.round(share * 100)}%: matikan spektrometer!`, urgent: true };
  if (pass && pass.from - t <= SF.shadowWarnSec && sp.on && !sf.scan)
    return { msg: `Bayangan bukit lewat dalam ${Math.ceil(pass.from - t)} detik: matikan spektrometer.`, urgent: true };
  if (draining && secLeft < SF.timeSec - t && an.on && !an.sending)
    return { msg: 'Daya menipis: matikan antena sampai siap mengirim.', urgent: true };
  if (inPass(sf, t)) {
    const p = inPass(sf, t);
    if (sp.on && !sf.scan) return { msg: 'Dalam bayangan: matikan spektrometer, hemat baterai.', urgent: true };
    if (!an.sending) return { msg: `Dalam bayangan, panel 0 W. Tunggu ${Math.ceil(p.to - t)} detik.`, urgent: false };
  }
  if (sf.scan) return { msg: `Memindai… ${Math.ceil(SF.scanSec - sf.scan.t)} detik. Jangan matikan spektrometer.`, urgent: false };
  if (sp.has && !sf.iceFound && sf.scans === 0) {
    return sp.on ? { msg: 'Spesialis: tekan Pindai sekarang.', urgent: true } : { msg: 'Spesialis: nyalakan spektrometer, lalu tekan Pindai.', urgent: false };
  }
  if (sp.on) return { msg: 'Pindai selesai: matikan spektrometer supaya baterai awet.', urgent: true };
  if (!an.has) return { msg: 'Tidak ada antena: data tidak bisa dikirim ke Bumi.', urgent: true };
  if (!an.on) return { msg: 'Spesialis: nyalakan antena.', urgent: false };
  if (!pointed(sf)) {
    const diff = an.deg - earthDeg();
    return { msg: `Putar antena ke ${diff > 0 ? 'kanan' : 'kiri'}, sinyal ${Math.round(signal(sf) * 100)}%`, urgent: true };
  }
  if (!an.sending) return { msg: 'Daya kurang untuk mengirim. Matikan spektrometer dan tunggu baterai terisi.', urgent: true };
  return { msg: 'Sinyal kuat, data terkirim', urgent: false };
}

function surfaceCommand(game, cmd) {
  const sf = game.surface;
  if (!sf) return;
  const sp = sf.spectrometer;
  const an = sf.antenna;
  if (cmd === 'spectrometerToggle' && sp.has) {
    sp.on = !sp.on;
    game.log.push(`Spektrometer ${sp.on ? 'menyala' : 'dimatikan'}.`);
  }
  if (cmd === 'scan' && sp.has && sp.on && !sf.scan && !sf.iceFound) {
    sf.scan = { t: 0 };
    game.log.push('Memindai tanah dengan spektrometer…');
  }
  if (cmd === 'antennaToggle' && an.has) {
    an.on = !an.on;
    game.log.push(`Antena ${an.on ? 'menyala' : 'dimatikan'}.`);
  }
  if (cmd === 'antennaLeft' && an.has) an.deg = Math.min(180, an.deg + SF.antennaStepDeg);
  if (cmd === 'antennaRight' && an.has) an.deg = Math.max(0, an.deg - SF.antennaStepDeg);
}

// Untuk snapshot
function surfaceView(game) {
  const sf = game.surface;
  if (!sf) return null;
  const pass = nextPass(sf, sf.t);
  return {
    t: sf.t,
    timeLeft: Math.max(0, SF.timeSec - sf.t),
    site: sf.site,
    alwaysDark: sf.alwaysDark,
    sunlit: sf.sunlit,
    shadowInSec: pass ? pass.from - sf.t : null,
    battery: sf.battery,
    batteryMax: sf.batteryMax,
    lowPowerShare: SF.lowPowerShare,
    powerNet: Math.round(sf.powerNet),
    solar: sf.sunlit ? sf.panelPower : 0,
    panel: sf.panelPower,
    rtg: sf.rtgPower,
    spectrometer: { has: sf.spectrometer.has, on: sf.spectrometer.on },
    scan: sf.scan ? { progress: sf.scan.t / SF.scanSec } : null,
    scans: sf.scans,
    iceFound: sf.iceFound,
    antenna: { has: sf.antenna.has, on: sf.antenna.on, deg: sf.antenna.deg, signal: signal(sf), pointed: pointed(sf), sending: sf.antenna.sending },
    earthDeg: earthDeg(),
    minSignal: SF.minSignal,
    data: sf.data,
    dataTarget: SF.dataTarget,
  };
}

// Debrief: sebab gagal (atau kurang bintang) dan cara memperbaikinya.
function adviceFor(game, success, failCode) {
  const out = [];
  const td = game.touchdown;
  const sf = game.surface;
  const num = (v) => String(v).replace('.', ',');
  if (failCode === 'F-HEAVY') out.push('Wahana terlalu berat untuk roket sedang. Kurangi bahan bakar atau item di Rakit.');
  if (failCode === 'F-CRASH') {
    if (!game.hasEngine) out.push('Tidak ada mesin pendarat. Pasang Mesin pendarat di Rakit.');
    else if (!td) out.push('Pendarat jatuh. Ikuti aba-aba pelatih untuk mulai mengerem, lalu jaga gas sekitar 50% saat turun.');
    else if (td.speed > L.maxLandingSpeed)
      out.push(`Menyentuh permukaan ${num(td.speed)} u/s (maks. ${L.maxLandingSpeed}). Tambah gas saat dekat tanah supaya kecepatan turun di bawah saran.`);
    else out.push(`Terlalu miring ${td.tiltDeg}°. Tegakkan pendarat (A/D) sebelum menyentuh; dekat kawah batasnya ${S.crater.maxTiltDeg}°.`);
  }
  if (failCode === 'F-POWER' && sf) {
    if (sf.alwaysDark && !sf.rtgPower)
      out.push('Di dekat kawah selalu bayangan, jadi panel surya tidak menghasilkan daya. Pasang RTG atau baterai tambahan di Rakit.');
    else if (sf.passes.length) out.push('Bayangan bukit lain sempat menutupi panel surya. Matikan instrumen saat pelatih memberi tahu, atau tambah baterai.');
    out.push('Matikan spektrometer setelah memindai, dan nyalakan antena hanya saat sudah mengarah ke Bumi.');
  }
  if (sf && success) {
    if (!sf.antenna.has) out.push('Tidak ada antena, jadi data tidak terkirim. Pasang antena di Rakit.');
    else if (failCode === 'P-ANTENNA')
      out.push(
        `Data terkirim ${Math.round((sf.data / SF.dataTarget) * 100)}%. Antena mengarah ke Bumi hanya ${Math.round(sf.pointedSec)} detik. Putar antena ke kanan sampai ${earthDeg()}° (Bumi rendah di cakrawala) lebih awal, atau pakai antena sedang supaya lebih cepat.`,
      );
    if (!sf.spectrometer.has) out.push('Bintang 3 butuh es terdeteksi: pasang Spektrometer di Rakit.');
    else if (!sf.iceFound) out.push(sf.site === 'crater' ? 'Es belum terdeteksi. Nyalakan spektrometer dan tekan Pindai lebih awal.' : 'Es lebih mungkin ditemukan di dekat kawah gelap.');
    if (sf.site !== 'crater') out.push('Bintang 3 hanya bisa didapat di titik Dekat kawah gelap.');
    else if (td.speed > L.smoothLandingSpeed) out.push(`Bintang 3 butuh mendarat mulus (≤ ${num(L.smoothLandingSpeed)} u/s).`);
    if (game.fuel < L.minFuelFor3Stars)
      out.push(
        `Bintang 3 butuh sisa bahan bakar ≥ ${Math.round(L.minFuelFor3Stars * 100)}% (sisa ${Math.round(game.fuel * 100)}%). Mulai mengerem tepat saat aba-aba pelatih, atau tambah bahan bakar di Rakit.`,
      );
  }
  return out;
}

// ---------- Perintah Spesialis ----------
export const SITE_COMMANDS = { siteRidge: 'ridge', siteCrater: 'crater' };

export function command(game, cmd) {
  if (game.result) return game;
  if (SURFACE_COMMANDS.includes(cmd)) {
    if (game.phase === 'landed') surfaceCommand(game, cmd);
    return game;
  }
  const id = SITE_COMMANDS[cmd];
  if (id && game.sites && (game.phase === 'orbit' || game.phase === 'descent') && game.siteChoice !== id) {
    game.siteChoice = id;
    game.log.push(`Titik pendaratan dipilih: ${S[id].name}.`);
  }
  return game;
}

// ---------- Selesai ----------
function finish(game, success, failCode) {
  const fuelLeft = game.fuel;
  const td = game.touchdown;
  const site = td ? td.site : null;
  const maxStars = site ? S[site].maxStars : L.outsideMaxStars;
  const smoothLanding = td && td.speed <= L.smoothLandingSpeed;
  const sf = game.surface;
  const dataFull = !!sf && sf.data >= SF.dataTarget;
  // 1 = mendarat dan bertahan (data sebagian), 2 = data penuh,
  // 3 = mendarat mulus dekat kawah + es terdeteksi + data penuh + sisa bahan bakar ≥ minFuelFor3Stars.
  let stars = 0;
  if (success) stars = dataFull ? Math.min(2, maxStars) : 1;
  if (success && dataFull && maxStars >= 3 && smoothLanding && sf.iceFound && fuelLeft >= L.minFuelFor3Stars && !game.check.overBudget) stars = 3;
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
    landingSpeed: td ? td.speed : null,
    landingTiltDeg: td ? td.tiltDeg : null,
    landingSite: site, // 'ridge' | 'crater' | null (di luar titik)
    siteChoice: game.siteChoice,
    dataSent: sf ? Math.round(sf.data) : 0,
    dataTarget: SF.dataTarget,
    iceFound: !!(sf && sf.iceFound),
    advice: adviceFor(game, success, failCode),
  };
  game.phase = 'done';
  return game;
}

// ---------- Bayangan ----------
// Matahari di kiri, rendah. Titik permukaan dalam bayangan kalau ada medan di kirinya yang lebih tinggi dari
// garis sinar Matahari. Disapu dari kiri ke kanan: "garis bayangan" turun SUN_SLOPE per u dan naik di puncak bukit.
function terrainWithShadow(game, x0, x1, n) {
  const H = game.ground.height;
  const step = (x1 - x0) / n;
  let line = -Infinity;
  for (let x = x0 - Math.ceil(L.shadowLookback / step) * step; x < x0 - 1e-6; x += step) line = Math.max(line - SUN_SLOPE * step, H(x));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + step * i;
    const y = H(x);
    line = Math.max(line - SUN_SLOPE * step, y);
    pts.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, s: y < line - 0.05 ? 1 : 0 });
  }
  return pts;
}

// Titik di permukaan tempat bayangan dari ketinggian py (di posisi px) jatuh, atau null kalau terlalu jauh.
function shadowPoint(game, px, py, maxDist) {
  const H = game.ground.height;
  for (let d = 0; d <= maxDist; d += 1) if (H(px + d) >= py - SUN_SLOPE * d) return px + d;
  return null;
}

// ---------- Untuk tampilan dan Spesialis ----------
export function snapshotLevel3(game, withPaths = true) {
  const c = game.craft;
  const alt = altitude(game);
  // Permukaan dikirim sebagai titik-titik di sekitar pendarat (tampilan tidak menghitung permukaan sendiri).
  // Di orbit kedua penanda harus terlihat, jadi permukaan dikirim sampai ke titik terjauh.
  const far = game.phase === 'orbit' && game.sites ? Math.max(...['ridge', 'crater'].map((id) => Math.abs(game.sites[id].x - c.x))) + 120 : 0;
  const half = Math.min(1400, Math.max(160, alt * 1.8 + 120, far));
  const terrain = terrainWithShadow(game, c.x - half, c.x + half, withPaths ? 160 : 60);
  const tilt = Math.atan2(Math.sin(c.angle), Math.cos(c.angle)) / DEG;
  const feet = shadowPoint(game, c.x, c.y, half);
  const top = feet === null ? null : shadowPoint(game, c.x, c.y + LANDER_HEIGHT, half);
  const tg = target(game);
  return {
    level: 3,
    phase: game.phase,
    stage: stage(game),
    t: game.t,
    craft: { x: c.x, y: c.y, angle: c.angle, thrusting: game.thrusting, crashed: !!c.crashed },
    craftShadow: feet === null ? null : { x0: feet, x1: top === null ? c.x + half : top },
    altitude: Math.max(0, alt),
    vDown: -c.vy,
    vSide: c.vx,
    tiltDeg: tilt,
    targetDescent: targetDescent(alt),
    hoverThrottle: game.hoverThrottle,
    fuel: game.fuel,
    hasEngine: game.hasEngine,
    maxLandingSpeed: L.maxLandingSpeed,
    maxLandingTiltDeg: tg ? S[tg.id].maxTiltDeg : L.maxLandingTiltDeg,
    sunElevationDeg: L.sunElevationDeg,
    earth: L.earth,
    precision: game.precision,
    slowFactor: game.precision ? S.crater.slowFactor : 1,
    burnInSec: secondsToBurn(game),
    engineLocked: game.phase === 'orbit' && !game.siteChoice,
    sites: game.sites
      ? ['ridge', 'crater'].map((id) => ({
          id,
          name: S[id].name,
          about: S[id].about,
          ice: S[id].ice,
          x: game.sites[id].x,
          y: game.sites[id].y,
          halfWidth: S[id].halfWidth,
          maxTiltDeg: S[id].maxTiltDeg,
          maxStars: S[id].maxStars,
          ...(id === 'crater' ? { bowl: { x: game.sites.crater.bowlX, r: S.crater.craterRadius, depth: S.crater.craterDepth } } : {}),
        }))
      : null,
    siteChoice: game.siteChoice,
    target: tg ? { id: tg.id, dx: tg.dx, over: Math.abs(tg.dx) <= tg.halfWidth } : null,
    direction: game.phase === 'descent' ? directionText(tg) : null,
    touchdown: game.touchdown,
    surface: surfaceView(game),
    terrain,
    trail: withPaths ? game.trail : [],
    lastLog: game.log[game.log.length - 1] || '',
    coach: game.assist ? game.coach : null,
    result: game.result,
  };
}
