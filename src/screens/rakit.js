import { ITEMS } from '../data/items.js';
import { LEVELS, CUBESAT_SIZES } from '../data/levels.js';
import { buildCheck } from '../levels/level1.js';

export function rakitScreen(app, el) {
  const L = LEVELS[app.level];
  const choices = ITEMS.filter((it) => it.level === 1 && it.cubesat);
  el.className = 'screen';
  el.innerHTML = `
    <h2>${L.name}: Rakit</h2>
    <p class="muted">Build a CubeSat, ride a rocket to low Earth orbit, deploy safely, and send your first signal to a ground station.</p>
    <div class="card">
      <b>Ukuran CubeSat</b>
      <div class="row" id="sizes">${Object.keys(CUBESAT_SIZES)
        .map((k) => `<label><input type="radio" name="size" value="${k}"> ${k}${CUBESAT_SIZES[k].optional ? ' (kalau sempat)' : ''}</label>`)
        .join(' ')}</div>
    </div>
    <div class="card">
      <b>Komponen</b>
      <div class="items">${choices
        .map(
          (it) => `<label class="item"><input type="checkbox" value="${it.id}">
          <span>${it.name}<small>${it.mass} kg · ${it.price} juta $ · ${it.power >= 0 ? '+' : ''}${it.power} W</small></span></label>`,
        )
        .join('')}</div>
    </div>
    <div class="card">
      <b>Bahan bakar roket: <span id="fuelv"></span></b>
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
  const b = app.build;

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
  $('#fuel').value = Math.round(b.fuel * 10);
  $('#fuel').oninput = () => ((b.fuel = $('#fuel').value / 10), update());

  function bar(label, value, max, unit) {
    const pct = Math.min(100, (value / max) * 100);
    return `<div>${label}: ${+value.toFixed(2)} / ${max} ${unit}</div><div class="bar ${value > max ? 'over' : ''}"><i style="width:${pct}%"></i></div>`;
  }
  function update() {
    const c = buildCheck(b);
    $('#fuelv').textContent = Math.round(b.fuel * 100) + '%';
    $('#bars').innerHTML =
      bar('Massa CubeSat', c.mass, c.massLimit, 'kg') +
      bar('Anggaran', c.price, c.budget, 'juta $') +
      bar('Slot', c.slotsUsed, c.slots, 'slot');
    // Terlalu berat tetap boleh diluncurkan supaya pemain melihat F-HEAVY di Debrief.
    $('#launch').disabled = c.overBudget || c.tooManyItems;
  }
  update();

  $('#back').onclick = () => app.go('lobby');
  $('#launch').onclick = () => app.go('flight');
}
