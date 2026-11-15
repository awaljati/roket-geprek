import { makeRoomCode, openRoom, hasFirebase } from '../net/room.js';
import { topbarHtml, bindTopbar } from './topbar.js';

export function lobbyScreen(app, el) {
  el.className = 'screen lobby-screen';
  el.innerHTML = `
    ${topbarHtml()}
  
<div class="contentlobby">
  <div class="contentlobby-left">
    <img src="/assets/netral.svg" alt="Pok-Pok" class="floating-icon" />
  </div>
  
  <div class="contentlobby-right">
    <div class="card row">
      <div style="flex:1"><b>Buat room (Navigator)</b><br><span class="muted">Perangkat ini menyetir roket dan menjalankan fisika.</span></div>
      <button id="create">Buat room</button>
    </div>
    <div class="card row">
      <div style="flex:1"><b>Gabung room (Spesialis)</b><br><span class="muted">Masukkan kode dari Navigator.</span></div>
      <input type="text" id="code" maxlength="4" placeholder="KODE">
      <button id="join">Gabung</button>
    </div>
    <div class="card row">
      <div style="flex:1"><b>Solo</b><br><span class="muted">Satu perangkat memegang Navigator dan Spesialis.</span></div>
      <button class="primary" id="solo">Main solo</button>
    </div>
    <div id="msg" class="status"></div>
    
    <p class="muted">${hasFirebase ? 'Mode online aktif: main berdua dari perangkat berbeda.' : 'Mode lokal: buka dua tab di browser yang sama.'}</p>
  </div>
  </div>
  `;
  const $ = (s) => el.querySelector(s);

  $('#solo').onclick = () => {
    app.role = 'solo';
    app.go('levels');
  };

  $('#create').onclick = async () => {
    app.role = 'navigator';
    app.code = makeRoomCode();
    try {
      app.room = await openRoom(app.code, { onCmd: (cmd) => app.onCmd && app.onCmd(cmd) });
    } catch (e) {
      $('#msg').textContent = 'Gagal membuat room: ' + e.message;
      return;
    }
    $('#msg').innerHTML = `Kode room: <span class="code">${app.code}</span><br>Bagikan ke Spesialis, lalu pilih misi.`;
    $('#create').textContent = 'Pilih misi';
    $('#create').onclick = () => app.go('levels');
  };

  $('#join').onclick = async () => {
    const code = $('#code').value.trim().toUpperCase();
    if (code.length !== 4) {
      $('#msg').textContent = 'Kode room 4 huruf.';
      return;
    }
    app.role = 'spesialis';
    app.code = code;
    app.go('spesialis');
  };

  bindTopbar(el, app, { back: () => app.go('home') });
}
