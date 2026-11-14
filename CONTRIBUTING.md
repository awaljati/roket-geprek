# Panduan Kontribusi

Panduan singkat supaya kerja lima orang di satu repo tetap rapi.

## Alur kerja

1. Ambil versi terbaru: `git checkout main && git pull`.
2. Buat branch untuk satu fitur: `git checkout -b <nama>/<fitur>`, misalnya `rina/ui-lobby` atau `andi/level3`.
3. Buat perubahan kecil, lalu jalankan `npm run dev` dan cek di browser.
4. Commit dengan pesan yang menjelaskan apa yang berubah, misalnya `Rakit: tampilkan alasan tombol Luncurkan tidak aktif`.
5. `git push -u origin <nama>/<fitur>`, lalu buka Pull Request ke `main`.
6. Minta satu anggota lain mencoba link preview Vercel di PR, lalu merge.

`main` harus selalu bisa dimainkan, karena Vercel otomatis deploy dari `main`.

## Aturan kode

1. **Angka game hanya di `src/data/`.** Nilainya disalin dari Datasheet Roket Geprek. Kalau datasheet berubah, ubah di sini juga.
2. **Hasil setiap level berbentuk sama:** `{ success, failCode, stars, score, fuelLeft, photos }`. Debrief dan mode battle bergantung pada bentuk ini.
3. **Navigator adalah host.** Hanya perangkat Navigator yang menjalankan fisika. Spesialis mengirim perintah (`release`, `deployPanels`, `photo`, …) dan menerima snapshot.
4. **Tampilan hanya membaca snapshot.** Aturan game ada di `src/levels/`, tidak di `src/render/` atau `src/screens/`.
5. **Kode gagal** ada di `src/data/failcodes.js`. Kode baru ditambahkan di sana dan di Game Design Final.
6. **Bahasa:** teks untuk pemain dalam bahasa Indonesia, kecuali briefing dan hint (bahasa Inggris, sesuai desain).
7. **Jangan commit `.env`** atau kunci apa pun.

## Menambah level

1. Buat `src/levels/levelN.js` dengan fungsi yang sama seperti `level2.js`: `createLevelN`, `stepLevelN`, `command`, `snapshotLevelN`, `buildCheck`.
2. Tambahkan angka levelnya di `src/data/levels.js`.
3. Daftarkan di `src/levels/index.js` (dan naikkan `LAST_LEVEL`).
4. Kalau butuh tampilan baru, tambahkan di `src/render/render2d.js` berdasarkan `view.level`.
5. Kalau Spesialis butuh tombol baru, tambahkan panelnya di `src/screens/specialistPanel.js`.

## Dokumen terkait

- [docs/ARSITEKTUR.md](docs/ARSITEKTUR.md): struktur kode dan cara kerja room
- [docs/SETUP-ONLINE.md](docs/SETUP-ONLINE.md): Firebase dan Vercel
- Game Design Final dan Datasheet Roket Geprek (dokumen tim): sumber kebenaran untuk aturan dan angka game. Kalau kode dan dokumen berbeda, dokumen yang benar.
