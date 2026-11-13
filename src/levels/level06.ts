import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 6, name: 'Copper Switchback', length: 5400, tunnelWidth: 28.5, tunnelHeight: 16,
  tunnels: [{ id: 'copper-entry', start: 0, end: 1740, style: 'metal' }, { id: 'switchback-core', start: 1884, end: 3820, style: 'wireframe' }, { id: 'copper-exit', start: 3968, end: 5400, style: 'neon' }],
  jumps: [{ launch: 1740, landing: 1884, rampSlope: 0.122 }, { launch: 3820, landing: 3968, rampSlope: 0.12 }],
  sharpTurns: [{ center: 1110, length: 184, direction: -1, strength: 5.6 }, { center: 2940, length: 212, direction: 1, strength: 6.1 }],
  track: {
    curveAmplitude: [21, 12.2, 5.4, 2.5, 1.7], curveFrequency: [0.00242, 0.00465, 0.0095, 0.0131, 0.0188], curvePhase: [4.6, 5.2, 0.3, 1.4, 2.3],
    terrainAmplitude: [6.1, 2.7, 1.3, 0.62, 0.31], terrainFrequency: [0.00245, 0.00735, 0.0146, 0.0234, 0.0305], terrainPhase: [5.2, 0.6, 2.8, 3.9, 4.7],
    curveScale: 1.15, terrainScale: 1.08,
  },
};

export default level;