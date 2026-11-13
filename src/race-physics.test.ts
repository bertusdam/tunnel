import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getLevel, LEVELS, validateLevels } from './levels';
import {
  cameraOrientationForSteering,
  cameraQuaternionFollowingTrack,
  smoothCameraSteeringInput,
} from './camera-rig';
import {
  HALF_WIDTH,
  CURVE_RESPONSE,
  BRAKING_DECELERATION,
  MAX_LEVEL,
  MAX_LATERAL_ACCELERATION,
  MAX_DISPLAY_SPEED,
  MAX_SPEED,
  PLAYER_COLLISION_RADIUS,
  MAX_AIR_LAUNCH_SPEED,
  RAMP_SLOPE,
  brakingDistance,
  STEERING_ACCELERATION,
  curveAtDistance,
  curveLateralAcceleration,
  stepWallRebound,
  levelOneCurveScale,
  applyTunnelWallRebound,
  hasTunnelWallCollision,
  resolveTunnelWallContact,
  transitionAdjustment,
  hasTunnelClearance,
  isLevelBoundary,
  isUpwardLaunch,
  levelAtDistance,
  nextLevelOrigin,
  landingTunnelIndexForGap,
  levelTurnSharpness,
  launchVerticalVelocity,
  predictTransfer,
  rawTrackHeight,
  rampHeightAtProgress,
  stepLateralMotion,
  steeringAuthorityForSpeed,
  SHARP_TURN_WARNING_OFFSETS,
  sharpTurnsForLevel,
  trackX,
} from './race-physics';

function runTurn(steerWithCurve: boolean, start = 0, end = 1480): number {
  let offset = 0;
  let velocity = 0;
  const speed = MAX_SPEED;
  const deltaTime = 1 / 60;
  let maximumOffset = 0;

  for (let distance = start; distance < end; distance += speed * deltaTime) {
    const curve = curveAtDistance(distance);
    const steeringDemand = curve * speed ** 2 * CURVE_RESPONSE
      - offset * 2 - velocity * 3;
    const steering = steerWithCurve
      ? Math.max(-1, Math.min(1, steeringDemand / (STEERING_ACCELERATION * (speed / MAX_SPEED))))
      : 0;
    const next = stepLateralMotion(offset, velocity, speed, curve, steering, deltaTime);
    offset = next.offset;
    velocity = next.velocity;
    maximumOffset = Math.max(maximumOffset, Math.abs(offset));
  }

  return maximumOffset;
}

function runConstantSteering(speed: number, start: number, end: number, steering: number, level = 1): number {
  let offset = 0;
  let velocity = 0;
  let maximumOffset = 0;
  const deltaTime = 1 / 60;
  for (let distance = start; distance < end; distance += speed * deltaTime) {
      const next = stepLateralMotion(offset, velocity, speed, curveAtDistance(distance, level), steering, deltaTime);
    offset = next.offset;
    velocity = next.velocity;
    maximumOffset = Math.max(maximumOffset, Math.abs(offset));
  }
  return maximumOffset;
}

function runUnsteeredTurn(
  speed: number,
  turn: ReturnType<typeof sharpTurnsForLevel>[number],
  level: number,
): boolean {
  let offset = 0;
  let velocity = 0;
  const halfWidth = getLevel(level).tunnelWidth / 2;
  const deltaTime = 1 / 60;
  const end = turn.center + turn.length / 2 + turn.length * 4;

  for (let distance = turn.center - turn.length / 2; distance < end; distance += speed * deltaTime) {
    const curve = curveAtDistance(distance, level);
    const next = stepLateralMotion(offset, velocity, speed, curve, 0, deltaTime);
    const wall = resolveTunnelWallContact(offset, next.offset, halfWidth, PLAYER_COLLISION_RADIUS);
    offset = wall.offset;
    velocity = next.velocity;
    if (wall.collided) return true;
  }
  return false;
}

function runBrakingApproach(turn: ReturnType<typeof sharpTurnsForLevel>[number], level: number): number | null {
  const halfWidth = getLevel(level).tunnelWidth / 2;
  const previousTurn = sharpTurnsForLevel(level)
    .filter((candidate) => candidate.center < turn.center)
    .sort((left, right) => left.center - right.center)
    .at(-1);
  let speed = previousTurn ? 60 : MAX_SPEED;
  let offset = 0;
  let velocity = 0;
  let distance = previousTurn
    ? previousTurn.center - previousTurn.length / 2
    : turn.center + SHARP_TURN_WARNING_OFFSETS[0];
  const firstWarning = turn.center + SHARP_TURN_WARNING_OFFSETS[0];
  const end = turn.center + turn.length / 2;
  const deltaTime = 1 / 60;

  for (let step = 0; distance < end && step < 2000; step += 1) {
    if (distance >= firstWarning) {
      speed = Math.max(60, speed - BRAKING_DECELERATION * deltaTime);
    } else if (previousTurn && distance <= previousTurn.center + previousTurn.length / 2) {
      speed = 60;
    } else {
      speed = Math.min(MAX_SPEED, speed + 27 * (MAX_SPEED / 120) * deltaTime);
    }
    const curve = curveAtDistance(distance, level);
    const steeringDemand = curve * speed ** 2 * CURVE_RESPONSE
      - offset * 2 - velocity * 3;
    const maximumSteeringForce = STEERING_ACCELERATION * steeringAuthorityForSpeed(speed);
    const steering = Math.abs(steeringDemand) > maximumSteeringForce * 0.3
      ? Math.sign(steeringDemand)
      : 0;
    const next = stepLateralMotion(offset, velocity, speed, curve, steering, deltaTime);
    const wallContact = resolveTunnelWallContact(
      offset, next.offset, halfWidth, PLAYER_COLLISION_RADIUS,
    );
    offset = wallContact.offset;
    velocity = next.velocity;
    if (wallContact.collided) return distance;
    if (Math.abs(offset) > halfWidth - PLAYER_COLLISION_RADIUS - 1.25) {
      speed = Math.max(0, speed - 24 * deltaTime);
      velocity *= Math.exp(-8 * deltaTime);
    }
    distance += speed * deltaTime;
  }
  return null;
}

