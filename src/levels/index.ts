import level01 from './level01';
import level02 from './level02';
import level03 from './level03';
import level04 from './level04';
import level05 from './level05';
import level06 from './level06';
import level07 from './level07';
import level08 from './level08';
import level09 from './level09';
import level10 from './level10';
import level11 from './level11';
import level12 from './level12';
import level13 from './level13';
import level14 from './level14';
import level15 from './level15';
import level16 from './level16';
import level17 from './level17';
import level18 from './level18';
import level19 from './level19';
import level20 from './level20';
import type { LevelDefinition } from './types';

export type { JumpDefinition, LevelDefinition, SharpTurnDefinition, TunnelDefinition, TunnelStyle } from './types';

export const LEVELS: readonly LevelDefinition[] = [
  level01, level02, level03, level04, level05, level06, level07, level08, level09, level10,
  level11, level12, level13, level14, level15, level16, level17, level18, level19, level20,
];

export function getLevel(id: number): LevelDefinition {
  const level = LEVELS[id - 1];
  if (!level || level.id !== id) throw new RangeError(`Unknown level: ${id}`);
  return level;
}

export function validateLevels(): string[] {
  const errors: string[] = [];
  if (LEVELS.length !== 20) errors.push(`Expected 20 levels, got ${LEVELS.length}`);

  LEVELS.forEach((level, index) => {
    if (level.id !== index + 1) errors.push(`Level at index ${index} has id ${level.id}`);
    if (index > 0 && level.tunnelWidth >= LEVELS[index - 1].tunnelWidth) {
      errors.push(`Level ${level.id} is not narrower than level ${level.id - 1}`);
    }
    if (level.jumps.length > 3) errors.push(`Level ${level.id} has more than three jumps`);
    if (level.sharpTurns.some((turn) => turn.direction !== 1 && turn.direction !== -1)) {
      errors.push(`Level ${level.id} has an invalid sharp-turn direction`);
    }

    const sortedTunnels = [...level.tunnels].sort((a, b) => a.start - b.start);
    if (sortedTunnels.some((tunnel, tunnelIndex) => tunnel.start < 0 || tunnel.end > level.length
      || tunnel.start >= tunnel.end
      || (tunnelIndex > 0 && tunnel.start < sortedTunnels[tunnelIndex - 1].end))) {
      errors.push(`Level ${level.id} has invalid or overlapping tunnel ranges`);
    }
    for (const jump of level.jumps) {
      const launchTunnel = level.tunnels.find((tunnel) => tunnel.end === jump.launch);
      const landingTunnel = level.tunnels.find((tunnel) => tunnel.start === jump.landing);
      if (!launchTunnel || !landingTunnel || jump.launch >= jump.landing || jump.rampSlope <= 0) {
        errors.push(`Level ${level.id} has a jump that does not connect two tunnels`);
      }
    }
  });

  if (LEVELS[0]?.sharpTurns.length !== 0) errors.push('Level 1 must not have a sharp turn');
  if (!LEVELS[1]?.sharpTurns.length) errors.push('Level 2 must have the first sharp turn');
  return errors;
}
