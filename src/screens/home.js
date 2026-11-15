export function homeScreen(app, el) {
/*  el.className = 'screen center';
  el.innerHTML = `
    <h1>Roket Geprek</h1>
    <p class="muted">Rakit wahana, terbangkan roket, selesaikan misi seperti NASA.</p>
    <button class="primary" id="play">Main</button>
  `;
*/
  el.className = 'screen center home-container';
  el.innerHTML = `
    <img src="/assets/judul.svg" alt="Roket Geprek" class="floating-icon" />
    <button class="btn-mulai" id="btn-mulai">
      <img src="/assets/button-mulai.svg" alt="Mulai" />
    </button>
  `;
  el.querySelector('#play').onclick = () => app.go('lobby');
}
