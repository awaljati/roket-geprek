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
    <div id="sp-fuelbox"><div id="sp-fuelname">Bahan bakar</div><div class="bar"><i id="sp-fuel"></i></div></div>
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
    if (v.space) return updateSpace(v);
    $('#sp-fuelname').textContent = 'Bahan bakar pendarat';
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

  // Fase awal: peluncuran, perjalanan ke Bulan, masuk orbit polar (Spesialis membaca indikator kecepatan).
  function updateSpace(v) {
    const o = v.loi;
    const SPEED = { lambat: 'LAMBAT: terlalu banyak mengerem!', pas: 'PAS ✓', cepat: 'CEPAT: terus mengerem' };
    $('#sp-status').textContent =
      v.phase === 'launch'
        ? 'Peluncuran dari Biak. Tunggu sampai roket masuk orbit parkir.'
        : v.phase === 'tli'
          ? v.tliArmed
            ? `TLI dalam ${Math.ceil(v.secondsToTli || 0)} detik.`
            : 'Aba-aba ke Navigator: tekan Gas + untuk berangkat ke Bulan (TLI).'
          : v.phase === 'transfer'
            ? `Menuju Bulan, tiba dalam ${Math.ceil(v.arriveInSec)} detik. Siapkan aba-aba mengerem.`
            : o && o.captured
              ? 'Masuk orbit polar Bulan! Bersiap memilih titik pendaratan.'
              : o && o.burnInSec !== null && o.burnInSec !== undefined && o.burnInSec > 0.5
                ? `Aba-aba ke Navigator: mengerem dalam ${Math.ceil(o.burnInSec)} detik.`
                : o && o.status
                  ? `Kecepatan ${SPEED[o.status]}`
                  : v.phase === 'done'
                    ? 'Misi selesai.'
                    : 'Aba-aba: SEKARANG! Mengerem lawan arah gerak.';
    for (const [id, btn] of [['ridge', '#sp-ridge'], ['crater', '#sp-crater']]) {
      $(btn).disabled = true;
      $(btn).className = '';
      $(btn).textContent = `${id === 'ridge' ? 'Puncak bukit' : 'Dekat kawah gelap'} (${id === 'ridge' ? 1 : 2})`;
    }
    $('#sp-site').textContent = 'Titik dipilih setelah masuk orbit Bulan.';
    const ok = (b) => (b ? '✓' : '⚠');
    $('#sp-read').innerHTML = o
      ? `<div>${ok(o.altOk)} Ketinggian: <b>${o.alt.toFixed(0)} u</b> <small class="muted">cincin ${o.ringAlt} u</small></div>
        <div>${ok(o.speedOk)} Kecepatan: <b>${o.speed.toFixed(0)} u/s</b> ${o.status ? `<b>${o.status.toUpperCase()}</b>` : ''} <small class="muted">pas ${o.vCirc.toFixed(0)} u/s</small></div>
        <div>${ok(o.flatOk)} Naik/turun: <b>${o.radial.toFixed(0)} u/s</b></div>
        <small class="muted">Kurang mengerem: lewat Bulan (F-ORBIT). Kebanyakan: jatuh (F-CRASH).</small>`
      : `<div>Bahan bakar pendarat: <b>${Math.round(v.fuel * 100)}%</b> <small class="muted">(dipakai saat turun ke permukaan)</small></div>`;
    $('#sp-fuelname').textContent = 'Bahan bakar roket';
    $('#sp-fuel').style.width = Math.max(0, v.rocketFuel * 100) + '%';
    $('#sp-log').textContent = v.lastLog;
    updateSurface(null, false);
  }

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

