import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 11, name: 'Obsidian Coil', length: 5400, tunnelWidth: 25, tunnelHeight: 16,
  tunnels: [{ id: 'coil-upper', start: 0, end: 1330, style: 'metal' }, { id: 'coil-throat', start: 1482, end: 3490, style: 'neon' }, { id: 'coil-lower', start: 3642, end: 5400, style: 'wireframe' }],
  jumps: [{ launch: 1330, landing: 1482, rampSlope: 0.121 }, { launch: 3490, landing: 3642, rampSlope: 0.126 }],
  sharpTurns: [{ center: 630, length: 172, direction: 1, strength: 5.3 }, { center: 2050, length: 226, direction: -1, strength: 6.4 }, { center: 2860, length: 188, direction: 1, strength: 5.7 }, { center: 4510, length: 214, direction: -1, strength: 6.2 }, { center: 5100, length: 178, direction: 1, strength: 5.5 }, { center: 3920, length: 164, direction: -1, strength: 5.2 }],
  track: {
    curveAmplitude: [28, 7.8, 6.7, 1.9, 2.1], curveFrequency: [0.00208, 0.00562, 0.00802, 0.0158, 0.0179], curvePhase: [3.7, 4.8, 5.9, 0.6, 1.5],
    terrainAmplitude: [5.1, 3.5, 0.95, 0.8, 0.34], terrainFrequency: [0.00305, 0.00585, 0.0174, 0.0201, 0.0352], terrainPhase: [4.6, 5.7, 0.9, 2, 3.1],
    curveScale: 1.28, terrainScale: 0.97,
  },
};

export default level;