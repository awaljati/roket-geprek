// Gambar wahana dari DKV (public/assets/wahana/), dipakai render2d dan render3d.
// Gambar roket "mati" dan "nyala" dipotong dengan kotak yang sama, jadi badan roket tidak bergeser saat api muncul.
// Ukuran dalam piksel potongan asli: lebar 872, tinggi 1496 (termasuk api), ekor roket di baris 1283.
// Kalau gambar belum termuat atau gagal, renderer memakai bentuk roket lama.
export const ROCKET_SPRITE = {
  off: '/assets/wahana/roket-mati.png',
  on: '/assets/wahana/roket-nyala.png',
  top: '/assets/wahana/roket-atas.png', // tampak atas (dari hidung), untuk kamera 3D yang melihat searah sumbu roket
  cropW: 872,
  cropH: 1496,
  tailRow: 1283,
  topAspect: 200 / 137, // lebar / tinggi gambar tampak atas
  bodyHeight: 22, // tinggi badan roket dalam satuan game (bentuk lama: 20)
};

// Ukuran gambar dalam satuan game: lebar, tinggi seluruh gambar, dan jarak ekor dari atas gambar.
export function rocketSpriteSize() {
  const s = ROCKET_SPRITE.bodyHeight / ROCKET_SPRITE.tailRow;
  return { w: ROCKET_SPRITE.cropW * s, h: ROCKET_SPRITE.cropH * s, tail: ROCKET_SPRITE.tailRow * s };
}
