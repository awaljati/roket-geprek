// Bintang terbaik per level, disimpan di browser pemain (hanya untuk tampilan di Pilih Level).
const KEY = 'roket-geprek-bintang';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (_) {
    return {};
  }
}

export function bestStars(level) {
  return load()[level] || 0;
}

export function saveStars(level, stars) {
  const all = load();
  if ((all[level] || 0) >= stars) return;
  all[level] = stars;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (_) {}
}
