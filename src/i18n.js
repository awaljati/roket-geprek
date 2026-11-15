// Pilihan bahasa (Indonesia / Inggris) di lapisan tampilan.
// Logika game dan semua teks sumber tetap bahasa Indonesia. Saat bahasa Inggris dipilih, teks yang tampil
// (DOM dan tulisan di kanvas 2D) diterjemahkan lewat kamus di i18n-en.js. Kalimat yang belum ada di kamus
// tetap tampil dalam bahasa Indonesia, jadi game tidak pernah rusak karena terjemahan.
import { DICT, RULES, WORDS } from './i18n-en.js';

const KEY = 'roket-geprek-bahasa';

export function getLang() {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'id';
  } catch (_) {
    return 'id';
  }
}

// Ganti bahasa lalu muat ulang halaman (paling sederhana dan pasti konsisten).
export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang === 'en' ? 'en' : 'id');
  } catch (_) {}
  location.reload();
}

const NUM = /\d+(?:[.,]\d+)*/g;
const SEP = /( · | \| | — |\n)/;
const cache = new Map();

// Cocokkan persis, lalu dengan angka diganti '#' (angka dimasukkan lagi sesuai urutan).
function lookup(s) {
  if (Object.prototype.hasOwnProperty.call(DICT, s)) return DICT[s];
  const nums = s.match(NUM);
  if (!nums) return null;
  const key = s.replace(NUM, '#');
  if (!Object.prototype.hasOwnProperty.call(DICT, key)) return null;
  let i = 0;
  return DICT[key].replace(/#/g, () => nums[i++] ?? '');
}

function rule(s) {
  for (const [re, out] of RULES) {
    const m = s.match(re);
    if (m) return typeof out === 'function' ? out(m, piece) : s.replace(re, out);
  }
  return null;
}

// Satu potong teks: coba utuh, tanpa tanda baca di ujung, tanpa simbol di depan, lalu aturan pola.
function piece(p) {
  const m = p.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = m[2];
  if (!core || !/[A-Za-z]/.test(core)) return p;
  let r = lookup(core) ?? rule(core);
  if (r == null) {
    const t = core.match(/^([\s\S]*?)([.:!?…]+)$/);
    if (t) {
      const x = lookup(t[1]) ?? rule(t[1]);
      if (x != null) r = x + t[2];
    }
  }
  if (r == null) {
    const h = core.match(/^([^A-Za-z0-9]+)([\s\S]+)$/);
    if (h) {
      const x = piece(h[2]);
      if (x !== h[2]) r = h[1] + x;
    }
  }
  if (r == null && Object.prototype.hasOwnProperty.call(WORDS, core.toLowerCase())) r = WORDS[core.toLowerCase()];
  return r == null ? p : m[1] + r + m[3];
}

function split(s, re) {
  const parts = s.split(re);
  if (parts.length < 2) return null;
  let any = false;
  const out = parts.map((p, i) => {
    if (i % 2 === 1) return p;
    const t = piece(p);
    if (t !== p) any = true;
    return t;
  });
  return any ? out.join('') : null;
}

export function tr(text) {
  return getLangCached === 'en' && text ? translate(text) : text;
}

// Terjemahan tanpa melihat bahasa yang dipilih (dipakai tr dan alat cek kamus).
export function translate(text) {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  let out = piece(text);
  if (out === text) out = split(text, SEP) ?? split(text, /((?<=[.!?:])\s+)/) ?? text;
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}

let getLangCached = 'id';

// Dipanggil sekali saat game dibuka.
export function startI18n() {
  getLangCached = getLang();
  if (getLangCached !== 'en') return;
  document.documentElement.lang = 'en';
  const done = new WeakMap();
  const fix = (n) => {
    const v = n.nodeValue;
    if (!v || done.get(n) === v || !/[A-Za-z]/.test(v)) return;
    const t = tr(v);
    if (t !== v) n.nodeValue = t;
    done.set(n, n.nodeValue);
  };
  const attrs = (el) => {
    for (const a of ['placeholder', 'title', 'aria-label']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) {
        const t = tr(v);
        if (t !== v) el.setAttribute(a, t);
      }
    }
  };
  const walk = (root) => {
    if (root.nodeType === 3) return fix(root);
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) fix(n);
    attrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(attrs);
  };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') fix(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  walk(document.body);
}

// Kanvas 2D: tulisan yang digambar ikut diterjemahkan.
export function translateCanvas(ctx) {
  if (getLang() !== 'en') return;
  const draw = ctx.fillText.bind(ctx);
  ctx.fillText = (t, ...rest) => draw(tr(String(t)), ...rest);
}
