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
3. Tab 1 menyetir, Tab 2 menekan tombol Spesialis.

### Kontrol Navigator (cukup diketuk, tidak perlu ditahan)
| Tombol | Fungsi |
|---|---|
| W / S | gas naik / turun 25% |
| Spasi | mesin nyala / mati |
| X | matikan mesin |
| F | dorongan pendek (koreksi kecil) |
| A / D | putar 15° |
| Q | arahkan searah gerak |
| E | arahkan lawan arah gerak |

Cara cepat masuk orbit: gas penuh (W 4x), setelah naik sedikit putar D 5x lalu Q, matikan mesin (X) saat "Titik tertinggi" ✓, lalu saat hampir di puncak nyalakan gas lagi sampai kecepatan ✓.

### Main lintas perangkat (online)
Salin `.env.example` jadi `.env`, isi dari Firebase Console (Realtime Database + Anonymous sign-in aktif), lalu `npm run dev` lagi.

## Level 1: CubeSat Transmisi
Rakit CubeSat (1U/3U) → terbang ke cincin orbit dan tahan 3 detik → Spesialis lepas CubeSat → tunggu hitung mundur → buka panel dan antena → kirim sinyal saat lewat di atas stasiun Bumi.

## Level 2: Memutari Bulan
Rakit kapsul (wajib kamera dan pelindung panas) → tekan W untuk berangkat → garis putus-putus = prediksi, garis hijau = target free return → di jendela MCC putar ke kiri/kanan jalur (Z/C) dan dorong sampai prediksi pas → dekat Bulan arahkan kapsul ke Bulan, Spesialis memotret (tombol 2) → MCC pulang untuk sudut masuk atmosfer → saat masuk atmosfer tekan E (pelindung panas di depan). Koreksi lebih awal = lebih hemat bahan bakar. T = percepat waktu.

## Cara kerja tim
- Branch per orang: `nama/fitur` (misal `andi/level2`), lalu Pull Request ke `main`.
- `main` selalu bisa dijalankan; Vercel deploy otomatis dari `main`.
- Angka game hanya di `src/data/`. Kalau datasheet berubah, ubah di sana.
- Pakai Claude Code: baca `CLAUDE.md` dulu, minta perubahan kecil per langkah.

## Struktur
Lihat `CLAUDE.md`.
