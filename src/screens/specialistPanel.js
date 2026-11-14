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
