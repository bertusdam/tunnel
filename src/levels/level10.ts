import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 10, name: 'Blue Comet', length: 5400, tunnelWidth: 25.7, tunnelHeight: 16,
  tunnels: [{ id: 'comet-mouth', start: 0, end: 1980, style: 'neon' }, { id: 'comet-tail', start: 2130, end: 5400, style: 'graffiti' }],
  jumps: [{ launch: 1980, landing: 2130, rampSlope: 0.127 }],
  sharpTurns: [{ center: 910, length: 210, direction: -1, strength: 6.1 }, { center: 3030, length: 182, direction: 1, strength: 5.6 }, { center: 3620, length: 224, direction: -1, strength: 6.3 }, { center: 4870, length: 192, direction: 1, strength: 5.9 }, { center: 5260, length: 168, direction: -1, strength: 5.4 }],
  track: {
    curveAmplitude: [18, 16, 3.4, 3.6, 1], curveFrequency: [0.00262, 0.00398, 0.0102, 0.0122, 0.0198], curvePhase: [2.9, 3.7, 4.8, 5.7, 0.8],
    terrainAmplitude: [7.1, 1.9, 1.45, 0.68, 0.24], terrainFrequency: [0.00218, 0.0081, 0.0131, 0.0252, 0.0286], terrainPhase: [3.8, 4.7, 5.6, 1.1, 2],
    curveScale: 1.25, terrainScale: 1.12,
  },
};

export default level;