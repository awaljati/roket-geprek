// Layar terbang (perangkat Navigator / solo). Menjalankan fisika, menggambar, dan mengirim snapshot ke Spesialis.
import { createLevel1, stepLevel1, command, snapshotLevel1 } from '../levels/level1.js';
import { orbitCheck, orbitExtremes } from '../engine/flight.js';
import { createRenderer } from '../render/render2d.js';
import { mountSpecialistPanel } from './specialistPanel.js';
import { createControls, controlAction } from '../engine/attitude.js';
import { bindControls, helpHtml } from './controls.js';

const DT = 1 / 60;

export function flightScreen(app, el) {
  el.className = 'flight';
  el.innerHTML = `
    <div class="view">
      <canvas id="cv"></canvas>
      <div class="hud" id="hud"></div>
      <div class="touch" id="pad"></div>
    </div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createRenderer($('#cv'));
  const game = createLevel1(app.build);
  const ctrl = createControls();

  // Panel kanan: Spesialis (solo) atau status room (navigator).
  let updatePanel = () => {};
  if (app.role === 'solo') {
    updatePanel = mountSpecialistPanel($('#side'), (cmd) => command(game, cmd));
  } else {
    $('#side').innerHTML = `<h2>Navigator</h2><p>Room <span class="code">${app.code}</span></p><p class="muted">Spesialis memegang tombol lepas, panel, antena, dan kirim sinyal.</p><div class="status" id="navst"></div>`;
    app.onCmd = (cmd) => command(game, cmd);
    updatePanel = (v) => ($('#navst').textContent = v.lastLog);
  }

  const unbind = bindControls($('#pad'), (action) => controlAction(ctrl, action, game.flight));

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let lastSend = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      stepLevel1(game, ctrl, DT);
      acc -= DT;
    }
    const view = snapshotLevel1(game);
    renderer.draw(view);
    drawHud(view);
    updatePanel(view);
    if (app.room && now - lastSend > 100) {
      app.room.sendState(snapshotLevel1(game, false));
      lastSend = now;
    }
    if (game.result) {
      app.result = game.result;
      if (app.room) {
        app.room.sendState(snapshotLevel1(game, false));
        app.room.saveResult('tim', 1, game.result);
      }
      setTimeout(() => app.go('debrief'), 900);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function apoLine() {
    const p = game.flight.planet;
    const { apo, peri } = orbitExtremes(game.flight);
    const fmt = (r) => (r === Infinity ? 'lepas' : Math.round(r - p.radius));
    const target = p.orbitRadius - p.radius;
    const near = (r) => r !== null && Math.abs(r - p.orbitRadius) < 14;
    return `Titik tertinggi ${fmt(apo)}${near(apo) ? ' ✓' : ''} · terendah ${peri === null ? '-' : fmt(peri)}${near(peri) ? ' ✓' : ''} (target ${target})`;
  }

  function drawHud(v) {
    const o = orbitCheck(game.flight);
    const mark = (ok) => (ok ? '✓' : '·');
    $('#hud').innerHTML = `
      <b>Bahan bakar ${Math.round(v.flight.fuel * 100)}%</b>
      <span>Gas ${Math.round(ctrl.throttle * 100)}%${ctrl.pulseLeft > 0 ? ' (dorongan pendek)' : ''} · Arah: ${{ manual: 'manual', prograde: 'searah gerak', retrograde: 'lawan arah' }[ctrl.mode]}</span>
      <span>${apoLine()}</span>
      <span>${mark(o.altOk)} Ketinggian ${Math.round(o.r - game.flight.planet.radius)} / ${game.flight.planet.orbitRadius - game.flight.planet.radius}</span>
      <span>${mark(o.speedOk)} Kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}</span>
      <span>${mark(o.flatOk)} Naik/turun ${o.radial.toFixed(0)}</span>
      ${v.phase === 'launch' && v.flight.inRing ? `<span style="color:var(--ok)">Tahan di cincin ${v.flight.inRingFor.toFixed(1)} s</span>` : ''}
      <details><summary class="muted">Kontrol</summary><div class="keys">${helpHtml()}</div></details>`;
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    unbind();
    app.onCmd = null;
  };
}
