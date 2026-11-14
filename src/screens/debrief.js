import { FAIL_CODES } from '../data/failcodes.js';
import { LEVELS } from '../data/levels.js';
import { LEVEL_MODULES, LAST_LEVEL } from '../levels/index.js';

export function debriefScreen(app, el) {
  const r = app.result || { success: false, failCode: null, stars: 0, score: 0, fuelLeft: 0, photos: 0 };
  const L = LEVELS[app.level];
  const M = LEVEL_MODULES[app.level];
  app.fails = app.fails || {};
  if (!r.success) app.fails[app.level] = (app.fails[app.level] || 0) + 1;
  // Petunjuk muncul setelah 1 kali gagal di Level 1, setelah 2 kali di level lain (Game Design Final).
  const showHint = !r.success && L.hint && app.fails[app.level] >= (app.level === 1 ? 1 : 2);
  const hasNext = r.stars >= 1 && app.level < LAST_LEVEL;
  el.className = 'screen center';
  el.innerHTML = `
    <h2>Debrief: ${L.name}</h2>
    <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
    <p><b>${r.success ? 'Misi berhasil' : 'Misi gagal'}</b>${r.failCode ? ` · ${r.failCode}` : ''}</p>
    ${r.failCode ? `<p>${FAIL_CODES[r.failCode]}</p>` : ''}
    <p class="muted">Skor ${r.score} · Sisa bahan bakar ${Math.round(r.fuelLeft * 100)}%${app.level === 2 ? ` · Foto berguna ${r.photos}` : ''}</p>
    ${showHint ? `<p class="card">Hint: ${L.hint}</p>` : ''}
    <p class="card">Misi nyata yang mirip: ${M.realMission}</p>
    <div class="row">
      <button id="retry">Coba lagi</button>
      <button class="primary" id="next" ${hasNext ? '' : 'disabled'}>${app.level >= LAST_LEVEL && r.success ? 'Level berikutnya belum dibuat' : 'Lanjut'}</button>
    </div>
  `;
  el.querySelector('#retry').onclick = () => app.go('rakit');
  el.querySelector('#next').onclick = () => {
    app.level += 1;
    app.go('rakit');
  };
}
