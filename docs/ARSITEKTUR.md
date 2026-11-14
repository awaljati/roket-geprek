# Arsitektur

## Struktur folder

```
src/
  data/       angka game dari Datasheet: items, levels, failcodes
  engine/     hitungan murni, tanpa DOM:
                flight.js    fisika orbit Bumi (Level 1 dan peluncuran Level 2)
                cislunar.js  gravitasi Bumi-Bulan (dipakai untuk menghitung jalur Level 2)
                attitude.js  gas bertahap, arah, mode searah/lawan arah/kiri/kanan jalur
                assist.js    bantuan pilot untuk peluncuran
                rng.js       angka acak dengan seed (kejadian sama untuk semua tim battle)
  levels/     aturan tiap level dan daftar level (index.js)
  net/        room dengan kode: Firebase atau lokal (BroadcastChannel)
  render/     menggambar dari snapshot (render2d sekarang, render3d nanti)
  screens/    layar: home, lobby, rakit, flight, spesialis, debrief, kontrol
  main.js     perpindahan layar dan tombol Back
```

## Alur satu misi

```
Rakit ──build──▶ level.create(build, seed)
                      │
          setiap 1/60 detik: level.step(game, kendali, dt)
                      │
          level.snapshot(game) ──▶ render (gambar)
                      │        └─▶ room.sendState (ke HP Spesialis, ~10x per detik)
                      │
   Spesialis: room.sendCmd('photo') ──▶ level.command(game, 'photo')
                      │
          game.result ──▶ Debrief
```

## Room

- Navigator membuat kode 4 huruf dan menjadi host.
- Firebase Realtime Database: `room/<kode>/cmds` (perintah Spesialis), `room/<kode>/state` (snapshot dari Navigator), `room/<kode>/teams/<tim>/levelN` (hasil untuk mode battle).
- Tanpa `.env`, room memakai BroadcastChannel: dua tab di browser yang sama.
- Aturan keamanan database ada di `database.rules.json`.

## Model Level 2

Fisika penuh Bumi-Bulan terlalu sensitif untuk dimainkan: dorongan sangat kecil sudah mengubah sudut masuk atmosfer puluhan derajat. Karena itu Level 2 memakai:

1. **Jalur nominal:** lintasan free return hasil simulasi gravitasi Bumi-Bulan, dihitung sekali.
2. **Penyimpangan:** jarak menyamping dari jalur yang terus membesar kalau tidak dikoreksi. Nilai awalnya acak dengan seed.
3. **Koreksi (MCC):** dorongan ke kiri atau kanan jalur mengubah laju penyimpangan. Koreksi awal butuh sedikit bahan bakar, koreksi terlambat butuh jauh lebih banyak.

Jarak terdekat ke Bulan dan sudut masuk atmosfer dihitung dari penyimpangan itu dan ditampilkan ke Spesialis sebagai prediksi.
