import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 13, name: 'Broken Halo', length: 5400, tunnelWidth: 23.6, tunnelHeight: 16,
  tunnels: [{ id: 'halo-west', start: 0, end: 1620, style: 'wireframe' }, { id: 'halo-east', start: 1774, end: 3940, style: 'metal' }, { id: 'halo-return', start: 4094, end: 5400, style: 'neon' }],
  jumps: [{ launch: 1620, landing: 1774, rampSlope: 0.123 }, { launch: 3940, landing: 4094, rampSlope: 0.12 }],
  sharpTurns: [{ center: 540, length: 184, direction: 1, strength: 5.6 }, { center: 1180, length: 212, direction: -1, strength: 6.1 }, { center: 2540, length: 176, direction: 1, strength: 5.4 }, { center: 3270, length: 238, direction: -1, strength: 6.6 }, { center: 4700, length: 194, direction: 1, strength: 5.9 }, { center: 5080, length: 168, direction: -1, strength: 5.3 }, { center: 2200, length: 182, direction: -1, strength: 5.5 }],
  track: {
    curveAmplitude: [29, 8.1, 6.5, 2.4, 1.5], curveFrequency: [0.00202, 0.00578, 0.0079, 0.0162, 0.0173], curvePhase: [5.5, 0.4, 1.5, 2.6, 3.6],
    terrainAmplitude: [4.9, 3.7, 0.88, 0.86, 0.27], terrainFrequency: [0.00312, 0.0057, 0.0178, 0.0195, 0.0358], terrainPhase: [0.5, 1.5, 2.7, 3.8, 4.9],
    curveScale: 1.34, terrainScale: 1.04,
  },
};

export default level;