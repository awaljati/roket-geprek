// Level 4: Mendarat di Mars (terinspirasi Curiosity dan Perseverance NASA).
//
// Fase:
//   - Peluncuran: dari Biak ke orbit parkir, engine dan bantuan pilot sama dengan Level 3 (launch).
//   - Orbit parkir (park): Gas + = berangkat ke Mars (TMI).
//   - Ke Mars (cruise): animasi lintasan Bumi-Mars yang dipercepat (bukan fisika penuh). Ada 2 badai matahari
//     pada waktu acak dari seed. Spesialis melihat radar badai (peringatan warnSec detik sebelumnya), Navigator
//     mematikan instrumen. Instrumen menyala saat badai dan tidak ada pelindung radiasi: kamera rusak (P-STORM).
//   - Program pendaratan (program, waktu berhenti): Navigator mengatur sudut masuk dan ketinggian roket pendarat
//     menyala, Spesialis mengatur ketinggian parasut dibuka lalu menekan Siap. Navigator memulai masuk atmosfer.
//   - "Tujuh menit penuh ketegangan" (edl): animasi otomatis, pemain tidak bisa mengendalikan. Hasilnya ditentukan
//     program: tanpa Paket Pendaratan Mars F-ATMO, sudut di luar rentang F-ENTRY, parasut terlalu tinggi (robek)
//     atau terlalu rendah F-CHUTE, roket pendarat terlambat F-HARD, menyala terlalu tinggi / bahan bakar kurang F-FUEL.
//   - Di permukaan (landed): Spesialis menekan Kirim foto. Butuh antena besar dan daya cukup (panel surya 40%).
//     Kurang: foto sebagian (P-ANTENNA).
//
// Bintang: 1 = mendarat (kamera rusak atau foto sebagian), 2 = foto penuh,
//          3 = foto penuh + sisa bahan bakar ≥ minFuelFor3Stars + anggaran hemat (tanpa dana cadangan).

import { createFlight, stepFlight, EARTH } from '../engine/flight.js';
import { createAssist, stepAssist } from '../engine/assist.js';
import { makeRng } from '../engine/rng.js';
import { LEVELS, ROCKETS, BODIES } from '../data/levels.js';
import { missionReward } from './reward.js';
import { itemById, ITEMS } from '../data/items.js';

const L = LEVELS[4];
const E = L.edl;
const SF = L.surface;

// ---------- Rakit ----------
export const RAKIT_ITEMS = ITEMS.filter((it) => !it.cubesat && it.id !== 'fuel' && it.level <= 4);
export const DEFAULT_BUILD = { items: ['mars-edl', 'antenna-l', 'panel-l', 'battery'], fuel: 0.6, assist: true };

export function buildCheck(build) {
  const body = BODIES[L.body];
  const items = build.items.map(itemById);
  const fuelMass = Math.round(build.fuel * 10) * itemById('fuel').mass;
  const mass = body.mass + items.reduce((m, it) => m + it.mass, 0) + fuelMass;
  const price = items.reduce((p, it) => p + it.price, 0) + Math.round(build.fuel * 10) * itemById('fuel').price;
  const cap = ROCKETS[L.rocket].capacityKg;
  const missingEdl = !build.items.includes(L.requiredItem);
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
    missingEdl,
    // Peringatan tetap boleh diluncurkan, supaya pemain melihat akibatnya di Debrief.
    warn: missingEdl ? `Tanpa ${itemById(L.requiredItem).name}, wahana tidak bisa melewati atmosfer Mars (F-ATMO).` : null,
  };
}

// ---------- Mulai ----------
export function createLevel4(build, seed = 'solo') {
  const rng = makeRng(seed + '-L4');
  const check = buildCheck(build);
  const has = (id) => build.items.includes(id);
  const game = {
    level: 4,
    build,
    check,
    phase: 'launch',
    assist: build.assist !== false,
    coach: null,
    noWarp: false, // flight.js: percepat waktu dimatikan saat badai mendekat
    flight: createFlight({ planet: EARTH, fuel: 1, orbitHoldSec: L.orbitHoldSec }),
    launchAssist: build.assist !== false ? createAssist() : null,
    rocketFuel: 1,
    fuel: build.fuel, // bahan bakar roket pendarat (slider Rakit)
    hasEdl: has('mars-edl'),
    radShield: has('rad-shield'),
    massRatio: Math.max(1, check.mass / L.retroFuel.refMassKg),
    cruise: null,
    storms: makeStorms(rng),
    instrumentsOn: true,
    cameraDamaged: false,
    stormHits: 0,
    program: { entryDeg: L.entry.startDeg, chuteKm: L.chute.startKm, retroKm: L.retro.startKm, ready: false, locked: false },
    edl: null,
    surface: null,
    log: ['Luncurkan roket dari Biak ke orbit parkir.'],
    result: null,
  };
  if (check.tooHeavy) return finish(game, false, 'F-HEAVY');
  return game;
}