// Panel Spesialis Level 4: radar badai matahari, ketinggian parasut, dan foto pertama dari Mars.
export function mountSpecialistPanel4(container, send) {
  container.innerHTML = `
    <h2>Spesialis</h2>
    <div class="status" id="sp-status"></div>
    <div class="card" id="sp-radar"><b>Radar badai matahari</b><div id="sp-storm"></div></div>
    <div class="card" id="sp-prog"><b>Program pendaratan</b>
      <div id="sp-chute"></div>
      <div class="row"><button id="sp-cDown">Parasut − (1)</button><button id="sp-cUp">Parasut + (2)</button></div>
      <button id="sp-ready">Siap (3)</button>
      <div id="sp-ranges"></div>
    </div>
    <div class="card" id="sp-edl" style="display:none"></div>
    <div class="card" id="sp-surface" style="display:none"><b>Di permukaan Mars</b> <small class="muted" id="sp-time"></small>
      <div id="sp-power"></div>
      <div>Baterai</div><div class="bar"><i id="sp-batt"></i></div>
      <button class="primary" id="sp-photo">Kirim foto (4)</button>
      <div>Foto ke Bumi</div><div class="bar"><i id="sp-data"></i></div>
    </div>
    <small class="muted" id="sp-log"></small>
  `;
  const $ = (s) => container.querySelector(s);
  const KEYS = { 1: 'chuteDown', 2: 'chuteUp', 3: 'programReady', 4: 'sendPhoto' };
  $('#sp-cDown').onclick = () => send('chuteDown');
  $('#sp-cUp').onclick = () => send('chuteUp');
  $('#sp-ready').onclick = () => send('programReady');
  $('#sp-photo').onclick = () => send('sendPhoto');
  window.addEventListener('keydown', onKey);
  function onKey(e) {
    if (!container.isConnected) return window.removeEventListener('keydown', onKey);
    if (KEYS[e.key]) send(KEYS[e.key]);
  }
  const n = (x) => String(x).replace('.', ',');

  return function update(v) {
    if (!v) return;
    const c = v.cruise;
    const p = v.program;
    const ph = v.view;
    // Status utama
    let status = v.lastLog;
    if (ph === 'launch') status = 'Peluncuran dari Biak. Tunggu sampai roket masuk orbit parkir.';
    else if (ph === 'park') status = 'Aba-aba ke Navigator: tekan Gas + untuk berangkat ke Mars (TMI).';
    else if (ph === 'cruise' && c) {
      if (c.stormActive) status = v.radShield ? 'Badai lewat. Pelindung radiasi melindungi instrumen.' : v.instrumentsOn ? 'BADAI! Navigator, matikan instrumen sekarang!' : 'Badai lewat. Instrumen aman.';
      else if (c.stormInSec !== null) status = v.instrumentsOn && !v.radShield ? `Aba-aba: badai dalam ${Math.ceil(c.stormInSec)} detik! Navigator, matikan instrumen.` : `Badai dalam ${Math.ceil(c.stormInSec)} detik.`;
      else status = v.instrumentsOn ? `Menuju Mars. Awasi radar badai. Tiba dalam ${Math.ceil(c.arriveInSec)} detik.` : 'Radar tenang. Aba-aba: Navigator, nyalakan lagi instrumen.';
    } else if (ph === 'program') status = p.ready ? 'Siap. Tunggu Navigator memulai masuk atmosfer.' : 'Waktu berhenti. Atur ketinggian parasut, cek angka Navigator, lalu tekan Siap.';
    else if (ph === 'edl') status = 'Tujuh menit penuh ketegangan. Tidak ada yang bisa dikendalikan: tunggu sinyal.';
    else if (ph === 'landed' && v.surface) status = v.surface.sending ? 'Mengirim foto pertama…' : v.surface.pressed ? 'Foto terkirim.' : 'Mendarat! Tekan Kirim foto.';
    if (v.result) status = 'Misi selesai.';
    $('#sp-status').textContent = status;

    // Radar badai
    $('#sp-radar').style.display = ph === 'launch' || ph === 'park' || ph === 'cruise' ? '' : 'none';
    const warn = c && c.stormInSec !== null;
    $('#sp-storm').innerHTML = !c
      ? '<small class="muted">Radar aktif setelah berangkat ke Mars.</small>'
      : `<div class="bar"><i style="width:${c.stormActive ? 100 : warn ? (1 - c.stormInSec / c.stormWarnSec) * 100 : 0}%;background:${c.stormActive || warn ? 'var(--bad)' : ''}"></i></div>
        <div>${c.stormActive ? '<b style="color:var(--bad)">BADAI SEDANG LEWAT</b>' : warn ? `<b style="color:var(--bad)">⚠ Badai dalam ${Math.ceil(c.stormInSec)} detik</b>` : 'Tenang'}</div>
        <small>Instrumen: <b>${v.instrumentsOn ? 'menyala' : 'mati'}</b> · pelindung radiasi: ${v.radShield ? 'ada ✓' : 'tidak ada'} · kamera: ${v.cameraDamaged ? '<b style="color:var(--bad)">rusak</b>' : 'baik'}<br>Sisa badai di perjalanan: ${c.stormsLeft}</small>`;

    // Program pendaratan (Spesialis melihat semua rentang aman)
    $('#sp-prog').style.display = ph === 'program' ? '' : 'none';
    const okMark = (k) => (p.ok[k] ? '✓' : '⚠');
    const rng = (k, u) => `${n(p.safe[k][0])} … ${n(p.safe[k][1])}${u}`;
    $('#sp-chute').innerHTML = `${okMark('chute')} Parasut dibuka di: <b>${n(p.chuteKm)} km</b> <small class="muted">aman ${rng('chute', ' km')}</small>`;
    $('#sp-cDown').disabled = $('#sp-cUp').disabled = ph !== 'program';
    $('#sp-ready').disabled = ph !== 'program';
    $('#sp-ready').className = p.ready ? 'primary' : '';
    $('#sp-ready').textContent = p.ready ? 'Siap ✓ (3 = batal)' : 'Siap (3)';
    $('#sp-ranges').innerHTML = `<small>Angka Navigator:<br>
      ${okMark('entry')} Sudut masuk <b>${n(p.entryDeg)}°</b> <span class="muted">aman ${rng('entry', '°')}</span><br>
      ${okMark('retro')} Roket pendarat <b>${n(p.retroKm)} km</b> <span class="muted">aman ${rng('retro', ' km')}</span><br>
      ${v.hasEdl ? '' : '<b style="color:var(--bad)">Tidak ada Paket Pendaratan Mars!</b>'}</small>`;

    // Tujuh menit
    const e = v.edl;
    $('#sp-edl').style.display = ph === 'edl' && e ? '' : 'none';
    if (e) {
      const left = e.clockLeft;
      $('#sp-edl').innerHTML = `<b>T− ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</b>
        <div>Ketinggian ${e.alt >= 10 ? Math.round(e.alt) : n(e.alt.toFixed(1))} km · ${Math.round(e.speed)} m/s</div>
        <small class="muted">Sinyal dari Mars butuh ±${e.signalDelayMin} menit ke Bumi, jadi wahana mendarat sendiri.</small>`;
    }

    // Permukaan
    const sf = v.surface;
    $('#sp-surface').style.display = sf ? '' : 'none';
    if (sf) {
      $('#sp-time').textContent = sf.pressed ? '' : `· sisa waktu ${Math.ceil(sf.timeLeft)} detik`;
      $('#sp-power').innerHTML = `<small>Panel surya ${sf.solar} W (di Mars hanya ${Math.round(sf.solarShare * 100)}% dari ${sf.solarFull} W)${sf.rtg ? ` · RTG ${sf.rtg} W` : ''}<br>
        Mengirim butuh ${-sf.load} W${sf.sending ? ` · daya bersih <b style="color:var(${sf.powerNet < 0 ? '--bad' : '--ok'})">${sf.powerNet > 0 ? '+' : ''}${sf.powerNet} W</b>` : ''}<br>
        Antena: ${sf.antenna ? `${sf.antenna}${sf.hasBig ? ' ✓' : ` (hanya ${Math.round(sf.cap * 100)}% foto)`}` : '<b style="color:var(--bad)">tidak ada</b>'}${v.cameraDamaged ? '<br><b style="color:var(--bad)">Kamera rusak terkena badai</b>' : ''}</small>`;
      $('#sp-batt').style.width = Math.max(0, (sf.battery / sf.batteryMax) * 100) + '%';
      $('#sp-photo').disabled = !sf.ready || sf.pressed || !sf.antenna || !!v.result;
      $('#sp-photo').textContent = sf.sending ? `Mengirim… ${Math.round(sf.progress * 100)}%` : sf.pressed ? 'Foto sudah dikirim' : !sf.antenna ? 'Tidak ada antena' : 'Kirim foto (4)';
      $('#sp-data').style.width = Math.min(100, sf.progress * 100) + '%';
    }
    $('#sp-log').textContent = `Bahan bakar roket pendarat ${Math.round(v.fuel * 100)}% · ${v.lastLog}`;
  };
}

export function mountPanelFor(level, container, send) {
  if (level === 4) return mountSpecialistPanel4(container, send);
  if (level === 3) return mountSpecialistPanel3(container, send);
  return level === 2 ? mountSpecialistPanel2(container, send) : mountSpecialistPanel(container, send);
}
