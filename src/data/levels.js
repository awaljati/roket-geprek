// Disalin dari Datasheet Roket Geprek, sheet "Level" dan "Roket dan Wahana".
export const ROCKETS = {
  kecil: { capacityKg: 450 },
  sedang: { capacityKg: 1500 },
  besar: { capacityKg: 2500 },
};

// Badan wahana dasar (sheet "Roket dan Wahana").
export const BODIES = {
  Kapsul: { mass: 600, basePower: -80 },
  Pendarat: { mass: 350, basePower: -60 },
  Rover: { mass: 900, basePower: -100 },
};

// Ukuran CubeSat (Level 1). Batas massa = batas bar Massa di layar Rakit.
export const CUBESAT_SIZES = {
  '1U': { bodyMass: 0.8, massLimit: 2, slots: 2, basePower: -1 },
  '3U': { bodyMass: 2.5, massLimit: 6, slots: 4, basePower: -3 },
  '6U': { bodyMass: 5, massLimit: 12, slots: 6, basePower: -6, optional: true },
};

// Lokasi landasan peluncuran. Biak dekat khatulistiwa dan pernah direncanakan LAPAN/BRIN sebagai bandar antariksa.
export const LAUNCH_SITE = { name: 'Biak, Papua', lat: -1.17, lon: 136.08 };

// Dana misi: misi yang sukses dan hemat mendapat dana, yang bisa ditambahkan ke anggaran misi berikutnya.
// Nilai game (juta $), perlu balancing.
export const REWARD = {
  perStar: 6, // dana per bintang
  savingsShare: 0.5, // setengah sisa anggaran ikut jadi dana
  orbitBonus: 3, // Level 1: orbit tepat (sesuai syarat bintang 3)
  photoBonus: 5, // Level 2: foto berguna mencapai target
  maxExtraShare: 0.5, // dana cadangan yang boleh dipakai maksimal 50% dari anggaran level
};