// Badai matahari: rentang waktu mulai dibagi rata, satu bagian untuk tiap badai, supaya tidak bertumpuk.
function makeStorms(rng) {
  const S = L.storms;
  const between = ([a, b]) => a + rng() * (b - a);
  const [s0, s1] = S.startSec;
  const slot = (s1 - s0) / S.count;
  const out = [];
  for (let i = 0; i < S.count; i++) {
    const from = between([s0 + i * slot, s0 + (i + 0.5) * slot]);
    out.push({ from, to: from + between(S.durationSec), hit: false });
  }
  return out;
}

// ---------- Langkah per frame ----------
export function stepLevel4(game, ctrl, rawDt) {
  if (game.result) return game;
  if (game.phase === 'launch') return launchStep(game, ctrl, rawDt);
  if (game.phase === 'park') return parkStep(game, ctrl, rawDt);
  if (ctrl) {
    // Setelah peluncuran mesin Navigator tidak dipakai lagi: semua otomatis atau lewat tombol program.
    ctrl.throttle = 0;
    ctrl.pulseLeft = 0;
  }
  game.thrusting = false;
  if (game.phase === 'cruise') return cruiseStep(game, rawDt);
  if (game.phase === 'program') {
    game.coach = programCoach(game);
    return game; // waktu berhenti
  }
  if (game.phase === 'edl') return edlStep(game, rawDt);
  if (game.phase === 'landed') return surfaceStep(game, rawDt);
  return game;
}

// Peluncuran ke orbit parkir: sama dengan fase 'launch' Level 3.
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
    game.phase = 'park';
    game.thrusting = false;
    if (ctrl) {
      ctrl.throttle = 0;
      ctrl.mode = 'prograde';
    }
    game.log.push('Orbit parkir tercapai. Tekan Gas + untuk berangkat ke Mars (TMI).');
  }
  return game;
}

// Di orbit parkir: Gas + menyalakan TMI (trans-Mars injection), lalu perjalanan ke Mars dimulai.
function parkStep(game, ctrl, dt) {
  const f = game.flight;
  stepFlight(f, null, dt);
  game.coach = game.assist ? { msg: 'Orbit parkir tercapai! Tekan Gas + untuk berangkat ke Mars (TMI).', urgent: true } : null;
  if (ctrl && (ctrl.throttle > 0 || ctrl.pulseLeft > 0)) {
    ctrl.throttle = 0;
    ctrl.pulseLeft = 0;
    game.rocketFuel = f.fuel;
    game.flight = null;
    game.cruise = { t: 0 };
    game.phase = 'cruise';
    game.log.push('TMI selesai, menuju Mars. Spesialis: awasi radar badai matahari.');
  }
  return game;
}

// ---------- Ke Mars ----------
const stormAt = (game, t) => game.storms.find((s) => t >= s.from && t < s.to);
const nextStorm = (game, t) => game.storms.find((s) => s.from > t);

function cruiseStep(game, dt) {
  const cr = game.cruise;
  cr.t += dt;
  const storm = stormAt(game, cr.t);
  if (storm) {
    if (!storm.started) {
      storm.started = true;
      game.log.push(game.radShield ? 'Badai matahari lewat. Pelindung radiasi melindungi instrumen.' : 'BADAI MATAHARI lewat!');
    }
    if (game.instrumentsOn && !game.radShield && !storm.hit) {
      storm.hit = true;
      game.stormHits++;
      if (!game.cameraDamaged) game.log.push('Instrumen menyala saat badai: kamera rusak terkena radiasi!');
      game.cameraDamaged = true;
    }
  }
  const next = nextStorm(game, cr.t);
  const warnIn = next ? next.from - cr.t : null;
  game.noWarp = !!storm || (warnIn !== null && warnIn <= L.storms.warnSec + 2);
  if (cr.t >= L.cruiseSec) {
    game.phase = 'program';
    game.noWarp = false;
    game.log.push('Mendekati Mars. Waktu berhenti: susun program pendaratan.');
    game.coach = programCoach(game);
    return game;
  }
  game.coach = game.assist ? cruiseCoach(game, storm, warnIn) : null;
  return game;
}

function cruiseCoach(game, storm, warnIn) {
  const left = Math.ceil(L.cruiseSec - game.cruise.t);
  if (storm) {
    if (game.radShield) return { msg: 'Badai matahari lewat. Pelindung radiasi melindungi instrumen.', urgent: false };
    return game.instrumentsOn
      ? { msg: 'BADAI! Matikan instrumen (I) sekarang!', urgent: true }
      : { msg: 'Badai matahari lewat. Instrumen aman karena dimatikan. Tunggu badai lewat.', urgent: false };
  }
  if (warnIn !== null && warnIn <= L.storms.warnSec && !game.radShield) {
    return game.instrumentsOn
      ? { msg: `Spesialis melihat badai di radar: ${Math.ceil(warnIn)} detik lagi! Navigator, matikan instrumen (I).`, urgent: true }
      : { msg: `Instrumen mati. Badai datang dalam ${Math.ceil(warnIn)} detik.`, urgent: false };
  }
  if (!game.instrumentsOn) return { msg: 'Badai sudah lewat: nyalakan lagi instrumen (I). Program pendaratan butuh instrumen.', urgent: true };
  return { msg: `Menuju Mars, tiba dalam ${left} detik (Percepat ⏩ untuk mempercepat). Spesialis mengawasi radar badai.`, urgent: false };
}

