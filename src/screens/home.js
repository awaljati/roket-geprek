export function homeScreen(app, el) {
  el.className = 'screen center home-screen';
  el.innerHTML = `
       <a class="btnlink"
         href="http://itb.ac.id/"
         target="_blank"
         rel="noopener noreferrer">
        <img src="/assets/kepala-ayam-icon.svg" alt="Kunjungi Kami" />
      </a>
      
    <img src="/assets/judul.svg" alt="Roket Geprek" class="floating-icon" />
    <button class="primary" id="play">
      <img src="/assets/button-mulai.svg" alt="Mulai" />
    </button>
  `;
  el.querySelector('#play').onclick = () => app.go('lobby');
}
