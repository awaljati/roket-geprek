// Daftar level. Layar memakai ini supaya tidak perlu tahu detail tiap level.
import * as L1 from './level1.js';
import * as L2 from './level2.js';
import * as L3 from './level3.js';
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
    briefing: 'Build a CubeSat, ride a rocket to low Earth orbit, deploy safely, and send your first signal to a ground station.',
    realMission: 'CubeSat buatan kampus yang diluncurkan lewat NASA CubeSat Launch Initiative, juga Surya Satellite-1 dari Indonesia (cek ulang).',
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
};

export const LAST_LEVEL = 3;