// Posisi untuk animasi (bukan fisika): setengah elips Hohmann dari orbit Bumi (r = 1) ke orbit Mars (r = 1,52).
// Selama perjalanan Bumi bergerak ~255° dan Mars ~136°, jadi Mars tiba di ujung elips tepat saat wahana tiba.
const MARS_R = 1.52;
function cruiseView(game) {
  const p = game.cruise ? Math.min(1, game.cruise.t / L.cruiseSec) : 0;
  const a = (1 + MARS_R) / 2;
  const e = (MARS_R - 1) / (MARS_R + 1);
  const nu = Math.PI * p;
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  const start = 200; // sudut Bumi saat berangkat (derajat), hanya tampilan
  const t = game.cruise ? game.cruise.t : 0;
  const storm = stormAt(game, t);
  const next = nextStorm(game, t);
  const warnIn = next ? next.from - t : null;
  return {
    progress: p,
    arriveInSec: Math.max(0, L.cruiseSec - t),
    startDeg: start,
    earthDeg: start + 255 * p,
    marsDeg: start + 44 + 136 * p,
    craft: { r, deg: start + 180 * p },
    marsR: MARS_R,
    transfer: { a, e },
    stormActive: !!storm,
    stormProgress: storm ? (t - storm.from) / (storm.to - storm.from) : null,
    // Hanya yang terlihat di radar Spesialis: badai dalam warnSec detik.
    stormInSec: warnIn !== null && warnIn <= L.storms.warnSec ? warnIn : null,
    stormWarnSec: L.storms.warnSec,
    stormsLeft: game.storms.filter((s) => s.from > t).length + (storm ? 1 : 0),
  };
}

// ---------- Program pendaratan ----------
const inRange = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v) => String(+v.toFixed(2)).replace('.', ',');

function programCoach(game) {
  const pr = game.program;
  if (!game.assist) return null;
  if (!game.instrumentsOn) return { msg: 'Nyalakan instrumen (I): komputer pendaratan butuh instrumen.', urgent: true };
  const [elo, ehi] = L.entry.safeDeg;
  const [rlo, rhi] = L.retro.safeKm;
  if (!inRange(pr.entryDeg, L.entry.safeDeg)) return { msg: `Navigator: atur sudut masuk (U/O) ke ${elo}° sampai ${ehi}°. Sekarang ${fmt(pr.entryDeg)}°.`, urgent: false };
  if (!inRange(pr.retroKm, L.retro.safeKm)) return { msg: `Navigator: atur roket pendarat (J/L) menyala di ${fmt(rlo)}–${fmt(rhi)} km. Sekarang ${fmt(pr.retroKm)} km.`, urgent: false };
  if (!pr.ready) return { msg: 'Spesialis: atur ketinggian parasut dibuka, lalu tekan Siap.', urgent: false };
  return { msg: 'Program siap. Navigator: tekan Mulai masuk atmosfer (Enter).', urgent: true };
}

// ---------- Tujuh menit penuh ketegangan ----------
// Rencana dihitung sekali saat program dikunci; animasi hanya memutar rencana itu.
function planEdl(game) {
  const pr = game.program;
  const [elo, ehi] = L.entry.safeDeg;
  const [clo, chi] = L.chute.safeKm;
  const [rlo, rhi] = L.retro.safeKm;
  const F = L.retroFuel;
  const tRetro = E.totalSec - (pr.retroKm * 1000) / E.retroDescentMs;
  const plan = { chuteKm: pr.chuteKm, retroKm: pr.retroKm, entryDeg: pr.entryDeg, tRetro, failCode: null, failAt: null, why: null, fuelUsed: 0 };
  const fail = (code, at, why) => Object.assign(plan, { failCode: code, failAt: at, why });
  if (!game.hasEdl) return fail('F-ATMO', E.peakHeatSec + 10, 'burn');
  if (pr.entryDeg < elo) return fail('F-ENTRY', E.peakHeatSec - 10, 'steep');
  if (pr.entryDeg > ehi) return fail('F-ENTRY', 60, 'skip');
  if (pr.chuteKm > chi) return fail('F-CHUTE', E.chuteAtSec + 15, 'tear');
  if (pr.chuteKm < clo) return fail('F-CHUTE', E.chuteAtSec + 12, 'low');
  // Roket pendarat: menyala di retroKm. Bahan bakar menentukan berapa km yang bisa direm (maks. rhi km).
  const need = (km) => (F.base + F.perKm * km) * game.massRatio;
  const coverKm = Math.min(rhi, Math.max(0, (game.fuel / game.massRatio - F.base) / F.perKm));
  if (pr.retroKm > coverKm + 1e-9) {
    plan.outKm = pr.retroKm - coverKm; // bahan bakar habis di ketinggian ini
    plan.fuelUsed = game.fuel;
    const tOut = tRetro + (coverKm * 1000) / E.retroDescentMs;
    return fail('F-FUEL', Math.min(E.totalSec, tOut + 8), pr.retroKm > rhi ? 'early' : 'fuel');
  }
  plan.fuelUsed = need(pr.retroKm);
  if (pr.retroKm < rlo) return fail('F-HARD', E.totalSec, 'late');
  return plan;
}