function runKeyControlledTurn(
  speed: number,
  turn: ReturnType<typeof sharpTurnsForLevel>[number],
  level: number,
): number | null {
  const halfWidth = getLevel(level).tunnelWidth / 2;
  let offset = 0;
  let velocity = 0;
  let currentSpeed = speed;
  let distance = turn.center - turn.length / 2;
  const turnExit = turn.center + turn.length / 2;
  const recoveryEnd = turnExit + turn.length * 4;
  const deltaTime = 1 / 60;

  for (let step = 0; distance < recoveryEnd && step < 2000; step += 1) {
    const curve = curveAtDistance(distance, level);
    const steeringDemand = curve * currentSpeed ** 2 * CURVE_RESPONSE
      - offset * 2 - velocity * 3;
    const maximumSteeringForce = STEERING_ACCELERATION * steeringAuthorityForSpeed(currentSpeed);
    const steering = Math.abs(steeringDemand) > maximumSteeringForce * 0.35
      ? Math.sign(steeringDemand)
      : 0;
    const next = stepLateralMotion(
      offset,
      velocity,
      currentSpeed,
      curve,
      steering,
      deltaTime,
    );
    const wall = resolveTunnelWallContact(offset, next.offset, halfWidth, PLAYER_COLLISION_RADIUS);
    offset = wall.offset;
    velocity = next.velocity;
    if (wall.collided) return Math.sign(offset);
    if (Math.abs(offset) > halfWidth - PLAYER_COLLISION_RADIUS - 1.25) {
      currentSpeed = Math.max(0, currentSpeed - 24 * deltaTime);
      velocity *= Math.exp(-8 * deltaTime);
    }
    distance += currentSpeed * deltaTime;
  }
  return null;
}

function maximumFrameLateralStep(
  speed: number,
  turn: ReturnType<typeof sharpTurnsForLevel>[number],
  level: number,
): number {
  let offset = 0;
  let velocity = 0;
  let maximumStep = 0;
  const deltaTime = 1 / 60;
  const recoveryEnd = turn.center + turn.length / 2 + turn.length * 4;

  for (let distance = turn.center - turn.length / 2; distance < recoveryEnd; distance += speed * deltaTime) {
    const steering = distance < turn.center + turn.length / 2 ? turn.direction : 0;
    const next = stepLateralMotion(
      offset,
      velocity,
      speed,
      curveAtDistance(distance, level),
      steering,
      deltaTime,
    );
    maximumStep = Math.max(maximumStep, Math.abs(next.offset - offset));
    offset = next.offset;
    velocity = next.velocity;
  }
  return maximumStep;
}

function runWholeLevelAtBrakedSpeed(level: number): { collision: number | null; maximumOffset: number } {
  const definition = getLevel(level);
  const speed = 60 * MAX_SPEED / MAX_DISPLAY_SPEED;
  const deltaTime = 1 / 60;
  let offset = 0;
  let velocity = 0;
  let maximumOffset = 0;
  let distance = 0;

  for (let step = 0; distance < 5400 && step < 4000; step += 1) {
    const curve = curveAtDistance(distance, level);
    const steeringDemand = curve * speed ** 2 * CURVE_RESPONSE
      - offset * 2 - velocity * 3;
    const maximumSteeringForce = STEERING_ACCELERATION * steeringAuthorityForSpeed(speed);
    const steering = Math.abs(steeringDemand) > maximumSteeringForce * 0.35
      ? Math.sign(steeringDemand)
      : 0;
    const next = stepLateralMotion(offset, velocity, speed, curve, steering, deltaTime);
    const localDistance = distance % definition.length;
    const insideTunnel = definition.tunnels.some((tunnel) => localDistance >= tunnel.start && localDistance <= tunnel.end);
    if (insideTunnel) {
      const wall = resolveTunnelWallContact(offset, next.offset, definition.tunnelWidth / 2, PLAYER_COLLISION_RADIUS);
      offset = wall.offset;
      if (wall.collided) return { collision: distance, maximumOffset };
    } else {
      offset = next.offset;
    }
    velocity = next.velocity;
    maximumOffset = Math.max(maximumOffset, Math.abs(offset));
    distance += speed * deltaTime;
  }
  return { collision: null, maximumOffset };
}

