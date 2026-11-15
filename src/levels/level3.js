// Level 3: Kutub Selatan Bulan (terinspirasi pendaratan Artemis di kutub selatan; Artemis III kini uji coba di orbit Bumi, pendaratan pertama di Artemis IV).
// Tahap 1: inti pendaratan. Tahap 2: pilihan titik pendaratan dan bayangan panjang dari Matahari rendah.
// Tahap 3: di permukaan (daya, pindai es, kirim data ke Bumi).
//
// Fase awal (tampilan Bumi-Bulan seperti Level 2):
//   - Peluncuran dari Biak ke orbit parkir: engine dan bantuan pilot sama dengan Level 1/2 (launch, tli).
//   - Ke Bulan: lintasan otomatis (hasil simulasi gravitasi Bumi-Bulan, dihitung sekali), bisa dipercepat.
//   - Masuk orbit polar Bulan (LOI): di wilayah Bulan hanya gravitasi Bulan yang dihitung. Saat paling dekat,
//     Navigator mengerem berlawanan arah gerak sampai masuk cincin orbit. Kurang mengerem: lewat (F-ORBIT).
//     Kebanyakan: jatuh (F-CRASH). Bahan bakar roket (peluncuran + LOI) terpisah dari bahan bakar pendarat.
//
// Setelah masuk orbit, tampilan samping: permukaan Bulan berupa garis berbukit (y = ketinggian, x = jarak menyamping).
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
// Fase: launch -> tli -> transfer -> loi -> captured -> orbit -> descent -> landed (permukaan) -> done
// Tahap (untuk snapshot): launch -> transfer -> loi -> pick (pilih titik) -> deorbit (keluar orbit) -> descent (turun)
//   -> landed -> scan / send

import { applyControls, createControls } from '../engine/attitude.js';
import { stepLanderAssist, targetDescent, directionText } from '../engine/landerAssist.js';
import { createFlight, stepFlight, EARTH, positionAngle } from '../engine/flight.js';
import { createAssist, stepAssist } from '../engine/assist.js';
import { CISLUNAR, stepBody } from '../engine/cislunar.js';
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
    phase: 'launch',
    assist: build.assist !== false,
    coach: null,
    // Fase awal (lihat bagian "Fase awal"). Roket punya bahan bakar sendiri, terpisah dari game.fuel (pendarat).
    flight: createFlight({ planet: EARTH, fuel: 1, orbitHoldSec: L.orbitHoldSec }),
    launchAssist: build.assist !== false ? createAssist() : null,
    tliArmed: false,
    secondsToTli: null,
    holdThrust: false,
    space: null, // wahana di tampilan Bumi-Bulan setelah TLI: { x, y, vx, vy, angle }
    spaceT: 0,
    spaceTrail: [],
    rocketFuel: 1,
    earthAngle: 0,
    loi: null,
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
    log: ['Luncurkan roket dari Biak ke orbit parkir.'],
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
  if (game.phase === 'launch' || game.phase === 'tli') return 'launch';
  if (game.phase === 'transfer') return 'transfer';
  if (game.phase === 'loi' || game.phase === 'captured') return 'loi';
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

// ---------- Fase awal: peluncuran, ke Bulan, masuk orbit polar (LOI) ----------
const SPACE_PHASES = ['launch', 'tli', 'transfer', 'loi', 'captured'];
const MOON = CISLUNAR.moon;
const RING = L.moonOrbitRadius;
const moonCirc = (r) => Math.sqrt(MOON.gm / r);
const moonDist = (s) => Math.hypot(s.x - MOON.x, s.y - MOON.y);
const TRANSFER_DT = 1 / 30;

// Lintasan ke Bulan dari orbit parkir (sudut theta, kecepatan tliSpeed), gravitasi Bumi + Bulan,
// sampai masuk wilayah Bulan (moonSoiRadius). Mengembalikan keadaan saat masuk dan titik-titiknya.
function transferFrom(theta, keep) {
  const r0 = CISLUNAR.parkingRadius;
  const v = L.tliSpeed;
  const s = { x: Math.sin(theta) * r0, y: Math.cos(theta) * r0, vx: Math.cos(theta) * v, vy: -Math.sin(theta) * v };
  const pts = [];
  let t = 0;
  while (t < 120) {
    if (keep) pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
    if (moonDist(s) < L.moonSoiRadius) break;
    stepBody(s, [CISLUNAR.earth, MOON], 0, 0, TRANSFER_DT);
    t += TRANSFER_DT;
  }
  return { s, t, pts };
}