function edlStep(game, rawDt) {
  const ed = game.edl;
  const before = ed.t;
  ed.t = Math.min(E.totalSec, ed.t + rawDt * E.timeScale);
  const p = ed.plan;
  const passed = (at) => before < at && ed.t >= at;
  // Catatan peristiwa untuk Spesialis dan Navigator
  if (passed(1)) game.log.push('Masuk atmosfer Mars. Mulai sekarang semuanya otomatis.');
  if (game.hasEdl && passed(E.peakHeatSec)) game.log.push('Panas puncak: pelindung panas membara.');
  if (!p.failCode || p.failAt > E.chuteAtSec) {
    if (passed(E.chuteAtSec)) game.log.push(`Parasut dibuka di ${fmt(p.chuteKm)} km.`);
    if (passed(E.chuteAtSec + 20)) game.log.push('Pelindung panas dilepas.');
    if (passed(p.tRetro)) game.log.push(`Roket pendarat menyala di ${fmt(p.retroKm)} km.`);
  }
  if (p.failCode && ed.t >= p.failAt) {
    game.log.push(
      {
        burn: 'Tanpa Paket Pendaratan Mars, wahana terbakar di atmosfer.',
        steep: 'Sudut masuk terlalu curam: wahana terlalu panas dan hancur.',
        skip: 'Sudut masuk terlalu landai: wahana memantul kembali ke angkasa.',
        tear: 'Parasut dibuka terlalu tinggi dan terlalu cepat: parasut robek.',
        low: 'Parasut dibuka terlalu rendah: tidak sempat memperlambat, wahana menabrak tanah.',
        late: 'Roket pendarat menyala terlambat: mendarat terlalu cepat.',
        early: 'Roket pendarat menyala terlalu tinggi: bahan bakar habis di udara.',
        fuel: 'Bahan bakar roket pendarat habis sebelum menyentuh tanah.',
      }[p.why],
    );
    game.fuel = Math.max(0, game.fuel - p.fuelUsed);
    return finish(game, false, p.failCode);
  }
  if (ed.t >= E.totalSec) {
    game.fuel = Math.max(0, game.fuel - p.fuelUsed);
    ed.landedAt = ed.t;
    game.log.push('MENDARAT di Mars! Sinyal tiba di Bumi.');
    startSurface(game);
    return game;
  }
  // Hitung mundur tetap tampil tanpa bantuan pilot: itulah inti "tujuh menit".
  game.coach = edlCoach(game);
  return game;
}

// Tahap EDL saat ini (untuk tampilan): entry -> chute -> retro -> landed, atau kegagalan.
function edlStage(ed) {
  const p = ed.plan;
  const t = ed.t;
  if (p.failCode && p.failAt <= E.chuteAtSec && t > p.failAt - 25) return p.why; // burn / steep / skip
  if (t < E.chuteAtSec) return 'entry';
  if (p.why === 'tear' || p.why === 'low') return p.why;
  if (t < p.tRetro) return 'chute';
  if (p.why === 'early' || p.why === 'fuel') {
    const tOut = p.failAt - 8;
    if (t >= tOut) return p.why;
  }
  return 'retro';
}

const smooth = (x) => x * x * (3 - 2 * x);

