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
    // Tombol menjelaskan alasannya kalau belum bisa dipakai.
    // Saat hitung mundur, tombol buka tetap bisa ditekan (dan membuat misi gagal): itu bagian tantangannya.
    const waiting = v.phase === 'countdown' ? ' ⚠ tunggu hitung mundur' : '';
    const btn = (id, label, disabled) => {
      $(id).disabled = disabled;
      $(id).textContent = label;
    };
    btn('#sp-release', v.released ? 'CubeSat sudah dilepas' : v.phase === 'launch' ? 'Lepas CubeSat (setelah orbit tercapai)' : 'Lepas CubeSat', v.released || v.phase === 'done');
    btn(
      '#sp-panels',
      !v.hasFoldPanel ? 'Panel lipat tidak dipasang' : v.panelsOpen ? 'Panel surya terbuka' : !v.released ? 'Buka panel surya (setelah CubeSat dilepas)' : 'Buka panel surya' + waiting,
      !v.hasFoldPanel || v.panelsOpen || !v.released,
    );
    btn(
      '#sp-antenna',
      !v.hasUhf ? 'Antena pita tidak dipasang (S-band tidak perlu dibuka)' : v.antennaOpen ? 'Antena terbuka' : !v.released ? 'Buka antena (setelah CubeSat dilepas)' : 'Buka antena' + waiting,
      !v.hasUhf || v.antennaOpen || !v.released,
    );
    btn('#sp-transmit', v.transmitting ? 'Berhenti kirim' : !v.released ? 'Kirim sinyal (setelah CubeSat dilepas)' : 'Kirim sinyal' + waiting, !v.released || v.phase === 'done');
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

