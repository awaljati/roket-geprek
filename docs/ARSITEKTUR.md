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
                landerAssist.js  bantuan pilot untuk pendaratan (Level 3)
                rng.js       angka acak dengan seed (kejadian sama untuk semua tim battle)
  levels/     aturan tiap level dan daftar level (index.js)
  net/        room dengan kode: Firebase atau lokal (BroadcastChannel)
  render/     menggambar dari snapshot:
                view.js      memilih 3D atau 2D, otomatis kembali ke 2D kalau 3D gagal
                render3d.js  Three.js: planet bertekstur NASA, kamera bisa diputar
                render2d.js  canvas 2D (cadangan, lebih ringan)
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

## Model Level 3

Tampilan samping: permukaan Bulan berbukit di bawah, pendarat bergerak di bidang x (menyamping) dan y (ketinggian).

1. **Orbit datar:** permukaan dianggap datar, tapi gravitasi efektif = g × (1 − (vx / orbitSpeed)²). Pada kecepatan orbit pendarat tidak jatuh; setelah direm (deorbit) gravitasi penuh bekerja.
2. **Gravitasi:** 1/6 gravitasi permukaan Bumi game (`EARTH.gm / EARTH.radius²`). Waktu diperlambat (`timeScale`) supaya sempat bereaksi.
3. **Gas 50% = melayang** untuk massa acuan (`thrustToWeight: 2`). Pendarat yang lebih berat butuh gas lebih besar.
4. **Mendarat:** kecepatan total ≤ `maxLandingSpeed` dan miring ≤ `maxLandingTiltDeg`. Selain itu F-CRASH. Tanpa mesin pendarat: F-CRASH langsung.

5. **Titik pendaratan:** permukaan punya sepasang tempat yang berulang setiap `sitePeriod` u: *Puncak bukit* (landasan lebar, selalu di atas garis sinar Matahari, bintang maks. 2) dan *Dekat kawah gelap* (landasan setengah lebar 12 u di balik bukit kecil, dalam bayangan, di samping kawah berbibir, miring maks. 7°, bintang 3 kalau mulus). Penanda sudah terlihat sejak di orbit. Spesialis memilih dengan perintah `siteRidge` / `siteCrater`; sebelum itu mesin terkunci. Mendarat di luar titik tetap sah, bintang maks. 2.
6. **Kapan mengerem:** setelah titik dipilih, pelatih menyimulasikan pendaratan berbantuan dari beberapa jarak dan memilih titik mulai mengerem yang paling hemat bahan bakar (`burnPlan`). Pelatih menghitung mundur lalu memberi aba-aba "SEKARANG! Tekan Gas +". Kalau terlewat, penanda pindah ke pasangan berikutnya. Timeline: Pilih titik → Keluar orbit → Turun → Mendarat (`stage` di snapshot).
7. **Dekat landasan kawah:** di bawah `slowAltitude` u, waktu diperlambat (`slowFactor`) dan tampilan menggambar garis panduan tegak ke tanah.
8. **Bayangan:** Matahari rendah di kiri (`sunElevationDeg`). Level menghitung titik permukaan yang dalam bayangan dan bayangan pendarat, lalu mengirimnya di snapshot (`terrain[i].s`, `craftShadow`); tampilan menggambarnya miring dan memanjang dengan tepi lembut. Bumi kecil di cakrawala (posisi di `LEVELS[3].earth`) ada di sisi berlawanan dengan Matahari.

9. **Di permukaan** (fase `landed`, `surface.timeSec` detik layar): dekat kawah selalu bayangan (panel 0 W, perlu RTG atau baterai); di puncak bukit panel bekerja kecuali saat bayangan bukit lain lewat (`shadowPasses`, waktunya dari seed). Spesialis menyalakan/mematikan spektrometer dan antena, menekan Pindai (`scanSec`, peluang es `iceChance` per titik), dan memutar antena ke Bumi (`antennaStepDeg`, Bumi di `earth.elevationDeg`). Data terkirim hanya saat antena menyala, mengarah ke Bumi, dan baterai di atas `lowPowerShare`. Baterai habis: F-POWER. Selesai saat data penuh atau waktu habis (data sebagian: P-ANTENNA). Bintang: 1 = mendarat dan bertahan, 2 = data penuh, 3 = mulus dekat kawah + es + data penuh. `result.advice` berisi sebab dan cara memperbaiki untuk Debrief. Perintah: `spectrometerToggle`, `scan`, `antennaToggle`, `antennaLeft`, `antennaRight` (tombol 3–7).

Semua angka ada di `LEVELS[3]` (`src/data/levels.js`). Level 3 selalu memakai tampilan 2D (belum ada versi 3D).

## Tampilan 3D

- Fisika tetap 2D. `render3d.js` menaruh semua benda di bidang XY dan menampilkannya dengan kamera yang sedikit miring, jadi planet terlihat bulat.
- Tekstur dibaca dari `public/assets/textures/bumi.jpg` dan `bulan.jpg`. Kalau belum ada, planet berwarna polos.
- Roket, CubeSat, dan kapsul adalah gambar datar (sprite) yang selalu menghadap kamera.
- Pemain bisa memutar pandangan dengan mouse atau dua jari di HP. Pilihan 2D/3D ada di menu jeda dan disimpan di browser.
