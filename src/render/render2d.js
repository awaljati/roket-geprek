// Tampilan 2D (canvas). Ini juga cadangan kalau tampilan 3D belum stabil.
// Semua tampilan punya bentuk yang sama: createRenderer(canvas) -> { draw(view) }.
// `view` = snapshot dari snapshotLevel1(): data saja, jadi bisa dikirim lewat room.

import { ROCKET_SPRITE, rocketSpriteSize } from './sprites.js';
import { EARTH, ROCKET_TUNING } from '../engine/flight.js';
import { CISLUNAR } from '../engine/cislunar.js';
import { drawMars } from './mars2d.js';
import { LAUNCH_SITE } from '../data/levels.js';

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

// Level 3: tekstur permukaan Bulan dipakai sebagai pola tanah; satu ubin tekstur selebar ini (u).
const MOON_TEXTURE = '/assets/textures/bulan.jpg';
const EARTH_TEXTURE = '/assets/textures/bumi.jpg';
const EARTH_POLAR = 'bumi-kutub-selatan'; // penanda: Bumi dari atas kutub selatan (Level 1)
const TEXTURE_WORLD_U = 420;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random() * 1.4]);

  // Tekstur planet (sama dengan tampilan 3D). Selama belum termuat (atau gagal), planet berwarna polos.
  const images = {};
  function image(url) {
    if (!images[url]) {
      const img = new Image();
      img.src = url;
      images[url] = img;
    }
    const img = images[url];
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  // Bumi dilihat dari atas kutub selatan, sama dengan tampilan 3D: ekuator di tepi, Biak (landasan dan
  // stasiun bumi BRIN) tepat di puncak saat misi mulai, timur searah jarum jam. Dihitung sekali dari peta.
  let polarEarth = null;
  function polarEarthImage() {
    if (polarEarth) return polarEarth;
    const img = image(EARTH_TEXTURE);
    if (!img) return null;
    try {
      const src = document.createElement('canvas');
      src.width = Math.min(img.naturalWidth, 2048);
      src.height = Math.round((src.width * img.naturalHeight) / img.naturalWidth);
      const sctx = src.getContext('2d');
      sctx.drawImage(img, 0, 0, src.width, src.height);
      const sp = sctx.getImageData(0, 0, src.width, src.height).data;
      const N = 512;
      const out = document.createElement('canvas');
      out.width = out.height = N;
      const octx = out.getContext('2d');
      const od = octx.createImageData(N, N);
      const D = 180 / Math.PI;
      for (let py = 0; py < N; py++) {
        for (let px = 0; px < N; px++) {
          const dx = (px + 0.5) / (N / 2) - 1;
          const dy = (py + 0.5) / (N / 2) - 1; // ke bawah
          const rho = Math.hypot(dx, dy);
          if (rho > 1) continue;
          const lat = -Math.acos(rho) * D; // proyeksi ortografis dari kutub selatan
          const lon = LAUNCH_SITE.lon + Math.atan2(dx, -dy) * D; // sudut searah jarum jam dari puncak = ke timur
          const u = ((((lon + 180) / 360) % 1) + 1) % 1;
          const sx = Math.min(src.width - 1, Math.floor(u * src.width));
          const sy = Math.min(src.height - 1, Math.floor(((90 - lat) / 180) * src.height));
          const si = (sy * src.width + sx) * 4;
          const oi = (py * N + px) * 4;
          od.data[oi] = sp[si];
          od.data[oi + 1] = sp[si + 1];
          od.data[oi + 2] = sp[si + 2];
          od.data[oi + 3] = 255;
        }
      }
      octx.putImageData(od, 0, 0);
      polarEarth = out;
    } catch {
      polarEarth = null; // gagal membaca piksel: tetap pakai peta biasa
      return null;
    }
    return polarEarth;
  }

  // Planet bulat di (x, y) dengan jari-jari r, di koordinat y ke atas. Peta tekstur (equirectangular) dipotong
  // lingkaran: diambil bagian tengahnya selebar setengah peta, lalu diputar `angle` (searah jarum jam) bersama planet.
  function planetDisc(x, y, r, url, fill, edge, edgeWidth, angle = 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const polar = url === EARTH_POLAR ? polarEarthImage() : null;
    const img = polar || image(url === EARTH_POLAR ? EARTH_TEXTURE : url);
    if (img) {
      ctx.save();
      ctx.clip();
      ctx.translate(x, y);
      ctx.scale(1, -1); // kembali ke y ke bawah supaya gambar tidak terbalik
      ctx.rotate(angle);
      if (polar) ctx.drawImage(polar, -r, -r, 2 * r, 2 * r);
      else {
        const sw = img.naturalWidth / 2;
        const sh = img.naturalHeight;
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, 0, sw, sh, -r, -r, 2 * r, 2 * r);
      }
      // sedikit gelap di tepi supaya terlihat bulat
      const shade = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = shade;
      ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.lineWidth = edgeWidth;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }

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
    // Level 4: peluncuran memakai tampilan orbit Bumi (ada view.flight), sesudahnya tampilan Mars.
    if (view.level === 4 && !view.flight) return drawMars(ctx, canvas, view);
    // Level 3 memakai tampilan Bumi/Bumi-Bulan untuk fase awal (view.space), tampilan samping setelahnya.
    if (view.level === 3 && !view.space) return drawLander(view);
    if ((view.level === 2 || view.level === 3) && view.phase !== 'launch' && !(view.level === 3 && view.flight)) return drawCislunar(view);
    const [w, h] = background();

    const scale = Math.min(w, h) / (EARTH.orbitRadius * 2.6);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, -scale); // y ke atas

    // Bumi (ikut berputar bersama landasan)
    // Level 1: Bumi dari atas kutub selatan supaya stasiun bumi BRIN tepat di Biak. Level lain belum diubah.
    planetDisc(0, 0, EARTH.radius, view.level === 1 ? EARTH_POLAR : EARTH_TEXTURE, COLORS.earth, COLORS.earthEdge, 3, view.flight.earthAngle || 0);

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
      // Gambar dari DKV kalau sudah termuat; kalau belum, bentuk sederhana di bawah.
      const off = image(ROCKET_SPRITE.off);
      const on = image(ROCKET_SPRITE.on);
      const img = (f.thrusting && on) || off || on;
      if (img) {
        const sz = rocketSpriteSize();
        ctx.scale(1, -1); // gambar memakai y ke bawah: hidung di atas, api di bawah ekor
        ctx.drawImage(img, -sz.w / 2, -sz.tail, sz.w, sz.h);
      } else {
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

  function body(b, url, fill, edge, angle = 0) {
    planetDisc(b.x, b.y, b.radius, url, fill, edge, 2 / scaleNow, angle);
  }

  let scaleNow = 1;
  // Level 2: Bumi di bawah, Bulan di atas. Tidak sesuai skala.
  function drawCislunar(view) {
    const [w, h] = background();
    const E = CISLUNAR.earth;
    const Mo = CISLUNAR.moon;
    const minY = -260; // bawah Bumi
    const maxY = 1330; // puncak lintasan di atas Bulan
    // Level 3 mengirim kamera sendiri (mendekat ke Bulan saat masuk orbit); Level 2 memakai bingkai tetap.
    const cam = view.camera || { x: -112, y: (minY + maxY) / 2, spanX: 760, spanY: maxY - minY };
    scaleNow = Math.min(h / cam.spanY, w / cam.spanX) * 0.95;
    ctx.save();
    ctx.translate(w / 2 - cam.x * scaleNow, h / 2 + cam.y * scaleNow);
    ctx.scale(scaleNow, -scaleNow);

    // atmosfer, Bumi, Bulan
    ctx.beginPath();
    ctx.arc(0, 0, CISLUNAR.atmosphere, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(127,182,255,0.18)';
    ctx.fill();
    body(E, EARTH_TEXTURE, COLORS.earth, COLORS.earthEdge, view.earthAngle || 0);
    body(Mo, MOON_TEXTURE, '#9a9a9a', '#d8d8d8');

    // Level 3: cincin orbit polar Bulan (seperti cincin orbit Bumi di Level 1)
    if (view.moonRing) {
      ctx.beginPath();
      ctx.arc(Mo.x, Mo.y, view.moonRing.r, 0, Math.PI * 2);
      ctx.strokeStyle = view.moonRing.ok ? COLORS.ringOk : COLORS.ring;
      ctx.lineWidth = view.moonRing.tol * 2;
      ctx.globalAlpha = 0.18;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5 / scaleNow;
      ctx.setLineDash([8 / scaleNow, 8 / scaleNow]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

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

  // ---------- Level 3 ----------
  // Bintang redup (sedikit, supaya langit tetap terasa hitam) dan tekstur permukaan Bulan.
  const landerStars = Array.from({ length: 70 }, () => [Math.random(), Math.random() * 0.8, 0.6 + Math.random() * 0.9, 0.12 + Math.random() * 0.3]);
  let moonImg = null;
  let moonPattern = null;
  function moonTexture() {
    if (!moonImg) {
      moonImg = new Image();
      moonImg.onload = () => (moonPattern = ctx.createPattern(moonImg, 'repeat'));
      moonImg.src = MOON_TEXTURE;
    }
    return moonPattern;
  }
  let camScale = null; // skala kamera dihaluskan supaya tidak melompat saat zoom berubah
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

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
    // Kamera mengikuti pendarat; makin rendah, makin dekat. Di orbit diperkecil supaya kedua penanda terlihat.
    let want = h / Math.max(60, view.altitude * 1.35 + 40);
    if (view.phase === 'orbit' && view.sites) {
      const far = Math.max(...view.sites.map((s) => Math.abs(s.x - c.x) + s.halfWidth + 40));
      want = Math.min(want, (w * 0.46) / far);
    }
    camScale = camScale === null || view.t < 0.05 ? want : camScale + (want - camScale) * 0.08;
    const scale = camScale;
    const viewH = h / scale;
    const bottomY = mid.y - 0.2 * viewH;
    const sx = (x) => w / 2 + (x - c.x) * scale;
    const sy = (y) => h - (y - bottomY) * scale;
    const sunSlope = Math.tan(((view.sunElevationDeg || 4) * Math.PI) / 180);

    // Ketinggian permukaan di x (dari titik-titik snapshot)
    const groundY = (x) => {
      for (let i = 1; i < terrain.length; i++) {
        const a = terrain[i - 1];
        const b = terrain[i];
        if (x >= a.x && x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
      }
      return null;
    };
    // Garis cakrawala (permukaan tertinggi) di sekitar kolom layar px
    const skyline = (px) => {
      let best = h;
      for (const p of terrain) if (Math.abs(sx(p.x) - px) < 40 * dpr) best = Math.min(best, sy(p.y));
      return best;
    };

    // Bintang redup
    for (const [fx, fy, r, a] of landerStars) {
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.fillRect(fx * w, fy * h, r * dpr, r * dpr);
    }

    // Matahari rendah di kiri, separuh tertutup bukit
    const sunX = w * 0.1;
    const sunY = Math.min(h * 0.9, skyline(sunX) - 4 * dpr);
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90 * dpr);
    glow.addColorStop(0, 'rgba(255,244,214,0.55)');
    glow.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e1';
    ctx.fill();

    // Bumi kecil biru-putih, rendah di cakrawala, di sisi berlawanan dengan Matahari
    // Di permukaan Bumi harus selalu di atas pendarat (elevasi positif), jadi juga dibatasi oleh posisi pendarat.
    const earthPos = view.earth ? drawEarth(view.earth, w, skyline, dpr, view.surface ? sy(c.y) - 7 * (Math.max(28 * dpr, 6 * scale) / 6) : null) : null;

    if (terrain.length > 1) {
      const surface = new Path2D();
      surface.moveTo(sx(terrain[0].x), h);
      for (const p of terrain) surface.lineTo(sx(p.x), sy(p.y));
      surface.lineTo(sx(terrain[terrain.length - 1].x), h);
      surface.closePath();
      const topY = Math.min(...terrain.map((p) => sy(p.y)));

      ctx.save();
      ctx.clip(surface);
      // Tanah: tekstur bulan.jpg yang diredupkan, menempel pada dunia (ikut bergerak dan zoom)
      ctx.fillStyle = '#3c3c3a';
      ctx.fillRect(0, 0, w, h);
      const pat = moonTexture();
      if (pat) {
        const k = (TEXTURE_WORLD_U * scale) / moonImg.width;
        pat.setTransform(new DOMMatrix().translateSelf(sx(0), sy(0)).scaleSelf(k));
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // Kawah kecil (hiasan, posisinya tetap di dunia)
      const step = 36;
      for (let i = Math.floor(terrain[0].x / step); i * step < terrain[terrain.length - 1].x; i++) {
        if (hash(i) < 0.45) continue;
        const x = i * step + hash(i + 0.5) * 30;
        const gy = groundY(x);
        if (gy === null) continue;
        const rx = Math.max(2.5 * dpr, (2 + hash(i + 0.7) * 6) * scale);
        const ry = rx * 0.35;
        const cy = sy(gy) + (8 + hash(i + 0.3) * 70) * dpr + ry;
        ctx.beginPath();
        ctx.ellipse(sx(x), cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();
        ctx.beginPath(); // dinding dalam yang menghadap Matahari (kanan) lebih terang
        ctx.ellipse(sx(x), cy, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
        ctx.strokeStyle = 'rgba(235,230,215,0.35)';
        ctx.lineWidth = Math.max(1, ry * 0.35);
        ctx.stroke();
      }

      // Lereng yang menghadap Matahari (naik ke kanan, Matahari di kiri) lebih terang
      const lightBand = 28 * dpr;
      for (let i = 1; i < terrain.length; i++) {
        const a = terrain[i - 1];
        const b = terrain[i];
        if (a.s || b.s) continue;
        const slope = Math.atan2(b.y - a.y, b.x - a.x);
        const bright = Math.max(0, Math.min(1, Math.sin(slope + Math.atan(sunSlope)) / Math.sin(0.5)));
        if (bright < 0.05) continue;
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
        ctx.lineTo(sx(b.x), sy(b.y) + lightBand);
        ctx.lineTo(sx(a.x), sy(a.y) + lightBand);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,246,225,${0.3 * bright})`;
        ctx.fill();
      }

      // Gradasi gelap ke bawah
      const g = ctx.createLinearGradient(0, topY, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Bayangan panjang (p.s = 1 kalau dalam bayangan, dihitung di level).
      // Garis sinar Matahari disapu dari kiri; bayangan makin tebal makin jauh permukaan di bawah sinar,
      // lalu menipis ke ujung. Sisi bawahnya digeser searah sinar, jadi bentuknya miring dan memanjang.
      const band = Math.min(90 * dpr, h * 0.18);
      const runs = [];
      let line = terrain[0].s ? Infinity : -Infinity;
      let run = null;
      for (let j = 0; j < terrain.length; j++) {
        const p = terrain[j];
        line = j === 0 ? (p.s ? p.y + 30 : p.y) : Math.max(line - sunSlope * (p.x - terrain[j - 1].x), p.y);
        if (p.s) {
          if (!run) runs.push((run = j > 0 ? [{ p: terrain[j - 1], t: 0 }] : []));
          run.push({ p, t: Math.min(band, Math.max(3 * dpr, (line - p.y) * scale * 2.5)) });
        } else if (run) {
          run.push({ p, t: 0 });
          run = null;
        }
      }
      const shadowPath = (r) => {
        const path = new Path2D();
        r.forEach(({ p }, j) => (j ? path.lineTo(sx(p.x), sy(p.y)) : path.moveTo(sx(p.x), sy(p.y))));
        for (let j = r.length - 1; j >= 0; j--) path.lineTo(sx(r[j].p.x) + r[j].t * 1.6, sy(r[j].p.y) + r[j].t);
        path.closePath();
        return path;
      };
      for (const [blur, alpha] of [
        [9, 0.35], // penumbra lebar
        [2.5, 0.72], // inti bayangan
      ]) {
        ctx.filter = `blur(${blur * dpr}px)`;
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        for (const r of runs) if (r.length > 1) ctx.fill(shadowPath(r));
      }
      ctx.filter = 'none';
      ctx.restore();

      // Garis permukaan: lereng terang lebih putih, bagian dalam bayangan gelap
      for (let i = 1; i < terrain.length; i++) {
        const a = terrain[i - 1];
        const b = terrain[i];
        const lit = !a.s && !b.s && b.y >= a.y;
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
        ctx.strokeStyle = lit ? '#e8e6df' : a.s || b.s ? '#2b2b2b' : '#77776f';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }
    }

    // Kawah gelap di samping landasan: cekungan dengan bibir, dasar sangat gelap, kilau es biru muda
    const crater = view.sites && view.sites.find((s) => s.bowl);
    if (crater && terrain.length > 1) drawCrater(crater, { sx, sy, groundY, scale, dpr, w });

    // Bayangan pendarat: memanjang di permukaan ke arah menjauhi Matahari, tepi lembut
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
      ctx.filter = `blur(${2 * dpr}px)`;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(3 * dpr, 2 * scale);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.filter = 'none';
    }

    // Penanda titik pendaratan: puncak bukit bergaris kuning, dekat kawah bergaris biru muda menyala
    if (view.sites) {
      ctx.textAlign = 'center';
      for (const s of view.sites) {
        const chosen = view.siteChoice === s.id;
        const glowing = s.id === 'crater';
        const color = glowing ? '#8fe3ff' : '#ffd23f';
        const px = sx(s.x);
        const py = sy(s.y);
        if (px < -80 * dpr || px > w + 80 * dpr) continue;
        const x0 = sx(s.x - s.halfWidth);
        const x1 = sx(s.x + s.halfWidth);
        const th = Math.max(4 * dpr, Math.min(10 * dpr, 1.2 * scale));
        const stripe = th * 1.6;
        ctx.save();
        if (glowing) {
          ctx.shadowColor = '#7fdcff';
          ctx.shadowBlur = (chosen ? 18 : 12) * dpr;
        }
        ctx.fillStyle = '#141414';
        ctx.fillRect(x0, py - th / 2, x1 - x0, th);
        ctx.fillStyle = color;
        for (let x = x0; x < x1; x += stripe * 2) ctx.fillRect(x, py - th / 2, Math.min(stripe, x1 - x), th);
        ctx.restore();
        if (chosen) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5 * dpr;
          ctx.strokeRect(x0 - 2 * dpr, py - th / 2 - 2 * dpr, x1 - x0 + 4 * dpr, th + 4 * dpr);
        }
        const pole = (glowing ? 72 : 34) * dpr; // tiang kawah lebih tinggi supaya label tidak bertumpuk
        ctx.strokeStyle = color;
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
          ctx.font = `600 ${12 * dpr}px system-ui`;
          // Rincian titik (es, kemiringan, bintang) ada di panel Spesialis; di sini cukup namanya.
          ctx.fillText(`${s.name}${chosen ? ' ✓' : ''}`, px, py - pole - 6 * dpr);
        }
      }
      // Titik di luar layar: panah di tepi
      ctx.font = `600 ${12 * dpr}px system-ui`;
      view.sites.forEach((s, i) => {
        const px = sx(s.x);
        if (px >= 0 && px <= w) return;
        const right = px > w;
        const ex = right ? w - 18 * dpr : 18 * dpr;
        const ey = h * 0.62 + i * 34 * dpr; // di bawah kotak HUD
        ctx.fillStyle = view.siteChoice === s.id ? '#fff' : s.id === 'crater' ? '#8fe3ff' : '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(ex + (right ? 12 : -12) * dpr, ey);
        ctx.lineTo(ex, ey - 10 * dpr);
        ctx.lineTo(ex, ey + 10 * dpr);
        ctx.fill();
        ctx.textAlign = right ? 'right' : 'left';
        ctx.fillText(`${s.name} ${Math.round(Math.abs(s.x - c.x))} u`, ex + (right ? -6 : 6) * dpr, ey - 14 * dpr);
      });
      ctx.textAlign = 'start';
    }

    // Garis panduan tegak ke tanah saat waktu diperlambat dekat landasan kawah
    if (view.precision) {
      const gy = groundY(c.x);
      if (gy !== null) {
        ctx.strokeStyle = 'rgba(143,227,255,0.9)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([5 * dpr, 5 * dpr]);
        ctx.beginPath();
        ctx.moveTo(sx(c.x), sy(c.y));
        ctx.lineTo(sx(c.x), sy(gy));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sx(c.x) - 8 * dpr, sy(gy));
        ctx.lineTo(sx(c.x) + 8 * dpr, sy(gy));
        ctx.stroke();
      }
      // Label di samping pendarat (tengah layar), tidak tertutup kotak HUD di kiri atas
      ctx.fillStyle = 'rgba(143,227,255,0.95)';
      ctx.font = `600 ${13 * dpr}px system-ui`;
      ctx.fillText(`Waktu diperlambat ${String(view.slowFactor).replace('.', ',')}×`, sx(c.x) + 22 * dpr, sy(c.y) + 18 * dpr);
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
    if (view.surface && !c.crashed) drawSurfaceGear(view.surface, sx(c.x), sy(c.y), k, earthPos, dpr);

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

  // Bumi dilihat dari Bulan: bola kecil biru dengan awan putih, sisi yang menghadap Matahari (kiri) terang.
  // aboveY: kalau diisi, Bumi digambar di atas titik layar ini (puncak pendarat di permukaan).
  function drawEarth(e, w, skyline, dpr, aboveY = null) {
    const r = e.radiusPx * dpr;
    const ex = w * e.xFrac;
    const lift = r + e.elevationDeg * 3 * dpr;
    let ey = skyline(ex) - lift;
    if (aboveY !== null) ey = Math.min(ey, aboveY - lift);
    if (ey < r * 1.5) {
      // Di luar layar (atas): panah di tepi atas dengan label.
      ctx.fillStyle = '#9fd0ff';
      ctx.beginPath();
      ctx.moveTo(ex, 6 * dpr);
      ctx.lineTo(ex - 8 * dpr, 18 * dpr);
      ctx.lineTo(ex + 8 * dpr, 18 * dpr);
      ctx.fill();
      ctx.font = `600 ${12 * dpr}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('Bumi', ex, 32 * dpr);
      ctx.textAlign = 'start';
      return { x: ex, y: ey };
    }
    const halo = ctx.createRadialGradient(ex, ey, r * 0.8, ex, ey, r * 3);
    halo.addColorStop(0, 'rgba(120,180,255,0.3)');
    halo.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(ex - r * 3, ey - r * 3, r * 6, r * 6);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.clip();
    const body = ctx.createRadialGradient(ex - r * 0.4, ey - r * 0.3, r * 0.1, ex, ey, r);
    body.addColorStop(0, '#9fd0ff');
    body.addColorStop(0.6, '#2f74c8');
    body.addColorStop(1, '#123a75');
    ctx.fillStyle = body;
    ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; // awan
    for (const [ox, oy, rx, ry] of [
      [-0.35, -0.45, 0.5, 0.16],
      [0.2, 0.05, 0.45, 0.14],
      [-0.2, 0.5, 0.4, 0.13],
    ]) {
      ctx.beginPath();
      ctx.ellipse(ex + ox * r, ey + oy * r, rx * r, ry * r, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    const night = ctx.createLinearGradient(ex - r, ey, ex + r, ey);
    night.addColorStop(0.45, 'rgba(0,0,10,0)');
    night.addColorStop(1, 'rgba(0,0,10,0.75)');
    ctx.fillStyle = night;
    ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(200,225,255,0.9)';
    ctx.font = `600 ${11 * dpr}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('Bumi', ex, ey - r - 6 * dpr);
    ctx.textAlign = 'start';
    return { x: ex, y: ey };
  }

  // Di permukaan: antena (0° = cakrawala kanan, 90° = tegak), garis sinyal ke Bumi saat mengirim, sinar pindai.
  function drawSurfaceGear(sf, px, py, k, earthPos, dpr) {
    const an = sf.antenna;
    if (an.has) {
      const bx = px + 1.4 * k;
      const by = py - 5.6 * k;
      // Sudut di layar: arah ke Bumi di layar + selisih antena terhadap Bumi di model.
      // Jadi saat antena tepat ke Bumi, piringan menghadap gambar Bumi. y layar ke bawah: naik = by - sin.
      const earthScreen = earthPos ? Math.atan2(by - earthPos.y, earthPos.x - bx) : (sf.earthDeg * Math.PI) / 180;
      const a = earthScreen + ((an.deg - sf.earthDeg) * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = -Math.sin(a);
      const len = 1.8 * k;
      const tx = bx + ux * len;
      const ty = by + uy * len;
      // Kerucut sinyal tipis ke arah hadap
      if (an.on) {
        const reach = 14 * k;
        const spread = 0.09;
        const cone = ctx.createLinearGradient(tx, ty, tx + ux * reach, ty + uy * reach);
        cone.addColorStop(0, `rgba(120,200,255,${0.15 + 0.35 * an.signal})`);
        cone.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(a + spread) * reach, ty - Math.sin(a + spread) * reach);
        ctx.lineTo(tx + Math.cos(a - spread) * reach, ty - Math.sin(a - spread) * reach);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = an.on ? '#e6e6e6' : '#8a8a8a';
      ctx.lineWidth = Math.max(1.5 * dpr, 0.25 * k);
      ctx.beginPath(); // tiang
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath(); // piringan: busur cekung menghadap arah antena
      ctx.arc(tx - ux * 0.9 * k, ty - uy * 0.9 * k, 1.3 * k, -a - 0.8, -a + 0.8);
      ctx.fillStyle = an.on ? '#f2f2f2' : '#9a9a9a';
      ctx.fill();
      ctx.stroke();
      if (an.sending && earthPos) {
        ctx.strokeStyle = 'rgba(120,200,255,0.8)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([6 * dpr, 6 * dpr]);
        ctx.lineDashOffset = -(performance.now() / 40) % (12 * dpr);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(earthPos.x, earthPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }
    if (sf.scan) {
      const g = ctx.createRadialGradient(px, py, 0, px, py, 10 * k);
      g.addColorStop(0, 'rgba(143,227,255,0.35)');
      g.addColorStop(1, 'rgba(143,227,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 10 * k * sf.scan.progress + k, Math.PI, 2 * Math.PI);
      ctx.fill();
    }
  }

  function drawCrater(s, { sx, sy, groundY, scale, dpr, w }) {
    const { x, r } = s.bowl;
    if (sx(x + r) < 0 || sx(x - r) > w) return;
    const rimY = s.y;
    // Dinding dalam di seberang (terlihat di cekungan profil permukaan): sangat gelap
    const inner = new Path2D();
    inner.moveTo(sx(x - r), sy(rimY));
    inner.lineTo(sx(x + r), sy(rimY));
    for (let i = 24; i >= 0; i--) {
      const px = x - r + (2 * r * i) / 24;
      const gy = groundY(px);
      if (gy !== null) inner.lineTo(sx(px), sy(Math.min(gy, rimY)));
    }
    inner.closePath();
    const wall = ctx.createLinearGradient(0, sy(rimY), 0, sy(rimY - s.bowl.depth));
    wall.addColorStop(0, '#111214');
    wall.addColorStop(1, '#030304');
    ctx.fillStyle = wall;
    ctx.fill(inner);
    // Dasar kawah yang tidak pernah terkena cahaya: gelapkan tanah di bawahnya juga
    const by = groundY(x);
    if (by !== null) {
      const dark = ctx.createRadialGradient(sx(x), sy(by), 0, sx(x), sy(by), r * scale * 1.1);
      dark.addColorStop(0, 'rgba(0,0,0,0.9)');
      dark.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(sx(x), sy(by), r * scale * 1.1, r * scale * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bibir kawah
    ctx.strokeStyle = 'rgba(170,170,165,0.55)';
    ctx.lineWidth = 2 * dpr;
    for (const ex of [x - r, x + r]) {
      ctx.beginPath();
      for (let i = -6; i <= 6; i++) {
        const px = ex + i * 0.8;
        const gy = groundY(px);
        if (gy === null) continue;
        if (i === -6) ctx.moveTo(sx(px), sy(gy));
        else ctx.lineTo(sx(px), sy(gy));
      }
      ctx.stroke();
    }
    // Kilau kecil biru muda: es di dasar kawah
    const now = performance.now() / 1000;
    ctx.save();
    ctx.shadowColor = '#9fe8ff';
    ctx.shadowBlur = 8 * dpr;
    for (let i = 0; i < 6; i++) {
      const px = x + (hash(i + 3.1) - 0.5) * r * 0.9;
      const gy = groundY(px);
      if (gy === null) continue;
      const a = 0.35 + 0.65 * Math.abs(Math.sin(now * 2.2 + i * 1.7));
      const qx = sx(px);
      const qy = sy(gy) - (1 + hash(i + 7.3) * 2) * dpr;
      const q = (1.2 + hash(i + 1.9) * 1.6) * dpr;
      ctx.fillStyle = `rgba(190,240,255,${a})`;
      ctx.beginPath(); // bintik bersudut empat
      ctx.moveTo(qx, qy - q * 2);
      ctx.lineTo(qx + q * 0.5, qy);
      ctx.lineTo(qx, qy + q * 2);
      ctx.lineTo(qx - q * 0.5, qy);
      ctx.closePath();
      ctx.moveTo(qx - q * 2, qy);
      ctx.lineTo(qx, qy - q * 0.5);
      ctx.lineTo(qx + q * 2, qy);
      ctx.lineTo(qx, qy + q * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  return { draw };
}
