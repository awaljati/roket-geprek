// Daftar level. Layar memakai ini supaya tidak perlu tahu detail tiap level.
import * as L1 from './level1.js';
import * as L2 from './level2.js';
import * as L3 from './level3.js';
import * as L4 from './level4.js';
import { ITEMS } from '../data/items.js';

export const LEVEL_MODULES = {
  1: {
    create: (build) => L1.createLevel1(build),
    step: L1.stepLevel1,
    command: L1.command,
    snapshot: L1.snapshotLevel1,
    buildCheck: L1.buildCheck,
    rakitItems: ITEMS.filter((it) => it.level === 1 && it.cubesat),
    defaultBuild: { size: '1U', items: ['cs-battery', 'cs-antenna-uhf'], fuel: 0.8, assist: true },
    briefing: 'Build a CubeSat, ride a rocket to low Earth orbit, deploy safely, and send your first signal to the BRIN ground station in Biak.',
    realMission: 'CubeSat buatan kampus yang diluncurkan lewat NASA CubeSat Launch Initiative, juga Surya Satellite-1 dari Indonesia (cek ulang).',
    fact: 'Di Biak, Papua, ada stasiun bumi milik BRIN (dulu LAPAN) untuk melacak satelit, mengirim perintah, dan menerima datanya. Karena dekat khatulistiwa, satelit yang orbitnya sejajar khatulistiwa, seperti LAPAN-A2, melintas di atasnya hampir setiap putaran. Stasiun ini juga membantu memantau peluncuran roket India (ISRO).',
  },
  2: {
    create: (build, seed) => L2.createLevel2(build, seed),
    step: L2.stepLevel2,
    command: L2.command,
    snapshot: L2.snapshotLevel2,
    buildCheck: L2.buildCheck,
    rakitItems: L2.RAKIT_ITEMS,
    defaultBuild: L2.DEFAULT_BUILD,
    briefing: 'Fly around the Moon and back, like Artemis II. Your path will drift: watch the predicted trajectory and fire short correction burns to stay on course. Correct early: it costs less fuel.',
    realMission: 'Artemis II (April 2026): 4 astronaut memutari Bulan dengan lintasan free return, lalu mendarat di laut.',
  },
  3: {
    create: (build, seed) => L3.createLevel3(build, seed),
    step: L3.stepLevel3,
    command: L3.command,
    snapshot: L3.snapshotLevel3,
    buildCheck: L3.buildCheck,
    rakitItems: L3.RAKIT_ITEMS,
    defaultBuild: L3.DEFAULT_BUILD,
    briefing: 'Land near the lunar south pole, where Artemis plans to explore. There is no air to slow you down: brake your orbital speed with the engine, then descend slowly and stay upright. Touch down at 2 u/s or less.',
    realMission: 'Artemis IV (rencana 2028): pendaratan astronaut pertama program Artemis, di dekat kutub selatan Bulan, wilayah yang diduga menyimpan es air di kawah yang selalu gelap. Artemis III (2027) kini menjadi uji coba di orbit Bumi. Juga Chandrayaan-3 dari India yang mendarat di dekat kutub selatan pada 2023.',
    fact: 'Di kutub selatan Bulan ada kawah yang dasarnya tidak pernah terkena Matahari selama miliaran tahun; di sanalah es air tersimpan.',
  },
  4: {
    create: (build, seed) => L4.createLevel4(build, seed),
    step: L4.stepLevel4,
    command: L4.command,
    snapshot: L4.snapshotLevel4,
    buildCheck: L4.buildCheck,
    rakitItems: L4.RAKIT_ITEMS,
    defaultBuild: L4.DEFAULT_BUILD,
    briefing: 'Bring a rover to Mars. On the way, turn instruments off when the Specialist sees a solar storm. Before arrival, program the landing: entry angle, parachute altitude, and landing rocket altitude. Then wait through seven minutes of terror: no one can steer, the signal takes minutes to reach Earth.',
    realMission: 'Perseverance (2021) dan Curiosity (2012) dari NASA: masuk atmosfer Mars dengan pelindung panas, parasut, lalu roket pendarat "sky crane", semuanya otomatis selama "tujuh menit penuh ketegangan".',
    fact: 'Atmosfer Mars hanya sekitar 1% kepadatan atmosfer Bumi. Cukup tebal untuk membuat wahana sangat panas, tapi terlalu tipis untuk memperlambatnya dengan parasut saja, jadi dibutuhkan roket pendarat.',
  },
};

export const LAST_LEVEL = 4;
