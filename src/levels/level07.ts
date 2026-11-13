import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 7, name: 'Violet Descent', length: 5400, tunnelWidth: 27.8, tunnelHeight: 16,
  tunnels: [{ id: 'violet-high', start: 0, end: 930, style: 'neon' }, { id: 'violet-drop', start: 1078, end: 2690, style: 'metal' }, { id: 'violet-low', start: 2838, end: 5400, style: 'graffiti' }],
  jumps: [{ launch: 930, landing: 1078, rampSlope: 0.118 }, { launch: 2690, landing: 2838, rampSlope: 0.124 }],
  sharpTurns: [{ center: 1970, length: 176, direction: 1, strength: 5.5 }, { center: 3490, length: 208, direction: -1, strength: 6 }, { center: 4720, length: 188, direction: 1, strength: 5.7 }, { center: 5100, length: 166, direction: -1, strength: 5.3 }],
  track: {
    curveAmplitude: [26, 9.2, 5.8, 2.9, 1.3], curveFrequency: [0.00214, 0.00538, 0.00855, 0.0146, 0.0176], curvePhase: [5.1, 0.2, 1.9, 2.7, 3.8],
    terrainAmplitude: [5.7, 2.2, 1.55, 0.51, 0.38], terrainFrequency: [0.00275, 0.00645, 0.01535, 0.0227, 0.0328], terrainPhase: [0.8, 1.9, 3.2, 4.6, 5.5],
    curveScale: 1.17, terrainScale: 1.01,
  },
};

export default level;