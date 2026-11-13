import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 12, name: 'Solar Flare', length: 5400, tunnelWidth: 24.3, tunnelHeight: 16,
  tunnels: [{ id: 'flare-a', start: 0, end: 820, style: 'neon' }, { id: 'flare-b', start: 972, end: 2250, style: 'metal' }, { id: 'flare-c', start: 2402, end: 3820, style: 'wireframe' }, { id: 'flare-d', start: 3972, end: 5400, style: 'neon' }],
  jumps: [{ launch: 820, landing: 972, rampSlope: 0.12 }, { launch: 2250, landing: 2402, rampSlope: 0.124 }, { launch: 3820, landing: 3972, rampSlope: 0.122 }],
  sharpTurns: [{ center: 1550, length: 198, direction: -1, strength: 5.9 }, { center: 3210, length: 232, direction: 1, strength: 6.5 }, { center: 4650, length: 176, direction: -1, strength: 5.5 }, { center: 5160, length: 206, direction: 1, strength: 6.1 }],
  track: {
    curveAmplitude: [17, 17.2, 3.1, 3.8, 1.3], curveFrequency: [0.00268, 0.00384, 0.0105, 0.0118, 0.0202], curvePhase: [4.4, 5.4, 0.5, 1.6, 2.5],
    terrainAmplitude: [7.3, 1.6, 1.62, 0.59, 0.46], terrainFrequency: [0.00212, 0.00835, 0.0128, 0.0258, 0.0279], terrainPhase: [5.4, 0.7, 1.8, 2.9, 4],
    curveScale: 1.31, terrainScale: 1.15,
  },
};

export default level;