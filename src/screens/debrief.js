import { FAIL_CODES } from '../data/failcodes.js';
import { LEVELS } from '../data/levels.js';
import { LEVEL_MODULES, LAST_LEVEL } from '../levels/index.js';
import { saveStars, addFunds, getFunds } from './progress.js';
import '@fontsource/londrina-solid/900.css';
import '../styles/debrief.css';

// Tampilan Debrief mengikuti desain DKV (public/layout screenshoot/): kiri = bintang, Pok-Pok, status menang/kalah;
// kanan = skor, bahan bakar, rincian tiap level, fakta.
const A = '/assets/debrief/';
const num = (x) => String(x).replace('.', ',');

// Baris rincian: label kiri, nilai kanan, keterangan kecil di bawah nilai.
const row = (label, value, note = '', cls = '') =>
  `<div class="db-row ${cls}"><span class="db-k">${label}</span><span class="db-v">${value}${note ? `<small>${note}</small>` : ''}</span></div>`;
const section = (title, rows) => (rows ? `<div class="db-sec"><h3>${title}</h3>${rows}</div>` : '');

// Rincian khusus tiap level (angka yang sama dengan Debrief lama).
function levelDetails(level, r, L) {
  if (level === 1 && r.orbitErrorPct != null) {
    const ok = r.orbitErrorPct <= L.orbitAccuracyFor3StarsPct;
    return section('Orbit', row('Ketepatan masuk orbit', `meleset ${num(r.orbitErrorPct)}%${ok ? ' ✓' : ''}`, ok ? '' : `bintang 3 butuh maks. ${L.orbitAccuracyFor3StarsPct}%`, 'sub'));
  }
  if (level === 2) {
    return section('Dokumentasi', row('Foto berguna', `${r.photos} / ${L.photoTarget}`, '', 'sub'));
  }
  if (level === 3 && r.landingSpeed != null) {
    const site = r.landingSite ? L.sites[r.landingSite] : null;
    const maxTilt = site ? site.maxTiltDeg : L.maxLandingTiltDeg;
    let siteNote = site ? `es ${site.ice} · bintang maks. ${site.maxStars}` : `bintang maks. ${L.outsideMaxStars}`;
    if (r.landingSite === 'crater' && r.success && r.stars < 3)
      siteNote += ` · bintang 3 butuh mendarat ≤ ${num(L.smoothLandingSpeed)} u/s dan sisa bahan bakar ≥ ${Math.round(L.minFuelFor3Stars * 100)}%`;
    let html = section(
      'Pendaratan',
      row('Kecepatan sentuh', `${num(r.landingSpeed)} u/s`, `maks. ${L.maxLandingSpeed} u/s`, 'sub') +
        row('Kemiringan', `${r.landingTiltDeg}°`, `maks. ${maxTilt}°`, 'sub') +
        row('Titik pendaratan', site ? site.name : 'di luar kedua titik', siteNote, 'sub'),
    );
    if (r.success)
      html += section(
        'Di permukaan',
        row('Data ke Bumi', `${Math.round((r.dataSent / r.dataTarget) * 100)}% terkirim`, '', 'sub') + row('Es air', r.iceFound ? 'terdeteksi ✓' : 'tidak terdeteksi', '', 'sub'),
      );
    return html;
  }
  if (level === 4) {
    let html = '';
    if (r.program) {
      const p = r.program;
      html += section(
        'Program',
        row('Sudut masuk', `${num(p.entryDeg)}°`, `aman: ${L.entry.safeDeg.map(num).join('° — ')}°`, 'sub') +
          row('Parasut', `${num(p.chuteKm)} km`, `aman: ${L.chute.safeKm.map(num).join(' km — ')} km`, 'sub') +
          row('Roket pendarat', `${num(p.retroKm)} km`, `aman: ${L.retro.safeKm.map(num).join(' km — ')} km`, 'sub'),
      );
    }
    if (r.success)
      html += `<div class="db-sec">${row(
        'Dokumentasi',
        `${Math.round(r.photoShare * 100)}% terkirim`,
        `Kamera ${r.cameraDamaged ? 'rusak terkena badai' : 'baik'}${r.frugal ? '' : ' · memakai dana cadangan'}`,
        'main',
      )}</div>`;
    return html;
  }
  return '';
}