// Ketinggian (km) dan kecepatan (m/s) untuk animasi.
function edlState(ed) {
  const p = ed.plan;
  const t = ed.t;
  const st = edlStage(ed);
  const C = E.chuteAtSec;
  let alt;
  let speed;
  // Turun di atmosfer menuju ketinggian parasut (kecepatan dari 5,4 km/s ke ~400 m/s).
  const entryAlt = (tt) => p.chuteKm + (E.entryKm - p.chuteKm) * (1 - Math.min(1, tt / C)) ** 1.6;
  const entrySpeed = (tt) => 400 + 5000 * (1 - smooth(Math.min(1, tt / (C * 0.8))));
  if (st === 'skip' || st === 'steep' || st === 'burn') {
    // Gagal sebelum parasut: mengikuti lintasan masuk biasa, lalu memantul naik (skip) atau jatuh lebih cepat (steep).
    const k = smooth(Math.min(1, Math.max(0, (t - (p.failAt - 25)) / 25)));
    alt = entryAlt(t) + (st === 'skip' ? 40 * k : st === 'steep' ? -25 * k : 0);
    speed = entrySpeed(t) * (st === 'skip' ? 1 : 1 + 0.2 * k);
  } else if (st === 'entry') {
    alt = entryAlt(t);
    speed = entrySpeed(t);
  } else if (st === 'tear' || st === 'low') {
    // parasut robek atau dibuka terlalu rendah: jatuh sampai tanah
    const k = Math.min(1, (t - C) / (p.failAt - C));
    alt = p.chuteKm * (1 - k);
    speed = st === 'tear' ? 420 : 300;
  } else {
    // parasut: dari chuteKm ke retroKm; roket pendarat: dari retroKm ke tanah
    const chuteK = Math.min(1, (t - C) / Math.max(1, p.tRetro - C));
    if (t < p.tRetro) {
      alt = p.chuteKm + (p.retroKm - p.chuteKm) * chuteK;
      speed = 400 - 320 * smooth(Math.min(1, chuteK * 3));
    } else {
      const k = Math.min(1, (t - p.tRetro) / Math.max(1, E.totalSec - p.tRetro));
      alt = p.retroKm * (1 - k);
      speed = 80 - 79 * smooth(k);
      if (p.why === 'late') speed = Math.max(speed, 40);
      if (st === 'early' || st === 'fuel') {
        const tOut = p.failAt - 8;
        const kk = Math.min(1, (t - tOut) / 8);
        const outAlt = p.outKm;
        alt = outAlt * (1 - kk);
        speed = 20 + 40 * kk;
      }
    }
  }
  const heat = st === 'entry' || st === 'steep' || st === 'burn' ? Math.max(0, Math.sin(Math.min(1, t / (E.peakHeatSec * 2)) * Math.PI)) * (st === 'entry' ? 1 : 1.4) : 0;
  return {
    t,
    stage: st,
    alt: Math.max(0, alt),
    speed: Math.max(0, speed),
    heat: Math.min(1.4, heat),
    // Parasut (dan cangkang belakang) dilepas saat roket pendarat menyala.
    chuteOpen: (st === 'chute' || st === 'low') && t >= C,
    chuteTorn: st === 'tear',
    shieldOff: t >= C + 20 && st !== 'tear' && st !== 'low',
    retroOn: st === 'retro' && t >= p.tRetro,
    hard: p.why === 'late',
    clockLeft: Math.max(0, E.totalSec - t),
    totalSec: E.totalSec,
    signalDelayMin: E.signalDelayMin,
    entryDeg: p.entryDeg,
    safeDeg: L.entry.safeDeg,
    crashed: false,
  };
}

function edlCoach(game) {
  const s = edlState(game.edl);
  const mm = Math.floor(s.clockLeft / 60);
  const ss = String(Math.floor(s.clockLeft % 60)).padStart(2, '0');
  const clock = `${mm}:${ss}`;
  const msg = {
    entry: s.t < E.peakHeatSec * 1.6 ? `Tujuh menit penuh ketegangan… ${clock}. Pelindung panas menahan gesekan atmosfer.` : `Melambat di atmosfer… ${clock}. Bersiap membuka parasut.`,
    chute: `Parasut terbuka! ${clock}`,
    retro: `Roket pendarat menyala! ${clock}`,
    burn: 'Wahana terlalu panas…',
    steep: 'Terlalu curam! Wahana terlalu panas…',
    skip: 'Terlalu landai! Wahana memantul…',
    tear: 'Parasut robek!',
    low: 'Parasut terlambat dibuka!',
    early: 'Bahan bakar roket pendarat menipis…',
    fuel: 'Bahan bakar roket pendarat menipis…',
  }[s.stage];
  return { msg: msg || clock, urgent: false };
}

// ---------- Di permukaan: foto pertama ----------
function startSurface(game) {
  const items = game.build.items.map(itemById);
  const antennas = items.filter((it) => it.id.startsWith('antenna'));
  const big = itemById(SF.photoAntenna);
  const best = antennas.reduce((m, it) => (it.data > m.data ? it : m), { data: 0, power: 0, name: null, id: null });
  const store = SF.roverBatteryWh + items.reduce((s, it) => s + it.storeWh, 0);
  game.phase = 'landed';
  game.surface = {
    t: 0,
    battery: store,
    batteryMax: store,
    panelPower: Math.round(items.reduce((s, it) => s + (it.deployable && it.power > 0 ? it.power : 0), 0) * SF.solarShare),
    panelFull: items.reduce((s, it) => s + (it.deployable && it.power > 0 ? it.power : 0), 0),
    rtgPower: items.reduce((s, it) => s + (!it.deployable && it.power > 0 ? it.power : 0), 0),
    basePower: BODIES[L.body].basePower,
    antenna: { id: best.id, name: best.name, power: best.power },
    hasBig: !!antennas.find((it) => it.id === SF.photoAntenna),
    // Antena selain antena besar hanya bisa mengirim sebagian foto.
    cap: best.id ? Math.min(1, best.data / big.data) : 0,
    sending: false,
    pressed: false,
    progress: 0,
    stopped: null, // 'power' | 'antenna' saat pengiriman berhenti sebelum penuh
    powerNet: 0,
  };
  game.coach = { msg: 'MENDARAT di Mars!', urgent: false };
}

