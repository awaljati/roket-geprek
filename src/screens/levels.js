// Layar Pilih Level (peta misi dari desain DKV). Semua level yang sudah dibuat bisa langsung dipilih (tidak perlu membuka berurutan).
import { LEVEL_MODULES } from '../levels/index.js';
import { bestStars, getFunds } from './progress.js';
import '../styles/pilih-misi.css';

// x, y = titik tengah lingkaran jalur pada latar 1920×1080 (persen lebar dan tinggi latar).
// cy = letak tengah bola planet pada gambarnya (persen tinggi): koin nomor Level 1 dan 3 di atas, Level 2 dan 4 di bawah.
const CARDS = [
  { level: 1, x: 21, y: 66, cy: 63, title: 'CubeSat Transmisi', where: 'Orbit rendah Bumi', what: 'Rakit CubeSat, masuk orbit, kirim sinyal pertama ke stasiun bumi BRIN di Biak.', tag: 'Tutorial' },
  { level: 2, x: 40.5, y: 41.5, cy: 36, title: 'Memutari Bulan', where: 'Bumi → Bulan → Bumi', what: 'Koreksi lintasan, foto Bulan, lalu pulang lewat atmosfer seperti Artemis II.', tag: 'Menengah' },
  { level: 3, x: 59.5, y: 72, cy: 62, title: 'Kutub Selatan Bulan', where: 'Permukaan Bulan', what: 'Mendarat tanpa atmosfer di wilayah target Artemis: rem dengan mesin, turun pelan, tetap tegak.', tag: 'Lanjutan' },
  { level: 4, x: 78.5, y: 51, cy: 36, title: 'Mendarat di Mars', where: 'Permukaan Mars', what: 'Lindungi rover dari badai matahari, program pendaratannya, lalu kirim foto pertama dari Mars.', tag: 'Ahli' },
];

export function levelsScreen(app, el) {
  el.className = 'misi-screen';
  el.innerHTML = `
    <div class="misi-head">
      <h2 class="misi-title">Pilih Misi</h2>
      <p>Dana cadangan: <b>${getFunds()} juta $</b> <small>· didapat dari misi yang berhasil dan hemat</small></p>
      <p>${app.code && app.role === 'navigator' ? `Room <b>${app.code}</b> · Spesialis otomatis mengikuti misi yang kamu pilih.` : 'Pilih misi yang ingin dimainkan.'}</p>
      <button id="back" class="misi-back">Kembali</button>
    </div>
    <div class="misi-stage">
      ${CARDS.map((c) => {
        const ready = Boolean(LEVEL_MODULES[c.level]);
        const stars = bestStars(c.level);
        return `<button class="misi-planet ${ready ? '' : 'misi-locked'}" data-level="${c.level}" ${ready ? '' : 'disabled'}
            style="--x:${c.x}%;--y:${c.y}%;--cy:-${c.cy}%" title="${c.where}: ${c.what}" aria-label="Level ${c.level}: ${c.title}">
          <img src="/assets/misi/level-${c.level}.webp" alt="" width="283" height="360" draggable="false">
          <span class="misi-info">
            <b class="misi-name">${c.title}</b>
            <span class="misi-stars">${ready ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</span>
            <span class="misi-tag">${c.tag}</span>
          </span>
        </button>`;
      }).join('')}
    </div>
  `;
  el.querySelectorAll('.misi-planet:not(.misi-locked)').forEach((b) => {
    b.onclick = () => {
      app.level = Number(b.dataset.level);
      app.go('rakit');
    };
  });
  el.querySelector('#back').onclick = () => app.go('lobby');
}
