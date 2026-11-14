// Engine terbang 2D. Murni hitungan: tidak menyentuh DOM, tidak tahu soal tampilan 2D/3D.
// Satuan "u" = satuan game. Planet di (0,0). Sudut 0 = mengarah ke atas (sumbu +y), searah jarum jam positif.

import { applyControls } from './attitude.js';

export const EARTH = {
  radius: 120, // u
  gm: 1.2e6, // u^3/s^2 -> gravitasi permukaan ~83 u/s^2
  orbitRadius: 180, // cincin orbit rendah (mewakili ~400 km)
  // Rotasi Bumi (rad/detik game), searah jarum jam seperti arah orbit di game.
  // Kecepatan permukaan = 0,05 x 120 = 6 u/s, sekitar 6% kecepatan orbit, mirip aslinya (0,47 dari 7,8 km/s).
  spin: 0.05,
};

export const ROCKET_TUNING = {
  thrustAccel: 100, // u/s^2 saat roket penuh
  turnRate: 2.2, // rad/s
  fuelBurnPerSec: 0.22, // fraksi bahan bakar per detik saat dorong
  orbitRadiusTol: 18, // u
  orbitSpeedTol: 0.1, // 10% dari kecepatan orbit lingkaran
  orbitRadialTol: 12, // u/s kecepatan naik/turun yang masih dianggap datar
  escapeRadius: 600,
};

export function circularSpeed(planet, r) {
  return Math.sqrt(planet.gm / r);
}

export function createFlight({ planet = EARTH, fuel = 1, massRatio = 1, orbitHoldSec = 3 } = {}) {
  return {
    planet,
    t: 0,
    x: 0,
    y: planet.radius,
    vx: 0,
    vy: 0,
    angle: 0,
    earthAngle: 0, // sudut putar Bumi sejak awal misi
    padAngle: 0, // posisi landasan di permukaan Bumi (ikut berputar)
    fuel, // 0..1
    massRatio, // >1 = lebih berat, dorongan terasa lebih lemah
    orbitHoldSec,
    inRingFor: 0,
    launched: false,
    status: 'pad', // pad | flying | orbit | crashed | lost
    failCode: null,
    trail: [],
  };
}

// ctrl = objek dari createControls() (engine/attitude.js), atau null untuk tanpa kendali.
export function stepFlight(s, ctrl, dt) {
  if (s.status === 'crashed' || s.status === 'lost') return s;
  const T = ROCKET_TUNING;
  const p = s.planet;

  s.earthAngle += (p.spin || 0) * dt;
  const onPad = s.status === 'pad';
  if (onPad) {
    // Landasan ikut berputar bersama Bumi: roket tegak di permukaan dan bergerak dengan kecepatan permukaan.
    s.padAngle = s.earthAngle;
    const surfaceSpeed = (p.spin || 0) * p.radius;
    s.x = Math.sin(s.padAngle) * p.radius;
    s.y = Math.cos(s.padAngle) * p.radius;
    s.vx = Math.cos(s.padAngle) * surfaceSpeed;
    s.vy = -Math.sin(s.padAngle) * surfaceSpeed;
  }

  const throttle = ctrl ? applyControls(ctrl, s, T.turnRate, dt) : 0;
  if (onPad) {
    s.angle = s.padAngle;
    if (ctrl && ctrl.mode === 'manual') ctrl.targetAngle = s.padAngle;
  }

  let ax = 0;
  let ay = 0;
  const thrusting = throttle > 0 && s.fuel > 0 && s.status !== 'orbit';
  s.thrusting = thrusting;
  s.throttle = throttle;
  // Di landasan: roket baru terangkat kalau dorongan lebih besar dari gravitasi.
  const surfaceG = p.gm / (p.radius * p.radius);
  const accel = (T.thrustAccel * throttle) / s.massRatio;
  s.padTooWeak = s.status === 'pad' && thrusting && accel <= surfaceG;
  if (s.padTooWeak) return s;
  if (thrusting) {
    const a = (T.thrustAccel * throttle) / s.massRatio;
    ax += Math.sin(s.angle) * a;
    ay += Math.cos(s.angle) * a;
    s.fuel = Math.max(0, s.fuel - T.fuelBurnPerSec * throttle * dt);
    s.launched = true;
    if (s.status === 'pad') s.status = 'flying';
  }

  if (s.status === 'pad') return s; // diam di landasan sampai mesin menyala

  const r = Math.hypot(s.x, s.y);
  const g = p.gm / (r * r);
  ax -= (g * s.x) / r;
  ay -= (g * s.y) / r;

  s.vx += ax * dt;
  s.vy += ay * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.t += dt;

  if (s.trail.length === 0 || s.t - s.trail[s.trail.length - 1].t > 0.1) {
    s.trail.push({ x: s.x, y: s.y, t: s.t });
    if (s.trail.length > 400) s.trail.shift();
  }

  const r2 = Math.hypot(s.x, s.y);
  if (r2 <= p.radius && s.launched && s.t > 0.3) {
    s.status = 'crashed';
    s.failCode = s.fuel <= 0 ? 'F-FUEL' : 'F-CRASH';
    return s;
  }
  if (r2 > T.escapeRadius) {
    s.status = 'lost';
    s.failCode = 'F-ORBIT';
    return s;
  }

  // Cek cincin orbit: ketinggian pas, kecepatan pas, hampir tidak naik/turun.
  const o = orbitCheck(s);
  s.inRing = o.ok;
  if (s.status === 'flying') {
    s.inRingFor = o.ok ? s.inRingFor + dt : 0;
    if (s.inRingFor >= s.orbitHoldSec) s.status = 'orbit';
  }
  return s;
}

export function orbitCheck(s) {
  const T = ROCKET_TUNING;
  const p = s.planet;
  const r = Math.hypot(s.x, s.y);
  const speed = Math.hypot(s.vx, s.vy);
  const radial = (s.vx * s.x + s.vy * s.y) / r;
  const vCirc = circularSpeed(p, p.orbitRadius);
  const altOk = Math.abs(r - p.orbitRadius) <= T.orbitRadiusTol;
  const speedOk = Math.abs(speed - vCirc) <= vCirc * T.orbitSpeedTol;
  const flatOk = Math.abs(radial) <= T.orbitRadialTol;
  return { ok: altOk && speedOk && flatOk, r, speed, radial, vCirc, altOk, speedOk, flatOk };
}

// Sudut posisi wahana di sekitar planet (untuk cek lintasan di atas stasiun Bumi).
export function positionAngle(s) {
  return Math.atan2(s.x, s.y);
}

// Titik tertinggi (apoapsis) dan terendah (periapsis) lintasan saat ini, kalau mesin dimatikan sekarang.
export function orbitExtremes(s) {
  const p = s.planet;
  const r = Math.hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const eps = v2 / 2 - p.gm / r;
  if (eps >= 0) return { apo: Infinity, peri: null };
  const a = -p.gm / (2 * eps);
  const h = s.x * s.vy - s.y * s.vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (p.gm * p.gm)));
  return { apo: a * (1 + e), peri: a * (1 - e) };
}