function runLevelOneWithoutSteering(): { collision: number | null; maximumOffset: number } {
  const definition = getLevel(1);
  let distance = 0;
  let speed = 0;
  let offset = 0;
  let velocity = 0;
  const deltaTime = 1 / 60;
  const throttleAcceleration = 27 * MAX_SPEED / 120;
  let maximumOffset = 0;

  for (let step = 0; distance < 5400 && step < 5000; step += 1) {
    speed = Math.min(MAX_SPEED, speed + throttleAcceleration * deltaTime);
    const localDistance = distance % definition.length;
    const insideTunnel = definition.tunnels.some((tunnel) => localDistance >= tunnel.start && localDistance <= tunnel.end);
    const next = stepLateralMotion(
      offset,
      velocity,
      speed,
      curveAtDistance(localDistance, 1),
      0,
      deltaTime,
      insideTunnel ? 1 : 0.3,
    );
    const previousOffset = offset;
    offset = next.offset;
    velocity = next.velocity;
    maximumOffset = Math.max(maximumOffset, Math.abs(offset));
    if (insideTunnel) {
      const wall = resolveTunnelWallContact(previousOffset, offset, definition.tunnelWidth / 2, PLAYER_COLLISION_RADIUS);
      offset = wall.offset;
      if (wall.collided) return { collision: distance, maximumOffset };
    }
    distance += speed * deltaTime;
  }
  return { collision: null, maximumOffset };
}

