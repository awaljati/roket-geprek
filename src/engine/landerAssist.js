// Bantuan pilot untuk pendaratan tanpa atmosfer (Level 3). Murni hitungan, seperti assist.js.
// Bantuan mengatur ARAH pendarat dan MENGURANGI gas kalau berlebihan.
// Pemain tetap menambah gas sendiri: bantuan hanya memberi tahu kapan harus menekan Gas +.

import { THROTTLE_STEP } from './attitude.js';

const ceilStep = (x) => Math.min(1, Math.ceil(x / THROTTLE_STEP - 1e-6) * THROTTLE_STEP);
const floorStep = (x) => Math.max(0, Math.floor(x / THROTTLE_STEP + 1e-6) * THROTTLE_STEP);

// Kecepatan turun yang diinginkan pada ketinggian tertentu: makin rendah, makin pelan.
export function targetDescent(alt) {
  return Math.min(30, 0.8 + 0.18 * Math.max(0, alt));
}

// s = { alt, vx, vy, hoverThrottle, fuel, phase }. Mengubah ctrl (arah dan gas), mengembalikan { msg, urgent, rec }.
export function stepLanderAssist(s, ctrl) {
  const hover = s.hoverThrottle;
  const vDown = -s.vy;

  if (s.phase === 'orbit') {
    ctrl.mode = 'retrograde';
    return { msg: 'Pendarat di orbit rendah Bulan. Tekan Gas + untuk mengerem dan mulai turun.', urgent: true, rec: 1 };
  }

  // Arah: rem kecepatan menyamping dulu (lawan arah gerak), lalu tegak.
  const braking = Math.abs(s.vx) > 3 && s.alt > 15;
  if (braking) ctrl.mode = 'retrograde';
  else {
    ctrl.mode = 'manual';
    const lean = Math.max(-0.2, Math.min(0.2, s.vx * 0.07)); // miring sedikit untuk membuang sisa geser
    ctrl.targetAngle = s.alt > 4 ? -lean : 0;
  }

  // Gas yang disarankan.
  let rec;
  let msg;
  let urgent = false;
  if (braking) {
    rec = 1;
    msg = `Rem kecepatan menyamping: ${Math.abs(s.vx).toFixed(0)} u/s. Biarkan gas penuh.`;
  } else {
    const err = vDown - targetDescent(s.alt);
    if (s.vy > 0.3) {
      rec = 0; // naik lagi: buang-buang bahan bakar
      msg = 'Pendarat naik. Bantuan pilot mengurangi gas.';
    } else if (err > 4) {
      rec = 1;
    } else if (err > 0.5) {
      rec = ceilStep(hover + 0.25);
    } else if (err < -1) {
      rec = floorStep(hover - 0.25);
      msg = 'Turun pelan. Bantuan pilot mengurangi gas supaya lebih cepat turun.';
    } else {
      rec = Math.min(ctrl.throttle, ceilStep(hover)); // sudah pas: jangan minta tambah gas
      msg = s.alt < 20 ? 'Hampir menyentuh… tahan, tetap tegak.' : 'Kecepatan turun pas. Tahan gas.';
    }
  }
  if (rec > ctrl.throttle + 1e-6) {
    msg = braking
      ? `Masih bergeser ${Math.abs(s.vx).toFixed(0)} u/s ke samping! Tekan Gas + (sampai ${Math.round(rec * 100)}%).`
      : `Terlalu cepat turun! Tekan Gas + (sampai ${Math.round(rec * 100)}%).`;
    urgent = true;
  }
  // Bantuan hanya menurunkan gas, tidak menaikkan.
  if (ctrl.throttle > rec + 1e-6) ctrl.throttle = rec;
  if (s.fuel <= 0) {
    msg = 'Bahan bakar habis!';
    urgent = true;
  }
  return { msg, urgent, rec };
}
