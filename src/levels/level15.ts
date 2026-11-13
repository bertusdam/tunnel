import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 15, name: 'Razor Cathedral', length: 5400, tunnelWidth: 22.2, tunnelHeight: 16,
  tunnels: [{ id: 'razor-nave', start: 0, end: 1850, style: 'metal' }, { id: 'razor-choir', start: 2006, end: 3780, style: 'neon' }, { id: 'razor-spire', start: 3936, end: 5400, style: 'wireframe' }],
  jumps: [{ launch: 1850, landing: 2006, rampSlope: 0.124 }, { launch: 3780, landing: 3936, rampSlope: 0.12 }],
  sharpTurns: [{ center: 610, length: 190, direction: 1, strength: 5.8 }, { center: 1260, length: 236, direction: -1, strength: 6.6 }, { center: 2660, length: 180, direction: 1, strength: 5.5 }, { center: 3260, length: 248, direction: -1, strength: 6.8 }, { center: 4520, length: 206, direction: 1, strength: 6 }, { center: 4930, length: 174, direction: -1, strength: 5.4 }, { center: 2220, length: 198, direction: -1, strength: 5.9 }, { center: 4180, length: 186, direction: 1, strength: 5.7 }],
  track: {
    curveAmplitude: [30, 7.2, 7.1, 1.7, 2.3], curveFrequency: [0.00198, 0.00594, 0.00765, 0.0167, 0.0169], curvePhase: [1.9, 3, 4, 5.1, 6],
    terrainAmplitude: [4.7, 3.9, 0.76, 0.93, 0.22], terrainFrequency: [0.0032, 0.00555, 0.0182, 0.019, 0.0364], terrainPhase: [2.6, 3.7, 4.8, 5.9, 0.8],
    curveScale: 1.4, terrainScale: 1.06,
  },
};

export default level;