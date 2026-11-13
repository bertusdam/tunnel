import { getLevel } from './levels';

export const MAX_SPEED = 210;
export const MAX_LEVEL = 20;
export const MAX_DISPLAY_SPEED = 120;
export const TUNNEL_WIDTH = 24;
export const TUNNEL_HEIGHT = 16;
export const HALF_WIDTH = TUNNEL_WIDTH / 2;
export const HALF_HEIGHT = TUNNEL_HEIGHT / 2;
export const LANDING_MARGIN = 1;
export const GRAVITY = 10.2;
export const RAMP_LENGTH = 80;
export const RAMP_SLOPE = 0.12;
export const RAMP_RISE = RAMP_LENGTH * RAMP_SLOPE / 2;
// Keep the airborne arc inside the destination tunnel despite the higher forward speed and steeper ramp.
export const MAX_AIR_LAUNCH_SPEED = 6.25;
export const MIN_LAUNCH_SLOPE = 0.04;
export const CURVE_RESPONSE = 2 / 3;
export const STEERING_ACCELERATION = 110;
export const MAX_LATERAL_ACCELERATION = 700;
export const LATERAL_DAMPING = 3.5;
export const MAX_LATERAL_SPEED = 30;
export const BRAKING_DECELERATION = 42 * MAX_SPEED / 120;
export const PLAYER_COLLISION_RADIUS = 0.75;
const WALL_REBOUND_INSET = 0.35;
const WALL_REBOUND_RESTITUTION = 1;
const WALL_REBOUND_DAMPING = 0.8;
const MAX_WALL_REBOUND_SPEED = 42;
const MIN_WALL_REBOUND_SPEED = 3.5;
const MIN_REBOUND_SPEED = 0.8;
export const SHARP_TURN_WARNING_OFFSETS = [-500, -390, -280, -170] as const;
export interface SharpTurn {
  center: number;
  length: number;
  direction: 1 | -1;
  strength: number;
}

const SHARP_TURN_CURVATURE = 0.0007;
const JUMP_TERRAIN_SCALE = 0.08;
const JUMP_TERRAIN_BLEND = 120;

function terrainVariationScale(distance: number, level: number): number {
  let scale = 1;
  for (const jump of getLevel(level).jumps) {
    const zone = { start: jump.launch - 180, end: jump.landing + 180 };
    if (distance >= zone.start && distance <= zone.end) return JUMP_TERRAIN_SCALE;

    const blendStart = zone.start - JUMP_TERRAIN_BLEND;
    const blendEnd = zone.end + JUMP_TERRAIN_BLEND;
    const blendDistance = distance < zone.start ? distance - blendStart : blendEnd - distance;
    if (blendDistance > 0) {
      const progress = Math.max(0, Math.min(1, blendDistance / JUMP_TERRAIN_BLEND));
      const eased = progress * progress * (3 - 2 * progress);
      scale = Math.min(scale, 1 + (JUMP_TERRAIN_SCALE - 1) * eased);
    }
  }
  return scale;
}

export function levelTurnSharpness(level: number): number {
  const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 1 + (clampedLevel - 1) * 0.012;
}

export function levelOneCurveScale(): number {
  return getLevel(1).track.curveScale;
}

export function sharpTurnsForLevel(level: number): SharpTurn[] {
  return getLevel(level).sharpTurns.map((turn) => ({ ...turn }));
}

export function levelAtDistance(distance: number, levelLength: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(Math.max(0, distance) / levelLength) + 1));
}

export function isLevelBoundary(distance: number, levelLength: number): boolean {
  return distance > 0 && distance % levelLength === 0;
}

export function nextLevelOrigin(previousOrigin: number, previousEndHeight: number, nextStartHeight: number): number {
  return previousOrigin + previousEndHeight - nextStartHeight;
}

