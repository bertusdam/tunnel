import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 14, name: 'Black Ice', length: 5400, tunnelWidth: 22.9, tunnelHeight: 16,
  tunnels: [{ id: 'ice-inlet', start: 0, end: 1040, style: 'neon' }, { id: 'ice-shelf', start: 1196, end: 2970, style: 'wireframe' }, { id: 'ice-canyon', start: 3126, end: 4470, style: 'metal' }, { id: 'ice-basin', start: 4626, end: 5400, style: 'neon' }],
  jumps: [{ launch: 1040, landing: 1196, rampSlope: 0.119 }, { launch: 2970, landing: 3126, rampSlope: 0.125 }, { launch: 4470, landing: 4626, rampSlope: 0.121 }],
  sharpTurns: [{ center: 730, length: 224, direction: -1, strength: 6.3 }, { center: 1890, length: 184, direction: 1, strength: 5.6 }, { center: 2520, length: 242, direction: -1, strength: 6.7 }, { center: 3670, length: 172, direction: 1, strength: 5.4 }, { center: 4100, length: 214, direction: -1, strength: 6.2 }],
  track: {
    curveAmplitude: [16, 18.1, 2.8, 4.1, 1.1], curveFrequency: [0.00274, 0.00372, 0.0109, 0.0114, 0.0207], curvePhase: [0.9, 2, 3, 4.2, 5.2],
    terrainAmplitude: [7.6, 1.45, 1.7, 0.53, 0.49], terrainFrequency: [0.00206, 0.0086, 0.0123, 0.0264, 0.0272], terrainPhase: [1.4, 2.5, 3.6, 4.8, 5.7],
    curveScale: 1.37, terrainScale: 1.18,
  },
};

export default level;