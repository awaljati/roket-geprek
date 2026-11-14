// Perangkat Spesialis: menerima snapshot dari Navigator, menampilkan peta kecil + panel, mengirim perintah.
import { openRoom } from '../net/room.js';
import { createRenderer } from '../render/render2d.js';
import { mountSpecialistPanel } from './specialistPanel.js';
import { FAIL_CODES } from '../data/failcodes.js';

export function spesialisScreen(app, el) {
  el.className = 'flight';
  el.innerHTML = `
    <div class="view"><canvas id="cv"></canvas><div class="hud" id="wait">Menunggu Navigator di room <b>${app.code}</b>…</div></div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createRenderer($('#cv'));
  let room = null;
  const update = mountSpecialistPanel($('#side'), (cmd) => room && room.sendCmd(cmd));

  openRoom(app.code, {
    onState: (v) => {
      $('#wait').style.display = 'none';
      renderer.draw(v);
      update(v);
      if (v.result) {
        const r = v.result;
        $('#wait').style.display = 'block';
        $('#wait').innerHTML = `<b>${r.success ? 'Berhasil' : 'Gagal'}</b> ${'★'.repeat(r.stars)}<br>${r.failCode ? FAIL_CODES[r.failCode] : ''}`;
      }
    },
  }).then((r) => (room = r));

  return () => room && room.close();
}
