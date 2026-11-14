// Layar terbang (perangkat Navigator / solo). Menjalankan fisika, menggambar, dan mengirim snapshot ke Spesialis.
import { createLevel1, stepLevel1, command, snapshotLevel1 } from '../levels/level1.js';
import { orbitCheck } from '../engine/flight.js';
import { createRenderer } from '../render/render2d.js';
import { mountSpecialistPanel } from './specialistPanel.js';

const DT = 1 / 60;

export function flightScreen(app, el) {
  el.className = 'flight';
  el.innerHTML = `
    <div class="view">
      <canvas id="cv"></canvas>
      <div class="hud" id="hud"></div>
      <div class="touch">
        <div class="row"><button id="tl">⟲</button><button id="tr">⟳</button></div>
        <button class="primary" id="th">Dorong</button>
      </div>
    </div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createRenderer($('#cv'));
  const game = createLevel1(app.build);
  const input = { thrust: false, turn: 0 };
  const keys = new Set();

  // Panel kanan: Spesialis (solo) atau status room (navigator).
  let updatePanel = () => {};
  if (app.role === 'solo') {
    updatePanel = mountSpecialistPanel($('#side'), (cmd) => command(game, cmd));
  } else {
    $('#side').innerHTML = `<h2>Navigator</h2><p>Room <span class="code">${app.code}</span></p><p class="muted">Spesialis memegang tombol lepas, panel, antena, dan kirim sinyal.</p><div class="status" id="navst"></div>`;
    app.onCmd = (cmd) => command(game, cmd);
    updatePanel = (v) => ($('#navst').textContent = v.lastLog);
  }

  const onKey = (e, down) => {
    const k = e.key.toLowerCase();
    if (['w', ' ', 'arrowup', 'a', 'd', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    down ? keys.add(k) : keys.delete(k);
  };
  const kd = (e) => onKey(e, true);
  const ku = (e) => onKey(e, false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  const hold = (id, on, off) => {
    const b = $(id);
    b.onpointerdown = on;
    b.onpointerup = b.onpointerleave = off;
  };
  const touch = { thrust: false, turn: 0 };
  hold('#th', () => (touch.thrust = true), () => (touch.thrust = false));
  hold('#tl', () => (touch.turn = -1), () => (touch.turn = 0));
  hold('#tr', () => (touch.turn = 1), () => (touch.turn = 0));

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let lastSend = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    input.thrust = touch.thrust || keys.has('w') || keys.has(' ') || keys.has('arrowup');
    input.turn = touch.turn || (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    while (acc >= DT) {
      stepLevel1(game, input, DT);
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

  function drawHud(v) {
    const o = orbitCheck(game.flight);
    const mark = (ok) => (ok ? '✓' : '·');
    $('#hud').innerHTML = `
      <b>Bahan bakar ${Math.round(v.flight.fuel * 100)}%</b>
      <span>${mark(o.altOk)} Ketinggian ${Math.round(o.r - game.flight.planet.radius)} / ${game.flight.planet.orbitRadius - game.flight.planet.radius}</span>
      <span>${mark(o.speedOk)} Kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}</span>
      <span>${mark(o.flatOk)} Naik/turun ${o.radial.toFixed(0)}</span>
      ${v.phase === 'launch' && v.flight.inRing ? `<span style="color:var(--ok)">Tahan di cincin ${v.flight.inRingFor.toFixed(1)} s</span>` : ''}
      <small class="muted">W/Spasi dorong · A/D putar</small>`;
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    app.onCmd = null;
  };
}
