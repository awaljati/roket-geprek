import { LEVELS, CUBESAT_SIZES, ROCKETS } from '../data/levels.js';
import { LEVEL_MODULES } from '../levels/index.js';
import { REWARD } from '../data/levels.js';
import { getFunds } from './progress.js';
import { topbarHtml, bindTopbar } from './topbar.js';
import '@fontsource/londrina-solid/400.css';
import '@fontsource/londrina-solid/900.css';
import '../styles/rakit.css';

// Tampilan Rakit mengikuti desain DKV (docs/desain/layout-rakit-wahana.png).
// Ikon Level 1 dari DKV (versi WebP ringan); ikon Level 2-4 digambar sendiri dengan gaya yang sama (rakit/ikon/*.svg).
const A = '/assets/rakit/';
const ITEM_ICON = {
  'cs-battery': 'baterai-cubesat-icon.webp',
  'cs-panel-body': 'panel-surya-menempel-icon.webp',
  'cs-panel-fold': 'panel-surya-lipat-icon.webp',
  'cs-antenna-uhf': 'antena-pita-uhf-icon.webp',
  'cs-antenna-s': 'antena-s-band-icon.webp',
  battery: 'ikon/baterai.svg',
  'panel-s': 'ikon/panel-surya-kecil.svg',
  'panel-l': 'ikon/panel-surya-besar.svg',
  'antenna-s': 'ikon/antena-kecil.svg',
  'antenna-m': 'ikon/antena-sedang.svg',
  'antenna-l': 'ikon/antena-besar.svg',
  camera: 'ikon/kamera.svg',
  heatshield: 'ikon/pelindung-panas.svg',
  'lander-engine': 'ikon/mesin-pendarat.svg',
  spectrometer: 'ikon/spektrometer.svg',
  rtg: 'ikon/rtg.svg',
  'mars-edl': 'ikon/paket-pendaratan-mars.svg',
  'rad-shield': 'ikon/pelindung-radiasi.svg',
};
const ROCKET_ICON = { kecil: 'rocket-kecil-icon.webp', sedang: 'ikon/roket-sedang.svg', besar: 'ikon/roket-besar.svg' };
const FUEL_BARS = 5;

