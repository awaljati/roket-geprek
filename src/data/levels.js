// Disalin dari Datasheet Roket Geprek, sheet "Level" dan "Roket dan Wahana".
export const ROCKETS = {
  kecil: { capacityKg: 450 },
  sedang: { capacityKg: 1500 },
  besar: { capacityKg: 2500 },
};

// Ukuran CubeSat (Level 1). Batas massa = batas bar Massa di layar Rakit.
export const CUBESAT_SIZES = {
  '1U': { bodyMass: 0.8, massLimit: 2, slots: 2, basePower: -1 },
  '3U': { bodyMass: 2.5, massLimit: 6, slots: 4, basePower: -3 },
  '6U': { bodyMass: 5, massLimit: 12, slots: 6, basePower: -6, optional: true },
};

export const LEVELS = {
  1: {
    name: 'Level 1: CubeSat Transmisi',
    rocket: 'kecil',
    budget: 30,
    body: 'CubeSat',
    orbitHoldSec: 3,
    minFuelFor3Stars: 0.3,
    // waktu game (sudah dipercepat dari aslinya)
    safeCountdownSec: 10, // asli ~30 menit
    passWindowSec: 20, // asli ~5-10 menit
    nextPassSec: 30, // asli ~90 menit per putaran
    dataForFullSignal: 10,
    hint: 'Wait for the countdown before opening anything, then transmit only while you are over the ground station.',
  },
  2: { name: 'Level 2: Memutari Bulan', rocket: 'sedang', budget: 90, body: 'Kapsul', minFuelFor3Stars: 0.25, photoTarget: 6 },
  3: { name: 'Level 3: Kutub Selatan Bulan', rocket: 'sedang', budget: 160, body: 'Pendarat', orbitHoldSec: 3, minFuelFor3Stars: 0.2, maxLandingSpeed: 2 },
  4: { name: 'Level 4: Mendarat di Mars', rocket: 'besar', budget: 260, body: 'Rover', minFuelFor3Stars: 0.15, photoTarget: 1 },
};
