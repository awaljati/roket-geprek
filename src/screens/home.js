export function homeScreen(app, el) {
/*  el.className = 'screen center';
  el.innerHTML = `
    <h1>Roket Geprek</h1>
    <p class="muted">Rakit wahana, terbangkan roket, selesaikan misi seperti NASA.</p>
    <button class="primary" id="play">Main</button>
  `;
*/
  el.className = 'screen center home-screen';
  el.innerHTML = `
    <img src="/assets/intro-screen.svg" alt="" class="home-bg" />
    <img src="/assets/judul.svg" alt="Roket Geprek" class="floating-icon" />
    <button class="primary" id="play">
      <img src="/assets/button-mulai.svg" alt="Mulai" />
    </button>
  `;
  el.querySelector('#play').onclick = () => app.go('lobby');
}