function surfaceStep(game, dt) {
  const sf = game.surface;
  sf.t += dt;
  if (sf.t < L.landedHoldSec) return game;
  const load = sf.basePower + (sf.sending ? sf.antenna.power : 0);
  sf.powerNet = sf.sending ? sf.panelPower + sf.rtgPower + load : 0; // rover tidur sampai foto dikirim
  if (sf.sending) {
    sf.battery = Math.min(sf.batteryMax, sf.battery + sf.powerNet * SF.whPerWattSec * dt);
    if (sf.battery <= 0) {
      sf.battery = 0;
      sf.sending = false;
      sf.stopped = 'power';
      game.log.push(`Daya habis saat mengirim foto: hanya ${Math.round(sf.progress * 100)}% terkirim.`);
      return finish(game, true, game.cameraDamaged ? 'P-STORM' : 'P-ANTENNA');
    }
    sf.progress = Math.min(sf.cap, sf.progress + dt / SF.photoSec);
    if (sf.progress >= sf.cap - 1e-9) {
      sf.progress = sf.cap;
      sf.sending = false;
      if (sf.cap >= 1) {
        game.log.push(game.cameraDamaged ? 'Foto terkirim, tapi rusak karena kamera terkena badai.' : 'Foto pertama dari Mars terkirim penuh!');
        return finish(game, true, game.cameraDamaged ? 'P-STORM' : null);
      }
      sf.stopped = 'antenna';
      game.log.push(`Antena terlalu kecil: hanya ${Math.round(sf.progress * 100)}% foto terkirim.`);
      return finish(game, true, game.cameraDamaged ? 'P-STORM' : 'P-ANTENNA');
    }
  }
  if (!sf.antenna.id && sf.t >= L.landedHoldSec + 4) {
    game.log.push('Tidak ada antena: foto tidak bisa dikirim ke Bumi.');
    return finish(game, true, game.cameraDamaged ? 'P-STORM' : 'P-ANTENNA');
  }
  if (sf.t >= SF.timeSec && !sf.pressed) {
    game.log.push('Waktu habis: foto tidak dikirim.');
    return finish(game, true, game.cameraDamaged ? 'P-STORM' : 'P-ANTENNA');
  }
  if (game.assist) game.coach = surfaceCoach(game);
  return game;
}

function surfaceCoach(game) {
  const sf = game.surface;
  if (sf.sending) return { msg: `Mengirim foto… ${Math.round(sf.progress * 100)}% · daya ${sf.powerNet > 0 ? '+' : ''}${Math.round(sf.powerNet)} W`, urgent: false };
  if (!sf.antenna.id) return { msg: 'Tidak ada antena: foto tidak bisa dikirim ke Bumi.', urgent: true };
  return { msg: `Spesialis: tekan Kirim foto (4). Sisa ${Math.ceil(SF.timeSec - sf.t)} detik.`, urgent: true };
}

// ---------- Perintah ----------
// Navigator: instrumentsToggle, entryDown/Up, retroDown/Up, lockProgram. Spesialis: chuteDown/Up, programReady, sendPhoto.
export function command(game, cmd) {
  if (game.result) return game;
  const pr = game.program;
  if (cmd === 'instrumentsToggle' && (game.phase === 'cruise' || game.phase === 'program')) {
    game.instrumentsOn = !game.instrumentsOn;
    game.log.push(`Instrumen ${game.instrumentsOn ? 'dinyalakan' : 'dimatikan'}.`);
  }
  if (game.phase === 'program' && !pr.locked) {
    const step = (key, cfg, dir) => {
      const lo = cfg.minDeg ?? cfg.minKm;
      const hi = cfg.maxDeg ?? cfg.maxKm;
      const st = cfg.stepDeg ?? cfg.stepKm;
      pr[key] = +clamp(pr[key] + dir * st, lo, hi).toFixed(2);
    };
    // Sudut masuk negatif: "turun" = lebih curam (lebih negatif).
    if (cmd === 'entryDown') step('entryDeg', L.entry, -1);
    if (cmd === 'entryUp') step('entryDeg', L.entry, 1);
    if (cmd === 'retroDown') step('retroKm', L.retro, -1);
    if (cmd === 'retroUp') step('retroKm', L.retro, 1);
    if (cmd === 'chuteDown' || cmd === 'chuteUp') {
      step('chuteKm', L.chute, cmd === 'chuteUp' ? 1 : -1);
      pr.ready = false; // diubah lagi = harus menekan Siap lagi
    }
    if (cmd === 'programReady') {
      pr.ready = !pr.ready;
      game.log.push(pr.ready ? `Spesialis siap: parasut dibuka di ${fmt(pr.chuteKm)} km.` : 'Spesialis mengubah program parasut.');
    }
    if (cmd === 'lockProgram' && pr.ready && game.instrumentsOn) {
      pr.locked = true;
      game.edl = { t: 0, plan: planEdl(game) };
      game.phase = 'edl';
      game.log.push(`Program dikunci: sudut ${fmt(pr.entryDeg)}°, parasut ${fmt(pr.chuteKm)} km, roket pendarat ${fmt(pr.retroKm)} km.`);
    }
  }
  if (cmd === 'sendPhoto' && game.phase === 'landed') {
    const sf = game.surface;
    if (sf.t >= L.landedHoldSec && !sf.pressed && sf.antenna.id) {
      sf.pressed = true;
      sf.sending = true;
      game.log.push(`Mengirim foto pertama lewat ${sf.antenna.name.toLowerCase()}…`);
    }
  }
  return game;
}

