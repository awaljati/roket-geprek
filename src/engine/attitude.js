// Kendali arah dan gas wahana. Murni hitungan, dipakai semua level.
// Pemain tidak perlu menahan tombol: gas punya tingkat (0-100%), arah diputar per ketukan,
// dan ada mode "searah gerak" / "lawan arah gerak" yang menahan arah otomatis.

export const THROTTLE_STEP = 0.25;
export const TURN_STEP = Math.PI / 12; // 15 derajat per ketukan
export const PULSE_SEC = 0.25; // dorongan pendek untuk koreksi kecil (MCC)

export function createControls() {
  return {
    throttle: 0, // 0..1
    lastThrottle: 1,
    targetAngle: 0,
    mode: 'manual', // manual | prograde | retrograde
    pulseLeft: 0,
  };
}

// Aksi dari keyboard / tombol layar. Nama aksi sama di semua level.
export function controlAction(c, action, craft) {
  switch (action) {
    case 'throttleUp':
      c.throttle = Math.min(1, +(c.throttle + THROTTLE_STEP).toFixed(2));
      break;
    case 'throttleDown':
      c.throttle = Math.max(0, +(c.throttle - THROTTLE_STEP).toFixed(2));
      break;
    case 'engineToggle':
      if (c.throttle > 0) {
        c.lastThrottle = c.throttle;
        c.throttle = 0;
      } else c.throttle = c.lastThrottle || 1;
      break;
    case 'engineCut':
      if (c.throttle > 0) c.lastThrottle = c.throttle;
      c.throttle = 0;
      c.pulseLeft = 0;
      break;
    case 'pulse':
      c.pulseLeft = PULSE_SEC;
      break;
    case 'turnLeft':
    case 'turnRight':
      if (c.mode !== 'manual') c.targetAngle = craft ? craft.angle : c.targetAngle;
      c.mode = 'manual';
      c.targetAngle += action === 'turnRight' ? TURN_STEP : -TURN_STEP;
      break;
    case 'prograde':
      c.mode = c.mode === 'prograde' ? 'manual' : 'prograde';
      if (c.mode === 'manual' && craft) c.targetAngle = craft.angle;
      break;
    case 'retrograde':
      c.mode = c.mode === 'retrograde' ? 'manual' : 'retrograde';
      if (c.mode === 'manual' && craft) c.targetAngle = craft.angle;
      break;
  }
  return c;
}

// Sudut arah gerak (0 = ke atas, searah jarum jam positif), sama dengan konvensi engine.
export function velocityAngle(vx, vy) {
  return Math.atan2(vx, vy);
}

function wrap(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Memutar craft.angle menuju target dengan kecepatan putar terbatas.
// Mengembalikan gas efektif detik ini (0..1), termasuk dorongan pendek.
export function applyControls(c, craft, turnRate, dt) {
  const speed = Math.hypot(craft.vx, craft.vy);
  if (c.mode !== 'manual' && speed > 1) {
    const va = velocityAngle(craft.vx, craft.vy);
    c.targetAngle = c.mode === 'prograde' ? va : va + Math.PI;
  }
  const diff = wrap(c.targetAngle - craft.angle);
  const maxTurn = turnRate * dt;
  craft.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));

  let throttle = c.throttle;
  if (c.pulseLeft > 0) {
    throttle = 1;
    c.pulseLeft = Math.max(0, c.pulseLeft - dt);
  }
  return throttle;
}
