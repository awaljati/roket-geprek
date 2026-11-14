// Disalin dari Datasheet Roket Geprek, sheet "Item". Kalau angka berubah di datasheet, ubah juga di sini.
// mass kg, price juta $, power W (+ hasil / - pakai), storeWh simpan daya, data unit (per foto/pindai atau kirim per detik game)
export const ITEMS = [
  { id: 'fuel', name: 'Bahan bakar (per 10%)', level: 1, mass: 30, price: 2, power: 0, storeWh: 0, data: 0, note: 'Di Level 1 ini bahan bakar roket, tidak dihitung ke massa CubeSat' },

  // Level 1: komponen CubeSat
  { id: 'cs-battery', name: 'Baterai CubeSat', level: 1, mass: 0.3, price: 1, power: 0, storeWh: 20, data: 0, cubesat: true },
  { id: 'cs-panel-body', name: 'Panel surya menempel', level: 1, mass: 0.1, price: 1, power: 2, storeWh: 0, data: 0, cubesat: true },
  { id: 'cs-panel-fold', name: 'Panel surya lipat', level: 1, mass: 0.3, price: 3, power: 10, storeWh: 0, data: 0, cubesat: true, deployable: true },
  { id: 'cs-antenna-uhf', name: 'Antena pita UHF', level: 1, mass: 0.1, price: 1, power: -2, storeWh: 0, data: 1, cubesat: true, deployable: true },
  { id: 'cs-antenna-s', name: 'Antena S-band', level: 1, mass: 0.2, price: 2, power: -6, storeWh: 0, data: 4, cubesat: true },

  // Level 2 ke atas
  { id: 'battery', name: 'Baterai', level: 2, mass: 20, price: 5, power: 0, storeWh: 300, data: 0 },
  { id: 'panel-s', name: 'Panel surya kecil', level: 2, mass: 10, price: 4, power: 100, storeWh: 0, data: 0, deployable: true },
  { id: 'antenna-s', name: 'Antena kecil', level: 2, mass: 5, price: 3, power: -10, storeWh: 0, data: 5 },
  { id: 'antenna-m', name: 'Antena sedang', level: 2, mass: 12, price: 8, power: -25, storeWh: 0, data: 15 },
  { id: 'camera', name: 'Kamera', level: 2, mass: 8, price: 10, power: -30, storeWh: 0, data: 10 },
  { id: 'heatshield', name: 'Pelindung panas', level: 2, mass: 80, price: 15, power: 0, storeWh: 0, data: 0 },
  { id: 'panel-l', name: 'Panel surya besar', level: 2, mass: 25, price: 10, power: 300, storeWh: 0, data: 0, deployable: true },
  { id: 'lander-engine', name: 'Mesin pendarat', level: 3, mass: 120, price: 30, power: 0, storeWh: 0, data: 0 },
  { id: 'spectrometer', name: 'Spektrometer', level: 3, mass: 15, price: 25, power: -50, storeWh: 0, data: 30 },
  { id: 'rtg', name: 'RTG', level: 3, mass: 45, price: 60, power: 110, storeWh: 0, data: 0 },
  { id: 'mars-edl', name: 'Paket Pendaratan Mars', level: 4, mass: 400, price: 120, power: 0, storeWh: 0, data: 0 },
  { id: 'antenna-l', name: 'Antena besar', level: 4, mass: 30, price: 20, power: -60, storeWh: 0, data: 40 },
  { id: 'rad-shield', name: 'Pelindung radiasi', level: 4, mass: 40, price: 15, power: 0, storeWh: 0, data: 0 },
];

export const itemById = (id) => ITEMS.find((it) => it.id === id);
