import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 1, name: 'Wide Open', length: 5400, tunnelWidth: 32, tunnelHeight: 16,
  tunnels: [
    { id: 'wide-entry', start: 0, end: 2420, style: 'wireframe' },
    { id: 'wide-exit', start: 2560, end: 5400, style: 'metal' },
  ],
  jumps: [{ launch: 2420, landing: 2560, rampSlope: 0.12 }],
  sharpTurns: [],
  track: {
    curveAmplitude: [25, 10, 4, 2, 1.4], curveFrequency: [0.0021, 0.0044, 0.008, 0.012, 0.016], curvePhase: [0.1, 0.8, 1.7, 2.4, 3.1],
    terrainAmplitude: [5.8, 2.4, 1.1, 0.5, 0.25], terrainFrequency: [0.0023, 0.0065, 0.014, 0.021, 0.029], terrainPhase: [0.3, 1.4, 2.1, 2.8, 4.2],
    curveScale: 1.02, terrainScale: 0.94,
  },
};

export default level;