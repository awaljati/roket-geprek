# Roket Geprek: aturan untuk Claude Code

Game edukasi misi luar angkasa untuk NASA Space Apps Challenge 2026 (challenge "Space Mission Design Game").
Desain lengkap ada di dokumen **Game Design Final – Roket Geprek**; angka ada di **Datasheet Roket Geprek**.
Kalau kode dan dokumen berbeda, dokumen yang benar: tanyakan dulu sebelum mengubah aturan game.

## Stack
- Vite + JavaScript biasa (tanpa React, tanpa TypeScript). UI = HTML/CSS di atas `<canvas>`.
- Fisika 2D di `src/engine/`. Tampilan terpisah di `src/render/` (render2d sekarang, render3d dengan Three.js nanti).
- Room dengan kode: Firebase Realtime Database + anonymous auth (`src/net/room.js`). Tanpa `.env` = mode lokal (BroadcastChannel, 2 tab).
- Deploy: Vercel dari branch `main`.

## Struktur
```
src/
  data/       angka dari datasheet (items, levels, failcodes). Jangan taruh angka game di tempat lain.
  engine/     fisika murni: tanpa DOM, tanpa Three.js
  levels/     aturan tiap level: createLevelN, stepLevelN, command, snapshotLevelN
  net/        room Navigator/Spesialis
  render/     menggambar dari snapshot saja
  screens/    layar: home, lobby, rakit, flight, spesialis, debrief
```

## Aturan penting
1. Setiap level mengembalikan hasil dengan bentuk yang sama:
   `{ success, failCode, stars, score, fuelLeft, photos }`. Debrief dan battle bergantung pada bentuk ini.
2. Navigator = host: hanya perangkat Navigator yang menjalankan fisika. Spesialis hanya mengirim perintah (`release`, `deployPanels`, `deployAntenna`, `transmit`, …) dan menerima snapshot.
3. Render hanya membaca snapshot. Jangan menaruh aturan game di `render/` atau `screens/`.
4. Kode gagal pakai daftar di `src/data/failcodes.js`. Kode baru: tambahkan di sana dan di Game Design Final.
5. Teks untuk pemain dalam bahasa Indonesia, kecuali briefing dan hint (bahasa Inggris, sesuai desain).
6. Perubahan kecil dan bisa dites: satu fitur per commit, jalankan `npm run dev` dan cek di browser sebelum push.
7. Jangan commit `.env` atau kunci Firebase.

## Status
- Sudah: Lobby (solo, buat room, gabung), Rakit Level 1, terbang ke orbit, Level 1 CubeSat lengkap, Debrief.
- Berikutnya: Level 2 (Memutari Bulan), tampilan 3D, mode battle, aset DKV menggantikan bentuk sementara.
