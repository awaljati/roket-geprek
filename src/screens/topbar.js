// Bar atas bersama untuk Lobby, Pilih Misi, dan Rakit (desain DKV):
// kiri = Kembali, Pengaturan, dana cadangan (koin cabe); kanan = nama game dan kepala Pok-Pok.
import { getFunds, resetProgress } from './progress.js';
import { prefers3D, setPrefer3D } from '../render/view.js';
import { getLang, setLang } from '../i18n.js';
import '../styles/ui-dkv.css';

// flow = ikut alur halaman (Rakit); tanpa flow = menempel di atas layar (Lobby, Pilih Misi).
export function topbarHtml({ flow = false } = {}) {
  return `
    <div class="headerlobby topbar${flow ? ' topbar-flow' : ''}">
      <div class="headerlobby-left">
        <button type="button" class="topbar-btn tb-back" data-tb="back" aria-label="Kembali" title="Kembali">
          <img src="/assets/back-button.svg" alt="">
        </button>
        <button type="button" class="topbar-btn tb-settings" data-tb="settings" aria-label="Pengaturan" title="Pengaturan">
          <img src="/assets/ui/pengaturan.webp" alt="">
        </button>
        <div class="coin tb-coin" title="Dana cadangan (juta $): didapat dari misi yang berhasil dan hemat, bisa dipakai sebagai tambahan anggaran di layar Rakit.">
          <img src="/assets/ui/koin.webp" alt="" class="coin-icon">
          <span class="coin-text" data-tb="coin">${getFunds()}</span>
        </div>
      </div>
      <div class="headerlobby-right">
        <button type="button" class="tb-lang" data-tb="lang" title="Bahasa / Language">${getLang() === 'en' ? 'ID' : 'EN'}</button>
        <span class="headerlobby-name">Roket Geprek</span>
        <img src="/assets/ui/kepala-ayam.webp" alt="" class="tb-ayam">
      </div>
    </div>`;
}

// back = fungsi saat tombol Kembali ditekan.
export function bindTopbar(el, app, { back }) {
  el.querySelector('[data-tb="back"]').onclick = back;
  el.querySelector('[data-tb="settings"]').onclick = () => openSettings(app);
  el.querySelector('[data-tb="lang"]').onclick = () => setLang(getLang() === 'en' ? 'id' : 'en');
}

function openSettings(app) {
  const box = document.createElement('div');
  box.className = 'tb-modal';
  box.innerHTML = `
    <div class="tb-dialog" role="dialog" aria-modal="true" aria-labelledby="tb-title">
      <h3 id="tb-title">Pengaturan</h3>
      <div class="tb-row">
        <div><b>Bahasa / Language</b></div>
        <div class="tb-seg">
          <button type="button" data-lang="id">Indonesia</button>
          <button type="button" data-lang="en">English</button>
        </div>
      </div>
      <div class="tb-row">
        <div><b>Tampilan</b><br><small>3D lebih indah; 2D lebih ringan untuk HP lama.</small></div>
        <div class="tb-seg">
          <button type="button" data-view="3d">3D</button>
          <button type="button" data-view="2d">2D</button>
        </div>
      </div>
      <div class="tb-row">
        <div><b>Progres</b><br><small>Bintang dan dana cadangan tersimpan di browser ini.</small></div>
        <button type="button" data-a="reset">Hapus progres</button>
      </div>
      <div class="tb-confirm" hidden>
        <span>Yakin? Bintang dan dana cadangan kembali ke 0.</span>
        <span class="tb-confirm-btns"><button type="button" data-a="yes">Ya, hapus</button><button type="button" data-a="no">Batal</button></span>
      </div>
      <p class="tb-note">Roket Geprek · NASA Space Apps Challenge 2026</p>
      <button type="button" class="primary tb-close" data-a="close">Tutup</button>
    </div>`;
  const $ = (s) => box.querySelector(s);
  const showView = () =>
    box.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', (b.dataset.view === '3d') === prefers3D()));
  showView();
  box.querySelectorAll('[data-lang]').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === getLang());
    b.onclick = () => b.dataset.lang !== getLang() && setLang(b.dataset.lang);
  });
  box.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      setPrefer3D(b.dataset.view === '3d');
      showView();
    };
  });
  const close = () => {
    box.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  window.addEventListener('keydown', onKey);
  box.onclick = (e) => e.target === box && close();
  $('[data-a="close"]').onclick = close;
  $('[data-a="reset"]').onclick = () => ($('.tb-confirm').hidden = false);
  $('[data-a="no"]').onclick = () => ($('.tb-confirm').hidden = true);
  $('[data-a="yes"]').onclick = () => {
    resetProgress();
    close();
    app.refresh();
  };
  document.body.appendChild(box);
  $('[data-a="close"]').focus();
}
