import { makeRoomCode, openRoom, hasFirebase } from '../net/room.js';

export function lobbyScreen(app, el) {
  el.className = 'screen lobby-screen';
  el.innerHTML = `
    <div>
      el.innerHTML = `
       <a class="btnlink"
         href="http://itb.ac.id/"
         target="_blank"
         rel="noopener noreferrer">
        <img src="/assets/netral.svg" alt="Kunjungi Kami" />
      </a>
    </div>

    <img src="/assets/judul.svg" alt="Roket Geprek" class="floating-icon" />
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
    <div id="msg" class="status"></div>
    <button id="back">Kembali</button>
    <p class="muted">Mode koneksi: ${hasFirebase ? 'online (Firebase)' : 'lokal: buka 2 tab di browser yang sama untuk tes'}</p>
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

  $('#back').onclick = () => app.go('home');
}
