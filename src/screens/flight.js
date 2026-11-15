// Layar terbang (perangkat Navigator / solo). Menjalankan fisika, menggambar, dan mengirim snapshot ke Spesialis.
import { LEVEL_MODULES } from '../levels/index.js';
import { LAUNCH_SITE } from '../data/levels.js';
import { orbitCheck, orbitExtremes } from '../engine/flight.js';
import { createView, prefers3D, setPrefer3D } from '../render/view.js';
import { mountPanelFor } from './specialistPanel.js';
import { createControls, controlAction } from '../engine/attitude.js';
import { bindControls, helpHtml } from './controls.js';
import { spendFunds } from './progress.js';

const DT = 1 / 60;
const MODE_NAME = { manual: 'manual', prograde: 'searah gerak', retrograde: 'lawan arah', left: 'kiri jalur', right: 'kanan jalur' };

export function flightScreen(app, el) {
  const M = LEVEL_MODULES[app.level];
  el.className = 'flight';
  el.innerHTML = `
    <div class="view">
      <div class="stage" id="stage"><canvas id="cv"></canvas></div>
      <div class="timeline" id="timeline"></div>
      <div class="coach" id="coach"></div>
      <div class="hud"><div id="hud"></div>
        <details><summary class="muted">Kontrol</summary><div class="keys">${helpHtml()}</div></details>
      </div>
      <button class="menu-btn" id="menuBtn">☰ Menu</button>
      <div class="touch" id="pad"></div>
      <div class="overlay" id="pause">
        <div class="card pause-card">
          <h2>Misi dijeda</h2>
          <button class="primary" id="pResume">Lanjutkan</button>
          <button id="pRestart">Ulangi misi</button>
          <button id="pRakit">Ubah rakitan</button>
          <button id="pView"></button>
          <button id="pHome">Keluar ke menu utama</button>
        </div>
      </div>
    </div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createView($('#stage'));
  // Dana cadangan yang dipakai terpotong setiap kali misi dimulai (termasuk Ulangi misi).
  if (app.build.extraBudget) app.build.extraBudget = spendFunds(app.build.extraBudget);
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

  const padSet =
    app.level === 2 ? (game.assist ? 'moonAssist' : 'moon') : app.level === 3 ? (game.assist ? 'basic' : 'lander') : game.assist ? 'basic' : 'manual';
  const unbind = bindControls(
    $('#pad'),
    (action) => {
      if (paused) return;
      if (action === 'warp') warp = warp === 1 ? 3 : 1;
      else controlAction(ctrl, action, craft());
    },
    padSet,
  );

  // ---------- Menu jeda ----------
  let paused = false;
  const setPaused = (on) => {
    paused = on;
    $('#pause').style.display = on ? 'flex' : 'none';
  };
  $('#menuBtn').onclick = () => setPaused(true);
  $('#pResume').onclick = () => setPaused(false);
  $('#pRestart').onclick = () => app.go('flight');
  $('#pRakit').onclick = () => app.go('rakit');
  $('#pHome').onclick = () => app.go('home');
  // Ganti tampilan 2D/3D: misi diulang dengan tampilan baru.
  $('#pView').textContent = prefers3D() ? 'Pakai tampilan 2D (lebih ringan)' : 'Pakai tampilan 3D';
  $('#pView').onclick = () => {
    setPrefer3D(!prefers3D());
    app.go('flight');
  };
  const onEsc = (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') setPaused(!paused);
  };
  window.addEventListener('keydown', onEsc);
  // Tombol Back di HP / browser membuka menu jeda, bukan keluar dari web.
  app.onBack = () => {
    setPaused(!paused);
    return true;
  };
  const onUnload = (e) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', onUnload);

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let lastSend = 0;
  function frame(now) {
    if (paused) {
      last = now;
      if (app.room && now - lastSend > 500) {
        app.room.sendState({ ...M.snapshot(game, false), paused: true });
        lastSend = now;
      }
      raf = requestAnimationFrame(frame);
      return;
    }
    // Percepat waktu hanya saat mesin mati dan tidak di fase genting.
    const calm = ctrl.throttle === 0 && ctrl.pulseLeft === 0 && !['flyby', 'entry', 'launch', 'descent'].includes(game.phase);
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
    if (app.level === 3) return drawHud3(v, speed);
    if (app.level === 1 || v.phase === 'launch') return drawHud1(v, speed);
    drawHud2(v, speed);
  }

  function drawCoach(v) {
    const box = $('#coach');
    if (!v.coach || !v.coach.msg) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    box.className = 'coach' + (v.coach.urgent ? ' urgent' : '');
    box.textContent = v.coach.msg;
  }

  function drawHud1(v, speed) {
    drawCoach(v);
    const f = game.flight;
    const o = orbitCheck(f);
    const p = f.planet;
    const mark = (ok) => (ok ? '✓' : '·');
    const { apo, peri } = orbitExtremes(f);
    const fmt = (r) => (r === Infinity ? 'lepas' : Math.round(r - p.radius));
    const near = (r) => r !== null && Math.abs(r - p.orbitRadius) < 14;
    $('#timeline').innerHTML = '';
    $('#hud').innerHTML = `${controlLine(v, speed)}
      ${v.flight.status === 'pad' ? `<span>Landasan: ${LAUNCH_SITE.name} (dekat khatulistiwa)</span>` : ''}
      <span>Titik tertinggi ${fmt(apo)}${near(apo) ? ' ✓' : ''} · terendah ${peri === null ? '-' : fmt(peri)}${near(peri) ? ' ✓' : ''} (target ${p.orbitRadius - p.radius})</span>
      <span>${mark(o.altOk)} Ketinggian ${Math.round(o.r - p.radius)} / ${p.orbitRadius - p.radius}</span>
      <span>${mark(o.speedOk)} Kecepatan ${o.speed.toFixed(0)} / ${o.vCirc.toFixed(0)}</span>
      <span>${mark(o.flatOk)} Naik/turun ${o.radial.toFixed(0)}</span>
      ${v.phase === 'launch' && v.flight.inRing ? `<span style="color:var(--ok)">Tahan di cincin ${v.flight.inRingFor.toFixed(1)} s</span>` : ''}`;
  }

  function drawHud2(v, speed) {
    drawCoach(v);
    const steps = [
      ['Peluncuran', v.phase === 'launch'],
      ['TLI', v.phase === 'tli'],
      ...v.mccWindows.slice(0, 2).map((w) => [w.id, v.mcc === w.id]),
      ['Bulan', v.phase === 'flyby'],
      [v.mccWindows[2].id, v.mcc === v.mccWindows[2].id],
      ['Masuk atmosfer', v.phase === 'entry' || v.phase === 'splash'],
    ];
    $('#timeline').innerHTML = steps.map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join('');
    let status;
    if (v.phase === 'tli') status = v.secondsToTli !== null && game.tliArmed ? `TLI dalam ${Math.ceil(v.secondsToTli)} detik` : 'Tekan Gas + (W) untuk berangkat ke Bulan (TLI).';
    else if (v.phase === 'entry') status = 'Masuk atmosfer: tekan E supaya pelindung panas menghadap depan.';
    else if (v.mcc) status = `<span style="color:var(--ok)">${v.mcc}: mesin boleh dinyalakan</span>`;
    else if (v.nextMcc) status = `Mesin terkunci. ${v.nextMcc.id} dalam ${Math.ceil(v.nextMcc.from - v.t)} s${speed === 1 ? ' (T = percepat)' : ''}`;
    else status = 'Mesin terkunci.';
    const adv = app.role === 'solo' && !game.assist && v.advice && v.mcc ? `<span>Saran Spesialis: dorong ke <b>${v.advice === 'left' ? 'KIRI (Z)' : 'KANAN (C)'}</b> jalur</span>` : '';
    $('#hud').innerHTML = `${controlLine(v, speed)}<span>${status}</span>${adv}
      ${v.phase === 'flyby' ? `<span>${aimText(v.aimOff)} · Kualitas foto ${Math.round(v.photoQuality * 100)}%</span>` : ''}`;
  }

  // Level 3: ketinggian, kecepatan turun, kecepatan menyamping, bahan bakar (di controlLine), kemiringan.
  function drawHud3(v, speed) {
    drawCoach(v);
    const steps = [
      ['Pilih titik', v.stage === 'pick'],
      ['Keluar orbit', v.stage === 'deorbit'],
      ['Turun', v.stage === 'descent'],
      ['Mendarat', v.stage === 'landed'],
      ['Pindai es', v.stage === 'scan'],
      ['Kirim data', v.stage === 'send'],
    ];
    $('#timeline').innerHTML = steps.map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join('');
    const max = v.maxLandingSpeed;
    const speedNow = Math.hypot(v.vDown, v.vSide);
    const warn = (bad) => (bad ? ' style="color:var(--bad)"' : '');
    const lowAndFast = v.altitude < 40 && speedNow > max;
    const tiltBad = Math.abs(v.tiltDeg) > v.maxLandingTiltDeg;
    const sf = v.surface;
    if (sf) {
      const pct = (a, b) => Math.round((a / b) * 100);
      $('#hud').innerHTML = `<b>Di permukaan · sisa ${Math.ceil(sf.timeLeft)} detik${speed > 1 ? ' · Waktu ×' + speed : ''}</b>
        <span${warn(sf.battery / sf.batteryMax < sf.lowPowerShare)}>Baterai ${pct(sf.battery, sf.batteryMax)}% · daya ${sf.powerNet > 0 ? '+' : ''}${sf.powerNet} W</span>
        <span>Matahari: ${sf.alwaysDark ? 'selalu bayangan' : sf.sunlit ? 'terang' : 'bayangan bukit lewat'}</span>
        <span>Spektrometer ${sf.spectrometer.has ? (sf.spectrometer.on ? 'menyala' : 'mati') : '-'} · Es ${sf.iceFound ? '✓ terdeteksi' : sf.scan ? 'memindai…' : 'belum'}</span>
        <span${sf.antenna.sending ? ' style="color:var(--ok)"' : ''}>Antena ${sf.antenna.has ? `${sf.antenna.deg}° (Bumi ${sf.earthDeg}°)${sf.antenna.sending ? ' mengirim' : ''}` : '-'} · Data ${pct(sf.data, sf.dataTarget)}%</span>
        <small class="muted">Tombol permukaan dipegang Spesialis</small>`;
      return;
    }
    $('#hud').innerHTML = `${controlLine(v, speed)}
      ${v.hasEngine ? '' : '<span style="color:var(--bad)">Tidak ada mesin pendarat!</span>'}
      ${v.engineLocked ? '<span style="color:var(--bad)">Mesin terkunci: Spesialis, pilih titik pendaratan dulu</span>' : ''}
      ${v.burnInSec !== null && v.burnInSec !== undefined ? `<span>Mulai mengerem ${v.burnInSec > 0.5 ? `dalam ${Math.ceil(v.burnInSec)} detik` : '<b>SEKARANG</b>'}</span>` : ''}
      ${v.direction ? `<span${v.target && v.target.over ? ' style="color:var(--ok)"' : ''}>${v.direction}</span>` : ''}
      <span>Ketinggian ${v.altitude.toFixed(0)} u</span>
      <span${warn(lowAndFast)}>Kecepatan turun ${v.vDown.toFixed(1)} u/s${v.vDown < 0 ? ' (naik)' : ''}</span>
      <span${warn(v.altitude < 40 && Math.abs(v.vSide) > max)}>Kecepatan menyamping ${Math.abs(v.vSide).toFixed(1)} u/s${Math.abs(v.vSide) > 0.2 ? (v.vSide > 0 ? ' →' : ' ←') : ''}</span>
      <span${warn(tiltBad && v.altitude < 40)}>Kemiringan ${Math.round(Math.abs(v.tiltDeg))}° ${tiltBad ? '' : '✓'}</span>
      <small class="muted">Aman mendarat: kecepatan ≤ ${max} u/s, miring ≤ ${v.maxLandingTiltDeg}° · gas ${Math.round(v.hoverThrottle * 100)}% = melayang</small>`;
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
    window.removeEventListener('keydown', onEsc);
    window.removeEventListener('beforeunload', onUnload);
    app.onCmd = null;
    app.onBack = null;
    renderer.dispose();
  };
}
