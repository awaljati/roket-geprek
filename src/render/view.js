// Memilih tampilan 2D atau 3D. Tampilan 3D dimuat terpisah; kalau gagal (WebGL tidak ada, error),
// otomatis kembali ke 2D supaya game tetap bisa dimainkan.
import { createRenderer as create2D } from './render2d.js';

const KEY = 'roket-geprek-tampilan';

export function prefers3D() {
  try {
    return localStorage.getItem(KEY) !== '2d';
  } catch (_) {
    return true;
  }
}

export function setPrefer3D(on) {
  try {
    localStorage.setItem(KEY, on ? '3d' : '2d');
  } catch (_) {}
}

// stage = elemen pembungkus yang berisi <canvas class="cv2">.
export function createView(stage, want3D = prefers3D()) {
  const c2 = stage.querySelector('canvas');
  const r2 = create2D(c2);
  let r3 = null;
  let c3 = null;
  let mode = '2d';

  const use2D = (why) => {
    if (why) console.warn('Tampilan 3D dimatikan, pakai 2D:', why);
    mode = '2d';
    if (c3) c3.style.display = 'none';
    c2.style.display = 'block';
  };

  if (want3D) {
    c3 = document.createElement('canvas');
    c3.style.display = 'none';
    stage.appendChild(c3);
    import('./render3d.js')
      .then((m) => m.createRenderer(c3))
      .then((r) => {
        if (!c3.isConnected) return r.dispose();
        r3 = r;
        mode = '3d';
        c3.style.display = 'block';
        c2.style.display = 'none';
      })
      .catch(use2D);
  }

  return {
    get mode() {
      return mode;
    },
    draw(view) {
      // Kanvas yang akan digambar ditampilkan dulu (ukurannya dibaca dari layout), lalu kanvas lain disembunyikan.
      // Semuanya dalam satu frame, jadi perpindahan 3D <-> 2D tidak pernah menampilkan layar kosong.
      if (mode === '3d') {
        c3.style.display = 'block';
        try {
          // false = tampilan ini belum ada versi 3D-nya (misalnya pendaratan Level 3): gambar dengan 2D.
          if (r3.draw(view) !== false) {
            c2.style.display = 'none';
            return;
          }
        } catch (e) {
          use2D(e);
        }
      }
      c2.style.display = 'block';
      r2.draw(view);
      if (c3) c3.style.display = 'none';
    },
    dispose() {
      if (r3) r3.dispose();
    },
  };
}
