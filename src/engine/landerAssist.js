// Bantuan pilot untuk pendaratan tanpa atmosfer (Level 3). Murni hitungan, seperti assist.js.
// Bantuan mengatur ARAH pendarat (menggeser ke titik pendaratan, lalu tegak) dan MENGURANGI gas kalau berlebihan.
// Pemain tetap menambah gas sendiri: bantuan hanya memberi tahu kapan harus menekan Gas +.

import { THROTTLE_STEP } from './attitude.js';

const ceilStep = (x) => Math.min(1, Math.ceil(x / THROTTLE_STEP - 1e-6) * THROTTLE_STEP);
const floorStep = (x) => Math.max(0, Math.floor(x / THROTTLE_STEP + 1e-6) * THROTTLE_STEP);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const HOLD_ALT = 30; // di bawah ketinggian ini, kalau belum di atas titik: melayang dulu sambil menggeser

// Kecepatan turun yang diinginkan pada ketinggian tertentu: makin rendah, makin pelan.
export function targetDescent(alt) {
  return Math.min(30, 0.8 + 0.18 * Math.max(0, alt));
}

// Kecepatan menyamping yang diinginkan menuju titik (dx = jarak titik dari pendarat, + = kanan).
export function targetSideSpeed(dx, alt) {
  const vmax = 2 + 0.12 * Math.max(0, alt);
  return clamp(0.25 * dx, -vmax, vmax);
}

// Teks arah ke titik pendaratan untuk pelatih, HUD, dan Spesialis.
export function directionText(target) {
  if (!target || target.neutral) return 'Spesialis: pilih titik pendaratan.';
  if (Math.abs(target.dx) <= target.halfWidth) return `Di atas ${target.name} ✓`;
  return `${target.name}: ${Math.round(Math.abs(target.dx))} u ke ${target.dx > 0 ? 'kanan →' : 'kiri ←'}`;
}

// s = { alt, vx, vy, hoverThrottle, fuel, phase, target: { dx, halfWidth, name, neutral? } | null }.
// neutral = belum ada titik dipilih: hanya dibidik, tidak ditunggu (tidak melayang).
// Mengubah ctrl (arah dan gas), mengembalikan { msg, urgent, rec }.
export function stepLanderAssist(s, ctrl) {
  const hover = s.hoverThrottle;
  const vDown = -s.vy;
  const t = s.target;

  if (s.phase === 'orbit') {
    ctrl.mode = 'retrograde';
    return { msg: 'Pendarat di orbit rendah Bulan. Tekan Gas + untuk mengerem dan mulai turun.', urgent: true, rec: 1 };
  }

  const far = t && !t.neutral && Math.abs(t.dx) > t.halfWidth;
  const holding = far && s.alt < HOLD_ALT;
  const wantDown = holding ? 0.3 : targetDescent(s.alt);
  const err = vDown - wantDown;

  // Arah: miring untuk mengubah kecepatan menyamping (rem atau geser ke titik), lalu tegak menjelang menyentuh.
  const dvx = s.vx - (t ? targetSideSpeed(t.dx, s.alt) : 0);
  // Kalau kecepatan menyamping meleset > 3 u/s: miring hampir mendatar supaya dorongan ke samping,
  // bukan ke atas (dorongan ke atas membuat pendarat naik lagi dan membuang bahan bakar).
  const braking = Math.abs(dvx) > 3 && s.alt > 15;
  ctrl.mode = 'manual';
  // Selain itu: miring sedikit (maks. 0,2 rad) untuk sisa geser, dan tegak penuh menjelang menyentuh.
  ctrl.targetAngle = braking ? -Math.sign(dvx) * (err > 4 ? 0.6 : 1.4) : s.alt > 4 ? -clamp(dvx * 0.07, -0.2, 0.2) : 0;

  // Gas yang disarankan.
  let rec;
  let msg;
  let urgent = false;
  if (braking) {
    rec = ceilStep(clamp(Math.abs(dvx) / 8, 0.25, 1)); // makin besar selisihnya, makin besar gasnya
    msg = 'Mengatur kecepatan menyamping.';
  } else if (s.vy > 0.3) {
    rec = 0; // naik lagi: buang-buang bahan bakar
    msg = 'Pendarat naik. Bantuan pilot mengurangi gas.';
  } else if (err > 4) {
    rec = 1;
    msg = 'Mengerem: kecepatan turun dikurangi.';
  } else if (err > 0.5) {
    rec = ceilStep(hover + 0.25);
    msg = 'Mengerem pelan.';
  } else if (err < -1) {
    rec = floorStep(hover - 0.25);
    msg = 'Turun pelan. Bantuan pilot mengurangi gas supaya lebih cepat turun.';
  } else {
    rec = Math.min(ctrl.throttle, ceilStep(hover)); // sudah pas: jangan minta tambah gas
    msg = holding ? 'Melayang sambil bergeser ke titik.' : s.alt < 20 ? 'Hampir menyentuh… tahan, tetap tegak.' : 'Kecepatan turun pas. Tahan gas.';
  }
  if (rec > ctrl.throttle + 1e-6) {
    msg = `${braking ? 'Kecepatan menyamping belum pas!' : holding ? 'Belum di atas titik: melayang dulu!' : 'Terlalu cepat turun!'} Tekan Gas + (sampai ${Math.round(rec * 100)}%).`;
    urgent = true;
  }
  // Bantuan hanya menurunkan gas, tidak menaikkan.
  if (ctrl.throttle > rec + 1e-6) ctrl.throttle = rec;
  if (s.fuel <= 0) return { msg: 'Bahan bakar habis!', urgent: true, rec };
  return { msg: urgent ? msg : `${directionText(t)} · ${msg}`, urgent, rec };
}
