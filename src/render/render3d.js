// Tampilan 3D (Three.js). BELUM DIBUAT: tugas programmer setelah render2d jalan.
// Harus punya bentuk yang sama dengan render2d: createRenderer(canvas) -> { draw(view) }.
//
// Rencana:
// - Bumi/Bulan/Mars = THREE.SphereGeometry + tekstur NASA equirectangular (sheet "Aset NASA").
// - Roket dan wahana = sprite 2D (THREE.Sprite) yang selalu menghadap kamera, posisi dari view.flight.x / y (z = 0).
// - Cincin orbit dan jejak = THREE.Line di bidang z = 0.
// - Kamera dikunci dari atas saat menyetir; OrbitControls hanya saat jeda atau menonton.
// - Fisika tetap 2D di engine/flight.js. File ini hanya menggambar.
//
// Cara pindah ke 3D: di screens/flight.js ganti import render2d.js -> render3d.js.

export async function createRenderer(canvas) {
  const THREE = await import('three');
  void THREE;
  throw new Error('render3d belum dibuat, pakai render2d dulu');
}
