import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 3, name: 'Split Current', length: 5400, tunnelWidth: 30.6, tunnelHeight: 16,
  tunnels: [
    { id: 'current-one', start: 0, end: 1510, style: 'neon' },
    { id: 'current-two', start: 1658, end: 3470, style: 'wireframe' },
    { id: 'current-three', start: 3618, end: 5400, style: 'metal' },
  ],
  jumps: [{ launch: 1510, landing: 1658, rampSlope: 0.119 }, { launch: 3470, landing: 3618, rampSlope: 0.123 }],
  sharpTurns: [{ center: 680, length: 172, direction: -1, strength: 5.2 }, { center: 2820, length: 190, direction: 1, strength: 5.8 }],
  track: {
    curveAmplitude: [27, 8.5, 6, 2.2, 1.8], curveFrequency: [0.0022, 0.0052, 0.0087, 0.0142, 0.0184], curvePhase: [1.3, 2.1, 3.4, 4.5, 5.4],
    terrainAmplitude: [5.2, 2.9, 0.9, 0.72, 0.28], terrainFrequency: [0.0028, 0.0068, 0.0158, 0.0222, 0.032], terrainPhase: [2.4, 0.5, 1.6, 3.7, 4.8],
    curveScale: 1.08, terrainScale: 0.98,
  },
};

export default level;