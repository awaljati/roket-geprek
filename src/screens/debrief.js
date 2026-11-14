import { FAIL_CODES } from '../data/failcodes.js';
import { LEVELS } from '../data/levels.js';

// Misi NASA nyata yang mirip, ditampilkan di Debrief (lihat Game Design Final).
const REAL_MISSION = {
  1: 'CubeSat buatan kampus yang diluncurkan lewat NASA CubeSat Launch Initiative, juga Surya Satellite-1 dari Indonesia (cek ulang).',
};

export function debriefScreen(app, el) {
  const r = app.result || { success: false, failCode: null, stars: 0, score: 0, fuelLeft: 0 };
  const L = LEVELS[app.level];
  el.className = 'screen center';
  el.innerHTML = `
    <h2>Debrief: ${L.name}</h2>
    <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
    <p><b>${r.success ? 'Misi berhasil' : 'Misi gagal'}</b>${r.failCode ? ` · ${r.failCode}` : ''}</p>
    ${r.failCode ? `<p>${FAIL_CODES[r.failCode]}</p>` : ''}
    <p class="muted">Skor ${r.score} · Sisa bahan bakar ${Math.round(r.fuelLeft * 100)}%</p>
    ${!r.success && L.hint ? `<p class="card">Hint: ${L.hint}</p>` : ''}
    <p class="card">Misi nyata yang mirip: ${REAL_MISSION[app.level] || ''}</p>
    <div class="row">
      <button id="retry">Coba lagi</button>
      <button class="primary" id="next" ${r.success ? '' : 'disabled'}>Lanjut</button>
    </div>
  `;
  el.querySelector('#retry').onclick = () => app.go('rakit');
  el.querySelector('#next').onclick = () => alertNext(el);
}

function alertNext(el) {
  el.querySelector('#next').textContent = 'Level 2 belum dibuat';
}
