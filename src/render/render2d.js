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
    if (view.level === 3) return drawLander(view);
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

    // Stasiun Bumi (Level 1): ikut berputar bersama Bumi, dengan wilayah jangkauan antenanya
    if (view.level === 1 && view.station && ['countdown', 'deploy', 'transmit'].includes(view.phase)) {
      const a = view.station.angle;
      const cov = view.station.coverage;
      const sx = Math.sin(a) * EARTH.radius;
      const sy = Math.cos(a) * EARTH.radius;
      // wilayah jangkauan: kipas dari stasiun ke cincin orbit
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(0, 0, EARTH.orbitRadius + 20, Math.PI / 2 - a - cov, Math.PI / 2 - a + cov);
      ctx.closePath();
      ctx.fillStyle = view.inPass ? 'rgba(255,213,74,0.22)' : 'rgba(255,213,74,0.10)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.station;
      ctx.fill();
      if (view.inPass) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(view.flight.x, view.flight.y);
        ctx.strokeStyle = 'rgba(255,213,74,0.8)';
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

  // Level 3: tampilan samping. Langit hitam, permukaan Bulan berbukit, Matahari rendah di cakrawala
  // (di kutub selatan Matahari selalu dekat cakrawala, jadi bayangan panjang dan kawah dalam selalu gelap).
  function drawLander(view) {
    const dpr = devicePixelRatio;
    const w = (canvas.width = canvas.clientWidth * dpr);
    const h = (canvas.height = canvas.clientHeight * dpr);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const c = view.craft;
    const terrain = view.terrain || [];
    const mid = terrain[Math.floor(terrain.length / 2)] || { y: 0 };
    // Kamera mengikuti pendarat; makin rendah, makin dekat.
    const viewH = Math.max(60, view.altitude * 1.35 + 40);
    const scale = h / viewH;
    const bottomY = mid.y - 0.2 * viewH;
    const sx = (x) => w / 2 + (x - c.x) * scale;
    const sy = (y) => h - (y - bottomY) * scale;
    const horizon = sy(mid.y);

    // Matahari rendah, sebagian tertutup bukit
    const sunX = w * 0.1;
    // Matahari separuh terlihat di atas bukit pada posisi x-nya.
    const sunWorldX = c.x + (sunX - w / 2) / scale;
    const under = terrain.reduce((best, p) => (Math.abs(p.x - sunWorldX) < Math.abs(best.x - sunWorldX) ? p : best), mid);
    const sunY = Math.min(h * 0.9, sy(under.y) - 4 * dpr);
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90 * dpr);
    glow.addColorStop(0, 'rgba(255,244,214,0.55)');
    glow.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e1';
    ctx.fill();

    // Permukaan: sisi yang menghadap Matahari (kiri) lebih terang
    if (terrain.length > 1) {
      ctx.beginPath();
      ctx.moveTo(sx(terrain[0].x), h);
      for (const p of terrain) ctx.lineTo(sx(p.x), sy(p.y));
      ctx.lineTo(sx(terrain[terrain.length - 1].x), h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, horizon - 40 * dpr, 0, h);
      g.addColorStop(0, '#9b9b98');
      g.addColorStop(1, '#2a2a2a');
      ctx.fillStyle = g;
      ctx.fill();
      // Bayangan panjang (dihitung di level, p.s = 1 kalau dalam bayangan)
      // Satu bentuk per bagian yang bersambung, supaya tidak ada garis sambungan.
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      let i = 0;
      while (i < terrain.length) {
        if (!terrain[i].s) {
          i++;
          continue;
        }
        const from = Math.max(0, i - 1);
        while (i < terrain.length && terrain[i].s) i++;
        const to = Math.min(terrain.length - 1, i);
        ctx.beginPath();
        ctx.moveTo(sx(terrain[from].x), h);
        for (let j = from; j <= to; j++) ctx.lineTo(sx(terrain[j].x), sy(terrain[j].y));
        ctx.lineTo(sx(terrain[to].x), h);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 1; i < terrain.length; i++) {
        const a = terrain[i - 1];
        const b = terrain[i];
        // lereng naik ke kanan menghadap Matahari di kiri
        const lit = !a.s && !b.s && b.y >= a.y;
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
        ctx.strokeStyle = lit ? '#e8e6df' : a.s || b.s ? '#2b2b2b' : '#77776f';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }
    }

    // Ketinggian permukaan di x (dari titik-titik snapshot)
    const groundY = (x) => {
      for (let i = 1; i < terrain.length; i++) {
        const a = terrain[i - 1];
        const b = terrain[i];
        if (x >= a.x && x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
      }
      return null;
    };

    // Bayangan pendarat: memanjang di permukaan ke arah menjauhi Matahari
    if (view.craftShadow && terrain.length > 1) {
      const { x0, x1 } = view.craftShadow;
      ctx.beginPath();
      let started = false;
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = groundY(x);
        if (y === null) continue;
        if (!started) ctx.moveTo(sx(x), sy(y));
        else ctx.lineTo(sx(x), sy(y));
        started = true;
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(3 * dpr, 2 * scale);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Penanda titik pendaratan
    if (view.sites) {
      ctx.font = `600 ${12 * dpr}px system-ui`;
      ctx.textAlign = 'center';
      for (const s of view.sites) {
        const chosen = view.siteChoice === s.id;
        const color = chosen ? '#ff8a3d' : '#9cc4ff';
        const px = sx(s.x);
        const py = sy(s.y);
        if (px < -60 * dpr || px > w + 60 * dpr) continue;
        ctx.strokeStyle = color;
        ctx.lineWidth = (chosen ? 4 : 2.5) * dpr;
        ctx.beginPath(); // lebar landasan
        ctx.moveTo(sx(s.x - s.halfWidth), py);
        ctx.lineTo(sx(s.x + s.halfWidth), py);
        ctx.stroke();
        const pole = 34 * dpr;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - pole);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); // bendera
        ctx.moveTo(px, py - pole);
        ctx.lineTo(px + 12 * dpr, py - pole + 5 * dpr);
        ctx.lineTo(px, py - pole + 10 * dpr);
        ctx.fill();
        // Label disembunyikan menjelang mendarat supaya tidak menutupi pendarat.
        if (view.altitude > 25) {
          ctx.fillText(`${s.name}${chosen ? ' ✓' : ''}`, px, py - pole - 18 * dpr);
          ctx.fillStyle = 'rgba(220,230,255,0.8)';
          ctx.font = `${10.5 * dpr}px system-ui`;
          ctx.fillText(`es ${s.ice} · miring ≤ ${s.maxTiltDeg}° · ★ maks. ${s.maxStars}`, px, py - pole - 5 * dpr);
          ctx.font = `600 ${12 * dpr}px system-ui`;
        }
      }
      // Titik terpilih di luar layar: panah di tepi
      const t = view.sites.find((s) => s.id === view.siteChoice);
      if (t) {
        const px = sx(t.x);
        if (px < 0 || px > w) {
          const right = px > w;
          const ex = right ? w - 18 * dpr : 18 * dpr;
          const ey = h * 0.5;
          ctx.fillStyle = '#ff8a3d';
          ctx.beginPath();
          ctx.moveTo(ex + (right ? 12 : -12) * dpr, ey);
          ctx.lineTo(ex, ey - 10 * dpr);
          ctx.lineTo(ex, ey + 10 * dpr);
          ctx.fill();
          ctx.textAlign = right ? 'right' : 'left';
          ctx.fillText(`${t.name} ${Math.round(Math.abs(t.x - c.x))} u`, ex + (right ? -6 : 6) * dpr, ey - 16 * dpr);
        }
      }
      ctx.textAlign = 'start';
    }

    // Jejak
    const trail = view.trail || [];
    if (trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(sx(trail[0].x), sy(trail[0].y));
      for (const p of trail) ctx.lineTo(sx(p.x), sy(p.y));
      ctx.lineTo(sx(c.x), sy(c.y));
      ctx.strokeStyle = COLORS.trail;
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([4 * dpr, 6 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Pendarat: titik posisi = kaki. Ukuran asli 6 u, tapi minimal 28 px supaya tetap terlihat.
    const size = Math.max(28 * dpr, 6 * scale);
    const k = size / 6;
    ctx.save();
    ctx.translate(sx(c.x), sy(c.y));
    ctx.rotate(c.angle);
    if (c.crashed) ctx.rotate(0.9);
    if (c.thrusting) {
      ctx.fillStyle = COLORS.flame;
      ctx.beginPath();
      ctx.moveTo(-0.8 * k, -1.2 * k);
      ctx.lineTo(0.8 * k, -1.2 * k);
      ctx.lineTo(0, (0.6 + Math.random() * 1.6) * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = Math.max(1.5 * dpr, 0.3 * k);
    ctx.beginPath(); // kaki
    ctx.moveTo(-1.6 * k, -2.2 * k);
    ctx.lineTo(-3 * k, 0);
    ctx.moveTo(1.6 * k, -2.2 * k);
    ctx.lineTo(3 * k, 0);
    ctx.stroke();
    ctx.fillStyle = '#d4a017'; // badan berlapis emas (foil)
    ctx.fillRect(-2 * k, -3.6 * k, 4 * k, 1.8 * k);
    ctx.fillStyle = '#e6e6e6'; // kabin
    ctx.fillRect(-1.4 * k, -5.6 * k, 2.8 * k, 2 * k);
    ctx.fillStyle = '#7a7a7a'; // nosel
    ctx.fillRect(-0.6 * k, -1.8 * k, 1.2 * k, 0.6 * k);
    ctx.restore();

    if (c.crashed) {
      ctx.fillStyle = 'rgba(255,93,93,0.95)';
      ctx.font = `bold ${16 * dpr}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('PENDARAT HANCUR', w / 2, h * 0.35);
      ctx.textAlign = 'start';
    } else if (view.phase === 'landed' || (view.result && view.result.success)) {
      ctx.fillStyle = 'rgba(63,209,122,0.95)';
      ctx.font = `bold ${16 * dpr}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('MENDARAT', w / 2, h * 0.35);
      ctx.textAlign = 'start';
    }
  }

  return { draw };
}
