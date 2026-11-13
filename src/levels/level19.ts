import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 19, name: 'Event Horizon', length: 5400, tunnelWidth: 19.4, tunnelHeight: 16,
  tunnels: [{ id: 'horizon-a', start: 0, end: 790, style: 'wireframe' }, { id: 'horizon-b', start: 952, end: 2160, style: 'neon' }, { id: 'horizon-c', start: 2322, end: 3690, style: 'metal' }, { id: 'horizon-d', start: 3852, end: 5400, style: 'wireframe' }],
  jumps: [{ launch: 790, landing: 952, rampSlope: 0.122 }, { launch: 2160, landing: 2322, rampSlope: 0.126 }, { launch: 3690, landing: 3852, rampSlope: 0.121 }],
  sharpTurns: [{ center: 500, length: 210, direction: 1, strength: 6.1 }, { center: 1320, length: 246, direction: -1, strength: 6.8 }, { center: 2100, length: 180, direction: 1, strength: 5.6 }, { center: 2800, length: 254, direction: -1, strength: 7 }, { center: 3500, length: 192, direction: 1, strength: 6 }, { center: 4100, length: 238, direction: -1, strength: 6.7 }, { center: 4700, length: 174, direction: 1, strength: 5.5 }, { center: 5200, length: 222, direction: -1, strength: 6.4 }],
  track: {
    curveAmplitude: [32, 6.2, 7.9, 1.3, 2.7], curveFrequency: [0.0019, 0.00622, 0.00718, 0.0178, 0.0161], curvePhase: [5.9, 0.7, 1.8, 2.9, 4],
    terrainAmplitude: [4.2, 4.5, 0.64, 1.08, 0.18], terrainFrequency: [0.00336, 0.00525, 0.0191, 0.0178, 0.0376], terrainPhase: [0.6, 1.7, 2.8, 3.9, 5],
    curveScale: 1.52, terrainScale: 1.11,
  },
};

export default level;