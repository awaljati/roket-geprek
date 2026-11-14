// Layar terbang (perangkat Navigator / solo). Menjalankan fisika, menggambar, dan mengirim snapshot ke Spesialis.
import { LEVEL_MODULES } from '../levels/index.js';
import { orbitCheck, orbitExtremes } from '../engine/flight.js';
import { createRenderer } from '../render/render2d.js';
import { mountPanelFor } from './specialistPanel.js';
import { createControls, controlAction } from '../engine/attitude.js';
import { bindControls, helpHtml } from './controls.js';

const DT = 1 / 60;
const MODE_NAME = { manual: 'manual', prograde: 'searah gerak', retrograde: 'lawan arah', left: 'kiri jalur', right: 'kanan jalur' };

export function flightScreen(app, el) {
  const M = LEVEL_MODULES[app.level];
  el.className = 'flight';
  el.innerHTML = `
    <div class="view">
      <canvas id="cv"></canvas>
      <div class="timeline" id="timeline"></div>
      <div class="hud"><div id="hud"></div>
        <details><summary class="muted">Kontrol</summary><div class="keys">${helpHtml()}</div></details>
      </div>
      <div class="touch" id="pad"></div>
    </div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createRenderer($('#cv'));
  const game = M.create(app.build, app.code || 'solo');
  const craft = () => game.flight || game.craft;
  const ctrl = createControls();
  let warp = 1;

  // Panel kanan: Spesialis (solo) atau status room (navigator).
  let updatePanel = () => {};
  if (app.role === 'solo') {
    updatePanel = mountPanelFor(app.level, $('#side'), (cmd) => M.command(game, cmd));
  } else {
    $('#side').innerHTML = `<h2>Navigator</h2><p>Room <span class="code">${app.code}</span></p><p class="muted">Tombol wahana dipegang Spesialis di perangkatnya. Dengarkan aba-abanya.</p><div class="status" id="navst"></div>`;
    app.onCmd = (cmd) => M.command(game, cmd);
    updatePanel = (v) => ($('#navst').textContent = v.lastLog);
  }

  const unbind = bindControls($('#pad'), (action) => {
    if (action === 'warp') warp = warp === 1 ? 3 : 1;
    else controlAction(ctrl, action, craft());
  });

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let lastSend = 0;
  function frame(now) {
    // Percepat waktu hanya saat mesin mati dan tidak di fase genting.
    const calm = ctrl.throttle === 0 && ctrl.pulseLeft === 0 && !['flyby', 'entry', 'launch'].includes(game.phase);
    const speed = calm ? warp : 1;
    acc += Math.min(0.1, (now - last) / 1000) * speed;
    last = now;
    while (acc >= DT) {
      M.step(game, ctrl, DT);
      acc -= DT;
    }
    const view = M.snapshot(game);
    renderer.draw(view);
    drawHud(view, speed);
    updatePanel(view);
    if (app.room && now - lastSend > 100) {
      app.room.sendState(M.snapshot(game, false));
      lastSend = now;
    }
    if (game.result) {
      app.result = game.result;
      if (app.room) {
        app.room.sendState(M.snapshot(game, false));
        app.room.saveResult('tim', app.level, game.result);
      }
      setTimeout(() => app.go('debrief'), 1200);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function controlLine(v, speed) {
    const fuel = v.flight ? v.flight.fuel : v.fuel;
    return `<b>Bahan bakar ${Math.round(fuel * 100)}%</b>
      <span>Gas ${Math.round(ctrl.throttle * 100)}%${ctrl.pulseLeft > 0 ? ' (dorongan pendek)' : ''} · Arah: ${MODE_NAME[ctrl.mode]}${speed > 1 ? ' · Waktu ×' + speed : ''}</span>`;
  }

  function drawHud(v, speed) {
    if (app.level === 1) return drawHud1(v, speed);
    drawHud2(v, speed);
  }

  function drawHud1(v, speed) {
    const f = game.flight;
    const o = orbitCheck(f);
    const p = f.planet;
    const mark = (ok) => (ok ? '✓' : '·');
    const { apo, peri } = orbitExtremes(f);
    const fmt = (r) => (r === Infinity ? 'lepas' : Math.round(r - p.radius));
    const near = (r) => r !== null && Math.abs(r - p.orbitRadius) < 14;
    $('#timeline').innerHTML = '';
    $('#hud').innerHTML = `${controlLine(v, speed)}
      <span>Titik tertinggi ${fmt(apo)}${near(apo) ? ' ✓' : ''} · terendah ${peri === null ? '-' : fmt(peri)}${near(peri) ? ' ✓' : ''} (target ${p.orbitRadius - p.radius})</span>
      <span>${mark(o.altOk)} Ketinggian ${Math.round(o.r - p.radius)} / ${p.orbitRadius - p.radius}</span>
      <span>${mark(o.speedOk)} Kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}</span>
      <span>${mark(o.flatOk)} Naik/turun ${o.radial.toFixed(0)}</span>
      ${v.phase === 'launch' && v.flight.inRing ? `<span style="color:var(--ok)">Tahan di cincin ${v.flight.inRingFor.toFixed(1)} s</span>` : ''}`;
  }

  function drawHud2(v, speed) {
    const steps = [
      ['Berangkat', v.phase === 'tli'],
      ...v.mccWindows.slice(0, 2).map((w) => [w.id, v.mcc === w.id]),
      ['Bulan', v.phase === 'flyby'],
      [v.mccWindows[2].id, v.mcc === v.mccWindows[2].id],
      ['Masuk atmosfer', v.phase === 'entry' || v.phase === 'splash'],
    ];
    $('#timeline').innerHTML = steps.map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join('');
    let status;
    if (v.phase === 'tli') status = 'Tekan W untuk menyalakan mesin dan berangkat ke Bulan.';
    else if (v.phase === 'entry') status = 'Masuk atmosfer: tekan E supaya pelindung panas menghadap depan.';
    else if (v.mcc) status = `<span style="color:var(--ok)">${v.mcc}: mesin boleh dinyalakan</span>`;
    else if (v.nextMcc) status = `Mesin terkunci. ${v.nextMcc.id} dalam ${Math.ceil(v.nextMcc.from - v.t)} s${speed === 1 ? ' (T = percepat)' : ''}`;
    else status = 'Mesin terkunci.';
    const adv = app.role === 'solo' && v.advice && v.mcc ? `<span>Saran Spesialis: dorong ke <b>${v.advice === 'left' ? 'KIRI (Z)' : 'KANAN (C)'}</b> jalur</span>` : '';
    $('#hud').innerHTML = `${controlLine(v, speed)}<span>${status}</span>${adv}
      ${v.phase === 'flyby' ? `<span>${aimText(v.aimOff)} · Kualitas foto ${Math.round(v.photoQuality * 100)}%</span>` : ''}`;
  }

  function aimText(off) {
    if (off === null) return 'Arahkan kapsul ke Bulan (A/D)';
    if (Math.abs(off) <= 10) return '<span style="color:var(--ok)">Kamera mengarah ke Bulan ✓</span>';
    return `Arahkan kapsul ke Bulan: putar ${off > 0 ? 'kanan (D)' : 'kiri (A)'} ${Math.round(Math.abs(off))}°`;
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    unbind();
    app.onCmd = null;
  };
}
