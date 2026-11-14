// Bantuan pilot untuk Level 1 (level tutorial). Murni hitungan.
// Bantuan mengatur ARAH roket (gravity turn) dan mematikan mesin di saat yang pas.
// Pemain tetap menyalakan mesin sendiri: saat lepas landas dan saat di puncak lintasan.

import { orbitExtremes, orbitCheck, positionAngle } from './flight.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const TILT_START_ALT = 6; // u di atas permukaan
const TILT_ANGLE = (70 * Math.PI) / 180;

export function createAssist() {
  return { stage: 'pad', msg: '', urgent: false };
}

// Dipanggil sebelum stepFlight. Mengubah ctrl (arah dan gas) dan mengisi pesan pelatih.
export function stepAssist(a, s, ctrl) {
  const p = s.planet;
  const alt = Math.hypot(s.x, s.y) - p.radius;
  const target = p.orbitRadius;
  const { apo } = orbitExtremes(s);
  const o = orbitCheck(s);
  a.urgent = false;

  if (s.status === 'pad') {
    a.stage = 'pad';
    a.msg = s.padTooWeak ? 'Gas belum cukup. Tekan Gas + sampai 100%.' : 'Tekan Gas + (W) sampai 100% untuk lepas landas.';
    ctrl.mode = 'manual';
    ctrl.targetAngle = s.padAngle;
    a.launchAngle = positionAngle(s);
    return a;
  }
  if (s.status === 'orbit') {
    a.stage = 'done';
    a.msg = 'Orbit tercapai!';
    ctrl.throttle = 0;
    return a;
  }

  // Arah: naik lurus, lalu miring, lalu ikut arah gerak.
  if (a.stage === 'pad' || a.stage === 'climb') {
    a.stage = 'climb';
    ctrl.mode = 'manual';
    // Miring relatif terhadap arah "atas" di landasan (landasan ikut berputar bersama Bumi).
    const tilt = a.launchAngle + TILT_ANGLE;
    ctrl.targetAngle = alt > TILT_START_ALT ? tilt : a.launchAngle;
    if (alt > TILT_START_ALT && Math.abs(wrap(s.angle - tilt)) < 0.05) {
      ctrl.mode = 'prograde';
      a.stage = 'burn1';
    }
    a.msg = 'Bagus! Bantuan pilot memiringkan roket. Biarkan mesin menyala.';
  }

  if (a.stage === 'burn1') {
    ctrl.mode = 'prograde';
    a.msg = `Mesin menyala. Titik tertinggi ${apo === Infinity ? 'lepas' : Math.round(apo - p.radius)} / ${Math.round(target - p.radius)}`;
    if (apo >= target - 2) {
      ctrl.throttle = 0; // bantuan mematikan mesin tepat waktu
      a.stage = 'coast';
    }
  }

  if (a.stage === 'coast') {
    ctrl.mode = 'prograde';
    const nearTop = o.radial < 4;
    a.msg = nearTop ? 'SEKARANG! Tekan Gas + (W). Makin cepat bereaksi, makin tepat orbitnya.' : 'Mesin mati, roket meluncur naik. Tunggu sampai hampir di puncak…';
    a.urgent = nearTop;
    if (ctrl.throttle > 0) a.stage = 'burn2';
  }

  if (a.stage === 'burn2') {
    ctrl.mode = 'prograde';
    a.msg = `Tambah kecepatan: ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}`;
    if (o.speed >= o.vCirc * 0.99) {
      ctrl.throttle = 0;
      a.stage = 'hold';
    }
    if (ctrl.throttle === 0 && o.speed < o.vCirc * 0.99) a.stage = 'coast';
  }

  if (a.stage === 'hold') {
    a.msg = o.ok ? `Tahan di cincin… ${s.inRingFor.toFixed(1)} / ${s.orbitHoldSec} detik` : 'Hampir! Kalau kecepatan kurang, tekan Gas + sebentar.';
    if (!o.ok && o.speed < o.vCirc * (1 - 0.08) && ctrl.throttle === 0) a.stage = 'coast';
    if (ctrl.throttle > 0) a.stage = 'burn2';
  }
  return a;
}
