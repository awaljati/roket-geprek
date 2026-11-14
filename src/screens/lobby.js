import { makeRoomCode, openRoom, hasFirebase } from '../net/room.js';
import { TEAMS } from '../net/battle.js';
import { joinBattle, leaveBattle } from './battle.js';

export function lobbyScreen(app, el) {
  el.className = 'screen';
  el.innerHTML = `
    <h2>Lobby</h2>
    <p class="muted">Mode koneksi: ${hasFirebase ? 'online (Firebase)' : 'lokal: buka 2 tab di browser yang sama untuk tes'}</p>
    <div class="card row">
      <div style="flex:1"><b>Solo</b><br><span class="muted">Satu perangkat memegang Navigator dan Spesialis.</span></div>
      <button class="primary" id="solo">Main solo</button>
    </div>
    <div class="card row">
      <div style="flex:1"><b>Buat room (Navigator)</b><br><span class="muted">Perangkat ini menyetir roket dan menjalankan fisika.</span></div>
      <button id="create">Buat room</button>
    </div>
    <div class="card row">
      <div style="flex:1"><b>Gabung room (Spesialis)</b><br><span class="muted">Masukkan kode dari Navigator.</span></div>
      <input type="text" id="code" maxlength="4" placeholder="KODE">
      <button id="join">Gabung</button>
    </div>
    <h3>Battle (2–3 tim)</h3>
    <div class="card row">
      <div style="flex:1"><b>Buat battle (layar skor)</b><br><span class="muted">Buka di laptop atau proyektor. Layar ini menampilkan kode, memulai level, dan papan skor.</span></div>
      <button id="host">Buat battle</button>
    </div>
    <div class="card">
      <b>Gabung battle</b>
      <div class="row" style="margin-top:8px">
        <input type="text" id="bcode" maxlength="4" placeholder="KODE">
        <select id="bteam">${TEAMS.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
        <select id="brole"><option value="navigator">Navigator</option><option value="spesialis">Spesialis</option></select>
        <input type="text" id="bname" maxlength="16" placeholder="Nama (opsional)" style="text-transform:none">
        <button class="primary" id="bjoin">Gabung</button>
      </div>
    </div>
    <div id="msg" class="status"></div>
    <button id="back">Kembali</button>
  `;
  const $ = (s) => el.querySelector(s);

  $('#solo').onclick = () => {
    leaveBattle(app);
    app.role = 'solo';
    app.room = null;
    app.code = null;
    app.go('levels');
  };

  $('#create').onclick = async () => {
    leaveBattle(app);
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

  $('#host').onclick = () => {
    leaveBattle(app);
    app.go('battleHost');
  };
  $('#bjoin').onclick = async () => {
    const code = $('#bcode').value.trim().toUpperCase();
    if (code.length !== 4) {
      $('#msg').textContent = 'Kode battle 4 huruf, lihat di layar skor.';
      return;
    }
    leaveBattle(app);
    try {
      await joinBattle(app, { code, team: $('#bteam').value, role: $('#brole').value, name: $('#bname').value.trim() });
    } catch (e) {
      $('#msg').textContent = 'Gagal bergabung: ' + e.message;
      return;
    }
    app.go('battle');
  };

  $('#back').onclick = () => app.go('home');
}