export function debriefScreen(app, el) {
  const r = app.result || { success: false, failCode: null, stars: 0, score: 0, fuelLeft: 0, photos: 0 };
  const L = LEVELS[app.level];
  const M = LEVEL_MODULES[app.level];
  if (r.success) saveStars(app.level, r.stars);
  // Dana misi ditambahkan sekali untuk setiap hasil.
  if (r.reward && !r.rewardPaid) {
    addFunds(r.reward);
    r.rewardPaid = true;
  }
  app.fails = app.fails || {};
  if (!r.success) app.fails[app.level] = (app.fails[app.level] || 0) + 1;
  // Petunjuk muncul setelah 1 kali gagal di Level 1, setelah 2 kali di level lain (Game Design Final).
  const showHint = !r.success && L.hint && app.fails[app.level] >= (app.level === 1 ? 1 : 2);
  // Semua level bebas dipilih; Lanjut hanya jalan pintas ke level berikutnya.
  const hasNext = app.level < LAST_LEVEL;
  // Gagal di mode ahli: sarankan bantuan pilot paling atas.
  const tips = [
    ...(!r.success && app.build && app.build.assist === false
      ? ['Coba nyalakan Bantuan pilot di layar Rakit: pelatih memberi aba-aba kapan menekan Gas +, dan kemudi selanjutnya diatur otomatis.']
      : []),
    ...(r.advice || []),
  ];
  const stars = [0, 1, 2]
    .map((i) => `<img class="db-star s${i}" src="${A}${i < r.stars ? 'bintang-warna' : 'bintang-fade'}.webp" alt="">`)
    .join('');

  el.className = `debrief-screen ${r.success ? 'win' : 'lose'}`;
  el.innerHTML = `
    <div class="db-wrap">
      <aside class="db-left">
        <div class="db-stars" role="img" aria-label="${r.stars} dari 3 bintang">${stars}</div>
        <img class="db-pokpok" src="${A}${r.success ? 'senang' : 'cemas'}.webp" alt="Pok-Pok ${r.success ? 'senang' : 'cemas'}">
        <p class="db-status">${r.success ? 'Misi berhasil' : 'Misi gagal'}</p>
      </aside>
      <section class="db-right">
        <h2 class="db-title">${L.name.replace(/^Level (\d+):/, 'Level $1 :')}</h2>
        ${
          r.failCode
            ? `<div class="db-fail"><b>${r.failCode}</b> ${FAIL_CODES[r.failCode]}</div>`
            : ''
        }
        <div class="db-sec">
          ${row('Skor', r.score, '', 'score')}
          ${row('Sisa Bahan Bakar', `${Math.round(r.fuelLeft * 100)}%`, '', 'main')}
        </div>
        ${levelDetails(app.level, r, L)}
        ${tips.length ? `<div class="db-sec db-text"><h3>${r.success ? 'Supaya lebih baik' : 'Cara memperbaiki'}</h3><ul>${tips.map((a) => `<li>${a}</li>`).join('')}</ul></div>` : ''}
        ${showHint ? `<div class="db-sec db-text"><h3>Hint</h3><p>${L.hint}</p></div>` : ''}
        ${M.fact ? `<div class="db-sec db-text"><h3>Fakta</h3><p>${M.fact}</p></div>` : ''}
        <div class="db-sec db-text"><h3>Misi nyata yang mirip</h3><p>${M.realMission}</p></div>
        <div class="db-funds">${
          r.reward ? `Dana misi diterima: <b>+${r.reward} juta $</b>` : 'Misi gagal: tidak ada dana misi.'
        } · Dana cadangan sekarang <b>${getFunds()} juta $</b><small>Bisa ditambahkan ke anggaran misi berikutnya di layar Rakit.</small></div>
        <div class="db-actions">
          <button id="again">Main lagi</button>
          <button id="retry">Ubah rakitan</button>
          <button class="primary" id="next" ${hasNext ? '' : 'disabled'}>${app.level >= LAST_LEVEL && r.success ? 'Level berikutnya belum dibuat' : 'Lanjut'}</button>
        </div>
        <div class="db-actions small"><button id="levels">Pilih misi lain</button><button id="home">Menu utama</button></div>
      </section>
    </div>
  `;
  window.scrollTo(0, 0);
  el.querySelector('#again').onclick = () => app.go('flight');
  el.querySelector('#retry').onclick = () => app.go('rakit');
  el.querySelector('#home').onclick = () => app.go('home');
  el.querySelector('#levels').onclick = () => app.go('levels');
  el.querySelector('#next').onclick = () => {
    app.level += 1;
    app.go('rakit');
  };
}
