import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 8, name: 'Glass Needle', length: 5400, tunnelWidth: 27.1, tunnelHeight: 16,
  tunnels: [{ id: 'needle-approach', start: 0, end: 1280, style: 'wireframe' }, { id: 'glass-chamber', start: 1428, end: 3370, style: 'neon' }, { id: 'needle-return', start: 3518, end: 5400, style: 'metal' }],
  jumps: [{ launch: 1280, landing: 1428, rampSlope: 0.123 }, { launch: 3370, landing: 3518, rampSlope: 0.119 }],
  sharpTurns: [{ center: 720, length: 194, direction: -1, strength: 5.8 }, { center: 2310, length: 170, direction: 1, strength: 5.4 }, { center: 4180, length: 218, direction: -1, strength: 6.2 }],
  track: {
    curveAmplitude: [20, 14.1, 4.2, 3.4, 1.5], curveFrequency: [0.00258, 0.00428, 0.0091, 0.0129, 0.0193], curvePhase: [0.7, 1.8, 2.9, 4, 5.3],
    terrainAmplitude: [6.6, 2.5, 0.82, 0.77, 0.29], terrainFrequency: [0.00232, 0.00785, 0.01345, 0.0246, 0.0335], terrainPhase: [1.7, 2.6, 4, 5.1, 0.1],
    curveScale: 1.2, terrainScale: 1.1,
  },
};

export default level;