// ---------- Selesai ----------
function finish(game, success, failCode) {
  const fuelLeft = game.fuel;
  const sf = game.surface;
  const photoShare = sf ? sf.progress : 0;
  const photoFull = photoShare >= 1 && !game.cameraDamaged;
  const frugal = game.check.price <= L.budget; // hemat: tanpa dana cadangan
  let stars = 0;
  if (success) stars = photoFull ? 2 : 1;
  if (success && photoFull && fuelLeft >= L.minFuelFor3Stars && frugal) stars = 3;
  const score = success ? stars * 1000 + Math.round(fuelLeft * 500) + Math.max(0, (L.budget - game.check.price) * 5) : 0;
  const reward = missionReward({ success, stars, budget: game.check.budget, price: game.check.price });
  const pr = game.program;
  game.result = {
    success,
    failCode,
    stars,
    score,
    fuelLeft,
    photos: photoFull ? 1 : 0,
    reward,
    photoShare: Math.round(photoShare * 100) / 100,
    cameraDamaged: game.cameraDamaged,
    program: game.edl ? { entryDeg: pr.entryDeg, chuteKm: pr.chuteKm, retroKm: pr.retroKm } : null,
    frugal,
    advice: adviceFor(game, success, failCode, { frugal, photoShare }),
  };
  game.endedIn = game.phase;
  game.phase = 'done';
  return game;
}

// Debrief: sebab gagal (atau kurang bintang) dan cara memperbaikinya.
function adviceFor(game, success, failCode, { frugal, photoShare }) {
  const out = [];
  const pr = game.program;
  const p = game.edl ? game.edl.plan : null;
  const [elo, ehi] = L.entry.safeDeg;
  const [clo, chi] = L.chute.safeKm;
  const [rlo, rhi] = L.retro.safeKm;
  if (failCode === 'F-HEAVY') out.push('Wahana terlalu berat untuk roket besar. Kurangi bahan bakar atau item di Rakit.');
  if (game.phase === 'launch' && game.flight && game.flight.failCode) {
    out.push('Peluncuran gagal. Tekan Gas + sampai 100% saat lepas landas, lalu tekan Gas + lagi saat aba-aba SEKARANG di puncak lintasan.');
    return out;
  }
  if (failCode === 'F-ATMO') out.push(`Pasang ${itemById(L.requiredItem).name} di Rakit: isinya pelindung panas, parasut, dan roket pendarat. Tanpa itu wahana terbakar di atmosfer Mars.`);
  if (failCode === 'F-ENTRY' && p)
    out.push(
      p.why === 'steep'
        ? `Sudut masuk ${fmt(pr.entryDeg)}° terlalu curam: wahana terlalu panas. Navigator: naikkan sudut (O) ke ${elo}° sampai ${ehi}°.`
        : `Sudut masuk ${fmt(pr.entryDeg)}° terlalu landai: wahana memantul ke angkasa. Navigator: turunkan sudut (U) ke ${elo}° sampai ${ehi}°.`,
    );
  if (failCode === 'F-CHUTE' && p)
    out.push(
      p.why === 'tear'
        ? `Parasut dibuka di ${fmt(pr.chuteKm)} km, saat wahana masih terlalu cepat, jadi parasut robek. Spesialis: buka parasut lebih rendah, ${clo}–${chi} km.`
        : `Parasut dibuka di ${fmt(pr.chuteKm)} km, terlalu rendah untuk sempat memperlambat. Spesialis: buka parasut lebih tinggi, ${clo}–${chi} km.`,
    );
  if (failCode === 'F-HARD') out.push(`Roket pendarat menyala di ${fmt(pr.retroKm)} km, terlambat. Navigator: nyalakan di ${fmt(rlo)}–${fmt(rhi)} km supaya sempat melambat.`);
  if (failCode === 'F-FUEL' && p)
    out.push(
      p.why === 'early'
        ? `Roket pendarat menyala di ${fmt(pr.retroKm)} km, terlalu tinggi: bahan bakarnya habis sebelum menyentuh tanah. Nyalakan di ${fmt(rlo)}–${fmt(rhi)} km.`
        : 'Bahan bakar roket pendarat tidak cukup. Tambah bahan bakar di Rakit, atau nyalakan roket pendarat lebih rendah (tetap di atas ' + fmt(rlo) + ' km).',
    );
  if (game.cameraDamaged)
    out.push('Kamera rusak karena instrumen menyala saat badai matahari. Navigator: matikan instrumen (I) saat Spesialis melihat badai di radar, atau pasang Pelindung radiasi.');
  if (success) {
    const sf = game.surface;
    if (photoShare < 1) {
      if (!sf.antenna.id) out.push('Tidak ada antena: pasang Antena besar di Rakit.');
      else if (!sf.hasBig) out.push(`${sf.antenna.name} hanya bisa mengirim ${Math.round(sf.cap * 100)}% foto. Pasang Antena besar di Rakit.`);
      else if (sf.stopped === 'power')
        out.push(
          `Daya habis saat mengirim (butuh ${-(sf.basePower + sf.antenna.power)} W). Di Mars panel surya hanya menghasilkan ${Math.round(SF.solarShare * 100)}%${
            sf.panelFull ? ` (panel kamu ${sf.panelPower} W dari ${sf.panelFull} W)` : ', dan kamu tidak memasang panel surya'
          }. Pasang panel surya besar, RTG, atau baterai.`,
        );
      else if (!sf.pressed) out.push('Spesialis: tekan Kirim foto sebelum waktu di permukaan habis.');
    }
    if (game.fuel < L.minFuelFor3Stars)
      out.push(
        `Bintang 3 butuh sisa bahan bakar ≥ ${Math.round(L.minFuelFor3Stars * 100)}% (sisa ${Math.round(game.fuel * 100)}%). Nyalakan roket pendarat lebih rendah (tetap ≥ ${fmt(rlo)} km), atau tambah bahan bakar.`,
      );
    if (!frugal) out.push(`Bintang 3 butuh anggaran hemat: harga wahana maksimal ${L.budget} juta $, tanpa dana cadangan.`);
  }
  return out;
}

