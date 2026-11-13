import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 16, name: 'Thunder Run', length: 5400, tunnelWidth: 21.5, tunnelHeight: 16,
  tunnels: [{ id: 'thunder-fork', start: 0, end: 910, style: 'wireframe' }, { id: 'thunder-vault', start: 1068, end: 2710, style: 'metal' }, { id: 'thunder-bend', start: 2868, end: 4300, style: 'neon' }, { id: 'thunder-mouth', start: 4458, end: 5400, style: 'wireframe' }],
  jumps: [{ launch: 910, landing: 1068, rampSlope: 0.122 }, { launch: 2710, landing: 2868, rampSlope: 0.126 }, { launch: 4300, landing: 4458, rampSlope: 0.12 }],
  sharpTurns: [{ center: 520, length: 202, direction: -1, strength: 6 }, { center: 1510, length: 244, direction: 1, strength: 6.7 }, { center: 2140, length: 178, direction: -1, strength: 5.5 }, { center: 3430, length: 232, direction: 1, strength: 6.5 }, { center: 3880, length: 188, direction: -1, strength: 5.8 }, { center: 4880, length: 216, direction: 1, strength: 6.3 }],
  track: {
    curveAmplitude: [15, 19.3, 2.5, 4.4, 0.9], curveFrequency: [0.0028, 0.0036, 0.0113, 0.011, 0.0212], curvePhase: [2.8, 3.9, 5, 6, 0.9],
    terrainAmplitude: [7.9, 1.35, 1.78, 0.47, 0.53], terrainFrequency: [0.002, 0.0089, 0.0119, 0.0271, 0.0265], terrainPhase: [3.9, 5, 6.1, 1.2, 2.3],
    curveScale: 1.43, terrainScale: 1.2,
  },
};

export default level;