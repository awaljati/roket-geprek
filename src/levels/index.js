// Daftar level. Layar memakai ini supaya tidak perlu tahu detail tiap level.
import * as L1 from './level1.js';
import * as L2 from './level2.js';
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
};

export const LAST_LEVEL = 2;