// Titik terdekat dan terjauh orbit (hanya gravitasi Bulan) dari keadaan s, diukur dari pusat Bulan.
// Belum terikat (masih lewat): apo = Infinity.
function moonConic(s) {
  const dx = s.x - MOON.x;
  const dy = s.y - MOON.y;
  const r = Math.hypot(dx, dy);
  const eps = (s.vx * s.vx + s.vy * s.vy) / 2 - MOON.gm / r;
  const h = dx * s.vy - dy * s.vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (MOON.gm * MOON.gm)));
  const p = (h * h) / MOON.gm;
  return { peri: p / (1 + e), apo: e < 1 ? p / (1 - e) : Infinity };
}
const moonPeri = (s) => moonConic(s).peri;

// Lintasan nominal (dihitung sekali): sudut berangkat dicari supaya titik terdekat ke Bulan tepat di cincin orbit.
let NOMINAL = null;
function nominal() {
  if (NOMINAL) return NOMINAL;
  let lo = 160 * DEG; // titik terdekat makin kecil kalau sudut makin besar
  let hi = 170 * DEG;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (moonPeri(transferFrom(mid, false).s) > RING) lo = mid;
    else hi = mid;
  }
  const theta = (lo + hi) / 2;
  const tr = transferFrom(theta, true);
  // Bagian di wilayah Bulan sampai titik terdekat, hanya untuk digambar.
  const tail = [];
  const m = { ...tr.s };
  let prev = Infinity;
  for (let i = 0; i < 4000; i++) {
    const r = moonDist(m);
    if (r > prev) break;
    prev = r;
    if (i % 2 === 0) tail.push({ x: Math.round(m.x), y: Math.round(m.y) });
    stepBody(m, [MOON], 0, 0, TRANSFER_DT);
  }
  NOMINAL = { theta, pts: tr.pts, soiT: tr.t, soiState: tr.s, tail };
  return NOMINAL;
}

function sampleTransfer(t) {
  const n = nominal();
  const i = Math.max(0, Math.min(n.pts.length - 2, Math.floor(t / TRANSFER_DT)));
  const a = n.pts[i];
  const b = n.pts[i + 1];
  const f = Math.max(0, Math.min(1, (t - a.t) / TRANSFER_DT));
  const mix = (k) => a[k] + (b[k] - a[k]) * f;
  return { x: mix('x'), y: mix('y'), vx: mix('vx'), vy: mix('vy') };
}

// Jalur target (hijau) untuk tampilan. Snapshot untuk Spesialis memakai titik yang lebih jarang.
const NOMINAL_POINTS = {};
export function nominalPathPoints(every = 6) {
  if (!NOMINAL_POINTS[every]) {
    const n = nominal();
    const pts = n.pts.filter((_, i) => i % every === 0).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    NOMINAL_POINTS[every] = pts.concat(n.tail.filter((_, i) => i % Math.max(1, Math.round(every / 6)) === 0));
  }
  return NOMINAL_POINTS[every];
}

// Cek cincin orbit Bulan, seperti orbitCheck di engine/flight.js untuk Bumi.
function moonOrbitCheck(s) {
  const dx = s.x - MOON.x;
  const dy = s.y - MOON.y;
  const r = Math.hypot(dx, dy);
  const speed = Math.hypot(s.vx, s.vy);
  const radial = (s.vx * dx + s.vy * dy) / r;
  const vCirc = moonCirc(RING);
  const altOk = Math.abs(r - RING) <= L.moonOrbitRadiusTol;
  const speedOk = Math.abs(speed - vCirc) <= vCirc * L.moonOrbitSpeedTol;
  const flatOk = Math.abs(radial) <= L.moonOrbitRadialTol;
  // Indikator untuk Spesialis (lambat / pas / cepat), hanya berarti di dekat cincin.
  const status = !altOk ? null : speed > vCirc * (1 + L.moonOrbitSpeedTol) ? 'cepat' : speed < vCirc * (1 - L.moonOrbitSpeedTol) ? 'lambat' : 'pas';
  return { ok: altOk && speedOk && flatOk, r, speed, radial, vCirc, altOk, speedOk, flatOk, status };
}

const loiAccel = (game) => L.loiAccel / game.massRatio;

