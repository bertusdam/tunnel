import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 5, name: 'Three Pulse', length: 5400, tunnelWidth: 29.2, tunnelHeight: 16,
  tunnels: [
    { id: 'pulse-a', start: 0, end: 990, style: 'metal' }, { id: 'pulse-b', start: 1136, end: 2650, style: 'neon' },
    { id: 'pulse-c', start: 2798, end: 4210, style: 'wireframe' }, { id: 'pulse-d', start: 4358, end: 5400, style: 'metal' },
  ],
  jumps: [{ launch: 990, landing: 1136, rampSlope: 0.12 }, { launch: 2650, landing: 2798, rampSlope: 0.126 }, { launch: 4210, landing: 4358, rampSlope: 0.122 }],
  sharpTurns: [{ center: 1720, length: 168, direction: 1, strength: 5.4 }, { center: 3240, length: 196, direction: -1, strength: 5.9 }, { center: 4930, length: 182, direction: 1, strength: 5.6 }],
  track: {
    curveAmplitude: [24, 11.5, 4.8, 3.3, 1.1], curveFrequency: [0.00205, 0.0055, 0.0083, 0.0151, 0.0181], curvePhase: [3.5, 4.4, 5.3, 0.9, 1.7],
    terrainAmplitude: [5.5, 3.1, 1.05, 0.56, 0.36], terrainFrequency: [0.0029, 0.0062, 0.0165, 0.0211, 0.034], terrainPhase: [4.1, 5.4, 0.2, 1.3, 2.6],
    curveScale: 1.13, terrainScale: 0.96,
  },
};

export default level;