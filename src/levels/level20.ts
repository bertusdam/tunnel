import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 20, name: 'Last Light', length: 5400, tunnelWidth: 18.7, tunnelHeight: 16,
  tunnels: [{ id: 'last-light-one', start: 0, end: 1770, style: 'neon' }, { id: 'last-light-two', start: 1934, end: 3390, style: 'metal' }, { id: 'last-light-three', start: 3554, end: 5400, style: 'wireframe' }],
  jumps: [{ launch: 1770, landing: 1934, rampSlope: 0.125 }, { launch: 3390, landing: 3554, rampSlope: 0.123 }],
  sharpTurns: [{ center: 450, length: 218, direction: -1, strength: 6.3 }, { center: 1020, length: 252, direction: 1, strength: 6.9 }, { center: 1510, length: 184, direction: -1, strength: 5.7 }, { center: 2380, length: 260, direction: 1, strength: 7.1 }, { center: 2850, length: 196, direction: -1, strength: 6.1 }, { center: 4070, length: 244, direction: 1, strength: 6.8 }, { center: 4560, length: 178, direction: -1, strength: 5.6 }, { center: 5100, length: 230, direction: 1, strength: 6.5 }],
  track: {
    curveAmplitude: [13, 21.5, 1.9, 5.1, 0.7], curveFrequency: [0.00292, 0.00336, 0.0121, 0.0102, 0.0221], curvePhase: [0.4, 1.6, 2.7, 3.8, 4.9],
    terrainAmplitude: [8.5, 1.05, 1.95, 0.38, 0.62], terrainFrequency: [0.00188, 0.0095, 0.0111, 0.0286, 0.0251], terrainPhase: [1.6, 2.7, 3.8, 4.9, 6],
    curveScale: 1.56, terrainScale: 1.26,
  },
};

export default level;