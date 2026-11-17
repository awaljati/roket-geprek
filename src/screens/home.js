import '@fontsource/londrina-solid/900.css';

export function homeScreen(app, el) {
  el.className = 'screen center home-screen';
  el.innerHTML = `
       <a class="btnlink"
         href="https://www.instagram.com/roketgeprek.studio/"
         target="_blank"
         rel="noopener noreferrer"
         title="Instagram @roketgeprek.studio">
        <img src="/assets/ui/kepala-ayam.webp" alt="Instagram Roket Geprek (@roketgeprek.studio)" />
      </a>
      
    <img src="/assets/ui/judul.webp" alt="Roket Geprek" class="floating-icon" />
    <button class="tombol-biru" id="play">MULAI</button>
  `;
  el.querySelector('#play').onclick = () => app.go('lobby');
}