// Panel Spesialis Level 3: memilih titik pendaratan dan membacakan angka pendaratan ke Navigator.
export function mountSpecialistPanel3(container, send) {
  container.innerHTML = `
    <h2>Spesialis</h2>
    <div class="status" id="sp-status"></div>
    <div class="card"><b>Titik pendaratan</b>
      <button id="sp-ridge">Puncak bukit (1)</button>
      <button id="sp-crater">Dekat kawah gelap (2)</button>
      <small class="muted" id="sp-site"></small>
    </div>
    <div class="card" id="sp-read"></div>
    <div class="card" id="sp-surface" style="display:none"><b>Di permukaan</b> <small class="muted" id="sp-time"></small>
      <div id="sp-power"></div>
      <div>Baterai</div><div class="bar"><i id="sp-batt"></i></div>
      <button id="sp-spec">Spektrometer (3)</button>
      <button id="sp-scan">Pindai (4)</button>
      <div id="sp-ice"></div>
      <button id="sp-ant">Antena (5)</button>
      <div class="row"><button id="sp-antL">◀ Putar kiri (6)</button><button id="sp-antR">Putar kanan ▶ (7)</button></div>
      <div>Kekuatan sinyal <small class="muted" id="sp-aim"></small></div><div class="bar"><i id="sp-signal"></i></div>
      <div>Data ke Bumi</div><div class="bar"><i id="sp-data"></i></div>
    </div>
    <div id="sp-fuelbox"><div>Bahan bakar</div><div class="bar"><i id="sp-fuel"></i></div></div>
    <small class="muted" id="sp-log"></small>
  `;
  const $ = (s) => container.querySelector(s);
  $('#sp-ridge').onclick = () => send('siteRidge');
  $('#sp-crater').onclick = () => send('siteCrater');
  const SURFACE_KEYS = { 3: 'spectrometerToggle', 4: 'scan', 5: 'antennaToggle', 6: 'antennaLeft', 7: 'antennaRight' };
  $('#sp-spec').onclick = () => send('spectrometerToggle');
  $('#sp-scan').onclick = () => send('scan');
  $('#sp-ant').onclick = () => send('antennaToggle');
  // Putar kiri/kanan: ditahan = berputar terus (perintah dikirim berulang).
  for (const [id, cmd] of [['#sp-antL', 'antennaLeft'], ['#sp-antR', 'antennaRight']]) {
    const b = $(id);
    let timer = 0;
    const stop = () => {
      clearInterval(timer);
      timer = 0;
    };
    b.onpointerdown = (e) => {
      e.preventDefault();
      if (b.disabled) return;
      stop();
      send(cmd);
      timer = setInterval(() => (b.disabled || !container.isConnected ? stop() : send(cmd)), 80);
    };
    b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
  }
  window.addEventListener('keydown', onKey);
  function onKey(e) {
    if (!container.isConnected) return window.removeEventListener('keydown', onKey);
    if (e.key === '1') send('siteRidge');
    if (e.key === '2') send('siteCrater');
    if (SURFACE_KEYS[e.key]) send(SURFACE_KEYS[e.key]);
  }

  return function update(v) {
    if (!v) return;
    const max = v.maxLandingSpeed;
    const tooFast = v.phase === 'descent' && v.vDown > v.targetDescent + 0.5;
    $('#sp-status').textContent =
      v.phase === 'orbit'
        ? !v.siteChoice
          ? 'Pilih titik pendaratan sekarang! Mesin Navigator terkunci sampai kamu memilih.'
          : v.burnInSec > 0.5
            ? `Aba-aba ke Navigator: mulai mengerem dalam ${Math.ceil(v.burnInSec)} detik.`
            : 'Aba-aba: SEKARANG! Tekan Gas +'
        : v.phase === 'descent'
          ? tooFast
              ? 'Aba-aba: TERLALU CEPAT, tambah gas!'
              : `Aba-aba: ${v.direction}`
          : v.phase === 'landed'
            ? v.coach && v.coach.msg
              ? v.coach.msg
              : 'Mendarat! Pindai es, lalu arahkan antena ke Bumi.'
            : 'Misi selesai.';
    const canPick = (v.phase === 'orbit' || v.phase === 'descent') && v.sites;
    for (const [id, btn] of [['ridge', '#sp-ridge'], ['crater', '#sp-crater']]) {
      const s = v.sites && v.sites.find((x) => x.id === id);
      $(btn).disabled = !canPick || v.siteChoice === id;
      $(btn).className = v.siteChoice === id ? 'primary' : '';
      $(btn).innerHTML = s
        ? `${s.name}${v.siteChoice === id ? ' ✓' : ''} (${id === 'ridge' ? 1 : 2})<br><small>${s.about} ★ maks. ${s.maxStars}</small>`
        : `${id === 'ridge' ? 'Puncak bukit' : 'Dekat kawah gelap'} (${id === 'ridge' ? 1 : 2})`;
    }
    $('#sp-site').textContent = v.direction || '';
    const ok = (b) => (b ? '✓' : '⚠');
    $('#sp-read').innerHTML = `
      <div>Ketinggian: <b>${v.altitude.toFixed(0)} u</b></div>
      <div>${ok(!tooFast)} Kecepatan turun: <b>${v.vDown.toFixed(1)} u/s</b> <small class="muted">saran ≤ ${v.targetDescent.toFixed(1)}</small></div>
      <div>${ok(Math.abs(v.vSide) <= max)} Kecepatan menyamping: <b>${Math.abs(v.vSide).toFixed(1)} u/s</b></div>
      <div>${ok(Math.abs(v.tiltDeg) <= v.maxLandingTiltDeg)} Kemiringan: <b>${Math.round(Math.abs(v.tiltDeg))}°</b></div>
      <small class="muted">Aman mendarat: ≤ ${max} u/s, miring ≤ ${v.maxLandingTiltDeg}°</small>`;
    $('#sp-fuel').style.width = Math.max(0, v.fuel * 100) + '%';
    $('#sp-log').textContent = v.lastLog;
    updateSurface(v.surface, v.phase === 'landed');
  };

  // Di permukaan: daya, spektrometer, antena, data.
  function updateSurface(sf, active) {
    $('#sp-surface').style.display = sf ? '' : 'none';
    $('#sp-read').style.display = sf ? 'none' : '';
    $('#sp-fuelbox').style.display = sf ? 'none' : '';
    if (!sf) return;
    $('#sp-time').textContent = `· sisa waktu ${Math.ceil(sf.timeLeft)} detik`;
    const light = sf.alwaysDark ? 'selalu bayangan' : sf.sunlit ? 'terang' : 'bayangan bukit lewat';
    const soon = sf.sunlit && sf.shadowInSec !== null && sf.shadowInSec < 6 ? ` · ⚠ bayangan dalam ${Math.ceil(sf.shadowInSec)} detik` : '';
    $('#sp-power').innerHTML = `<small>Matahari: <b>${light}</b>${soon}<br>Panel ${sf.solar} W · RTG ${sf.rtg} W · daya bersih <b style="color:var(${sf.powerNet < 0 ? '--bad' : '--ok'})">${sf.powerNet > 0 ? '+' : ''}${sf.powerNet} W</b></small>`;
    const share = sf.battery / sf.batteryMax;
    $('#sp-batt').style.width = Math.max(0, share * 100) + '%';
    $('#sp-batt').style.background = share < sf.lowPowerShare ? 'var(--bad)' : '';
    const sp = sf.spectrometer;
    $('#sp-spec').disabled = !active || !sp.has;
    $('#sp-spec').className = sp.on ? 'primary' : '';
    $('#sp-spec').textContent = !sp.has ? 'Spektrometer tidak dipasang' : `Spektrometer: ${sp.on ? 'MENYALA (matikan)' : 'mati (nyalakan)'} (3)`;
    $('#sp-scan').disabled = !active || !sp.has || !sp.on || !!sf.scan || sf.iceFound;
    $('#sp-scan').textContent = sf.scan ? `Memindai… ${Math.round(sf.scan.progress * 100)}%` : sf.iceFound ? 'Es sudah terdeteksi' : sp.has && !sp.on ? 'Pindai (nyalakan spektrometer dulu)' : 'Pindai (4)';
    $('#sp-ice').innerHTML = sf.iceFound ? '<b style="color:var(--ok)">✓ Es air terdeteksi</b>' : sf.scans ? `<small class="muted">Belum ada es (${sf.scans}× pindai)</small>` : '';
    const an = sf.antenna;
    $('#sp-ant').disabled = !active || !an.has;
    $('#sp-ant').className = an.on ? 'primary' : '';
    $('#sp-ant').textContent = !an.has ? 'Antena tidak dipasang' : `Antena: ${an.on ? 'MENYALA (matikan)' : 'mati (nyalakan)'} (5)`;
    $('#sp-antL').disabled = $('#sp-antR').disabled = !active || !an.has;
    const sig = Math.round(an.signal * 100);
    $('#sp-aim').innerHTML = an.has
      ? `<b>${sig}%</b> ${an.pointed ? '✓ cukup (≥ ' + Math.round(sf.minSignal * 100) + '%)' : '· perlu ≥ ' + Math.round(sf.minSignal * 100) + '%'}${
          an.sending ? ' · <b>mengirim</b>' : !an.on ? ' · antena mati' : an.pointed ? ' · daya kurang' : ''
        }`
      : '';
    $('#sp-signal').style.width = (an.has ? sig : 0) + '%';
    $('#sp-signal').style.background = an.pointed ? 'var(--ok)' : '';
    $('#sp-data').style.width = Math.min(100, (sf.data / sf.dataTarget) * 100) + '%';
  }
}

export function mountPanelFor(level, container, send) {
  if (level === 3) return mountSpecialistPanel3(container, send);
  return level === 2 ? mountSpecialistPanel2(container, send) : mountSpecialistPanel(container, send);
}
