// Layar Pilih Level. Semua level yang sudah dibuat bisa langsung dipilih (tidak perlu membuka berurutan).
import { LEVEL_MODULES } from '../levels/index.js';
import { bestStars, getFunds } from './progress.js';

const CARDS = [
  { level: 1, title: 'CubeSat Transmisi', where: 'Orbit rendah Bumi', what: 'Rakit CubeSat, masuk orbit, kirim sinyal pertama ke stasiun Bumi.', tag: 'Tutorial' },
  { level: 2, title: 'Memutari Bulan', where: 'Bumi → Bulan → Bumi', what: 'Koreksi lintasan, foto Bulan, lalu pulang lewat atmosfer seperti Artemis II.', tag: 'Menengah' },
  { level: 3, title: 'Kutub Selatan Bulan', where: 'Permukaan Bulan', what: 'Mendarat tanpa atmosfer di wilayah target Artemis: rem dengan mesin, turun pelan, tetap tegak.', tag: 'Lanjutan' },
  { level: 4, title: 'Mendarat di Mars', where: 'Permukaan Mars', what: 'Lindungi rover dari badai matahari, program pendaratannya, lalu kirim foto pertama dari Mars.', tag: 'Ahli' },
];

export function levelsScreen(app, el) {
  el.className = 'screen';
  el.innerHTML = `
    <h2>Pilih Misi</h2>
    <p>Dana cadangan: <b>${getFunds()} juta $</b> <small class="muted">· didapat dari misi yang berhasil dan hemat</small></p>
    <p class="muted">${app.code && app.role === 'navigator' ? `Room <b>${app.code}</b> · Spesialis otomatis mengikuti misi yang kamu pilih.` : 'Pilih misi yang ingin dimainkan.'}</p>
    <div class="level-grid">
      ${CARDS.map((c) => {
        const ready = Boolean(LEVEL_MODULES[c.level]);
        const stars = bestStars(c.level);
        return `<button class="level-card ${ready ? '' : 'locked'}" data-level="${c.level}" ${ready ? '' : 'disabled'}>
          <span class="level-no">Level ${c.level}</span>
          <b>${c.title}</b>
          <small class="muted">${c.where}</small>
          <span>${c.what}</span>
          <span class="level-foot"><span class="tag">${c.tag}</span><span class="stars-sm">${ready ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</span></span>
        </button>`;
      }).join('')}
    </div>
    <button id="back">Kembali</button>
  `;
  el.querySelectorAll('.level-card:not(.locked)').forEach((b) => {
    b.onclick = () => {
      app.level = Number(b.dataset.level);
      app.go('rakit');
    };
  });
  el.querySelector('#back').onclick = () => app.go('lobby');
}