describe('tunnel racing physics', () => {
  it('registers twenty unique, valid level definitions with a narrowing tunnel progression', () => {
    expect(LEVELS).toHaveLength(20);
    expect(validateLevels()).toEqual([]);
    expect(new Set(LEVELS.map(({ name }) => name)).size).toBe(LEVELS.length);
    expect(LEVELS[0].tunnelWidth).toBeGreaterThan(30);
    expect(LEVELS.every((level, index) => index === 0
      || level.tunnelWidth < LEVELS[index - 1].tunnelWidth)).toBe(true);
    expect(LEVELS.every((level) => level.jumps.length <= 3)).toBe(true);
    expect(LEVELS[0].sharpTurns).toHaveLength(0);
    expect(LEVELS[1].sharpTurns.length).toBeGreaterThan(0);
    expect(new Set(LEVELS.flatMap((level) => level.tunnels.map(({ style }) => style))))
      .toEqual(new Set(['wireframe', 'metal', 'neon']));
  });

  it('uses a genuinely high-speed physical range', () => {
    expect(MAX_SPEED).toBeGreaterThanOrEqual(210);
  });

  it('makes steering necessary to hold the line through a fast bend', () => {
    const ordinaryBendStart = 1640;
    const ordinaryBendEnd = 2100;
    expect(runTurn(false, ordinaryBendStart, ordinaryBendEnd)).toBeGreaterThan(
      runTurn(true, ordinaryBendStart, ordinaryBendEnd),
    );
    expect(runTurn(true, ordinaryBendStart, ordinaryBendEnd)).toBeLessThan(HALF_WIDTH - 1);
  });

  it('responds directly to steering and includes tighter corners', () => {
    const steeringResponse = stepLateralMotion(0, 0, MAX_SPEED, 0, 1, 1 / 60);
    let sharpestCurve = 0;
    for (let distance = 0; distance <= 5400; distance += 4) {
      sharpestCurve = Math.max(sharpestCurve, Math.abs(curveAtDistance(distance)));
    }

    expect(steeringResponse.velocity).toBeGreaterThan(0.65);
      expect(sharpestCurve).toBeGreaterThan(0.0014);
  });

  it('uses the same quadratic curve-force physics at every speed', () => {
    const curve = 0.004;
    expect(Math.abs(curveLateralAcceleration(curve, 120)))
      .toBeCloseTo(Math.abs(curveLateralAcceleration(curve, 60)) * 4, 8);
  });

  it('requires forward motion to steer and gives more steering authority at speed', () => {
    expect(steeringAuthorityForSpeed(0)).toBe(0);
    expect(steeringAuthorityForSpeed(60)).toBeGreaterThan(0);
    expect(steeringAuthorityForSpeed(60)).toBeLessThan(steeringAuthorityForSpeed(MAX_SPEED));
    expect(stepLateralMotion(0, 0, 0, 0, 1, 1 / 60).velocity).toBe(0);
    expect(stepLateralMotion(0, 0, MAX_SPEED, 0, 1, 1 / 60).velocity)
      .toBeGreaterThan(stepLateralMotion(0, 0, 60, 0, 1, 1 / 60).velocity);
  });

  it('keeps sharper authored turns controllable with corrective steering', () => {
    let peakLevelTwentyCurvature = 0;
    let peakSignedCurvature = 0;
    for (const turn of sharpTurnsForLevel(MAX_LEVEL)) {
      for (let distance = turn.center - turn.length / 2;
        distance <= turn.center + turn.length / 2;
        distance += 0.5) {
        const curvature = curveAtDistance(distance, MAX_LEVEL);
        if (Math.abs(curvature) > peakLevelTwentyCurvature) {
          peakLevelTwentyCurvature = Math.abs(curvature);
          peakSignedCurvature = curvature;
        }
      }
    }
    const curveForce = Math.abs(curveLateralAcceleration(peakLevelTwentyCurvature, MAX_SPEED));
    const steeringForce = STEERING_ACCELERATION * steeringAuthorityForSpeed(MAX_SPEED);
    const counterSteeredForce = Math.abs(
      curveLateralAcceleration(peakSignedCurvature, MAX_SPEED)
        + Math.sign(peakSignedCurvature) * steeringForce,
    );

    expect(sharpTurnsForLevel(2)[0].length).toBeGreaterThanOrEqual(140);
      expect(peakLevelTwentyCurvature).toBeGreaterThan(0.01);
    expect(peakLevelTwentyCurvature).toBeLessThan(0.017);
    expect(curveForce).toBeLessThan(MAX_LATERAL_ACCELERATION);
    expect(curveForce + steeringForce).toBeLessThan(MAX_LATERAL_ACCELERATION);
    expect(counterSteeredForce).toBeLessThan(curveForce);
  });

  it('increases level-one broad curves without adding authored sharp corners', () => {
    expect(levelOneCurveScale()).toBeGreaterThan(1);
    expect(sharpTurnsForLevel(1)).toHaveLength(0);
    expect(runLevelOneWithoutSteering().maximumOffset).toBeGreaterThan(0);
    expect(runWholeLevelAtBrakedSpeed(1).collision).toBeNull();
  });

  it('uses distinct authored curve profiles and long sharp-turn entries', () => {
    expect(LEVELS.every((level) => level.track.curveAmplitude.length === 5
      && level.track.curveFrequency.length === 5
      && level.track.curvePhase.length === 5)).toBe(true);
    expect(new Set(LEVELS.map((level) => level.track.curvePhase.join(','))).size)
      .toBeGreaterThan(10);
    expect(sharpTurnsForLevel(MAX_LEVEL).every((turn) => turn.length >= 160)).toBe(true);
  });

  it('keeps the horizon level and follows the track before steering input', () => {
    const current = new THREE.Quaternion();
    const curvedTrackTarget = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
    const trackFollowingResponse = cameraOrientationForSteering(current, curvedTrackTarget, 0, 1);
    expect(trackFollowingResponse.angleTo(current)).toBeGreaterThan(0);
    const briefSteer = smoothCameraSteeringInput(0, 1, 1 / 60);
    const briefResponse = cameraOrientationForSteering(current, curvedTrackTarget, briefSteer, 1).angleTo(current);
    const sustainedResponse = cameraOrientationForSteering(current, curvedTrackTarget, 1, 1).angleTo(current);
    expect(briefSteer).toBeGreaterThan(0);
    expect(briefSteer).toBeLessThan(1);
    expect(briefResponse).toBeGreaterThan(0);
    expect(trackFollowingResponse.angleTo(current)).toBeLessThan(sustainedResponse);
    expect(briefResponse).toBeLessThan(sustainedResponse);

    const worldUp = new THREE.Vector3(0, 1, 0);
    const slopedTangent = new THREE.Vector3(0.4, 0.3, -0.86).normalize();
    const rotation = cameraQuaternionFollowingTrack(slopedTangent);
    const cameraUp = worldUp.clone().applyQuaternion(rotation);
    const horizontalUp = worldUp.clone().addScaledVector(slopedTangent, -worldUp.dot(slopedTangent)).normalize();
    expect(cameraUp.dot(horizontalUp)).toBeCloseTo(1, 6);
  });

  it('keeps turn controls consistent while requiring braking for sharp turns', () => {
    const levelTurns = Array.from({ length: MAX_LEVEL }, (_, index) => sharpTurnsForLevel(index + 1));
    const turnCounts = levelTurns.map((turns) => turns.length);

    expect(turnCounts[0]).toBe(0);
    expect(turnCounts[1]).toBe(1);
    expect(turnCounts.at(-1)).toBe(8);
      expect(levelTurns.every((turns, index) => turns.length === LEVELS[index].sharpTurns.length)).toBe(true);
    expect(levelTurns[1][0].strength * levelTurnSharpness(2))
      .toBeLessThan(levelTurns.at(-1)![0].strength * levelTurnSharpness(MAX_LEVEL));

    const firstLevelTwoTurn = levelTurns[1][0];
    const firstTurnStart = firstLevelTwoTurn.center - firstLevelTwoTurn.length / 2;
    const firstTurnEnd = firstLevelTwoTurn.center + firstLevelTwoTurn.length / 2;
    expect(runConstantSteering(MAX_SPEED, firstTurnStart, firstTurnEnd, firstLevelTwoTurn.direction, 2))
      .toBeLessThan(runConstantSteering(MAX_SPEED, firstTurnStart, firstTurnEnd, -firstLevelTwoTurn.direction, 2));
    expect(runUnsteeredTurn(MAX_SPEED, firstLevelTwoTurn, 2)).toBe(true);
    expect(runUnsteeredTurn(60, firstLevelTwoTurn, 2)).toBe(false);
    expect(levelTurns.at(-1)!.some((turn) => runUnsteeredTurn(MAX_SPEED, turn, MAX_LEVEL))).toBe(true);
    expect(levelTurns.at(-1)!.some((turn) => runUnsteeredTurn(60, turn, MAX_LEVEL))).toBe(true);
    for (const turn of levelTurns.at(-1)!) {
      expect(runBrakingApproach(turn, MAX_LEVEL), `braking approach at ${turn.center}`).toBeNull();
    }
  });

  it('lets displayed speed 50 clear every turn with responsive arrow input', () => {
    const physicalSpeed = 50 * MAX_SPEED / MAX_DISPLAY_SPEED;
    for (let level = 2; level <= MAX_LEVEL; level += 1) {
      for (const turn of sharpTurnsForLevel(level)) {
        expect(runKeyControlledTurn(physicalSpeed, turn, level), `level ${level}, turn ${turn.center}`)
          .toBeNull();
      }
    }
  });

  it('limits abrupt lateral snaps in sharp turns at topspeed', () => {
    const firstLevelTwoTurn = sharpTurnsForLevel(2)[0];
    expect(maximumFrameLateralStep(MAX_SPEED, firstLevelTwoTurn, 2)).toBeLessThanOrEqual(0.51);
  });

  it('simulates a continuous playable turn route through every entire level', () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const result = runWholeLevelAtBrakedSpeed(level);
      expect(result.collision, `level ${level}`).toBeNull();
      expect(result.maximumOffset, `level ${level} should keep a wall margin`)
        .toBeLessThan(getLevel(level).tunnelWidth / 2 - PLAYER_COLLISION_RADIUS);
    }
  });

  it('keeps warning signs before turn entry and matches visible and physical curvature', () => {
    const firstLevelTwoTurn = sharpTurnsForLevel(2)[0];
    expect(SHARP_TURN_WARNING_OFFSETS).toHaveLength(4);
    expect(SHARP_TURN_WARNING_OFFSETS.every((offset) => offset < -firstLevelTwoTurn.length / 2)).toBe(true);

    for (const level of [2, MAX_LEVEL]) {
      const turn = sharpTurnsForLevel(level)[0];
      for (const distance of [
        turn.center - 119,
        turn.center - 29,
        turn.center - 20,
        turn.center,
        turn.center + 20,
        turn.center + 29,
        turn.center + 40,
        turn.center + 100,
        turn.center + 269,
      ]) {
        const delta = 0.1;
        const visibleCurvature = (trackX(distance + delta, level) - 2 * trackX(distance, level)
          + trackX(distance - delta, level)) / delta ** 2;
        expect(curveAtDistance(distance, level)).toBeCloseTo(visibleCurvature, 3);
      }
    }
  });

  it('gives the player enough distance to brake before a sharp turn', () => {
    const firstTurn = sharpTurnsForLevel(2)[0];
    const brakingDistanceToCornerSpeed = brakingDistance(MAX_SPEED, 60, BRAKING_DECELERATION);
    const distanceFromFirstWarningToEntry = -firstTurn.length / 2 - SHARP_TURN_WARNING_OFFSETS[0];

    expect(distanceFromFirstWarningToEntry).toBeGreaterThanOrEqual(brakingDistanceToCornerSpeed + 60);
    expect(brakingDistance(MAX_SPEED, 60, BRAKING_DECELERATION)).toBeCloseTo(275.5102, 3);
    expect(runBrakingApproach(firstTurn, 2)).toBeNull();
  });

  it('rotates the camera with each track tangent while keeping the horizon level', () => {
    const worldUp = new THREE.Vector3(0, 1, 0);
    for (const tangent of [
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.7, 0, -0.7141428).normalize(),
      new THREE.Vector3(-0.7, 0.1, -0.7071068).normalize(),
    ]) {
      const rotation = cameraQuaternionFollowingTrack(tangent);
      const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
      const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      const expectedUp = worldUp.clone().addScaledVector(tangent, -worldUp.dot(tangent)).normalize();

      expect(cameraForward.dot(tangent)).toBeCloseTo(1, 6);
      expect(cameraUp.dot(expectedUp)).toBeCloseTo(1, 6);
    }
  });

  it('uses one transition profile for offset and its first two derivatives', () => {
    const profile = transitionAdjustment(30, 2, 120);
    expect(profile.offset).toBeCloseTo(33.75, 8);
    expect(profile.slope).toBeCloseTo(0.375, 8);
    expect(profile.curvature).toBeCloseTo(-1 / 24, 8);

    for (const distance of [20, 48, 96]) {
      const delta = 0.01;
      const before = transitionAdjustment(distance - delta, 2, 120);
      const after = transitionAdjustment(distance + delta, 2, 120);
      const current = transitionAdjustment(distance, 2, 120);
      expect((after.offset - before.offset) / (2 * delta)).toBeCloseTo(current.slope, 3);
      expect((after.slope - before.slope) / (2 * delta)).toBeCloseTo(current.curvature, 3);
    }

    expect(transitionAdjustment(120, 2, 120)).toEqual({ offset: 0, slope: 0, curvature: 0 });
  });

  it('detects hard tunnel-wall contact at the actual half-width', () => {
    expect(hasTunnelWallCollision(HALF_WIDTH - 0.01, HALF_WIDTH)).toBe(false);
    expect(hasTunnelWallCollision(HALF_WIDTH, HALF_WIDTH)).toBe(true);
    expect(hasTunnelWallCollision(-HALF_WIDTH - 0.01, HALF_WIDTH)).toBe(true);
  });

  it('sweeps and resolves wall contact without leaving the tunnel', () => {
    expect(resolveTunnelWallContact(10, 25, HALF_WIDTH)).toEqual({ collided: true, offset: HALF_WIDTH });
    expect(resolveTunnelWallContact(-10, -25, HALF_WIDTH)).toEqual({ collided: true, offset: -HALF_WIDTH });
    expect(resolveTunnelWallContact(10, 11, HALF_WIDTH)).toEqual({ collided: false, offset: 11 });
    expect(resolveTunnelWallContact(13, 0, HALF_WIDTH)).toEqual({ collided: true, offset: HALF_WIDTH });
    expect(resolveTunnelWallContact(10, 25, HALF_WIDTH, PLAYER_COLLISION_RADIUS))
      .toEqual({ collided: true, offset: HALF_WIDTH - PLAYER_COLLISION_RADIUS });
  });

  it('bounces tunnel-wall impacts back inward and retains reduced forward speed', () => {
    const contact = resolveTunnelWallContact(10, 25, HALF_WIDTH, PLAYER_COLLISION_RADIUS);
    const rebound = applyTunnelWallRebound(contact, 30, 120);

    expect(rebound.offset).toBeLessThan(HALF_WIDTH - PLAYER_COLLISION_RADIUS);
    expect(rebound.lateralVelocity).toBeLessThan(0);
    expect(rebound.speed).toBeLessThan(120);
    const nextOffset = rebound.offset + rebound.lateralVelocity / 60;
    expect(resolveTunnelWallContact(rebound.offset, nextOffset, HALF_WIDTH, PLAYER_COLLISION_RADIUS).collided)
      .toBe(false);
  });

  it('responds to counter-steering immediately during the wall rebound', () => {
    const contact = resolveTunnelWallContact(10, 20, HALF_WIDTH, PLAYER_COLLISION_RADIUS);
    const rebound = applyTunnelWallRebound(contact, 30, MAX_SPEED);
    let offset = rebound.offset;
    let velocity = rebound.lateralVelocity;
    let passiveOffset = rebound.offset;
    let passiveVelocity = rebound.lateralVelocity;

    for (let frame = 0; frame < 12; frame += 1) {
      const next = stepWallRebound(offset, velocity, 1 / 60, 1, rebound.speed);
      offset = next.offset;
      velocity = next.velocity;
      const passive = stepWallRebound(passiveOffset, passiveVelocity, 1 / 60);
      passiveOffset = passive.offset;
      passiveVelocity = passive.velocity;
    }

    expect(velocity).toBeGreaterThan(passiveVelocity + 1.5);
    expect(offset).toBeGreaterThan(passiveOffset + 0.15);
  });

  it('makes a hard wall impact lose more speed and rebound across to the opposite wall', () => {
    const firstContact = resolveTunnelWallContact(10, 20, HALF_WIDTH, PLAYER_COLLISION_RADIUS);
    const firstBounce = applyTunnelWallRebound(firstContact, 30, MAX_SPEED);
    let offset = firstBounce.offset;
    let velocity = firstBounce.lateralVelocity;
    let reboundTime = firstBounce.reboundDuration;
    let wallBounces = 1;
    let oppositeImpactSpeed = 0;
    let oppositeWallBounce: ReturnType<typeof applyTunnelWallRebound> | null = null;
    let finalBounce: ReturnType<typeof applyTunnelWallRebound> | null = null;

    for (let frame = 0; frame < 600; frame += 1) {
      const deltaTime = 1 / 60;
      const next = reboundTime > 0
        ? stepWallRebound(offset, velocity, deltaTime)
        : stepLateralMotion(offset, velocity, 0, 0, 0, deltaTime);
      const contact = resolveTunnelWallContact(
        offset, next.offset, HALF_WIDTH, PLAYER_COLLISION_RADIUS,
      );
      offset = contact.offset;
      velocity = next.velocity;
      if (contact.collided) {
        if (wallBounces === 1) oppositeImpactSpeed = Math.abs(velocity);
        const bounce = applyTunnelWallRebound(contact, velocity, firstBounce.speed);
        wallBounces += 1;
        if (wallBounces === 2) oppositeWallBounce = bounce;
        else finalBounce = bounce;
        offset = bounce.offset;
        velocity = bounce.lateralVelocity;
        reboundTime = bounce.reboundDuration;
        expect(reboundTime).toBeGreaterThan(0);
      } else {
        if (reboundTime <= 0
          && Math.abs(offset) > HALF_WIDTH - PLAYER_COLLISION_RADIUS - 1.25) {
          velocity *= Math.exp(-8 * deltaTime);
        }
        reboundTime = Math.max(0, reboundTime - deltaTime);
      }
    }

    expect(firstBounce.speed).toBeLessThan(MAX_SPEED * 0.12);
    expect(firstBounce.lateralVelocity).toBeGreaterThanOrEqual(-42);
    expect(firstBounce.lateralVelocity).toBeLessThan(-30);
    expect(oppositeWallBounce).not.toBeNull();
    expect(oppositeImpactSpeed).toBeGreaterThan(20);
    expect(Math.sign(oppositeWallBounce!.offset)).toBe(-Math.sign(firstBounce.offset));
    expect(oppositeWallBounce!.lateralVelocity).toBeGreaterThan(0);
    expect(finalBounce).toBeNull();
  });

  it('lets a softer wall impact lose energy before reaching the opposite wall', () => {
    const contact = resolveTunnelWallContact(10, 20, HALF_WIDTH, PLAYER_COLLISION_RADIUS);
    const bounce = applyTunnelWallRebound(contact, 12, 120);
    let offset = bounce.offset;
    let velocity = bounce.lateralVelocity;
    const deltaTime = 1 / 60;

    for (let elapsed = 0; elapsed < bounce.reboundDuration; elapsed += deltaTime) {
      const next = stepWallRebound(offset, velocity, deltaTime);
      const wall = resolveTunnelWallContact(offset, next.offset, HALF_WIDTH, PLAYER_COLLISION_RADIUS);
      expect(wall.collided).toBe(false);
      offset = wall.offset;
      velocity = next.velocity;
    }

    expect(Math.abs(bounce.lateralVelocity)).toBeLessThan(12);
    expect(bounce.speed).toBeLessThan(120 * 0.55);
    expect(offset).toBeGreaterThan(0);
    expect(Math.abs(offset)).toBeLessThan(HALF_WIDTH - PLAYER_COLLISION_RADIUS);
  });

  it('pushes away from the wall after a weak impact instead of settling against it', () => {
    const contact = resolveTunnelWallContact(10, 12, HALF_WIDTH, PLAYER_COLLISION_RADIUS);
    const bounce = applyTunnelWallRebound(contact, 2, 108);
    let offset = bounce.offset;
    let velocity = bounce.lateralVelocity;

    for (let elapsed = 0; elapsed < bounce.reboundDuration; elapsed += 1 / 60) {
      const next = stepWallRebound(offset, velocity, 1 / 60);
      offset = next.offset;
      velocity = next.velocity;
    }

    expect(Math.abs(bounce.lateralVelocity)).toBeGreaterThan(2);
    expect(Math.abs(offset)).toBeLessThan(HALF_WIDTH - PLAYER_COLLISION_RADIUS - 2);
  });

  it('scales turn sharpness steadily from level 1 through level 20', () => {
    const levelScales = Array.from({ length: MAX_LEVEL }, (_, index) => levelTurnSharpness(index + 1));
    const peakCurvature = (level: number) => {
      let peak = 0;
      for (let distance = 0; distance <= 5400; distance += 4) {
        peak = Math.max(peak, Math.abs(curveAtDistance(distance, level)));
      }
      return peak;
    };

    expect(levelScales[0]).toBe(1);
    expect(levelScales.at(-1)).toBeGreaterThan(levelScales[0]);
    expect(levelScales.every((scale, index) => index === 0 || scale > levelScales[index - 1])).toBe(true);
    expect(levelTurnSharpness(MAX_LEVEL + 1)).toBe(levelScales.at(-1));
    expect(peakCurvature(MAX_LEVEL)).toBeGreaterThan(peakCurvature(1));
  });

  it('uses distinct curve and terrain rhythms instead of only scaling one pattern', () => {
    const levelOneTurn = curveAtDistance(840, 1);
    const levelTwoTurn = curveAtDistance(840, 2);
    const levelThreeTurn = curveAtDistance(840, 3);
    const levelOneHeight = rawTrackHeight(2160, 1);
    const levelTwoHeight = rawTrackHeight(2160, 2);
    const levelThreeHeight = rawTrackHeight(2160, 3);

    expect(levelTwoTurn).not.toBeCloseTo(levelOneTurn, 5);
    expect(levelThreeTurn).not.toBeCloseTo(levelTwoTurn, 5);
    expect(levelTwoHeight).not.toBeCloseTo(levelOneHeight, 5);
    expect(levelThreeHeight).not.toBeCloseTo(levelTwoHeight, 5);
  });

  it('moves to the next level at the finish distance without resetting world progress', () => {
    expect(levelAtDistance(0, 5400)).toBe(1);
    expect(levelAtDistance(5399, 5400)).toBe(1);
    expect(levelAtDistance(5400, 5400)).toBe(2);
    expect(levelAtDistance(5400 * 19, 5400)).toBe(MAX_LEVEL);
    expect(levelAtDistance(5400 * MAX_LEVEL, 5400)).toBe(MAX_LEVEL);
  });

  it('keeps level heights continuous and identifies transition rings once', () => {
    const originBefore = 12;
    const previousEndHeight = 7.5;
    const nextStartHeight = -2.25;
    const nextOrigin = nextLevelOrigin(originBefore, previousEndHeight, nextStartHeight);

    expect(originBefore + previousEndHeight).toBe(nextOrigin + nextStartHeight);
    expect(isLevelBoundary(5400, 5400)).toBe(true);
    expect(isLevelBoundary(5399, 5400)).toBe(false);
    expect(isLevelBoundary(0, 5400)).toBe(false);
  });

  it('maps level 2 jump indices to the correct destination tunnel', () => {
    expect(landingTunnelIndexForGap(0, 3)).toBe(1);
    expect(landingTunnelIndexForGap(1, 3)).toBe(2);
    expect(landingTunnelIndexForGap(2, 3)).toBe(4);
    expect(landingTunnelIndexForGap(3, 3)).toBe(5);
    expect(landingTunnelIndexForGap(38, 3)).toBe(58);
    expect(landingTunnelIndexForGap(39, 3)).toBe(59);
  });

  it('adds more pronounced hills and valleys at higher levels', () => {
    let levelOneMin = Number.POSITIVE_INFINITY;
    let levelOneMax = Number.NEGATIVE_INFINITY;
    let levelTwentyMin = Number.POSITIVE_INFINITY;
    let levelTwentyMax = Number.NEGATIVE_INFINITY;
    for (let distance = 0; distance <= 5400; distance += 4) {
      const levelOneHeight = rawTrackHeight(distance, 1);
      const levelTwentyHeight = rawTrackHeight(distance, MAX_LEVEL);
      levelOneMin = Math.min(levelOneMin, levelOneHeight);
      levelOneMax = Math.max(levelOneMax, levelOneHeight);
      levelTwentyMin = Math.min(levelTwentyMin, levelTwentyHeight);
      levelTwentyMax = Math.max(levelTwentyMax, levelTwentyHeight);
    }
    expect(levelTwentyMax - levelTwentyMin).toBeGreaterThan(levelOneMax - levelOneMin);
  });

  it('launches only from a tunnel exit with an upward ramp', () => {
    expect(isUpwardLaunch(0)).toBe(false);
    expect(isUpwardLaunch(-0.1)).toBe(false);
    expect(isUpwardLaunch(RAMP_SLOPE)).toBe(true);
    expect(launchVerticalVelocity(MAX_SPEED, RAMP_SLOPE)).toBe(MAX_AIR_LAUNCH_SPEED);
    expect(launchVerticalVelocity(30, RAMP_SLOPE)).toBeLessThan(MAX_AIR_LAUNCH_SPEED);
  });

  it('raises the track monotonically through each launch ramp', () => {
    const heights = Array.from({ length: 11 }, (_, index) => rampHeightAtProgress(index / 10));
    expect(heights[0]).toBe(0);
    expect(heights.at(-1)).toBeGreaterThan(0);
    expect(heights.every((height, index) => index === 0 || height > heights[index - 1])).toBe(true);
    expect(rampHeightAtProgress(-1)).toBe(0);
    expect(rampHeightAtProgress(2)).toBe(heights.at(-1));
  });

  it('rejects a jump trajectory that touches the next tunnel roof', () => {
    expect(hasTunnelClearance(6.5, 16)).toBe(true);
    expect(hasTunnelClearance(7.5, 16)).toBe(false);
    expect(hasTunnelClearance(-7.5, 16)).toBe(false);
    expect(predictTransfer(80, 60, 0.2, -20).roofClear).toBe(false);
    expect(predictTransfer(80, 100, RAMP_SLOPE, 0).roofClear).toBe(true);
  });

  it('keeps each authored jump within the destination tunnel and speed envelope', () => {
    for (const level of LEVELS) {
      for (const jump of level.jumps) {
        const gapLength = jump.landing - jump.launch;
        const landingTunnel = level.tunnels.find((tunnel) => tunnel.start === jump.landing);
        expect(landingTunnel, `level ${level.id}, jump ${jump.launch}: destination tunnel`).toBeDefined();
        expect(gapLength).toBeGreaterThan(0);
        expect(gapLength).toBeLessThan(180);

        for (const speed of [160, MAX_SPEED]) {
          const prediction = predictTransfer(speed, gapLength, jump.rampSlope, 0, level.tunnelHeight);
          expect(prediction.clearsGap, `level ${level.id}, jump ${jump.launch}, speed ${speed}`).toBe(true);
          expect(prediction.roofClear, `level ${level.id}, jump ${jump.launch}, speed ${speed}`).toBe(true);
          expect(jump.launch + prediction.horizontalRange).toBeLessThan((landingTunnel?.end ?? 0) - 8);
        }

        expect(predictTransfer(60, gapLength, jump.rampSlope, 0, level.tunnelHeight).clearsGap)
          .toBe(false);
      }
    }
  });
});
