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

// Dana cadangan (juta $): didapat dari misi yang berhasil, bisa ditambahkan ke anggaran misi berikutnya.
const FUNDS = 'roket-geprek-dana';

export function getFunds() {
  try {
    return Math.max(0, Number(localStorage.getItem(FUNDS)) || 0);
  } catch (_) {
    return 0;
  }
}

function setFunds(n) {
  try {
    localStorage.setItem(FUNDS, String(Math.max(0, Math.round(n))));
  } catch (_) {}
}

export function addFunds(n) {
  setFunds(getFunds() + n);
}

// Mengurangi dana; mengembalikan jumlah yang benar-benar terpakai (tidak bisa melebihi dana yang ada).
export function spendFunds(n) {
  const used = Math.min(getFunds(), Math.max(0, n));
  setFunds(getFunds() - used);
  return used;
}
