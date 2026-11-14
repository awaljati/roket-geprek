import { LEVELS, CUBESAT_SIZES, ROCKETS } from '../data/levels.js';
import { LEVEL_MODULES } from '../levels/index.js';

export function rakitScreen(app, el) {
  const L = LEVELS[app.level];
  const M = LEVEL_MODULES[app.level];
  // Desain tersimpan per level, supaya Coba Lagi kembali ke desain terakhir.
  app.builds = app.builds || {};
  if (!app.builds[app.level]) app.builds[app.level] = structuredClone(M.defaultBuild);
  const b = app.builds[app.level];
  app.build = b;
  const isCubeSat = app.level === 1;

  el.className = 'screen';
  el.innerHTML = `
    <h2>${L.name}: Rakit</h2>
    <p class="muted">${M.briefing}</p>
    <p class="muted">Roket: <b>${L.rocket}</b> (kapasitas ${ROCKETS[L.rocket].capacityKg} kg) · Anggaran ${L.budget} juta $${isCubeSat ? '' : ` · Badan: ${L.body}`}</p>
    ${
      isCubeSat
        ? `<div class="card"><b>Ukuran CubeSat</b><div class="row">${Object.keys(CUBESAT_SIZES)
            .map((k) => `<label><input type="radio" name="size" value="${k}"> ${k}${CUBESAT_SIZES[k].optional ? ' (kalau sempat)' : ''}</label>`)
            .join(' ')}</div></div>`
        : ''
    }
    <div class="card">
      <b>Komponen</b>
      <div class="items">${M.rakitItems
        .map(
          (it) => `<label class="item"><input type="checkbox" value="${it.id}">
          <span>${it.name}<small>${it.mass} kg · ${it.price} juta $ · ${it.power >= 0 ? '+' : ''}${it.power} W</small></span></label>`,
        )
        .join('')}</div>
    </div>
    ${
      isCubeSat
        ? `<label class="card row"><input type="checkbox" id="assist"> <span><b>Bantuan pilot</b> (disarankan untuk pemula)<br><small class="muted">Roket dimiringkan otomatis dan mesin dimatikan tepat waktu. Kamu cukup menekan Gas + saat diminta.</small></span></label>`
        : ''
    }
    <div class="card">
      <b>Bahan bakar ${isCubeSat ? 'roket' : 'kapsul'}: <span id="fuelv"></span></b>
      <input type="range" id="fuel" min="1" max="10" step="1" style="width:100%">
    </div>
    <div class="card" id="bars"></div>
    <div class="row">
      <button id="back">Kembali</button>
      <button class="primary" id="launch">Luncurkan</button>
      ${app.code ? `<span class="muted">Room <b>${app.code}</b></span>` : ''}
    </div>
  `;
  const $ = (s) => el.querySelector(s);

  el.querySelectorAll('input[name=size]').forEach((r) => {
    r.checked = r.value === b.size;
    r.onchange = () => ((b.size = r.value), update());
  });
  el.querySelectorAll('.items input').forEach((c) => {
    c.checked = b.items.includes(c.value);
    c.onchange = () => {
      b.items = c.checked ? [...b.items, c.value] : b.items.filter((x) => x !== c.value);
      update();
    };
  });
  if ($('#assist')) {
    $('#assist').checked = b.assist !== false;
    $('#assist').onchange = () => (b.assist = $('#assist').checked);
  }
  $('#fuel').value = Math.round(b.fuel * 10);
  $('#fuel').oninput = () => ((b.fuel = $('#fuel').value / 10), update());

  function bar(label, value, max, unit) {
    const pct = Math.min(100, (value / max) * 100);
    return `<div>${label}: ${+value.toFixed(2)} / ${max} ${unit}</div><div class="bar ${value > max ? 'over' : ''}"><i style="width:${pct}%"></i></div>`;
  }
  function update() {
    const c = M.buildCheck(b);
    $('#fuelv').textContent = Math.round(b.fuel * 100) + '%';
    $('#bars').innerHTML =
      bar(isCubeSat ? 'Massa CubeSat' : 'Massa (wahana + item + bahan bakar)', c.mass, c.massLimit, 'kg') +
      bar('Anggaran', c.price, c.budget, 'juta $') +
      bar('Slot', c.slotsUsed, c.slots, 'slot');
    // Terlalu berat tetap boleh diluncurkan supaya pemain melihat F-HEAVY di Debrief.
    $('#launch').disabled = c.overBudget || c.tooManyItems;
    const why = [];
    if (c.tooManyItems) why.push(`Slot penuh: maksimal ${c.slots} komponen${isCubeSat ? ' (pilih CubeSat yang lebih besar, misalnya 3U)' : ''}.`);
    if (c.overBudget) why.push('Anggaran terlewati: kurangi komponen atau bahan bakar.');
    if (c.tooHeavy) why.push('Terlalu berat: roket akan gagal (F-HEAVY).');
    $('#bars').innerHTML += why.length ? `<p class="warn">${why.join('<br>')}</p>` : '';
  }
  update();

  $('#back').onclick = () => app.go('lobby');
  $('#launch').onclick = () => app.go('flight');
}