export const LEVELS = {
  1: {
    name: 'Level 1: CubeSat Transmisi',
    rocket: 'kecil',
    budget: 22,
    body: 'CubeSat',
    orbitHoldSec: 3,
    minFuelFor3Stars: 0.3,
    orbitAccuracyFor3StarsPct: 4, // bintang 3: saat masuk cincin, ketinggian dan kecepatan meleset maksimal 4%
    launchTimeScale: 0.45, // naik ke orbit diperlambat (1 = normal)
    orbitTimeScale: 0.35, // gerak di orbit diperlambat: satu putaran sekitar 40 detik
    // waktu game (sudah dipercepat dari aslinya)
    safeCountdownSec: 10, // asli ~30 menit
    // Stasiun Bumi: letaknya ikut berputar bersama Bumi. CubeSat bisa mengirim data hanya saat
    // berada di atas wilayah jangkauan antena stasiun (dihitung dari posisi, bukan jadwal).
    stationOffsetDeg: 45, // posisi stasiun: 45° di timur landasan
    stationCoverageDeg: 50, // lebar jangkauan ke tiap sisi (tidak sesuai skala; aslinya lebih sempit)
    dataForFullSignal: 10,
    hint: 'Wait for the countdown before opening anything, then transmit only while you are over the ground station.',
  },
  2: {
    name: 'Level 2: Memutari Bulan',
    rocket: 'sedang',
    budget: 60,
    body: 'Kapsul',
    minFuelFor3Stars: 0.25,
    photoTarget: 6,
    // Nilai game (bukan skala asli), perlu balancing:
    capsuleAccel: 2, // u/s^2 saat gas penuh (mesin modul servis)
    fuelBurnPerSec: 0.2, // fraksi bahan bakar per detik saat gas penuh
    driftOut: [0.9, 1.4], // penyimpangan awal (u/s), arah acak dari seed
    driftBack: [0.45, 0.75], // penyimpangan baru setelah melewati Bulan
    mccWindows: [
      { id: 'MCC-1', from: 3, to: 16 },
      { id: 'MCC-2', from: 24, to: 34 },
      { id: 'MCC pulang', from: 52, to: 78 },
    ],
    flybyTarget: [15, 70], // jarak terdekat ke permukaan Bulan (u) yang aman dan bagus untuk foto
    photoRange: 180, // jarak (u dari permukaan) mulai bisa memotret
    photoPointTolDeg: 25,
    entryCorridorDeg: [-10.5, -5.5], // sudut masuk atmosfer yang aman
    shieldPointTolDeg: 35, // pelindung panas harus menghadap arah gerak
    uPerKm: 1 / 51, // 1 u = 51 km (radius Bulan 34 u = 1.737 km)
    hint: 'Correct early: small burns at MCC-1 save fuel. Point the capsule toward the Moon for photos, and keep the heat shield forward (E) during entry.',
  },
  3: {
    name: 'Level 3: Kutub Selatan Bulan',
    rocket: 'sedang',
    budget: 100,
    body: 'Pendarat',
    orbitHoldSec: 3,
    minFuelFor3Stars: 0.2,
    maxLandingSpeed: 2, // u/s, kecepatan total saat menyentuh permukaan
    // Nilai game (bukan skala asli), perlu balancing:
    requiredItem: 'lander-engine', // tanpa mesin pendarat: F-CRASH
    // Fase awal: peluncuran dari Biak ke orbit parkir (seperti Level 2), perjalanan otomatis ke Bulan,
    // lalu masuk orbit polar Bulan (LOI). Bahan bakar roket terpisah dari bahan bakar pendarat (slider Rakit):
    // roket dipakai untuk peluncuran dan LOI, pendarat untuk turun ke permukaan.
    tliSpeed: 105, // u/s saat berangkat dari orbit parkir; sudut berangkat dihitung supaya lewat tepat di cincin Bulan
    moonSoiRadius: 250, // u dari pusat Bulan: di dalam jarak ini hanya gravitasi Bulan yang dihitung
    moonOrbitRadius: 58, // cincin orbit polar Bulan (u dari pusat Bulan; permukaan di 34)
    moonOrbitRadiusTol: 8, // u
    moonOrbitSpeedTol: 0.1, // 10% dari kecepatan orbit lingkaran
    moonOrbitRadialTol: 6, // u/s kecepatan naik/turun yang masih dianggap datar
    loiAccel: 25, // u/s^2 saat gas penuh (massa acuan); lebih berat = lebih lemah
    loiFuelBurnPerSec: 0.2, // fraksi bahan bakar roket per detik game saat gas penuh
    loiTimeScale: 0.5, // dekat Bulan waktu diperlambat supaya sempat bereaksi
    loiMaxSec: 40, // detik game sejak masuk wilayah Bulan; belum masuk cincin = F-ORBIT
    loiCountdownSec: 3, // hitung mundur sebelum aba-aba mengerem (detik layar)
    loiReactSec: 0.5, // aba-aba diberikan sekian detik layar lebih awal (waktu reaksi dan menaikkan gas)
    captureShowSec: 2, // jeda setelah masuk orbit sebelum pindah ke tampilan pilih titik (detik layar)
    moonGravityShare: 1 / 6, // gravitasi Bulan = 1/6 gravitasi Bumi game
    timeScale: 0.5, // pendaratan diperlambat (1 = normal)
    startAltitude: 300, // u di atas permukaan rata-rata
    orbitSpeed: 40, // u/s menyamping: pada kecepatan ini pendarat "mengorbit" (tidak jatuh)
    thrustToWeight: 2, // gas penuh = 2x berat di Bulan, jadi gas 50% = melayang (untuk massa acuan)
    refMassKg: 800, // massa acuan; lebih berat = dorongan terasa lebih lemah
    fuelBurnPerSec: 0.035, // fraksi bahan bakar per detik game saat gas penuh
    turnRate: 1.6, // rad/s
    maxLandingTiltDeg: 10, // "hampir tegak"
    landedHoldSec: 1.5, // jeda setelah mendarat sebelum Debrief
    terrain: [
      // bukit: amplitudo (u) dan panjang gelombang (u)
      [16, 520],
      [7, 190],
      [2.5, 70],
    ],
    // Matahari di kutub selatan selalu rendah (aslinya ~1,5°), jadi bayangan sangat panjang.
    sunElevationDeg: 4,
    shadowLookback: 600, // u ke arah Matahari yang diperiksa untuk bayangan
    // Bumi kecil di cakrawala, di sisi berlawanan dengan Matahari (Matahari di kiri).
    // xFrac = posisi mendatar di layar (0 = kiri, 1 = kanan), elevationDeg = tinggi di atas cakrawala.
    earth: { xFrac: 0.86, elevationDeg: 8, radiusPx: 9 },
    // Titik pendaratan: sepasang (puncak bukit + dekat kawah) berulang setiap sitePeriod u.
    // Pasangan dipilih Spesialis saat masih di orbit; mesin terkunci sampai ada pilihan.
    pickLeadU: 360, // saat mulai: titik mulai mengerem pasangan pertama minimal sejauh ini di depan pendarat
    pickMinLeadU: 60, // belum memilih dan titik mulai mengerem tinggal sedekat ini: pakai pasangan berikutnya
    burnWindowU: 20, // aba-aba "SEKARANG!" selama pendarat sejauh ini dari titik mulai mengerem
    burnCountdownSec: 3, // hitung mundur sebelum aba-aba (detik layar)
    deorbitDoneShare: 0.5, // "Keluar orbit" selesai saat kecepatan menyamping < 50% kecepatan orbit
    sitePeriod: 300, // semua bentuk satu pasangan harus muat dalam satu periode
    sitePhase: 180, // posisi puncak bukit pertama
    outsideMaxStars: 2, // mendarat di luar kedua titik: sah, tapi bintang maksimal 2
    smoothLandingSpeed: 1.5, // u/s, "mulus" untuk bintang 3 di dekat kawah
    sites: {
      ridge: {
        name: 'Puncak bukit',
        about: 'Medan landai, hampir selalu terang, sedikit es.',
        ice: 'sedikit',
        halfWidth: 18, // lebar landasan datar ke tiap sisi (u)
        ramp: 40, // lereng dari landasan ke medan sekitar (u)
        raise: 8, // landasan lebih tinggi dari bukit sekitar (u)
        maxTiltDeg: 10,
        maxStars: 2,
      },
      crater: {
        name: 'Dekat kawah gelap',
        about: 'Medan sempit, harus lebih tegak, sering dalam bayangan, banyak es.',
        ice: 'banyak',
        offset: 130, // jarak dari puncak bukit (u)
        halfWidth: 12,
        ramp: 10,
        maxTiltDeg: 7,
        maxStars: 3,
        craterRadius: 30, // kawah di sebelah kanan landasan (jauh dari Matahari)
        craterGap: 10, // jarak tepi landasan ke bibir kawah (u)
        craterDepth: 30,
        lipHeight: 3, // bibir kawah (u)
        lipWidth: 4,
        // Dekat landasan ini, di bawah slowAltitude u: waktu diperlambat dan ada garis panduan ke tanah.
        slowAltitude: 60,
        slowNearU: 30, // jarak menyamping dari tepi landasan
        slowFactor: 0.5,
        rimOffset: -50, // bukit di sisi Matahari yang membuat landasan sering dalam bayangan
        rimHeight: 12,
        rimWidth: 20,
      },
    },
    // Setelah mendarat (fase 5–6): daya, pindai es, kirim data. Nilai game, perlu balancing.
    surface: {
      timeSec: 60, // waktu di permukaan (detik layar)
      landerBatteryWh: 40, // baterai kecil bawaan pendarat (ditambah storeWh item baterai)
      whPerWattSec: 0.06, // Wh per watt per detik layar (waktu dipercepat), seperti WH_PER_WATT_SECOND Level 2
      lowPowerShare: 0.1, // di bawah 10% baterai antena tidak bisa mengirim ("daya kurang")
      // Bayangan bukit lain yang sesekali lewat di puncak bukit (waktunya dari seed)
      shadowPasses: 2,
      shadowSec: [8, 12], // lama satu bayangan
      shadowStartSec: [6, 48], // kapan bayangan mulai (setelah mendarat)
      shadowWarnSec: 4, // pelatih memberi tahu sekian detik sebelumnya
      scanSec: 5, // lama memindai dengan spektrometer menyala
      iceChance: { crater: 0.9, ridge: 0.2, outside: 0.1 }, // peluang es terdeteksi per pindaian
      dataTarget: 100, // unit data yang harus terkirim (antena mengirim `data` unit per detik)
      antennaStartDeg: 90, // 0 = cakrawala kanan, 90 = tegak ke atas, 180 = cakrawala kiri
      antennaStepDeg: 3, // satu perintah putar (tombol ditahan = perintah berulang)
      // Kekuatan sinyal: 100% tepat ke Bumi (earth.elevationDeg), turun lurus, 0% kalau selisih > signalZeroDeg.
      signalZeroDeg: 30,
      minSignal: 0.7, // data terkirim hanya kalau sinyal ≥ 70%; kecepatan = data antena × kekuatan sinyal
    },
    hint: 'Pick a landing site early, slide over it while still high, then descend slowly and upright. Gas 50% holds your descent speed; 75% slows you down. On the surface: turn the spectrometer off after scanning, and point the antenna low toward Earth on the right horizon. 3 stars: smooth landing near the dark crater, ice found, all data sent.',
  },
  4: {
    name: 'Level 4: Mendarat di Mars',
    rocket: 'besar',
    budget: 190,
    body: 'Rover',
    minFuelFor3Stars: 0.15,
    photoTarget: 1,
    orbitHoldSec: 3,
    requiredItem: 'mars-edl', // tanpa Paket Pendaratan Mars: F-ATMO
    // Nilai game (bukan skala asli), perlu balancing:
    cruiseSec: 40, // perjalanan ke Mars (detik layar, bisa dipercepat); aslinya ~7 bulan
    // Badai matahari: waktunya dari seed (sama untuk semua tim battle). Rentang mulai dibagi rata per badai.
    storms: { count: 2, startSec: [10, 34], durationSec: [4, 6], warnSec: 8 },
    // Program pendaratan (waktu berhenti). Nilai awal sengaja di luar rentang aman supaya harus diatur.
    entry: { safeDeg: [-16, -11], startDeg: -8, minDeg: -25, maxDeg: -4, stepDeg: 0.5 },
    chute: { safeKm: [7, 13], startKm: 16, minKm: 3, maxKm: 20, stepKm: 0.5 },
    retro: { safeKm: [1, 2.5], startKm: 0.5, minKm: 0.25, maxKm: 4, stepKm: 0.25 },
    // "Tujuh menit penuh ketegangan" (waktu game dalam detik, dipercepat edlTimeScale kali di layar)
    edl: {
      totalSec: 420, // 7 menit dari masuk atmosfer sampai menyentuh tanah
      timeScale: 20, // 420 detik game = 21 detik layar
      entryKm: 125, // ketinggian mulai masuk atmosfer
      chuteAtSec: 240, // parasut dibuka sekitar menit ke-4
      peakHeatSec: 80,
      retroDescentMs: 30, // kecepatan rata-rata saat roket pendarat menyala (m/s), menentukan lama fase terakhir
      signalDelayMin: 11, // jeda sinyal Mars-Bumi saat itu (berubah 4-24 menit sesuai jarak)
    },
    // Bahan bakar roket pendarat (slider Rakit): dipakai = (base + perKm × ketinggian menyala) × massa/refMassKg.
    // Roket pendarat paket EDL hanya bisa menyala selama turun retro.safeKm[1] km; menyala lebih tinggi = habis di udara.
    retroFuel: { base: 0.15, perKm: 0.1, refMassKg: 1600 },
    landedHoldSec: 1.5,
    // Di permukaan: foto pertama dikirim lewat antena besar. Panel surya di Mars hanya 40% (lebih jauh dari Matahari, debu).
    surface: {
      timeSec: 40, // waktu untuk menekan Kirim foto (detik layar)
      photoSec: 10, // lama mengirim foto
      solarShare: 0.4,
      roverBatteryWh: 40, // baterai kecil bawaan rover (ditambah storeWh item baterai)
      whPerWattSec: 0.25, // Wh per watt per detik layar (waktu dipercepat)
      photoAntenna: 'antenna-l', // antena lain hanya bisa mengirim sebagian (data / data antena besar)
    },
    hint: 'Turn instruments off when the Specialist sees a solar storm, then back on. Program the landing inside the safe ranges: entry -16° to -11°, parachute 7-13 km, landing rockets 1-2.5 km. Bring the large antenna and enough power (solar panels give only 40% on Mars).',
  },
};