export function transitionAdjustment(
  distance: number,
  slopeDelta: number,
  length: number,
): { offset: number; slope: number; curvature: number } {
  if (length <= 0 || distance >= length) return { offset: 0, slope: 0, curvature: 0 };

  const progress = Math.max(0, distance) / length;
  return {
    offset: slopeDelta * length * (progress - 2 * progress ** 2 + progress ** 3),
    slope: slopeDelta * (1 - 4 * progress + 3 * progress ** 2),
    curvature: slopeDelta / length * (-4 + 6 * progress),
  };
}

export function hasTunnelWallCollision(offset: number, halfWidth: number): boolean {
  return Math.abs(offset) >= halfWidth;
}

export function resolveTunnelWallContact(
  previousOffset: number,
  nextOffset: number,
  halfWidth: number,
  playerRadius = 0,
): { collided: boolean; offset: number } {
  const boundary = Math.max(0, halfWidth - playerRadius);
  const previousOutside = Math.abs(previousOffset) >= boundary;
  const nextOutside = Math.abs(nextOffset) >= boundary;

  if (!previousOutside && !nextOutside) return { collided: false, offset: nextOffset };
  const contactSide = previousOutside ? Math.sign(previousOffset) : Math.sign(nextOffset);
  return { collided: true, offset: contactSide * boundary };
}

export function applyTunnelWallRebound(
  contact: ReturnType<typeof resolveTunnelWallContact>,
  lateralVelocity: number,
  speed: number,
): { offset: number; lateralVelocity: number; speed: number; reboundDuration: number } {
  if (!contact.collided) return { ...contact, lateralVelocity, speed, reboundDuration: 0 };

  const contactSide = Math.sign(contact.offset) || 1;
  const outwardSpeed = Math.max(0, lateralVelocity * contactSide);
  const impactRatio = Math.min(1, outwardSpeed / MAX_LATERAL_SPEED);
  const forwardImpactRatio = Math.min(1, speed / MAX_SPEED);
  const impactEnergy = impactRatio * forwardImpactRatio;
  const restitution = 0.5 + impactEnergy * (WALL_REBOUND_RESTITUTION - 0.5);
  const reboundSpeed = Math.min(
    MAX_WALL_REBOUND_SPEED,
    Math.max(MIN_WALL_REBOUND_SPEED, outwardSpeed * restitution * (1 + impactEnergy * 0.4)),
  );
  return {
    offset: contact.offset - contactSide * WALL_REBOUND_INSET,
    lateralVelocity: -contactSide * reboundSpeed,
    speed: speed * (0.65 - impactRatio * 0.55),
    reboundDuration: reboundSpeed > MIN_REBOUND_SPEED
      ? Math.log(reboundSpeed / MIN_REBOUND_SPEED) / WALL_REBOUND_DAMPING
      : 0,
  };
}

export function stepWallRebound(
  offset: number,
  velocity: number,
  deltaTime: number,
  steering = 0,
  speed = 0,
): { offset: number; velocity: number } {
  const steeringAcceleration = steering * STEERING_ACCELERATION * steeringAuthorityForSpeed(speed);
  const nextVelocity = Math.max(
    -MAX_WALL_REBOUND_SPEED,
    Math.min(
      MAX_WALL_REBOUND_SPEED,
      velocity * Math.exp(-WALL_REBOUND_DAMPING * deltaTime) + steeringAcceleration * deltaTime,
    ),
  );
  return { offset: offset + nextVelocity * deltaTime, velocity: nextVelocity };
}

export function brakingDistance(initialSpeed: number, targetSpeed: number, deceleration: number): number {
  if (initialSpeed <= targetSpeed) return 0;
  if (deceleration <= 0) return Number.POSITIVE_INFINITY;
  return (initialSpeed ** 2 - targetSpeed ** 2) / (2 * deceleration);
}

export function steeringAuthorityForSpeed(speed: number): number {
  const speedRatio = Math.max(0, Math.min(1, speed / MAX_SPEED));
  return speedRatio;
}

export function curveLateralAcceleration(curve: number, speed: number): number {
  return -curve * speed ** 2 * CURVE_RESPONSE;
}

