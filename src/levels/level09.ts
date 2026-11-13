import type { LevelDefinition } from './types';

const level: LevelDefinition = {
  id: 9, name: 'Redline Foundry', length: 5400, tunnelWidth: 26.4, tunnelHeight: 16,
  tunnels: [{ id: 'foundry-one', start: 0, end: 860, style: 'metal' }, { id: 'foundry-two', start: 1008, end: 2360, style: 'wireframe' }, { id: 'foundry-three', start: 2508, end: 3970, style: 'neon' }, { id: 'foundry-four', start: 4118, end: 5400, style: 'metal' }],
  jumps: [{ launch: 860, landing: 1008, rampSlope: 0.12 }, { launch: 2360, landing: 2508, rampSlope: 0.125 }, { launch: 3970, landing: 4118, rampSlope: 0.121 }],
  sharpTurns: [{ center: 1480, length: 186, direction: 1, strength: 5.7 }, { center: 2920, length: 216, direction: -1, strength: 6.2 }, { center: 4630, length: 174, direction: 1, strength: 5.5 }, { center: 5200, length: 202, direction: -1, strength: 6 }],
  track: {
    curveAmplitude: [23, 10.4, 6.3, 2.1, 1.9], curveFrequency: [0.00228, 0.00492, 0.00815, 0.0154, 0.0183], curvePhase: [1.8, 2.8, 3.9, 4.7, 5.8],
    terrainAmplitude: [5.3, 3.3, 1.18, 0.44, 0.42], terrainFrequency: [0.00295, 0.00605, 0.0169, 0.0208, 0.0347], terrainPhase: [2.8, 3.8, 4.9, 0.4, 1.2],
    curveScale: 1.22, terrainScale: 0.93,
  },
};

export default level;