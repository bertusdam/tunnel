import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 4, name: 'The Long Swerve', length: 5400, tunnelWidth: 29.9, tunnelHeight: 16,
  tunnels: [{ id: 'swerve-entry', start: 0, end: 2190, style: 'wireframe' }, { id: 'swerve-arrival', start: 2338, end: 5400, style: 'graffiti' }],
  jumps: [{ launch: 2190, landing: 2338, rampSlope: 0.124 }],
  sharpTurns: [{ center: 3910, length: 204, direction: -1, strength: 5.9 }],
  track: {
    curveAmplitude: [19, 15, 3.7, 3.1, 1.2], curveFrequency: [0.0025, 0.0041, 0.0098, 0.0126, 0.019], curvePhase: [2.2, 3.1, 4.2, 5.1, 0.4],
    terrainAmplitude: [6.9, 1.8, 1.2, 0.48, 0.4], terrainFrequency: [0.0024, 0.0076, 0.0138, 0.024, 0.033], terrainPhase: [3.2, 4.3, 5.1, 0.7, 1.8],
    curveScale: 1.1, terrainScale: 1.05,
  },
};

export default level;