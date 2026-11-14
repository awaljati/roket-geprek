// Perangkat Spesialis: menerima snapshot dari Navigator, menampilkan peta kecil + panel, mengirim perintah.
import { openRoom } from '../net/room.js';
import { createView } from '../render/view.js';
import { mountPanelFor } from './specialistPanel.js';
import { FAIL_CODES } from '../data/failcodes.js';
import { nominalPathPoints } from '../levels/level2.js';

export function spesialisScreen(app, el) {
  el.className = 'flight';
  el.innerHTML = `
    <div class="view"><div class="stage" id="stage"><canvas id="cv"></canvas></div><div class="hud" id="wait">Menunggu Navigator di room <b>${app.code}</b>…</div></div>
    <div class="side" id="side"></div>
  `;
  const $ = (s) => el.querySelector(s);
  const renderer = createView($('#stage'));
  let room = null;
  const send = (cmd) => room && room.sendCmd(cmd);
  let level = null;
  let update = () => {};

  openRoom(app.code, {
    onState: (v) => {
      $('#wait').style.display = v.paused ? 'block' : 'none';
      if (v.paused) $('#wait').innerHTML = '<b>Dijeda oleh Navigator</b>';
      if (v.level !== level) {
        level = v.level;
        update = mountPanelFor(level, $('#side'), send);
      }
      // Jalur target Level 2 tidak dikirim lewat room (selalu sama), jadi dihitung di sini.
      if (v.level === 2 && !(v.nominal && v.nominal.length)) v.nominal = nominalPathPoints();
      renderer.draw(v);
      update(v);
      if (v.result) {
        const r = v.result;
        $('#wait').style.display = 'block';
        $('#wait').innerHTML = `<b>${r.success ? 'Berhasil' : 'Gagal'}</b> ${'★'.repeat(r.stars)}<br>${r.failCode ? FAIL_CODES[r.failCode] : ''}`;
      }
    },
  }).then((r) => (room = r));

  return () => {
    if (room) room.close();
    renderer.dispose();
  };
}
