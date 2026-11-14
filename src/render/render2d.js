// Tampilan 2D (canvas). Ini juga cadangan kalau tampilan 3D belum stabil.
// Semua tampilan punya bentuk yang sama: createRenderer(canvas) -> { draw(view) }.
// `view` = snapshot dari snapshotLevel1(): data saja, jadi bisa dikirim lewat room.

import { EARTH, ROCKET_TUNING } from '../engine/flight.js';

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

  function draw(view) {
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
    ctx.fillStyle = COLORS.space;
    ctx.fillRect(0, 0, w, h);
    for (const [sx, sy, sr] of stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(sx * w, sy * h, sr * devicePixelRatio, sr * devicePixelRatio);
    }

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
      if (f.thrusting) {
        ctx.fillStyle = COLORS.flame;
        ctx.beginPath();
        ctx.moveTo(-3, -8);
        ctx.lineTo(3, -8);
        ctx.lineTo(0, -16 - Math.random() * 6);
        ctx.fill();
      }
      ctx.fillStyle = COLORS.rocket;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(4, 4);
      ctx.lineTo(4, -8);
      ctx.lineTo(-4, -8);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  return { draw };
}
