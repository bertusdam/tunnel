export type TunnelStyle = 'wireframe' | 'metal' | 'neon' | 'graffiti';

export interface TunnelDefinition {
  id: string;
  start: number;
  end: number;
  style: TunnelStyle;
}

export interface JumpDefinition {
  launch: number;
  landing: number;
  rampSlope: number;
}

export interface SharpTurnDefinition {
  center: number;
  length: number;
  direction: 1 | -1;
  strength: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  length: number;
  tunnelWidth: number;
  tunnelHeight: number;
  tunnels: TunnelDefinition[];
  jumps: JumpDefinition[];
  sharpTurns: SharpTurnDefinition[];
  track: {
    curveAmplitude: number[];
    curveFrequency: number[];
    curvePhase: number[];
    terrainAmplitude: number[];
    terrainFrequency: number[];
    terrainPhase: number[];
    curveScale: number;
    terrainScale: number;
  };
}