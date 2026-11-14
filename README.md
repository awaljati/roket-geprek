# Roket Geprek

## Menjalankan

```bash
npm install
npm run dev
```

Buka alamat yang muncul (misalnya `http://localhost:5173`). `--host` sudah aktif, jadi HP di Wi-Fi yang sama bisa membuka alamat "Network".

### Tes dua peran tanpa Firebase
1. Tab 1: Main → Buat room → catat kode → Lanjut ke Rakit → Luncurkan.
2. Tab 2 (browser yang sama): Main → masukkan kode → Gabung.
3. Tab 1 menyetir (W/Spasi dorong, A/D putar), Tab 2 menekan tombol Spesialis.

### Main lintas perangkat (online)
Salin `.env.example` jadi `.env`, isi dari Firebase Console (Realtime Database + Anonymous sign-in aktif), lalu `npm run dev` lagi.

## Level 1: CubeSat Transmisi
Rakit CubeSat (1U/3U) → terbang ke cincin orbit dan tahan 3 detik → Spesialis lepas CubeSat → tunggu hitung mundur → buka panel dan antena → kirim sinyal saat lewat di atas stasiun Bumi.

## Cara kerja tim
- Branch per orang: `nama/fitur` (misal `andi/level2`), lalu Pull Request ke `main`.
- `main` selalu bisa dijalankan; Vercel deploy otomatis dari `main`.
- Angka game hanya di `src/data/`. Kalau datasheet berubah, ubah di sana.
- Pakai Claude Code: baca `CLAUDE.md` dulu, minta perubahan kecil per langkah.

## Struktur
Lihat `CLAUDE.md`.
