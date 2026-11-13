import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 2, name: 'First Apex', length: 5400, tunnelWidth: 31.3, tunnelHeight: 16,
  tunnels: [
    { id: 'amber-run', start: 0, end: 1120, style: 'metal' },
    { id: 'apex-gallery', start: 1264, end: 5400, style: 'neon' },
  ],
  jumps: [{ launch: 1120, landing: 1264, rampSlope: 0.121 }],
  sharpTurns: [{ center: 740, length: 178, direction: 1, strength: 5.4 }],
  track: {
    curveAmplitude: [22, 13, 5.2, 2.7, 1.6], curveFrequency: [0.00235, 0.0048, 0.0092, 0.0137, 0.0171], curvePhase: [0.6, 1.2, 2.6, 3.3, 4.1],
    terrainAmplitude: [6.4, 2.1, 1.4, 0.65, 0.32], terrainFrequency: [0.0026, 0.0071, 0.015, 0.023, 0.031], terrainPhase: [1.1, 2.2, 3.5, 4.1, 5.2],
    curveScale: 1.06, terrainScale: 1.03,
  },
};

export default level;