// ---------- Untuk tampilan dan Spesialis ----------
function stage(game) {
  const ph = game.phase === 'done' ? game.endedIn : game.phase;
  if (ph === 'launch' || ph === 'park') return 'launch';
  if (ph === 'cruise') return 'cruise';
  if (ph === 'program') return 'program';
  if (ph === 'edl') {
    const st = edlStage(game.edl);
    return st === 'chute' || st === 'tear' || st === 'low' ? 'chute' : st === 'retro' || st === 'early' || st === 'fuel' ? 'retro' : 'entry';
  }
  if (ph === 'landed') return game.surface && game.surface.t < L.landedHoldSec ? 'landed' : 'photo';
  return ph;
}

function surfaceView(game) {
  const sf = game.surface;
  if (!sf) return null;
  return {
    t: sf.t,
    ready: sf.t >= L.landedHoldSec,
    timeLeft: Math.max(0, SF.timeSec - sf.t),
    battery: sf.battery,
    batteryMax: sf.batteryMax,
    powerNet: Math.round(sf.powerNet),
    solar: sf.panelPower,
    solarFull: sf.panelFull,
    solarShare: SF.solarShare,
    rtg: sf.rtgPower,
    load: sf.basePower + sf.antenna.power,
    antenna: sf.antenna.name,
    hasBig: sf.hasBig,
    cap: sf.cap,
    pressed: sf.pressed,
    sending: sf.sending,
    progress: sf.progress,
  };
}

export function snapshotLevel4(game, withPaths = true) {
  const ph = game.phase === 'done' ? game.endedIn : game.phase;
  const f = game.flight;
  const pr = game.program;
  let edl = null;
  if (game.edl) {
    edl = edlState(game.edl);
    if (game.phase === 'done' && game.result && !game.result.success) edl.crashed = true;
  }
  return {
    level: 4,
    phase: game.phase,
    view: ph, // launch | park | cruise | program | edl | landed
    stage: stage(game),
    // Saat peluncuran, tampilan memakai gambar orbit Bumi seperti Level 1.
    flight: f
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
    fuel: game.fuel, // bahan bakar roket pendarat
    rocketFuel: f ? f.fuel : game.rocketFuel,
    hasEdl: game.hasEdl,
    radShield: game.radShield,
    instrumentsOn: game.instrumentsOn,
    cameraDamaged: game.cameraDamaged,
    cruise: game.cruise ? cruiseView(game) : null,
    program: {
      entryDeg: pr.entryDeg,
      chuteKm: pr.chuteKm,
      retroKm: pr.retroKm,
      ready: pr.ready,
      locked: pr.locked,
      safe: { entry: L.entry.safeDeg, chute: L.chute.safeKm, retro: L.retro.safeKm },
      range: { entry: [L.entry.minDeg, L.entry.maxDeg], chute: [L.chute.minKm, L.chute.maxKm], retro: [L.retro.minKm, L.retro.maxKm] },
      ok: { entry: inRange(pr.entryDeg, L.entry.safeDeg), chute: inRange(pr.chuteKm, L.chute.safeKm), retro: inRange(pr.retroKm, L.retro.safeKm) },
    },
    edl,
    surface: surfaceView(game),
    lastLog: game.log[game.log.length - 1] || '',
    coach: game.coach,
    result: game.result,
  };
}
