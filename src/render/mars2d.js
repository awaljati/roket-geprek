// Tampilan 2D Level 4 setelah peluncuran: perjalanan ke Mars, program pendaratan, "tujuh menit", dan permukaan.
// Hanya membaca snapshot (view); aturan ada di levels/level4.js. Peluncuran memakai tampilan orbit Bumi di render2d.

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], k))).join(',')})`;
const fmt = (v) => String(+(+v).toFixed(2)).replace('.', ',');
const STAR = Array.from({ length: 120 }, (_, i) => [hash(i), hash(i + 0.37), 0.5 + hash(i + 0.71) * 1.2]);

export function drawMars(ctx, canvas, view) {
  const dpr = devicePixelRatio;
  const w = (canvas.width = canvas.clientWidth * dpr);
  const h = (canvas.height = canvas.clientHeight * dpr);
  const g = { ctx, w, h, dpr, font: (px, bold = false) => `${bold ? '700 ' : ''}${px * dpr}px system-ui, sans-serif` };
  if (view.view === 'cruise') return drawCruise(g, view);
  if (view.view === 'program') return drawProgram(g);
  if (view.view === 'edl') return drawEdl(g, view);
  return drawSurface(g, view);
}

function space(g, alpha = 1) {
  const { ctx, w, h, dpr } = g;
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, r] of STAR) {
    ctx.fillStyle = `rgba(255,255,255,${0.6 * alpha})`;
    ctx.fillRect(x * w, y * h, r * dpr, r * dpr);
  }
}

function label(g, text, x, y, color = '#cfd8ea', size = 12, align = 'center', bold = false) {
  const { ctx } = g;
  ctx.font = g.font(size, bold);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ---------- Perjalanan ke Mars: Matahari di tengah, orbit Bumi dan Mars, setengah elips transfer ----------
function drawCruise(g, v) {
  const { ctx, w, h, dpr } = g;
  const c = v.cruise;
  space(g);
  const cx = w / 2;
  const cy = h * 0.46;
  const s = (Math.min(w, h) * 0.38) / c.marsR;
  const pos = (r, deg) => [cx + Math.cos((deg * Math.PI) / 180) * r * s, cy - Math.sin((deg * Math.PI) / 180) * r * s];

  // Badai matahari: gelombang kuning yang menyebar dari Matahari
  if (c.stormActive) {
    const k = c.stormProgress;
    const R = (0.2 + k * 1.6) * c.marsR * s;
    const grd = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
    grd.addColorStop(0, 'rgba(255,200,60,0)');
    grd.addColorStop(0.8, 'rgba(255,200,60,0.28)');
    grd.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  // Matahari
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 * dpr);
  glow.addColorStop(0, 'rgba(255,230,150,0.9)');
  glow.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 60 * dpr, cy - 60 * dpr, 120 * dpr, 120 * dpr);
  ctx.beginPath();
  ctx.arc(cx, cy, 12 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd866';
  ctx.fill();

  // Orbit Bumi dan Mars
  ctx.setLineDash([6 * dpr, 6 * dpr]);
  ctx.lineWidth = 1.2 * dpr;
  for (const [r, col] of [[1, 'rgba(127,182,255,0.55)'], [c.marsR, 'rgba(230,120,80,0.55)']]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Lintasan transfer (hijau) dan bagian yang sudah dilalui (oranye)
  const { a, e } = c.transfer;
  const pathTo = (p1, color, width) => {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const nu = Math.PI * p1 * (i / 60);
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      const [x, y] = pos(r, c.startDeg + (nu * 180) / Math.PI);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  pathTo(1, 'rgba(63,209,122,0.45)', 4 * dpr);
  pathTo(c.progress, 'rgba(255,200,120,0.9)', 2 * dpr);

  // Planet
  const [ex, ey] = pos(1, c.earthDeg);
  const [mx, my] = pos(c.marsR, c.marsDeg);
  ctx.beginPath();
  ctx.arc(ex, ey, 7 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#3a7fd5';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mx, my, 6 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#d0623a';
  ctx.fill();
  label(g, 'Bumi', ex, ey - 12 * dpr, '#9cc6ff');
  label(g, 'Mars', mx, my - 12 * dpr, '#ffb08a');
  label(g, 'Matahari', cx, cy + 28 * dpr, '#ffe3a0');

  // Wahana (segitiga kecil searah gerak)
  const [px, py] = pos(c.craft.r, c.craft.deg);
  const [qx, qy] = pos(c.craft.r, c.craft.deg + 1);
  const ang = Math.atan2(qy - py, qx - px);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(8 * dpr, 0);
  ctx.lineTo(-5 * dpr, 5 * dpr);
  ctx.lineTo(-5 * dpr, -5 * dpr);
  ctx.closePath();
  ctx.fillStyle = v.instrumentsOn ? '#f2f2f2' : '#8a93a6';
  ctx.fill();
  ctx.restore();
  if (c.stormActive) {
    label(g, v.radShield ? 'BADAI MATAHARI · pelindung radiasi aktif' : 'BADAI MATAHARI', cx, cy + 56 * dpr, '#ffd54a', 16, 'center', true);
  }
}

// ---------- Program pendaratan: Mars redup sebagai latar. Angka dan tombol ada di kartu HTML (screens/flight.js). ----------
function drawProgram(g) {
  const { ctx, w, h } = g;
  space(g, 0.5);
  const R = w * 1.4;
  const mx = w * 0.5;
  const my = h * 0.85 + R;
  const grd = ctx.createLinearGradient(0, my - R, 0, my - R + h * 0.3);
  grd.addColorStop(0, '#c4623b');
  grd.addColorStop(1, '#6e2c18');
  ctx.beginPath();
  ctx.arc(mx, my, R, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.fillStyle = 'rgba(5,7,15,0.55)'; // redupkan supaya kartu program mudah dibaca
  ctx.fillRect(0, 0, w, h);
}

// Kapsul: kerucut dengan pelindung panas di depan (arah `rot`, 0 = menghadap ke bawah).
function capsule(ctx, x, y, r, rot, heat = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (heat > 0) {
    const grd = ctx.createRadialGradient(0, r * 0.9, 0, 0, r * 0.9, r * (2.2 + heat * 1.5));
    grd.addColorStop(0, `rgba(255,240,180,${0.9 * Math.min(1, heat)})`);
    grd.addColorStop(0.4, `rgba(255,140,40,${0.7 * Math.min(1, heat)})`);
    grd.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, r * 0.9, r * (2.2 + heat * 1.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r);
  ctx.lineTo(r * 0.45, -r);
  ctx.lineTo(r, r * 0.6);
  ctx.lineTo(-r, r * 0.6);
  ctx.closePath();
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();
  ctx.fillStyle = '#7a4a2a'; // pelindung panas
  ctx.beginPath();
  ctx.ellipse(0, r * 0.65, r * 1.05, r * 0.32, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();
}

// Rover dengan tahap turun ("sky crane") di atasnya saat roket pendarat menyala.
function rover(ctx, x, y, r, { crane = false, flame = false, mast = true } = {}) {
  ctx.save();
  ctx.translate(x, y);
  // roda
  ctx.fillStyle = '#2b2b2b';
  for (const dx of [-0.8, 0, 0.8]) {
    ctx.beginPath();
    ctx.arc(dx * r, 0, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
  // badan
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(-r, -r * 0.75, 2 * r, r * 0.45);
  ctx.fillStyle = '#b9b3a6';
  ctx.fillRect(-r * 0.9, -r * 0.3, 1.8 * r, r * 0.12);
  if (mast) {
    ctx.fillStyle = '#d8d2c6';
    ctx.fillRect(r * 0.55, -r * 1.6, r * 0.12, r * 0.85);
    ctx.fillRect(r * 0.4, -r * 1.75, r * 0.42, r * 0.22);
  }
  if (crane) {
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.75);
    ctx.lineTo(-r * 0.5, -r * 2.4);
    ctx.moveTo(r * 0.6, -r * 0.75);
    ctx.lineTo(r * 0.5, -r * 2.4);
    ctx.stroke();
    ctx.fillStyle = '#9da3ad';
    ctx.fillRect(-r * 1.1, -r * 2.8, 2.2 * r, r * 0.45);
    if (flame) {
      for (const dx of [-1, -0.45, 0.45, 1]) {
        ctx.fillStyle = `rgba(255,${150 + Math.random() * 60},60,0.9)`;
        ctx.beginPath();
        ctx.moveTo(dx * r - r * 0.1, -r * 2.35);
        ctx.lineTo(dx * r + r * 0.1, -r * 2.35);
        ctx.lineTo(dx * r * 1.15, -r * (1.6 - Math.random() * 0.3));
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function parachute(ctx, x, y, r, torn) {
  ctx.save();
  ctx.translate(x, y);
  const top = -r * 5;
  ctx.strokeStyle = 'rgba(230,230,230,0.8)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  for (const dx of [-2.2, -1, 1, 2.2]) {
    ctx.moveTo(0, -r);
    ctx.lineTo(dx * r, top);
  }
  ctx.stroke();
  if (torn) {
    ctx.fillStyle = '#e0e0e0';
    for (let i = 0; i < 5; i++) {
      const px = (i - 2) * r * 1.1 + (Math.random() - 0.5) * r * 0.5;
      ctx.beginPath();
      ctx.moveTo(px, top - r * 0.3);
      ctx.lineTo(px + r * 0.6, top - r * (0.6 + Math.random()));
      ctx.lineTo(px + r * 0.3, top + r * 0.2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(0, top, r * 2.6, r * 1.6, 0, Math.PI, 2 * Math.PI);
    ctx.fillStyle = '#f2f2f2';
    ctx.fill();
    ctx.fillStyle = '#d0623a'; // pola parasut
    for (let i = 0; i < 6; i += 2) {
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.ellipse(0, top, r * 2.6, r * 1.6, 0, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- Tujuh menit penuh ketegangan ----------
function drawEdl(g, v) {
  const { ctx, w, h, dpr } = g;
  const e = v.edl;
  const alt = e.alt;
  // Langit: hitam di atas atmosfer, jingga kecokelatan dekat permukaan
  const k = Math.max(0, Math.min(1, 1 - alt / 60));
  ctx.fillStyle = mix([5, 7, 15], [196, 140, 100], k ** 1.5);
  ctx.fillRect(0, 0, w, h);
  if (k < 0.6) for (const [x, y, r] of STAR) {
    ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k / 0.6)})`;
    ctx.fillRect(x * w, y * h, r * dpr, r * dpr);
  }
  const capX = w / 2;
  const capY = h * 0.42;
  const r = Math.max(14 * dpr, Math.min(w, h) * 0.035);
  const capBottom = capY + r * 1.2;
  // Permukaan: lengkung Mars saat tinggi, tanah datar saat dekat
  if (alt > 12) {
    const R = w * 3;
    const topY = h - lerp(h * 0.08, h * 0.35, 1 - (alt - 12) / 113);
    const grd = ctx.createLinearGradient(0, topY, 0, h);
    grd.addColorStop(0, '#c4623b');
    grd.addColorStop(1, '#5d2615');
    ctx.beginPath();
    ctx.arc(w / 2, topY + R, R, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  } else {
    const gy = lerp(capBottom, h * 0.94, alt / 12);
    const grd = ctx.createLinearGradient(0, gy, 0, h);
    grd.addColorStop(0, '#b4582f');
    grd.addColorStop(1, '#4a1f10');
    ctx.fillStyle = grd;
    ctx.fillRect(0, gy, w, h - gy);
    // bukit dan batu (hiasan)
    ctx.fillStyle = 'rgba(80,30,15,0.5)';
    for (let i = 0; i < 14; i++) {
      const bx = hash(i) * w;
      const bw = (10 + hash(i + 0.3) * 30) * dpr * (1.5 - alt / 12);
      ctx.beginPath();
      ctx.ellipse(bx, gy + (4 + hash(i + 0.6) * 30) * dpr, bw, bw * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.crashed || (alt < 0.05 && e.stage !== 'retro')) {
      ctx.fillStyle = 'rgba(160,100,70,0.6)'; // debu
      ctx.beginPath();
      ctx.ellipse(capX, gy, r * 4, r * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wahana
  const st = e.stage;
  let x = capX;
  let y = capY;
  if (alt <= 12) y = Math.min(capY, lerp(capBottom, h * 0.94, alt / 12) - r * 1.2);
  const shake = st === 'entry' || st === 'steep' || st === 'burn' ? (Math.random() - 0.5) * e.heat * 3 * dpr : 0;
  x += shake;
  const tilt = ((e.entryDeg || -13) + 13) * 0.04;
  if (!e.shieldOff || st === 'tear' || st === 'low') {
    if (e.chuteOpen || e.chuteTorn) parachute(ctx, x, y, r, e.chuteTorn);
    capsule(ctx, x, y, r, st === 'skip' ? -0.5 : tilt, e.heat);
    // garis panas
    if (e.heat > 0.15) {
      ctx.strokeStyle = `rgba(255,190,110,${0.5 * Math.min(1, e.heat)})`;
      ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < 8; i++) {
        const sx = x + (hash(i + Math.floor(performance.now() / 80)) - 0.5) * r * 3;
        ctx.beginPath();
        ctx.moveTo(sx, y - r);
        ctx.lineTo(sx + (Math.random() - 0.5) * 4 * dpr, y - r * (3 + Math.random() * 4));
        ctx.stroke();
      }
    }
  } else if (e.chuteOpen) {
    parachute(ctx, x, y, r, false);
    rover(ctx, x, y + r * 0.6, r * 0.8, { crane: true, flame: false });
  } else {
    rover(ctx, x, y + r * 0.6, r * 0.8, { crane: alt > 0.02, flame: e.retroOn && !e.crashed });
  }
  if (e.crashed) label(g, 'GAGAL', capX, capY + r * 4, '#ff6b6b', 22, 'center', true);

  // Jam dan angka
  const left = e.clockLeft;
  const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  label(g, `T− ${clock}`, w / 2, 110 * dpr, '#ffd54a', 28, 'center', true);
  label(g, `Tujuh menit penuh ketegangan · sinyal butuh ±${e.signalDelayMin} menit ke Bumi`, w / 2, 132 * dpr, '#f3e2d4', 12);
  label(g, `Ketinggian ${alt >= 10 ? Math.round(alt) : fmt(alt.toFixed(1))} km · kecepatan ${Math.round(e.speed)} m/s`, w / 2, h - 16 * dpr, '#fff', 13, 'center', true);
  const steps = [
    ['Masuk atmosfer', st === 'entry' || st === 'burn' || st === 'steep' || st === 'skip'],
    ['Parasut', st === 'chute' || st === 'tear' || st === 'low'],
    ['Roket pendarat', st === 'retro' || st === 'early' || st === 'fuel'],
  ];
  steps.forEach(([n, on], i) => label(g, (on ? '▶ ' : '') + n, 16 * dpr, (h * 0.55) + i * 18 * dpr, on ? '#ffd54a' : 'rgba(255,255,255,0.55)', 12, 'left', on));
}

// ---------- Di permukaan Mars ----------
function drawSurface(g, v) {
  const { ctx, w, h, dpr } = g;
  const sf = v.surface;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#a77b5c');
  sky.addColorStop(1, '#e0b68f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Bumi: titik biru kecil di langit ("bintang pagi" dari Mars)
  const exy = [w * 0.8, h * 0.18];
  ctx.beginPath();
  ctx.arc(exy[0], exy[1], 3 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#bfe0ff';
  ctx.fill();
  label(g, 'Bumi', exy[0], exy[1] - 8 * dpr, '#3b2a20', 11);
  // Matahari kecil dan pucat
  ctx.beginPath();
  ctx.arc(w * 0.18, h * 0.22, 9 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,250,235,0.9)';
  ctx.fill();
  // Tanah dan bukit
  const gy = h * 0.7;
  ctx.fillStyle = '#9c4a28';
  ctx.beginPath();
  ctx.moveTo(0, gy);
  for (let i = 0; i <= 24; i++) ctx.lineTo((i / 24) * w, gy - (Math.sin(i * 0.9) * 6 + hash(i) * 14) * dpr - (i > 14 ? (i - 14) * 4 * dpr : 0));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7d381c';
  ctx.fillRect(0, gy + 10 * dpr, w, h);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(60,22,10,${0.3 + hash(i + 0.2) * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(hash(i + 0.5) * w, gy + (14 + hash(i + 0.9) * (h - gy - 20)) , (2 + hash(i) * 8) * dpr, (1 + hash(i) * 3) * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const r = Math.max(18 * dpr, Math.min(w, h) * 0.06);
  const rx = w * 0.42;
  const ry = gy + 6 * dpr;
  rover(ctx, rx, ry, r, { mast: true });
  // Antena (piringan) menghadap Bumi
  const ax = rx - r * 0.5;
  const ay = ry - r * 0.95;
  ctx.fillStyle = '#d8d2c6';
  ctx.beginPath();
  ctx.ellipse(ax, ay, r * 0.35, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  if (sf && sf.sending) {
    const t = performance.now() / 300;
    ctx.strokeStyle = 'rgba(80,140,255,0.8)';
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([6 * dpr, 8 * dpr]);
    ctx.lineDashOffset = -t * 10;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(exy[0], exy[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (v.edl && v.edl.crashed) label(g, 'GAGAL', w / 2, h * 0.4, '#ff3b3b', 22, 'center', true);
  if (sf) {
    const pct = Math.round(sf.progress * 100);
    const txt = !sf.ready ? 'MENDARAT di Mars!' : sf.sending ? `Mengirim foto pertama… ${pct}%` : sf.pressed ? `Foto terkirim ${pct}%` : 'Spesialis: tekan Kirim foto';
    label(g, txt, w / 2, 110 * dpr, '#2a160c', 18, 'center', true);
    // Kartu foto: terisi dari atas sesuai bagian yang sudah terkirim; kamera rusak = berbintik.
    if (sf.pressed) {
      const pw = Math.min(w * 0.3, 220 * dpr);
      const ph = pw * 0.62;
      const px = w - pw - 16 * dpr;
      const py = h - ph - 16 * dpr;
      ctx.fillStyle = '#111';
      ctx.fillRect(px - 4 * dpr, py - 4 * dpr, pw + 8 * dpr, ph + 8 * dpr);
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph * sf.progress);
      ctx.clip();
      const s2 = ctx.createLinearGradient(0, py, 0, py + ph);
      s2.addColorStop(0, '#b88a68');
      s2.addColorStop(0.55, '#d9ad84');
      s2.addColorStop(0.56, '#8f4224');
      s2.addColorStop(1, '#5d2a16');
      ctx.fillStyle = s2;
      ctx.fillRect(px, py, pw, ph);
      if (v.cameraDamaged) {
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = hash(i + 0.1) > 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
          ctx.fillRect(px + hash(i) * pw, py + hash(i + 0.4) * ph, 2 * dpr, 2 * dpr);
        }
      }
      ctx.restore();
      label(g, v.cameraDamaged ? 'Foto pertama (kamera rusak)' : 'Foto pertama dari Mars', px + pw / 2, py - 10 * dpr, '#2a160c', 11, 'center', true);
    }
  }
}
