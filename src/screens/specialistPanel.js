// Panel Spesialis Level 1. Dipakai di layar terbang (mode solo) dan di perangkat Spesialis.
// Hanya membaca `view` (snapshot) dan memanggil send(cmd); aturan ada di levels/level1.js.

export function mountSpecialistPanel(container, send) {
  container.innerHTML = `
    <h2>Spesialis</h2>
    <div class="status" id="sp-status"></div>
    <div id="sp-info"></div>
    <button id="sp-release">Lepas CubeSat</button>
    <button id="sp-panels">Buka panel surya</button>
    <button id="sp-antenna">Buka antena</button>
    <button id="sp-transmit">Kirim sinyal</button>
    <div>Baterai</div><div class="bar"><i id="sp-batt"></i></div>
    <div>Data terkirim</div><div class="bar"><i id="sp-data"></i></div>
  `;
  const $ = (s) => container.querySelector(s);
  $('#sp-release').onclick = () => send('release');
  $('#sp-panels').onclick = () => send('deployPanels');
  $('#sp-antenna').onclick = () => send('deployAntenna');
  $('#sp-transmit').onclick = () => send('transmit');

  return function update(v) {
    if (!v) return;
    const f = v.flight;
    const phaseText = {
      launch: 'Navigator sedang menuju cincin orbit. Tunggu.',
      release: 'Orbit tercapai. Lepaskan CubeSat!',
      countdown: `Hitung mundur aman: ${Math.ceil(v.countdown)} detik. Jangan buka apa pun.`,
      deploy: 'Aman. Buka panel dan antena.',
      transmit: v.inPass
        ? `Di atas stasiun Bumi! Kirim sekarang (${Math.ceil(v.secondsLeftInPass)} detik lagi).`
        : `Stasiun Bumi terlihat lagi dalam ${Math.ceil(v.secondsToPass)} detik.`,
      done: 'Misi selesai.',
    }[v.phase];
    $('#sp-status').textContent = phaseText || '';
    $('#sp-info').innerHTML = `<small class="muted">Bahan bakar ${Math.round(f.fuel * 100)}% · ${v.lastLog}</small>`;
    $('#sp-release').disabled = v.released || v.phase === 'done';
    $('#sp-panels').disabled = !v.hasFoldPanel || v.panelsOpen || !v.released;
    $('#sp-antenna').disabled = !v.hasUhf || v.antennaOpen || !v.released;
    $('#sp-transmit').disabled = !v.released || v.phase === 'done';
    $('#sp-transmit').textContent = v.transmitting ? 'Berhenti kirim' : 'Kirim sinyal';
    $('#sp-batt').style.width = Math.max(0, (v.battery / v.batteryMax) * 100) + '%';
    $('#sp-data').style.width = Math.min(100, (v.data / v.dataTarget) * 100) + '%';
  };
}

// Panel Spesialis Level 2: membaca prediksi lintasan, memberi aba-aba MCC, membuka panel, memotret.
export function mountSpecialistPanel2(container, send) {
  container.innerHTML = `
    <h2>Spesialis</h2>
    <div class="status" id="sp-status"></div>
    <div class="card" id="sp-pred"></div>
    <button id="sp-panels">Buka panel surya</button>
    <button id="sp-photo">Ambil foto</button>
    <div>Kualitas foto</div><div class="bar"><i id="sp-q"></i></div>
    <div id="sp-photos"></div>
    <div>Baterai</div><div class="bar"><i id="sp-batt"></i></div>
    <small class="muted" id="sp-log"></small>
  `;
  const $ = (s) => container.querySelector(s);
  $('#sp-panels').onclick = () => send('deployPanels');
  $('#sp-photo').onclick = () => send('photo');
  window.addEventListener('keydown', onKey);
  function onKey(e) {
    if (!container.isConnected) return window.removeEventListener('keydown', onKey);
    if (e.key === '1') send('deployPanels');
    if (e.key === '2') send('photo');
  }

  return function update(v) {
    if (!v) return;
    const km = (u) => Math.round(u * v.kmPerU).toLocaleString('id-ID');
    const [lo, hi] = v.flybyTarget;
    const [elo, ehi] = v.entryCorridor;
    const ca = v.forecast.closestMoon;
    const ea = v.forecast.entryAngle;
    const caOk = isFinite(ca) && ca >= lo && ca <= hi;
    const eaOk = ea >= elo && ea <= ehi;
    $('#sp-status').textContent = v.signalLost
      ? 'Signal lost: kapsul di balik Bulan.'
      : v.phase === 'launch'
        ? 'Navigator meluncurkan roket ke orbit parkir. Tunggu.'
        : v.phase === 'tli'
        ? 'Di orbit parkir. Buka panel surya, lalu tunggu TLI.'
        : v.phase === 'done'
          ? 'Misi selesai.'
          : v.lastLog;
    const adviceText = v.advice ? `Aba-aba: dorong ke <b>${v.advice === 'left' ? 'KIRI' : 'KANAN'}</b> jalur${v.mcc ? '' : ' (tunggu jendela MCC)'}` : 'Lintasan sudah pas.';
    $('#sp-pred').innerHTML = `
      ${isFinite(ca) ? `<div>${caOk ? '✓' : '⚠'} Jarak terdekat ke Bulan: <b>${ca <= 0 ? 'MENABRAK' : km(ca) + ' km'}</b><br><small class="muted">target ${km(lo)}–${km(hi)} km</small></div>` : ''}
      <div>${eaOk ? '✓' : '⚠'} Sudut masuk atmosfer: <b>${ea.toFixed(1)}°</b><br><small class="muted">aman ${elo}° sampai ${ehi}°</small></div>
      <div>${['launch', 'tli', 'done', 'entry', 'splash'].includes(v.phase) ? '' : adviceText}</div>`;
    $('#sp-panels').disabled = v.panelsOpen || v.phase === 'launch' || !v.panelPower;
    $('#sp-panels').textContent = v.panelsOpen ? 'Panel surya terbuka' : 'Buka panel surya (1)';
    $('#sp-photo').disabled = !v.hasCamera || v.phase !== 'flyby';
    $('#sp-photo').textContent = 'Ambil foto (2)';
    $('#sp-q').style.width = v.photoQuality * 100 + '%';
    $('#sp-photos').textContent = `Foto berguna: ${v.photos} / ${v.photoTarget}`;
    $('#sp-batt').style.width = Math.max(0, (v.battery / v.batteryMax) * 100) + '%';
    $('#sp-log').textContent = `Bahan bakar ${Math.round(v.fuel * 100)}%`;
  };
}

export function mountPanelFor(level, container, send) {
  return level === 2 ? mountSpecialistPanel2(container, send) : mountSpecialistPanel(container, send);
}