export function landingTunnelIndexForGap(gapIndex: number, tunnelsPerLevel: number): number {
  const gapsPerLevel = tunnelsPerLevel - 1;
  return Math.floor(gapIndex / gapsPerLevel) * tunnelsPerLevel + (gapIndex % gapsPerLevel) + 1;
}

export function rampHeightAtProgress(progress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return RAMP_RISE * clampedProgress ** 2;
}

interface AuthoredTurnProfile {
  offset: number;
  curvature: number;
}

function integratedTurnCurvature(progress: number): number {
  return progress ** 2 / 4 + (Math.cos(2 * Math.PI * progress) - 1) / (8 * Math.PI ** 2);
}

function authoredTurnProfile(distance: number, turn: SharpTurn, sharpness: number): AuthoredTurnProfile {
  const start = turn.center - turn.length / 2;
  const end = turn.center + turn.length / 2;
  const turnLength = turn.length;
  const recoveryLength = turnLength * 1.5;
  const curvatureScale = turn.direction * SHARP_TURN_CURVATURE * turn.strength * sharpness;
  const turnOffsetAtEnd = curvatureScale * turnLength ** 2 / 4;
  const turnSlopeAtEnd = curvatureScale * turnLength / 2;

  if (distance < start) return { offset: 0, curvature: 0 };
  if (distance <= end) {
    const progress = (distance - start) / turnLength;
    return {
      offset: curvatureScale * turnLength ** 2 * integratedTurnCurvature(progress),
      curvature: curvatureScale * Math.sin(Math.PI * progress) ** 2,
    };
  }

  const recoveryProgress = (distance - end) / recoveryLength;
  if (recoveryProgress >= 1) {
    return {
      offset: turnOffsetAtEnd + turnSlopeAtEnd * recoveryLength
        - curvatureScale * turnLength * recoveryLength / 4,
      curvature: 0,
    };
  }

  const recoveryAmplitude = curvatureScale * turnLength / recoveryLength;
  return {
    offset: turnOffsetAtEnd + turnSlopeAtEnd * recoveryLength * recoveryProgress
      - recoveryAmplitude * recoveryLength ** 2 * integratedTurnCurvature(recoveryProgress),
    curvature: -recoveryAmplitude * Math.sin(Math.PI * recoveryProgress) ** 2,
  };
}

export interface TransferPrediction {
  flightTime: number;
  horizontalRange: number;
  heightAtMouth: number;
  clearsGap: boolean;
  roofClear: boolean;
}

export function trackX(distance: number, level = 1): number {
  const sharpness = levelTurnSharpness(level);
  const profile = getLevel(level).track;
  const baseTrackX = profile.curveAmplitude.reduce((sum, amplitude, index) => {
    const frequency = profile.curveFrequency[index] * sharpness;
    return sum + profile.curveScale * amplitude * Math.sin(distance * frequency + profile.curvePhase[index]);
  }, 0);
  const sharpTurnOffset = sharpTurnsForLevel(level).reduce(
    (sum, turn) => sum + authoredTurnProfile(distance, turn, sharpness).offset,
    0,
  );
  return (baseTrackX + sharpTurnOffset) * 1.44;
}

export function rawTrackHeight(distance: number, level = 1): number {
  const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const sharpness = levelTurnSharpness(clampedLevel);
  const profile = getLevel(clampedLevel).track;
  const terrainScale = terrainVariationScale(distance, clampedLevel);
  return profile.terrainAmplitude.reduce((sum, amplitude, index) => {
    const frequency = profile.terrainFrequency[index] * sharpness;
    return sum + amplitude * profile.terrainScale * terrainScale
      * Math.sin(distance * frequency + profile.terrainPhase[index]);
  }, 0);
}

