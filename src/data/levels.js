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

export const LEVELS = {
  1: {
    name: 'Level 1: CubeSat Transmisi',
    rocket: 'kecil',
    budget: 30,
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
    budget: 90,
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
  3: { name: 'Level 3: Kutub Selatan Bulan', rocket: 'sedang', budget: 160, body: 'Pendarat', orbitHoldSec: 3, minFuelFor3Stars: 0.2, maxLandingSpeed: 2 },
  4: { name: 'Level 4: Mendarat di Mars', rocket: 'besar', budget: 260, body: 'Rover', minFuelFor3Stars: 0.15, photoTarget: 1 },
};