function spaceStep(game, ctrl, dt) {
  if (game.phase === 'launch') return launchStep(game, ctrl, dt);
  if (game.phase === 'tli') return tliStep(game, ctrl, dt);
  if (game.phase === 'transfer') return transferStep(game, ctrl, dt);
  return loiStep(game, ctrl, dt);
}

// Peluncuran ke orbit parkir: sama dengan fase 'launch' Level 2.
function launchStep(game, ctrl, dt) {
  const fdt = dt * LEVELS[1].launchTimeScale;
  if (game.launchAssist && ctrl) {
    stepAssist(game.launchAssist, game.flight, ctrl);
    game.coach = { msg: game.launchAssist.msg, urgent: game.launchAssist.urgent };
  }
  stepFlight(game.flight, ctrl, fdt);
  game.thrusting = !!game.flight.thrusting;
  if (game.flight.failCode) return finish(game, false, game.flight.failCode);
  if (game.flight.status === 'orbit') {
    game.phase = 'tli';
    game.thrusting = false;
    if (ctrl) {
      ctrl.throttle = 0;
      ctrl.mode = 'prograde';
    }
    game.log.push('Orbit parkir tercapai. Tekan Gas + untuk berangkat ke Bulan (TLI).');
  }
  return game;
}

// Di orbit parkir: TLI dijalankan saat roket tiba di titik berangkat (seperti fase 'tli' Level 2).
function tliStep(game, ctrl, dt) {
  const f = game.flight;
  stepFlight(f, null, dt);
  if (ctrl && (ctrl.throttle > 0 || ctrl.pulseLeft > 0) && !game.tliArmed) {
    game.tliArmed = true;
    game.log.push('TLI dijadwalkan: menunggu roket tiba di titik berangkat.');
  }
  if (ctrl) {
    ctrl.throttle = 0;
    ctrl.pulseLeft = 0;
  }
  const theta = nominal().theta;
  const omega = Math.hypot(f.vx, f.vy) / Math.hypot(f.x, f.y);
  let diff = theta - positionAngle(f);
  diff = ((diff % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  game.secondsToTli = diff / omega;
  game.coach = game.assist
    ? game.tliArmed
      ? { msg: `TLI dijadwalkan. Mesin menyala otomatis dalam ${Math.ceil(game.secondsToTli)} detik…`, urgent: false }
      : { msg: 'Orbit parkir tercapai! Tekan Gas + untuk berangkat ke Bulan (TLI).', urgent: true }
    : null;
  if (game.tliArmed && (diff < 0.05 || diff > 2 * Math.PI - 0.01)) {
    game.space = { ...sampleTransfer(0), angle: f.angle };
    game.rocketFuel = f.fuel;
    game.earthAngle = f.earthAngle;
    game.flight = null;
    game.spaceT = 0;
    game.secondsToTli = null;
    game.phase = 'transfer';
    game.log.push('TLI selesai, menuju Bulan.');
  }
  return game;
}

// Perjalanan ke Bulan: otomatis mengikuti lintasan nominal. Mesin terkunci.
function transferStep(game, ctrl, dt) {
  const n = nominal();
  game.spaceT += dt;
  game.earthAngle += EARTH.spin * dt;
  if (ctrl) {
    if (game.assist) ctrl.mode = 'retrograde'; // bersiap: mesin menghadap lawan arah gerak untuk mengerem nanti
    ctrl.throttle = 0;
    ctrl.pulseLeft = 0;
  }
  Object.assign(game.space, sampleTransfer(game.spaceT));
  if (ctrl) applyControls(ctrl, game.space, L.turnRate, dt);
  game.thrusting = false;
  pushSpaceTrail(game);
  const left = n.soiT - game.spaceT;
  game.coach = game.assist
    ? { msg: `Menuju Bulan, tiba dalam ${Math.ceil(left)} detik (Percepat ⏩ untuk mempercepat). Wahana diputar lawan arah gerak.`, urgent: false }
    : null;
  if (game.spaceT >= n.soiT) startLoi(game);
  return game;
}

function pushSpaceTrail(game) {
  const tr = game.spaceTrail;
  if (tr.length === 0 || game.spaceT - tr[tr.length - 1].t > 0.25) {
    tr.push({ x: game.space.x, y: game.space.y, t: game.spaceT });
    if (tr.length > 400) tr.shift();
  }
}

// Masuk wilayah Bulan: hitung kapan paling dekat dan kapan sebaiknya mulai mengerem (pengereman berpusat di titik terdekat).
function startLoi(game) {
  const n = nominal();
  Object.assign(game.space, n.soiState);
  const m = { ...n.soiState };
  const dt = 1 / 120;
  let best = Infinity;
  let tPeri = 0;
  let vPeri = 0;
  for (let t = 0; t < L.loiMaxSec; t += dt) {
    const r = moonDist(m);
    if (r > best) break;
    best = r;
    tPeri = t;
    vPeri = Math.hypot(m.vx, m.vy);
    stepBody(m, [MOON], 0, 0, dt);
  }
  const burnSec = Math.max(0, vPeri - moonCirc(RING)) / loiAccel(game);
  // Aba-aba sedikit lebih awal dari tengah pengereman, untuk waktu reaksi dan menaikkan gas.
  const cueAt = tPeri - burnSec / 2 - L.loiReactSec * L.loiTimeScale;
  game.loi = { t: 0, tPeri, rPeri: best, vPeri, cueAt, inRingFor: 0, inRing: false, cut: false, burnedSec: 0, showT: 0 };
  game.phase = 'loi';
  game.log.push('Masuk wilayah Bulan. Saat paling dekat, mengerem lawan arah gerak sampai masuk cincin orbit.');
}

function loiStep(game, ctrl, rawDt) {
  const lo = game.loi;
  const s = game.space;
  const dt = rawDt * L.loiTimeScale;
  lo.t += dt;
  game.spaceT += dt;
  game.earthAngle += EARTH.spin * dt;

  if (game.phase === 'captured') {
    // Sudah di cincin: tampilkan sebentar, lalu pendarat lepas dari roket dan mulai memilih titik.
    if (ctrl) ctrl.throttle = 0;
    stepBody(s, [MOON], 0, 0, dt);
    pushSpaceTrail(game);
    lo.showT += rawDt;
    if (lo.showT >= L.captureShowSec) enterLanderOrbit(game, ctrl);
    return game;
  }

  game.holdThrust = false;
  if (game.assist && ctrl) loiAssist(game, ctrl, moonOrbitCheck(s));
  let throttle = ctrl ? applyControls(ctrl, s, L.turnRate, dt) : 0;
  if (game.holdThrust) throttle = 0;
  const fuelBefore = game.rocketFuel;
  game.thrusting = throttle > 0 && game.rocketFuel > 0;
  let ax = 0;
  let ay = 0;
  if (game.thrusting) {
    const a = loiAccel(game) * throttle;
    ax = Math.sin(s.angle) * a;
    ay = Math.cos(s.angle) * a;
    game.rocketFuel = Math.max(0, game.rocketFuel - L.loiFuelBurnPerSec * throttle * dt);
    lo.burnedSec += dt;
    if (game.rocketFuel === 0 && fuelBefore > 0) game.log.push('Bahan bakar roket habis!');
  }
  stepBody(s, [MOON], ax, ay, dt);
  pushSpaceTrail(game);

  const o = moonOrbitCheck(s);
  lo.inRing = o.ok;
  lo.inRingFor = o.ok ? lo.inRingFor + dt : 0;
  if (o.r <= MOON.radius) {
    game.log.push('Terlalu banyak mengerem: wahana jatuh ke permukaan Bulan.');
    return finish(game, false, 'F-CRASH');
  }
  if (o.r > L.moonSoiRadius && lo.t > lo.tPeri) {
    game.log.push(lo.burnedSec > 0 ? 'Kurang mengerem: wahana melewati Bulan.' : 'Tidak mengerem: wahana melewati Bulan.');
    return finish(game, false, 'F-ORBIT');
  }
  if (lo.inRingFor >= L.orbitHoldSec) {
    // Komputer roket merapikan orbit supaya tetap di cincin (seperti circularize di engine/flight.js).
    const dx = s.x - MOON.x;
    const dy = s.y - MOON.y;
    const r = Math.hypot(dx, dy);
    const v = moonCirc(r);
    const dir = Math.sign(dx * s.vy - dy * s.vx) || 1;
    s.vx = ((-dy * dir) / r) * v;
    s.vy = ((dx * dir) / r) * v;
    game.phase = 'captured';
    game.thrusting = false;
    if (ctrl) ctrl.throttle = 0;
    game.coach = game.assist ? { msg: 'Masuk orbit polar Bulan!', urgent: false } : null;
    game.log.push('Masuk orbit polar Bulan! Pendarat bersiap lepas dari roket.');
    return game;
  }
  if (lo.t > L.loiMaxSec) {
    game.log.push('Belum masuk cincin orbit Bulan.');
    return finish(game, false, 'F-ORBIT');
  }
  return game;
}

// Detik layar sampai aba-aba mengerem (negatif = sudah lewat).
function secondsToLoi(game) {
  const lo = game.loi;
  return lo ? (lo.cueAt - lo.t) / L.loiTimeScale : null;
}

// Bantuan pilot LOI: mengarahkan wahana, memberi aba-aba Gas +, dan mematikan mesin saat orbit sudah pas
// (seperti bantuan peluncuran yang mematikan mesin di puncak lintasan). Gas + ditekan lebih awal = dijadwalkan.
// Kalau orbit masih lonjong setelah mesin dimatikan, bantuan memberi aba-aba koreksi:
//   - titik terjauh terlalu tinggi: mengerem (lawan arah gerak) di titik terdekat;
//   - titik terdekat terlalu rendah: mendorong (searah gerak) di titik terjauh.
function loiAssist(game, ctrl, o) {
  const lo = game.loi;
  const sp = game.space;
  const tol = L.moonOrbitRadiusTol * 0.5;
  const conic = moonConic(sp);
  const apoHigh = conic.apo > RING + tol;
  const periLow = conic.peri < RING - tol;
  // Lewat titik terdekat (jarak berhenti turun) atau titik terjauh (jarak berhenti naik)?
  const prev = lo.prevRadial;
  lo.prevRadial = o.radial;
  const atPeri = prev !== undefined && prev < 0 && o.radial >= 0;
  const atApo = prev !== undefined && prev > 0 && o.radial <= 0;
  if (lo.cut && !o.ok && conic.apo < Infinity) {
    // Titik terdekat yang terlalu rendah dibetulkan dulu (berbahaya), baru titik terjauh.
    if (periLow && atApo) lo.fix = 'raise';
    else if (!periLow && apoHigh && atPeri) lo.fix = 'lower';
    if (lo.fix) {
      lo.cut = false;
      lo.cueAt = lo.t;
      game.log.push(lo.fix === 'lower' ? 'Koreksi orbit: mengerem di titik terdekat.' : 'Koreksi orbit: mendorong searah gerak di titik terjauh.');
    }
  }
  // Arah: searah gerak hanya untuk koreksi "naikkan titik terdekat"; selain itu lawan arah gerak.
  const raising = lo.fix === 'raise' || (lo.cut && periLow);
  ctrl.mode = raising ? 'prograde' : 'retrograde';
  const want = Math.atan2(sp.vx, sp.vy) + (raising ? 0 : Math.PI);
  const aimed = Math.abs(Math.atan2(Math.sin(sp.angle - want), Math.cos(sp.angle - want))) < 0.35;
  const sec = secondsToLoi(game);
  const what = lo.fix === 'raise' ? 'mendorong (searah gerak)' : lo.fix === 'lower' ? 'mengerem lagi' : 'mengerem';
  let msg;
  let urgent = false;
  if (lo.cut) {
    ctrl.throttle = 0;
    msg = o.ok
      ? `Tahan di cincin… ${lo.inRingFor.toFixed(1)} / ${L.orbitHoldSec} detik`
      : `Mesin dimatikan. Orbit masih lonjong: tunggu aba-aba koreksi di titik ${periLow ? 'terjauh' : 'terdekat'}…`;
  } else if (sec > 0) {
    game.holdThrust = true;
    if (ctrl.throttle > 0) msg = `Pengereman dijadwalkan: mesin menyala otomatis dalam ${Math.ceil(sec)} detik…`;
    else if (sec <= L.loiCountdownSec) {
      msg = `Siap mengerem… ${Math.ceil(sec)}`;
      urgent = true;
    } else msg = `Mendekati Bulan. Wahana diarahkan lawan arah gerak. Mengerem dalam ${Math.ceil(sec)} detik.`;
  } else if (ctrl.throttle === 0) {
    msg = `SEKARANG! Tekan Gas + sampai 100% untuk ${what}`;
    urgent = true;
  } else {
    game.holdThrust = !aimed;
    urgent = ctrl.throttle < 1;
    const nums = `kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}`;
    msg = !aimed ? `Memutar wahana untuk ${what}…` : urgent ? `Tambah Gas + sampai 100%! ${nums}` : `${what[0].toUpperCase() + what.slice(1)}… ${nums}`;
    // Mesin dimatikan saat orbit sudah masuk cincin (bantuan mematikan mesin tepat waktu).
    // Saat mengerem, mesin juga dimatikan sebelum titik terdekat turun di bawah cincin (supaya tidak jatuh).
    const done = raising
      ? conic.peri >= RING - tol || o.speed >= moonCirc(o.r) * 1.03
      : conic.apo <= RING + tol || o.speed <= moonCirc(o.r) * 0.97 || conic.peri < RING - L.moonOrbitRadiusTol;
    if (done) {
      ctrl.throttle = 0;
      lo.cut = true;
      lo.fix = null;
    }
  }
  game.coach = { msg, urgent };
}

function enterLanderOrbit(game, ctrl) {
  game.phase = 'orbit';
  game.space = null;
  game.thrusting = false;
  game.holdThrust = false;
  game.coach = null;
  if (ctrl) {
    ctrl.throttle = 0;
    ctrl.pulseLeft = 0;
    ctrl.mode = 'retrograde';
  }
  game.log.push('Pendarat lepas dari roket di orbit rendah Bulan, di atas wilayah kutub selatan. Spesialis: pilih titik pendaratan.');
}

// Prediksi lintasan di wilayah Bulan kalau mesin dimatikan sekarang (garis putus-putus).
function loiPrediction(game, withPaths) {
  const m = { ...game.space };
  const pts = [];
  const dt = 1 / 30;
  const every = withPaths ? 3 : 9;
  for (let i = 0; i < 30 * 14; i++) {
    stepBody(m, [MOON], 0, 0, dt);
    if (i % every === 0) pts.push({ x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10 });
    const r = moonDist(m);
    if (r <= MOON.radius || r > L.moonSoiRadius * 1.4) break;
  }
  return pts;
}

// Kamera: seluruh jalur Bumi-Bulan (seperti Level 2), mendekat ke Bulan saat wahana mendekat.
function spaceCamera(p) {
  const d = p ? moonDist(p) : Infinity;
  const k0 = Math.max(0, Math.min(1, (900 - d) / (900 - L.moonSoiRadius)));
  const k = k0 * k0 * (3 - 2 * k0);
  const lerp = (a, b) => a + (b - a) * k;
  const near = L.moonSoiRadius * 2.2;
  return { x: lerp(-112, MOON.x), y: lerp(535, MOON.y), spanX: lerp(760, near), spanY: lerp(1590, near) };
}

function spaceSnapshot(game, withPaths) {
  const f = game.flight;
  const sp = game.space;
  const c = sp || (f ? { x: f.x, y: f.y, vx: f.vx, vy: f.vy, angle: f.angle } : { x: 0, y: 0, vx: 0, vy: 0, angle: 0 });
  const now = game.phase === 'done' ? game.endedIn : game.phase;
  const o = sp && (now === 'loi' || now === 'captured') ? moonOrbitCheck(sp) : null;
  const lo = game.loi;
  return {
    level: 3,
    space: true,
    phase: game.phase,
    stage: now === 'launch' || now === 'tli' ? 'launch' : now === 'transfer' ? 'transfer' : 'loi',
    t: game.spaceT,
    craft: { x: c.x, y: c.y, angle: c.angle, thrusting: !!game.thrusting },
    fuel: game.fuel, // bahan bakar pendarat (belum dipakai)
    rocketFuel: f ? f.fuel : game.rocketFuel,
    hasEngine: game.hasEngine,
    earthAngle: f ? f.earthAngle : game.earthAngle,
    secondsToTli: game.phase === 'tli' ? game.secondsToTli : null,
    tliArmed: game.tliArmed,
    arriveInSec: game.phase === 'transfer' ? Math.max(0, nominal().soiT - game.spaceT) : null,
    // Saat peluncuran, tampilan memakai gambar orbit Bumi seperti Level 1.
    flight:
      now === 'launch' && f
        ? {
            x: f.x,
            y: f.y,
            vx: f.vx,
            vy: f.vy,
            angle: f.angle,
            fuel: f.fuel,
            status: f.status,
            thrusting: !!f.thrusting,
            earthAngle: f.earthAngle,
            inRing: !!f.inRing,
            inRingFor: f.inRingFor,
            trail: withPaths ? f.trail : [],
          }
        : null,
    camera: spaceCamera(sp),
    moonRing: { r: RING, tol: L.moonOrbitRadiusTol, ok: now === 'captured' || !!(lo && lo.inRing) },
    loi: o
      ? {
          alt: o.r - MOON.radius,
          ringAlt: RING - MOON.radius,
          speed: o.speed,
          vCirc: o.vCirc,
          radial: o.radial,
          altOk: o.altOk,
          speedOk: o.speedOk,
          flatOk: o.flatOk,
          status: o.status,
          inRing: lo.inRing,
          inRingFor: lo.inRingFor,
          hold: L.orbitHoldSec,
          burnInSec: lo.cut || game.phase !== 'loi' ? null : secondsToLoi(game),
          captured: now === 'captured',
        }
      : null,
    nominal: nominalPathPoints(withPaths ? 6 : 24),
    trail: withPaths ? game.spaceTrail : [],
    prediction: sp && game.phase === 'loi' ? loiPrediction(game, withPaths) : [],
    signalLost: false,
    sites: null,
    siteChoice: game.siteChoice,
    surface: null,
    lastLog: game.log[game.log.length - 1] || '',
    coach: game.assist ? game.coach : null,
    result: game.result,
  };
}

// ---------- Langkah per frame ----------
export function stepLevel3(game, ctrl, rawDt) {
  if (game.result) return game;
  if (SPACE_PHASES.includes(game.phase)) return spaceStep(game, ctrl, rawDt);

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
    if (game.phase === 'orbit' && game.siteChoice) startDescent(game);
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
    game.precision = false; // waktu tidak lagi diperlambat setelah menyentuh permukaan
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
    // Mesin terkunci: gas dan dorongan pendek (F) sama-sama diabaikan sampai titik dipilih.
    if (ctrl) {
      ctrl.throttle = 0;
      ctrl.pulseLeft = 0;
    }
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
  // Spektrometer sudah menyala dan pindaian pertama belum dilakukan: minta Pindai dulu, jangan minta dimatikan.
  // Tanpa ini pelatih bolak-balik "nyalakan spektrometer" lalu "matikan spektrometer!" (dekat kawah tanpa RTG).
  // Pengecualian: baterai akan habis sebelum pindaian selesai.
  const needScan = sp.has && !sf.iceFound && sf.scans === 0;
  if (needScan && sp.on && !sf.scan && secLeft > SF.scanSec + 2) return { msg: 'Spesialis: tekan Pindai sekarang.', urgent: true };
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
  const where = game.phase;
  if (where === 'launch' && game.flight && game.flight.failCode) {
    out.push('Peluncuran gagal. Tekan Gas + sampai 100% saat lepas landas, lalu tekan Gas + lagi saat aba-aba SEKARANG di puncak lintasan.');
    return out;
  }
  if (where === 'loi' && failCode === 'F-ORBIT') {
    const lo = game.loi;
    const v = Math.round(moonCirc(RING));
    const passed = moonConic(game.space).apo === Infinity;
    out.push(
      lo.burnedSec === 0
        ? 'Mesin tidak dinyalakan dekat Bulan, jadi wahana melewati Bulan. Saat paling dekat dengan Bulan, arahkan lawan arah gerak (E) dan tekan Gas +.'
        : passed
          ? `Kurang mengerem: kecepatan masih di atas ${v} u/s, jadi wahana melewati Bulan. Mulai mengerem saat paling dekat dengan Bulan (aba-aba SEKARANG) dan biarkan mesin menyala sampai kecepatan sekitar ${v} u/s.`
          : `Orbit terlalu lonjong, tidak masuk cincin. Mulai mengerem tepat saat paling dekat dengan Bulan, dengan gas 100%, sampai kecepatan sekitar ${v} u/s.`,
    );
    if (game.rocketFuel <= 0) out.push('Bahan bakar roket habis saat mengerem. Ikuti aba-aba bantuan pilot saat peluncuran supaya bahan bakar roket tersisa.');
    return out;
  }
  if (where === 'loi' && failCode === 'F-CRASH') {
    out.push(`Terlalu banyak mengerem: wahana jatuh ke Bulan. Matikan mesin (X) saat kecepatan sekitar ${Math.round(moonCirc(RING))} u/s, atau nyalakan bantuan pilot.`);
    return out;
  }
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
  game.endedIn = game.phase;
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
  if (SPACE_PHASES.includes(game.phase) || SPACE_PHASES.includes(game.endedIn)) return spaceSnapshot(game, withPaths);
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
