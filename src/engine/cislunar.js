// Fisika 2D Bumi-Bulan untuk Level 2. Bulan dibuat diam di tempat (penyederhanaan, "not to scale").
// Murni hitungan: tanpa DOM.

export const CISLUNAR = {
  earth: { x: 0, y: 0, gm: 1.2e6, radius: 120 },
  moon: { x: 0, y: 1100, gm: 9e4, radius: 34 },
  atmosphere: 135, // batas atmosfer (titik masuk) dari pusat Bumi
  parkingRadius: 180,
};

export function gravityAt(x, y, bodies) {
  let ax = 0;
  let ay = 0;
  for (const b of bodies) {
    const dx = b.x - x;
    const dy = b.y - y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    const g = b.gm / r2;
    ax += (g * dx) / r;
    ay += (g * dy) / r;
  }
  return [ax, ay];
}

// Satu langkah semi-implisit Euler (stabil untuk orbit, cukup untuk game).
export function stepBody(s, bodies, ax0, ay0, dt) {
  const [gx, gy] = gravityAt(s.x, s.y, bodies);
  s.vx += (gx + ax0) * dt;
  s.vy += (gy + ay0) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

// Sudut lintasan terhadap horizontal lokal (derajat). Negatif = menukik ke bawah.
export function flightPathAngle(s, body) {
  const dx = s.x - body.x;
  const dy = s.y - body.y;
  const r = Math.hypot(dx, dy);
  const v = Math.hypot(s.vx, s.vy);
  const radial = (s.vx * dx + s.vy * dy) / r;
  return (Math.asin(Math.max(-1, Math.min(1, radial / v))) * 180) / Math.PI;
}

// Prediksi lintasan tanpa dorongan. Mengembalikan titik untuk digambar dan kejadian penting.
export function predict(start, world = CISLUNAR, { dt = 1 / 30, maxT = 160, every = 6 } = {}) {
  const s = { x: start.x, y: start.y, vx: start.vx, vy: start.vy };
  const bodies = [world.earth, world.moon];
  const points = [];
  let closestMoon = Infinity;
  let passedMoon = false;
  let entry = null;
  let t = 0;
  let i = 0;
  let leftEarth = Math.hypot(s.x, s.y) > world.atmosphere + 30;
  while (t < maxT) {
    stepBody(s, bodies, 0, 0, dt);
    t += dt;
    if (i++ % every === 0) points.push({ x: s.x, y: s.y });
    const dm = Math.hypot(s.x - world.moon.x, s.y - world.moon.y);
    if (dm < closestMoon) closestMoon = dm;
    else if (dm < world.moon.radius * 6) passedMoon = true;
    if (dm <= world.moon.radius) return { points, closestMoon, hitMoon: true, entry: null, t };
    const de = Math.hypot(s.x, s.y);
    if (!leftEarth && de > world.atmosphere + 30) leftEarth = true;
    if (leftEarth && de <= world.atmosphere) {
      entry = { angle: flightPathAngle(s, world.earth), t, x: s.x, y: s.y };
      points.push({ x: s.x, y: s.y });
      return { points, closestMoon, hitMoon: false, entry, passedMoon, t };
    }
    if (de > 4000) break;
  }
  return { points, closestMoon, hitMoon: false, entry: null, passedMoon, t };
}
