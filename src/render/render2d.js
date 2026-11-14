// Tampilan 2D (canvas). Ini juga cadangan kalau tampilan 3D belum stabil.
// Semua tampilan punya bentuk yang sama: createRenderer(canvas) -> { draw(view) }.
// `view` = snapshot dari snapshotLevel1(): data saja, jadi bisa dikirim lewat room.

import { EARTH, ROCKET_TUNING } from '../engine/flight.js';
import { CISLUNAR } from '../engine/cislunar.js';

const COLORS = {
  space: '#05070f',
  earth: '#1d5fa8',
  earthEdge: '#7fb6ff',
  ring: '#3fd17a',
  ringOk: '#9cffc4',
  trail: 'rgba(255,200,120,0.6)',
  rocket: '#f2f2f2',
  flame: '#ff8a3d',
  station: '#ffd54a',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random() * 1.4]);

  function background() {
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
    ctx.fillStyle = COLORS.space;
    ctx.fillRect(0, 0, w, h);
    for (const [sx, sy, sr] of stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(sx * w, sy * h, sr * devicePixelRatio, sr * devicePixelRatio);
    }
    return [w, h];
  }

  function draw(view) {
    if (view.level === 2 && view.phase !== 'launch') return drawCislunar(view);
    const [w, h] = background();

    const scale = Math.min(w, h) / (EARTH.orbitRadius * 2.6);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, -scale); // y ke atas

    // Bumi
    ctx.beginPath();
    ctx.arc(0, 0, EARTH.radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.earth;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.earthEdge;
    ctx.stroke();

    // Stasiun Bumi (Level 1): menyala saat lintasan terbuka
    if (view.level === 1 && ['countdown', 'deploy', 'transmit'].includes(view.phase)) {
      const a = Math.PI / 4;
      const sx = Math.sin(a) * EARTH.radius;
      const sy = Math.cos(a) * EARTH.radius;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.station;
      ctx.fill();
      if (view.inPass) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(view.flight.x, view.flight.y);
        ctx.strokeStyle = 'rgba(255,213,74,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Cincin orbit
    ctx.beginPath();
    ctx.arc(0, 0, EARTH.orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = view.flight.inRing ? COLORS.ringOk : COLORS.ring;
    ctx.lineWidth = ROCKET_TUNING.orbitRadiusTol * 2;
    ctx.globalAlpha = 0.18;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Jejak
    const trail = view.flight.trail || [];
    if (trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (const p of trail) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = COLORS.trail;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Roket atau CubeSat
    const f = view.flight;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(-f.angle);
    if (view.released) {
      ctx.fillStyle = '#c9c9c9';
      ctx.fillRect(-4, -4, 8, 8);
      if (view.panelsOpen) {
        ctx.fillStyle = '#3a6fd8';
        ctx.fillRect(-16, -2, 10, 4);
        ctx.fillRect(6, -2, 10, 4);
      }
      if (view.antennaOpen) {
        ctx.strokeStyle = '#eee';
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(0, 14);
        ctx.stroke();
      }
    } else {
      // Titik posisi roket = ekor roket, supaya roket berdiri tepat di permukaan Bumi.
      if (f.thrusting) {
        ctx.fillStyle = COLORS.flame;
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, -8 - Math.random() * 6);
        ctx.fill();
      }
      ctx.fillStyle = COLORS.rocket;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(4, 12);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-4, 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  function polyline(points, color, width, dash) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function body(b, fill, edge) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2 / scaleNow;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }

  let scaleNow = 1;
  // Level 2: Bumi di bawah, Bulan di atas. Tidak sesuai skala.
  function drawCislunar(view) {
    const [w, h] = background();
    const E = CISLUNAR.earth;
    const Mo = CISLUNAR.moon;
    const minY = -260; // bawah Bumi
    const maxY = 1330; // puncak lintasan di atas Bulan
    const spanY = maxY - minY;
    const spanX = 760;
    const centerX = -112; // lintasan condong ke kiri
    scaleNow = Math.min(h / spanY, w / spanX) * 0.95;
    ctx.save();
    ctx.translate(w / 2 - centerX * scaleNow, h / 2 + ((minY + maxY) / 2) * scaleNow);
    ctx.scale(scaleNow, -scaleNow);

    // atmosfer, Bumi, Bulan
    ctx.beginPath();
    ctx.arc(0, 0, CISLUNAR.atmosphere, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(127,182,255,0.18)';
    ctx.fill();
    body(E, COLORS.earth, COLORS.earthEdge);
    body(Mo, '#9a9a9a', '#d8d8d8');

    // jalur target (hijau), jejak (oranye), prediksi (putus-putus)
    polyline(view.nominal, 'rgba(63,209,122,0.55)', 6 / scaleNow);
    polyline(view.trail, COLORS.trail, 2 / scaleNow);
    polyline(view.prediction, '#ffffff', 2 / scaleNow, [8 / scaleNow, 8 / scaleNow]);

    // kapsul
    const c = view.craft;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(-c.angle);
    const k = 1 / scaleNow;
    if (c.thrusting) {
      ctx.fillStyle = COLORS.flame;
      ctx.beginPath();
      ctx.moveTo(-3 * k, -7 * k);
      ctx.lineTo(3 * k, -7 * k);
      ctx.lineTo(0, (-14 - Math.random() * 5) * k);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.rocket;
    ctx.beginPath();
    ctx.moveTo(0, 8 * k);
    ctx.lineTo(6 * k, -6 * k);
    ctx.lineTo(-6 * k, -6 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a4a2a'; // pelindung panas di bagian belakang
    ctx.fillRect(-6 * k, -8 * k, 12 * k, 2.5 * k);
    if (view.phase === 'entry') {
      ctx.fillStyle = 'rgba(255,140,40,0.8)';
      ctx.beginPath();
      ctx.arc(0, -10 * k, 8 * k, Math.PI, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    if (view.signalLost) {
      ctx.fillStyle = 'rgba(255,93,93,0.9)';
      ctx.font = `${14 * devicePixelRatio}px system-ui`;
      ctx.fillText('SIGNAL LOST', 16 * devicePixelRatio, h - 16 * devicePixelRatio);
    }
  }

  return { draw };
}