export function rakitScreen(app, el) {
  const L = LEVELS[app.level];
  const M = LEVEL_MODULES[app.level];
  // Desain tersimpan per level, supaya Coba Lagi kembali ke desain terakhir.
  app.builds = app.builds || {};
  if (!app.builds[app.level]) app.builds[app.level] = structuredClone(M.defaultBuild);
  const b = app.builds[app.level];
  app.build = b;
  const isCubeSat = app.level === 1;
  const fuelName = isCubeSat ? 'roket' : app.level === 4 ? 'roket pendarat' : app.level === 3 ? 'pendarat' : 'kapsul';
  const assistText = isCubeSat
    ? 'Roket dimiringkan otomatis dan mesin dimatikan tepat waktu. Kamu cukup menekan Gas + saat diminta.'
    : app.level === 4
      ? 'Roket dimiringkan otomatis saat peluncuran, dan pelatih mengingatkan badai matahari serta rentang aman program pendaratan.'
      : app.level === 3
        ? 'Pendarat dijaga tetap tegak dan gas dikurangi otomatis kalau berlebihan. Kamu cukup menekan Gas + saat diminta.'
        : 'Arah kapsul diatur otomatis (koreksi lintasan, membidik Bulan, pelindung panas). Kamu cukup menekan Gas + dan Ambil foto saat diminta.';
  const expertText = `Tanpa bantuan = mode ahli: roket tetap miring dan mesin mati otomatis saat ke orbit, tapi tanpa aba-aba: kamu sendiri yang menentukan kapan menyalakan mesin di puncak${app.level === 2 || app.level === 3 ? ', dan kemudi selanjutnya manual' : ''}.`;
  const icon = (id) => (ITEM_ICON[id] ? `<img src="${A}${ITEM_ICON[id]}" alt="" loading="lazy">` : '');

  el.className = 'screen rakit-screen';
  el.innerHTML = `
    ${topbarHtml({ flow: true })}
    <header class="rk-head">
      <h2 class="rk-title">${L.name}: Rakit</h2>
      <p class="rk-brief">${M.briefing}</p>
    </header>
    <section class="rk-panel">
      <div class="rk-chips">
        <div class="rk-chip">
          <img src="${A}${ROCKET_ICON[L.rocket]}" alt="">
          <div><b>Roket ${L.rocket}</b><small>Kapasitas ${ROCKETS[L.rocket].capacityKg} kg${isCubeSat ? '' : ` · Badan: ${L.body}`}</small></div>
        </div>
        <div class="rk-chip">
          <img src="${A}anggaran-icon.webp" alt="">
          <div><b>Anggaran</b><small id="budgetChip">${L.budget} juta $</small></div>
        </div>
      </div>
      ${
        isCubeSat
          ? `<fieldset class="rk-box rk-sizes"><legend class="rk-label">Ukuran CubeSat</legend><div class="rk-size-row">${Object.keys(CUBESAT_SIZES)
              .map((k) => {
                const s = CUBESAT_SIZES[k];
                return `<label class="rk-size"><input type="radio" name="size" value="${k}">
                  <img src="${A}cubesat-${k.toLowerCase()}.webp" alt="CubeSat ${k}">
                  <b>${k}</b><small>maks. ${s.massLimit} kg · ${s.slots} slot${s.optional ? ' · kalau sempat' : ''}</small></label>`;
              })
              .join('')}</div></fieldset>`
          : ''
      }
      <fieldset class="rk-box">
        <legend class="rk-label">Komponen</legend>
        <div class="rk-items">${M.rakitItems
          .map(
            (it) => `<label class="rk-item"><input type="checkbox" value="${it.id}">
            <span class="rk-ico">${icon(it.id)}</span>
            <span class="rk-item-text"><b>${it.name}</b><small>${it.mass} kg · ${it.price} juta $ · ${it.power >= 0 ? '+' : ''}${it.power} W</small></span></label>`,
          )
          .join('')}</div>
      </fieldset>
      <label class="rk-assist">
        <img src="${A}bantuan-pilot-icon.webp" alt="">
        <span class="rk-assist-text"><b>Bantuan pilot</b> <span class="rk-tag">disarankan</span><small>${assistText}</small><small class="rk-dim">${expertText}</small></span>
        <input type="checkbox" id="assist">
        <span class="rk-check" aria-hidden="true"></span>
      </label>
      <div class="rk-box rk-fuel">
        <div class="rk-fuel-read">
          <span class="rk-label">Bahan bakar ${fuelName}:</span>
          <span class="rk-big" id="fuelv"></span>
        </div>
        <div class="rk-fuel-bars" id="fuelBars">${Array.from({ length: FUEL_BARS }, (_, i) => `<button type="button" data-i="${i}" aria-label="Bahan bakar ${(i + 1) * 20}%"></button>`).join('')}</div>
        <input type="range" id="fuel" min="1" max="10" step="1" aria-label="Bahan bakar ${fuelName}">
      </div>
      <div class="rk-bottom">
        <div class="rk-box rk-bars" id="bars"></div>
        <button type="button" class="rk-launch" id="launch" aria-label="Luncurkan"><img src="${A}tombol-luncurkan.svg" alt=""></button>
      </div>
      <p class="rk-warn" id="why"></p>
      <div class="rk-funds" id="fundsCard"></div>
      ${app.code ? `<p class="rk-room">Room <b>${app.code}</b></p>` : ''}
      <i class="rk-rivet tl"></i><i class="rk-rivet tr"></i><i class="rk-rivet bl"></i><i class="rk-rivet br"></i>
    </section>
  `;
  const $ = (s) => el.querySelector(s);

  el.querySelectorAll('input[name=size]').forEach((r) => {
    r.checked = r.value === b.size;
    r.onchange = () => ((b.size = r.value), update());
  });
  el.querySelectorAll('.rk-items input').forEach((c) => {
    c.checked = b.items.includes(c.value);
    c.onchange = () => {
      b.items = c.checked ? [...b.items, c.value] : b.items.filter((x) => x !== c.value);
      update();
    };
  });
  $('#assist').checked = b.assist !== false;
  $('#assist').onchange = () => (b.assist = $('#assist').checked);

  // Dana cadangan: maksimal 50% anggaran level, dan tidak lebih dari dana yang dimiliki.
  const funds = getFunds();
  const maxExtra = Math.min(funds, Math.floor(L.budget * REWARD.maxExtraShare));
  b.extraBudget = Math.min(b.extraBudget || 0, maxExtra);
  $('#fundsCard').innerHTML =
    maxExtra > 0
      ? `<span class="rk-label">Dana cadangan: ${funds} juta $</span>
         <div class="rk-extra">Tambah ke anggaran: <b id="extraV"></b> juta $ <small>(maks. ${maxExtra})</small></div>
         <input type="range" id="extra" min="0" max="${maxExtra}" step="1" aria-label="Tambah dana cadangan ke anggaran">
         <small>*Dana yang dipakai langsung terpotong saat meluncur, walaupun misi gagal.</small>`
      : `<span class="rk-label">Dana cadangan: ${funds} juta $</span><small>*Selesaikan misi dengan hemat untuk mendapat dana tambahan anggaran.</small>`;
  if ($('#extra')) {
    $('#extra').value = b.extraBudget;
    $('#extra').oninput = () => ((b.extraBudget = Number($('#extra').value)), update());
  }
  $('#fuel').value = Math.round(b.fuel * 10);
  $('#fuel').oninput = () => ((b.fuel = $('#fuel').value / 10), update());
  // Batang bahan bakar bisa diketuk: batang ke-n = n × 20%.
  el.querySelectorAll('#fuelBars button').forEach((btn) => {
    btn.onclick = () => {
      b.fuel = (Number(btn.dataset.i) + 1) / FUEL_BARS;
      $('#fuel').value = Math.round(b.fuel * 10);
      update();
    };
  });

  function bar(label, value, max, unit) {
    const pct = Math.min(100, (value / max) * 100);
    return `<div class="rk-bar-row"><span class="rk-label">${label}: ${+value.toFixed(2)} / ${max} ${unit}</span><div class="rk-bar ${value > max ? 'over' : ''}"><i style="width:${pct}%"></i></div></div>`;
  }
  function update() {
    const c = M.buildCheck(b);
    $('#fuelv').textContent = Math.round(b.fuel * 100) + '%';
    const lit = Math.ceil(b.fuel * FUEL_BARS - 1e-9);
    el.querySelectorAll('#fuelBars button').forEach((btn, i) => btn.classList.toggle('on', i < lit));
    if ($('#extraV')) $('#extraV').textContent = b.extraBudget || 0;
    $('#budgetChip').textContent = `${c.budget} juta $`;
    $('#bars').innerHTML =
      bar(isCubeSat ? 'Massa CubeSat' : 'Massa', c.mass, c.massLimit, 'kg') +
      bar('Anggaran', c.price, c.budget, 'juta $') +
      bar('Slot', c.slotsUsed, c.slots, 'slot');
    // Terlalu berat tetap boleh diluncurkan supaya pemain melihat F-HEAVY di Debrief.
    $('#launch').disabled = c.overBudget || c.tooManyItems;
    const why = [];
    if (c.tooManyItems) why.push(`Slot penuh: maksimal ${c.slots} komponen${isCubeSat ? ' (pilih CubeSat yang lebih besar, misalnya 3U)' : ''}.`);
    if (c.overBudget) why.push(`Anggaran terlewati: kurangi komponen atau bahan bakar${maxExtra > 0 ? ', atau tambah dari dana cadangan' : ''}.`);
    if (c.tooHeavy) why.push('Terlalu berat: roket akan gagal (F-HEAVY).');
    if (c.warn) why.push(c.warn);
    $('#why').innerHTML = why.join('<br>');
    $('#why').hidden = why.length === 0;
  }
  update();

  bindTopbar(el, app, { back: () => app.go('levels') });
  $('#launch').onclick = () => app.go('flight');
}
