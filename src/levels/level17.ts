import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 17, name: 'Dead Star', length: 5400, tunnelWidth: 20.8, tunnelHeight: 16,
  tunnels: [{ id: 'star-core', start: 0, end: 2260, style: 'neon' }, { id: 'star-eclipse', start: 2420, end: 5400, style: 'metal' }],
  jumps: [{ launch: 2260, landing: 2420, rampSlope: 0.125 }],
  sharpTurns: [{ center: 420, length: 190, direction: 1, strength: 5.8 }, { center: 980, length: 218, direction: -1, strength: 6.3 }, { center: 1540, length: 176, direction: 1, strength: 5.5 }, { center: 1940, length: 242, direction: -1, strength: 6.7 }, { center: 2950, length: 204, direction: 1, strength: 6.1 }, { center: 3520, length: 182, direction: -1, strength: 5.7 }, { center: 4160, length: 230, direction: 1, strength: 6.5 }, { center: 4700, length: 188, direction: -1, strength: 5.9 }, { center: 5140, length: 214, direction: 1, strength: 6.2 }],
  track: {
    curveAmplitude: [31, 6.7, 7.5, 1.5, 2.5], curveFrequency: [0.00194, 0.00608, 0.0074, 0.0172, 0.0165], curvePhase: [3.8, 4.9, 6, 0.8, 1.9],
    terrainAmplitude: [4.5, 4.2, 0.7, 1, 0.2], terrainFrequency: [0.00328, 0.0054, 0.0187, 0.0184, 0.037], terrainPhase: [4.9, 6, 1.1, 2.2, 3.3],
    curveScale: 1.46, terrainScale: 1.09,
  },
};

export default level;