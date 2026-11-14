import { FAIL_CODES } from '../data/failcodes.js';
import { LEVELS } from '../data/levels.js';
import { LEVEL_MODULES, LAST_LEVEL } from '../levels/index.js';
import { saveStars, addFunds, getFunds } from './progress.js';

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
  el.className = 'screen center';
  el.innerHTML = `
    <h2>Debrief: ${L.name}</h2>
    <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
    <p><b>${r.success ? 'Misi berhasil' : 'Misi gagal'}</b>${r.failCode ? ` · ${r.failCode}` : ''}</p>
    ${r.failCode ? `<p>${FAIL_CODES[r.failCode]}</p>` : ''}
    <p class="muted">Skor ${r.score} · Sisa bahan bakar ${Math.round(r.fuelLeft * 100)}%${app.level === 2 ? ` · Foto berguna ${r.photos}` : ''}</p>
    ${
      app.level === 1 && r.orbitErrorPct != null
        ? `<p class="muted">Ketepatan masuk orbit: meleset ${String(r.orbitErrorPct).replace('.', ',')}%${
            r.orbitErrorPct <= L.orbitAccuracyFor3StarsPct ? ' ✓' : ` (bintang 3 butuh maksimal ${L.orbitAccuracyFor3StarsPct}%)`
          }</p>`
        : ''
    }
    ${
      app.level === 3 && r.landingSpeed != null
        ? `<p class="muted">Saat menyentuh permukaan: ${String(r.landingSpeed).replace('.', ',')} u/s (maks. ${L.maxLandingSpeed}) · miring ${r.landingTiltDeg}° (maks. ${L.maxLandingTiltDeg}°)</p>`
        : ''
    }
    <p class="card">${
      r.reward ? `Dana misi diterima: <b>+${r.reward} juta $</b>` : 'Misi gagal: tidak ada dana misi.'
    } · Dana cadangan sekarang <b>${getFunds()} juta $</b><br><small class="muted">Bisa ditambahkan ke anggaran misi berikutnya di layar Rakit.</small></p>
    ${showHint ? `<p class="card">Hint: ${L.hint}</p>` : ''}
    <p class="card">Misi nyata yang mirip: ${M.realMission}</p>
    <div class="row">
      <button id="again">Main lagi</button>
      <button id="retry">Ubah rakitan</button>
      <button class="primary" id="next" ${hasNext ? '' : 'disabled'}>${app.level >= LAST_LEVEL && r.success ? 'Level berikutnya belum dibuat' : 'Lanjut'}</button>
    </div>
    <div class="row"><button id="levels">Pilih misi lain</button><button id="home">Menu utama</button></div>
  `;
  el.querySelector('#again').onclick = () => app.go('flight');
  el.querySelector('#retry').onclick = () => app.go('rakit');
  el.querySelector('#home').onclick = () => app.go('home');
  el.querySelector('#levels').onclick = () => app.go('levels');
  el.querySelector('#next').onclick = () => {
    app.level += 1;
    app.go('rakit');
  };
}
