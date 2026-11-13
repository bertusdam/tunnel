import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 18, name: 'Chrome Tempest', length: 5400, tunnelWidth: 20.1, tunnelHeight: 16,
  tunnels: [{ id: 'tempest-entry', start: 0, end: 1430, style: 'metal' }, { id: 'tempest-eye', start: 1592, end: 3600, style: 'graffiti' }, { id: 'tempest-exit', start: 3762, end: 5400, style: 'neon' }],
  jumps: [{ launch: 1430, landing: 1592, rampSlope: 0.12 }, { launch: 3600, landing: 3762, rampSlope: 0.127 }],
  sharpTurns: [{ center: 760, length: 226, direction: -1, strength: 6.4 }, { center: 2150, length: 186, direction: 1, strength: 5.8 }, { center: 2780, length: 250, direction: -1, strength: 6.9 }, { center: 4260, length: 198, direction: 1, strength: 6 }, { center: 4920, length: 234, direction: -1, strength: 6.6 }, { center: 1840, length: 174, direction: -1, strength: 5.4 }, { center: 3180, length: 210, direction: 1, strength: 6.2 }],
  track: {
    curveAmplitude: [14, 20.4, 2.2, 4.8, 0.8], curveFrequency: [0.00286, 0.00348, 0.0117, 0.0106, 0.0217], curvePhase: [4.8, 5.9, 0.7, 1.8, 2.9],
    terrainAmplitude: [8.2, 1.2, 1.86, 0.42, 0.58], terrainFrequency: [0.00194, 0.0092, 0.0115, 0.0278, 0.0258], terrainPhase: [5.8, 0.9, 2.1, 3.2, 4.3],
    curveScale: 1.49, terrainScale: 1.23,
  },
};

export default level;