export function curveAtDistance(distance: number, level = 1): number {
  const sharpness = levelTurnSharpness(level);
  const profile = getLevel(level).track;
  const baseCurve = -profile.curveAmplitude.reduce((sum, amplitude, index) => {
    const frequency = profile.curveFrequency[index] * sharpness;
    return sum + profile.curveScale * amplitude * frequency ** 2
      * Math.sin(distance * frequency + profile.curvePhase[index]);
  }, 0);
  const sharpTurnCurve = sharpTurnsForLevel(level).reduce(
    (sum, turn) => sum + authoredTurnProfile(distance, turn, sharpness).curvature,
    0,
  );
  return (baseCurve + sharpTurnCurve) * 1.44;
}

export function stepLateralMotion(
  offset: number,
  velocity: number,
  speed: number,
  curve: number,
  steering: number,
  deltaTime: number,
  steeringScale = 1,
  lateralDampingScale = 1,
): { offset: number; velocity: number } {
  const steeringAuthority = steeringAuthorityForSpeed(speed);
  const steeringForce = steering * STEERING_ACCELERATION * steeringScale * steeringAuthority;
  const curveForce = curveLateralAcceleration(curve, speed);
  const lateralAcceleration = Math.max(
    -MAX_LATERAL_ACCELERATION,
    Math.min(MAX_LATERAL_ACCELERATION, steeringForce + curveForce),
  );
  let nextVelocity = velocity + lateralAcceleration * deltaTime;
  nextVelocity *= Math.exp(-LATERAL_DAMPING * lateralDampingScale * deltaTime);
  const lateralSpeedLimit = MAX_LATERAL_SPEED * steeringScale;
  nextVelocity = Math.max(-lateralSpeedLimit, Math.min(lateralSpeedLimit, nextVelocity));
  return { offset: offset + nextVelocity * deltaTime, velocity: nextVelocity };
}

export function isUpwardLaunch(slope: number): boolean {
  return slope >= MIN_LAUNCH_SLOPE;
}

export function launchVerticalVelocity(speed: number, rampSlope: number): number {
  const rampVelocity = speed * Math.sin(Math.atan(Math.max(0, rampSlope)));
  return Math.min(MAX_AIR_LAUNCH_SPEED, rampVelocity);
}

export function flightDuration(verticalVelocity: number, heightDelta: number, gravity = GRAVITY): number {
  const discriminant = verticalVelocity ** 2 - 2 * gravity * heightDelta;
  if (verticalVelocity <= 0 || discriminant < 0) return Number.POSITIVE_INFINITY;
  return (verticalVelocity + Math.sqrt(discriminant)) / gravity;
}

export function trajectoryHeight(verticalVelocity: number, elapsed: number, gravity = GRAVITY): number {
  return verticalVelocity * elapsed - 0.5 * gravity * elapsed ** 2;
}

export function hasTunnelClearance(relativeHeight: number, tunnelHeight = TUNNEL_HEIGHT, clearance = 0.8): boolean {
  return Math.abs(relativeHeight) <= tunnelHeight / 2 - clearance;
}

export function predictTransfer(
  speed: number,
  gapDistance: number,
  rampSlope: number,
  targetHeightDelta: number,
  tunnelHeight = TUNNEL_HEIGHT,
): TransferPrediction {
  if (speed <= 0 || !isUpwardLaunch(rampSlope)) {
    return { flightTime: 0, horizontalRange: 0, heightAtMouth: 0, clearsGap: false, roofClear: false };
  }

  const verticalVelocity = launchVerticalVelocity(speed, rampSlope);
  const flightTime = flightDuration(verticalVelocity, targetHeightDelta);
  const horizontalRange = speed * flightTime;
  const timeToMouth = gapDistance / speed;
  const heightAtMouth = trajectoryHeight(verticalVelocity, timeToMouth) - targetHeightDelta;

  return {
    flightTime,
    horizontalRange,
    heightAtMouth,
    clearsGap: Number.isFinite(flightTime) && horizontalRange >= gapDistance,
    roofClear: Number.isFinite(flightTime) && hasTunnelClearance(heightAtMouth, tunnelHeight),
  };
}
