import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import './style.css';
import { getLevel, LEVELS, type TunnelStyle } from './levels';
import {
  cameraOrientationForSteering,
  cameraQuaternionFollowingTrack,
  smoothCameraSteeringInput,
} from './camera-rig';
import {
  GRAVITY,
  LANDING_MARGIN,
  MAX_DISPLAY_SPEED,
  MAX_LEVEL,
  MAX_SPEED,
  BRAKING_DECELERATION,
  PLAYER_COLLISION_RADIUS,
  RAMP_LENGTH,
  RAMP_SLOPE,
  curveAtDistance,
  applyTunnelWallRebound,
  flightDuration,
  hasTunnelClearance,
  isLevelBoundary,
  isUpwardLaunch,
  levelAtDistance,
  launchVerticalVelocity,
  predictTransfer,
  rawTrackHeight,
  rampHeightAtProgress,
  resolveTunnelWallContact,
  nextLevelOrigin,
  SHARP_TURN_WARNING_OFFSETS,
  stepLateralMotion,
  stepWallRebound,
  sharpTurnsForLevel,
  transitionAdjustment,
  trackX,
  trajectoryHeight,
} from './race-physics';

type GameState = 'title' | 'playing' | 'paused' | 'crashed' | 'finished';
type SignalState = 'red' | 'amber' | 'green' | 'air';

interface TunnelSection {
  start: number;
  end: number;
  levelId: number;
  width: number;
  height: number;
  style: TunnelStyle;
}

interface JumpGap {
  launch: number;
  landing: number;
  landingTunnelEnd: number;
  levelId: number;
  tunnelWidth: number;
  tunnelHeight: number;
  rampSlope: number;
}

interface TrackFrame {
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

const CRASH_DURATION = 1.25;
// Preserve the original acceleration and braking feel as the top speed changes.
const SPEED_SCALE = MAX_SPEED / 120;
let currentLevel = 1;

const LEVEL_LENGTH = LEVELS[0].length;
const LEVEL_STARTS = LEVELS.map((_, index) => index * LEVEL_LENGTH);
const TUNNELS: TunnelSection[] = LEVELS.flatMap((level, levelIndex) =>
  level.tunnels.map((section) => ({
    start: section.start + LEVEL_STARTS[levelIndex],
    end: section.end + LEVEL_STARTS[levelIndex],
    levelId: level.id,
    width: level.tunnelWidth,
    height: level.tunnelHeight,
    style: section.style,
  })),
);
const tunnelAtDistance = (distance: number) => TUNNELS.find((section) => distance >= section.start && distance <= section.end);
const GAPS: JumpGap[] = LEVELS.flatMap((level, levelIndex) => level.jumps.map((jump) => ({
  launch: jump.launch + LEVEL_STARTS[levelIndex],
  landing: jump.landing + LEVEL_STARTS[levelIndex],
  landingTunnelEnd: (level.tunnels.find((section) => section.start === jump.landing)?.end ?? jump.landing)
    + LEVEL_STARTS[levelIndex],
  levelId: level.id,
  tunnelWidth: level.tunnelWidth,
  tunnelHeight: level.tunnelHeight,
  rampSlope: jump.rampSlope,
})));
const LEVEL_ENDS = LEVELS.map((level, index) => LEVEL_STARTS[index] + level.length);
const LEVEL_TRANSITION_LENGTH = 120;
const STARTING_CAMERA_CLEARANCE = 12;
const TUNNEL_RING_SPACING = 24;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required page element: #${id}`);
  return element as T;
};

const canvas = byId<HTMLCanvasElement>('game-canvas');
const hud = byId<HTMLElement>('hud');
const titleScreen = byId<HTMLElement>('title-screen');
const pauseScreen = byId<HTMLElement>('pause-screen');
const crashScreen = byId<HTMLElement>('crash-screen');
const finishScreen = byId<HTMLElement>('finish-screen');
const startButton = byId<HTMLButtonElement>('start-button');
const resumeButton = byId<HTMLButtonElement>('resume-button');
const pauseButton = byId<HTMLButtonElement>('pause-button');
const pauseRestartButton = byId<HTMLButtonElement>('restart-pause-button');
const finishRestartButton = byId<HTMLButtonElement>('restart-finish-button');
const motionToggle = byId<HTMLButtonElement>('motion-toggle');
const soundToggle = byId<HTMLButtonElement>('sound-toggle');
const pauseMotionToggle = byId<HTMLButtonElement>('pause-motion-toggle');
const pauseSoundToggle = byId<HTMLButtonElement>('pause-sound-toggle');
const fullscreenButton = byId<HTMLButtonElement>('fullscreen-button');
const speedValue = byId<HTMLElement>('speed-value');
const speedFill = byId<HTMLElement>('speed-fill');
const speedMeter = document.querySelector<HTMLElement>('.speed-meter');
const jumpPanel = byId<HTMLElement>('jump-panel');
const jumpStatus = byId<HTMLElement>('jump-status');
const jumpDetail = byId<HTMLElement>('jump-detail');
const gapDistance = byId<HTMLElement>('gap-distance');
const signalLamp = byId<HTMLElement>('signal-lamp');
const sectionLabel = byId<HTMLElement>('section-label');
const runDistance = byId<HTMLElement>('run-distance');
const runState = byId<HTMLElement>('run-state');
const crashTitle = byId<HTMLElement>('crash-title');
const crashDetail = byId<HTMLElement>('crash-detail');
const toast = byId<HTMLElement>('toast');
const finishEyebrow = byId<HTMLElement>('finish-eyebrow');
const finishTitle = byId<HTMLElement>('finish-title');
const finishCopy = byId<HTMLElement>('finish-copy');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x05070c, 1);
const wireframeMaterials: LineMaterial[] = [];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.Fog(0x05070c, 105, 290);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1500);
scene.add(camera);

const trackRoot = new THREE.Group();
scene.add(trackRoot);

function localTrackHeight(distance: number, level: number): number {
  const definition = getLevel(level);
  const sectionIndex = definition.tunnels.findIndex((section) => distance >= section.start && distance <= section.end);
  if (sectionIndex >= 0) {
    const section = definition.tunnels[sectionIndex];
    const rampStart = section.end - RAMP_LENGTH;
    const jump = definition.jumps.find((candidate) => candidate.launch === section.end);
    if (jump && distance >= rampStart) {
      const progress = (distance - rampStart) / RAMP_LENGTH;
      return rawTrackHeight(rampStart, level)
        + definition.jumps.slice(0, sectionIndex).reduce((total, item) => total + RAMP_LENGTH * item.rampSlope / 2, 0)
        + rampHeightAtProgress(progress) * (jump.rampSlope / RAMP_SLOPE);
    }
    return rawTrackHeight(distance, level)
      + definition.jumps.slice(0, sectionIndex).reduce((total, item) => total + RAMP_LENGTH * item.rampSlope / 2, 0);
  }

  const nextSectionIndex = definition.tunnels.findIndex((section) => distance < section.start);
  if (nextSectionIndex > 0) {
    const previousSection = definition.tunnels[nextSectionIndex - 1];
    const nextSection = definition.tunnels[nextSectionIndex];
    const progress = (distance - previousSection.end) / (nextSection.start - previousSection.end);
    const launchHeight = rawTrackHeight(previousSection.end - RAMP_LENGTH, level)
      + definition.jumps.slice(0, nextSectionIndex).reduce((total, item) => total + RAMP_LENGTH * item.rampSlope / 2, 0);
    const landingHeight = rawTrackHeight(nextSection.start, level)
      + definition.jumps.slice(0, nextSectionIndex).reduce((total, item) => total + RAMP_LENGTH * item.rampSlope / 2, 0);
    return THREE.MathUtils.lerp(launchHeight, landingHeight, progress);
  }

  return rawTrackHeight(distance, level)
    + definition.jumps.reduce((total, jump) => total + RAMP_LENGTH * jump.rampSlope / 2, 0);
}

function courseLevel(distance: number): number {
  return levelAtDistance(distance, LEVEL_LENGTH);
}

function levelOriginHeight(level: number): number {
  let origin = 0;
  for (let previousLevel = 1; previousLevel < level; previousLevel += 1) {
    origin = nextLevelOrigin(
      origin,
      localTrackHeight(LEVEL_LENGTH, previousLevel),
      localTrackHeight(0, previousLevel + 1),
    );
  }
  return origin;
}

function levelOriginX(level: number): number {
  let origin = 0;
  for (let previousLevel = 1; previousLevel < level; previousLevel += 1) {
    origin += trackX(LEVEL_LENGTH, previousLevel) - trackX(0, previousLevel + 1);
  }
  return origin;
}

function levelSlopeDelta(level: number, sampleAt: (distance: number, level: number) => number): number {
  const previousSlope = (sampleAt(LEVEL_LENGTH, level - 1) - sampleAt(LEVEL_LENGTH - 0.5, level - 1)) / 0.5;
  const nextSlope = (sampleAt(0.5, level) - sampleAt(0, level)) / 0.5;
  return previousSlope - nextSlope;
}

function courseTransitionAdjustment(
  distance: number,
  level: number,
  sampleAt: (distance: number, level: number) => number,
) {
  const slopeDelta = level > 1 ? levelSlopeDelta(level, sampleAt) : 0;
  return transitionAdjustment(distance, slopeDelta, LEVEL_TRANSITION_LENGTH);
}

function trackHeight(distance: number): number {
  const level = courseLevel(distance);
  const localDistance = distance - (level - 1) * LEVEL_LENGTH;
  const { offset } = courseTransitionAdjustment(localDistance, level, localTrackHeight);
  return levelOriginHeight(level) + localTrackHeight(localDistance, level) + offset;
}

function trackOffsetX(distance: number, level: number): number {
  const localDistance = distance - (level - 1) * LEVEL_LENGTH;
  const { offset } = courseTransitionAdjustment(localDistance, level, trackX);
  return levelOriginX(level) + trackX(localDistance, level) + offset;
}

function launchRampSlope(distance: number): number {
  return GAPS.find((gap) => Math.abs(gap.launch - distance) < 0.01)?.rampSlope ?? 0;
}

function courseCurve(distance: number): number {
  const level = courseLevel(distance);
  const localDistance = distance - (level - 1) * LEVEL_LENGTH;
  const { curvature } = courseTransitionAdjustment(localDistance, level, trackX);
  return curveAtDistance(localDistance, level) + curvature;
}

function pathCenter(distance: number): THREE.Vector3 {
  const s = Math.max(-40, distance);
  const level = courseLevel(s);
  const x = trackOffsetX(s, level);
  const y = trackHeight(s);
  return new THREE.Vector3(x, y, -s);
}

function sampleTrack(distance: number): TrackFrame {
  const center = pathCenter(distance);
  const before = pathCenter(distance - 0.7);
  const after = pathCenter(distance + 0.7);
  const tangent = after.sub(before).normalize();
  const right = tangent.clone().cross(WORLD_UP).normalize();
  const up = right.clone().cross(tangent).normalize();
  return { center, tangent, right, up };
}

function cornersAt(distance: number): THREE.Vector3[] {
  const { center, right, up } = sampleTrack(distance);
  const section = tunnelAtDistance(distance);
  const level = getLevel(courseLevel(distance));
  const halfWidth = (section?.width ?? level.tunnelWidth) / 2;
  const halfHeight = (section?.height ?? level.tunnelHeight) / 2;
  return [
    center.clone().addScaledVector(right, -halfWidth).addScaledVector(up, -halfHeight),
    center.clone().addScaledVector(right, halfWidth).addScaledVector(up, -halfHeight),
    center.clone().addScaledVector(right, halfWidth).addScaledVector(up, halfHeight),
    center.clone().addScaledVector(right, -halfWidth).addScaledVector(up, halfHeight),
  ];
}

function addLineSegments(points: THREE.Vector3[], color: number, opacity: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  trackRoot.add(lines);
  return lines;
}

function addWireframeSegments(points: THREE.Vector3[], color: number, opacity: number): void {
  const geometry = new LineSegmentsGeometry().setPositions(
    points.flatMap(({ x, y, z }) => [x, y, z]),
  );
  const material = new LineMaterial({
    color,
    linewidth: 3,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);
  wireframeMaterials.push(material);
  trackRoot.add(new LineSegments2(geometry, material));
}

function addMetalSideWalls(section: TunnelSection): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const seamPoints: THREE.Vector3[] = [];
  const cyanInlayPoints: THREE.Vector3[] = [];
  const amberMarkerPoints: THREE.Vector3[] = [];
  const panelLength = 24;
  const panelTints = [0x32444e, 0x43545b, 0x304550, 0x4c5c61, 0x2a3a43];

  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) => {
    for (const [vertex, shade] of [[a, 0.94], [b, 1.04], [c, 1.0]] as const) {
      positions.push(vertex.x, vertex.y, vertex.z);
      const vertexColor = color.clone().multiplyScalar(shade);
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
  };

  for (let distance = section.start, panelIndex = 0;
    distance < section.end;
    distance += panelLength, panelIndex += 1) {
    const nextDistance = Math.min(distance + panelLength, section.end);
    const currentCorners = cornersAt(distance);
    const nextCorners = cornersAt(nextDistance);

    for (let side = 0; side < 2; side += 1) {
      const lower = side === 0 ? 0 : 1;
      const upper = side === 0 ? 3 : 2;
      const a = currentCorners[lower];
      const b = nextCorners[lower];
      const c = nextCorners[upper];
      const d = currentCorners[upper];
      const center = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
      const tintIndex = (panelIndex * 3 + side * 2 + Math.floor(panelIndex / 3)) % panelTints.length;
      const tint = new THREE.Color(panelTints[tintIndex]);

      addTriangle(a, b, center, tint);
      addTriangle(b, c, center, tint.clone().multiplyScalar(1.05));
      addTriangle(c, d, center, tint.clone().multiplyScalar(0.92));
      addTriangle(d, a, center, tint.clone().multiplyScalar(1.08));
      seamPoints.push(a, d);

      const lowerInlayStart = a.clone().lerp(d, 0.24);
      const lowerInlayEnd = b.clone().lerp(c, 0.24);
      const upperInlayStart = a.clone().lerp(d, 0.78);
      const upperInlayEnd = b.clone().lerp(c, 0.78);
      if (panelIndex % 4 === 1) cyanInlayPoints.push(lowerInlayStart, lowerInlayEnd);
      if (panelIndex % 5 === 3 && side === 1) {
        amberMarkerPoints.push(upperInlayStart, upperInlayStart.clone().lerp(upperInlayEnd, 0.3));
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  trackRoot.add(new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  ));
  addLineSegments(seamPoints, 0x91a7ad, 0.26);
  addLineSegments(cyanInlayPoints, 0x56cbd0, 0.48);
  addLineSegments(amberMarkerPoints, 0xe7a34e, 0.58);
}

function addMetalRoofAndRoad(section: TunnelSection): void {
  const roofPositions: number[] = [];
  const roofColors: number[] = [];
  const roadPositions: number[] = [];
  const roadColors: number[] = [];
  const roofRibs: THREE.Vector3[] = [];
  const roofLightPoints: THREE.Vector3[] = [];
  const roadEdgePoints: THREE.Vector3[] = [];
  const panelLength = 18;
  const roofTints = [0x263943, 0x30454e, 0x354851, 0x293d46];
  const roadTints = [0x111d25, 0x17252c, 0x1b2b32, 0x142229];

  const addColoredQuad = (
    positions: number[],
    colors: number[],
    corners: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
    color: THREE.Color,
    facet: number,
  ) => {
    const [a, b, c, d] = corners;
    const center = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
    for (const [triangle, shade] of [
      [[a, b, center], 0.94 + facet] as const,
      [[b, c, center], 1.02 - facet] as const,
      [[c, d, center], 1.06 + facet] as const,
      [[d, a, center], 0.9 - facet] as const,
    ]) {
      for (const vertex of triangle) {
        positions.push(vertex.x, vertex.y, vertex.z);
        const vertexColor = color.clone().multiplyScalar(shade);
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
      }
    }
  };

  const addStrip = (
    positions: number[],
    colors: number[],
    startA: THREE.Vector3,
    startB: THREE.Vector3,
    endB: THREE.Vector3,
    endA: THREE.Vector3,
    color: number,
  ) => addColoredQuad(
    positions,
    colors,
    [startA, startB, endB, endA],
    new THREE.Color(color),
    0,
  );

  for (let distance = section.start, panelIndex = 0;
    distance < section.end;
    distance += panelLength, panelIndex += 1) {
    const nextDistance = Math.min(distance + panelLength, section.end);
    const current = cornersAt(distance);
    const next = cornersAt(nextDistance);
    const roofInset = 0.055;
    const roadInset = 0.07;
    const roofA = current[3].clone().addScaledVector(sampleTrack(distance).up, -roofInset);
    const roofB = current[2].clone().addScaledVector(sampleTrack(distance).up, -roofInset);
    const roofC = next[2].clone().addScaledVector(sampleTrack(nextDistance).up, -roofInset);
    const roofD = next[3].clone().addScaledVector(sampleTrack(nextDistance).up, -roofInset);
    const roadA = current[0].clone().addScaledVector(sampleTrack(distance).up, roadInset);
    const roadB = current[1].clone().addScaledVector(sampleTrack(distance).up, roadInset);
    const roadC = next[1].clone().addScaledVector(sampleTrack(nextDistance).up, roadInset);
    const roadD = next[0].clone().addScaledVector(sampleTrack(nextDistance).up, roadInset);
    const tintIndex = (panelIndex * 3 + Math.floor(panelIndex / 4)) % roofTints.length;

    addColoredQuad(roofPositions, roofColors, [roofA, roofB, roofC, roofD],
      new THREE.Color(roofTints[tintIndex]), panelIndex % 2 === 0 ? 0.035 : -0.02);
    addColoredQuad(roadPositions, roadColors, [roadA, roadB, roadC, roadD],
      new THREE.Color(roadTints[tintIndex]), panelIndex % 2 === 0 ? -0.015 : 0.02);

    if (panelIndex % 2 === 0) {
      roofRibs.push(roofA, roofB);
      const ridgeA = roofA.clone().lerp(roofB, 0.5);
      const ridgeB = roofD.clone().lerp(roofC, 0.5);
      roofLightPoints.push(ridgeA, ridgeB);
    }

    const leftEdgeStart = roadA.clone().lerp(roadB, 0.12);
    const leftEdgeEnd = roadD.clone().lerp(roadC, 0.12);
    const rightEdgeStart = roadA.clone().lerp(roadB, 0.88);
    const rightEdgeEnd = roadD.clone().lerp(roadC, 0.88);
    roadEdgePoints.push(leftEdgeStart, leftEdgeEnd, rightEdgeStart, rightEdgeEnd);

    if (panelIndex % 3 === 0) {
      const dashStart = roadA.clone().lerp(roadB, 0.49);
      const dashEnd = roadA.clone().lerp(roadB, 0.51);
      const nextDashStart = roadD.clone().lerp(roadC, 0.49);
      const nextDashEnd = roadD.clone().lerp(roadC, 0.51);
      addStrip(roadPositions, roadColors, dashStart, dashEnd, nextDashEnd, nextDashStart, 0x3c9b9e);
    }
  }

  const addSurface = (positions: number[], colors: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    trackRoot.add(new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    ));
  };

  addSurface(roofPositions, roofColors);
  addSurface(roadPositions, roadColors);
  addLineSegments(roofRibs, 0x91a7ad, 0.24);
  addLineSegments(roofLightPoints, 0x55c9ce, 0.5);
  addLineSegments(roadEdgePoints, 0xd79c50, 0.45);
}

interface NeonTubePlacement {
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
  length: number;
}

interface FlickeringLamp {
  tube: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  color: THREE.Color;
  phase: number;
  flickers: boolean;
}

const flickeringLamps: FlickeringLamp[] = [];

function neonTubeGeometry(radius: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const segments = 8;
  const lowerCenter = [0, -0.5, 0] as const;
  const upperCenter = [0, 0.5, 0] as const;

  const addTriangle = (a: readonly number[], b: readonly number[], c: readonly number[]) => {
    vertices.push(...a, ...b, ...c);
  };

  for (let segment = 0; segment < segments; segment += 1) {
    const angleA = segment / segments * Math.PI * 2;
    const angleB = (segment + 1) / segments * Math.PI * 2;
    const lowerA = [Math.cos(angleA) * radius, -0.5, Math.sin(angleA) * radius];
    const lowerB = [Math.cos(angleB) * radius, -0.5, Math.sin(angleB) * radius];
    const upperA = [lowerA[0], 0.5, lowerA[2]];
    const upperB = [lowerB[0], 0.5, lowerB[2]];

    addTriangle(lowerA, upperA, upperB);
    addTriangle(lowerA, upperB, lowerB);
    addTriangle(lowerCenter, lowerB, lowerA);
    addTriangle(upperCenter, upperA, upperB);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function addNeonSideTubes(section: TunnelSection): void {
  const tubeColors = [0x63f5f3, 0xb78aff, 0xffbd59];
  const placements: NeonTubePlacement[][] = tubeColors.map(() => []);
  const cylinderAxis = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  let seed = ((section.start + 1) * 7919) % 2147483647;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  for (let distance = section.start + 16; distance < section.end - 12;) {
    distance += 24 + random() * 52;
    if (distance >= section.end - 8) break;

    const side = random() < 0.5 ? -1 : 1;
    const height = -5.4 + random() * 10.8;
    const length = 9 + random() * 12;
    const colorRoll = random();
    const colorIndex = colorRoll < 0.44 ? 0 : colorRoll < 0.77 ? 1 : 2;
    const frame = sampleTrack(distance);
    placements[colorIndex].push({
      position: frame.center.clone()
        .addScaledVector(frame.right, side * (section.width / 2 - 0.075))
        .addScaledVector(frame.up, height),
      orientation: new THREE.Quaternion().setFromUnitVectors(cylinderAxis, frame.tangent),
      length,
    });
  }

  placements.forEach((fixtures, colorIndex) => {
    if (fixtures.length === 0) return;
    const color = tubeColors[colorIndex];
    const halo = new THREE.InstancedMesh(
      neonTubeGeometry(0.24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      fixtures.length,
    );
    const tube = new THREE.InstancedMesh(
      neonTubeGeometry(0.06),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      fixtures.length,
    );

    fixtures.forEach((fixture, index) => {
      scale.set(1, fixture.length, 1);
      matrix.compose(fixture.position, fixture.orientation, scale);
      halo.setMatrixAt(index, matrix);
      tube.setMatrixAt(index, matrix);
      tube.setColorAt(index, new THREE.Color(color));
    });

    trackRoot.add(halo, tube);
  });
}

function addGraffitiTunnel(section: TunnelSection): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const spillPositions: number[] = [];
  const spillColors: number[] = [];
  const graffitiPoints: THREE.Vector3[] = [];
  const graffitiColor = 0x080808;
  const wallTints = [0x414044, 0x504d50, 0x46464a, 0x575255];
  const roofTints = [0x1b1d22, 0x222328, 0x191c21];
  const floorTints = [0x252629, 0x2d2c2d, 0x232528];
  const panelLength = 18;

  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, tint: number) => {
    const color = new THREE.Color(tint);
    for (const point of [a, b, c]) {
      positions.push(point.x, point.y, point.z);
      colors.push(color.r, color.g, color.b);
    }
  };
  const addQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, tint: number) => {
    addTriangle(a, b, c, tint);
    addTriangle(a, c, d, tint);
  };

  for (let distance = section.start, panelIndex = 0;
    distance < section.end;
    distance += panelLength, panelIndex += 1) {
    const nextDistance = Math.min(distance + panelLength, section.end);
    const current = cornersAt(distance);
    const next = cornersAt(nextDistance);
    const wallTint = wallTints[panelIndex % wallTints.length];
    addQuad(current[0], current[3], next[3], next[0], wallTint);
    addQuad(current[1], next[1], next[2], current[2], wallTints[(panelIndex + 1) % wallTints.length]);
    addQuad(current[3], current[2], next[2], next[3], roofTints[panelIndex % roofTints.length]);
    addQuad(current[0], next[0], next[1], current[1], floorTints[panelIndex % floorTints.length]);
  }

  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shell.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  trackRoot.add(new THREE.Mesh(shell, new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  })));

  const graffitiShapes = [
    [[-3, -1], [-2.4, 1.7], [-1.6, -0.5], [-0.8, 1.6], [0, -1]],
    [[0.35, -1], [0.35, 1.7], [2, 1.7], [2.35, 1.1], [0.8, 0.25], [2.25, -0.35], [1.9, -1], [0.35, -1]],
    [[-2.5, -0.8], [-1.2, 1.4], [0, -0.7], [1.25, 1.5], [2.5, -0.8]],
  ];
  let seed = (section.start + 17) * 104729 % 2147483647;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const graffitiPoint = (distance: number, along: number, vertical: number, side: number) => {
    const frame = sampleTrack(distance + along);
    return frame.center
      .addScaledVector(frame.right, side * (section.width / 2 - 0.09))
      .addScaledVector(frame.up, vertical);
  };
  const drawTag = (distance: number, side: number, tagIndex: number) => {
    const shape = graffitiShapes[tagIndex % graffitiShapes.length];
    const verticalCenter = -0.2 + random() * 2.2;
    const scale = 0.82 + random() * 0.35;
    for (let pointIndex = 0; pointIndex < shape.length - 1; pointIndex += 1) {
      const [alongA, heightA] = shape[pointIndex];
      const [alongB, heightB] = shape[pointIndex + 1];
      graffitiPoints.push(
        graffitiPoint(distance, alongA * scale, verticalCenter + heightA * scale, side),
        graffitiPoint(distance, alongB * scale, verticalCenter + heightB * scale, side),
      );
    }
    // A couple of short drips make the marks read as spray-painted tags, not tunnel wiring.
    for (let drip = 0; drip < 2; drip += 1) {
      const along = -1.8 + random() * 3.6;
      const top = verticalCenter - 0.35 + random() * 1.1;
      graffitiPoints.push(
        graffitiPoint(distance, along, top, side),
        graffitiPoint(distance, along + 0.1, top - 0.55 - random() * 0.55, side),
      );
    }
  };

  let tagIndex = 0;
  for (let distance = section.start + 38; distance < section.end - 18; distance += 92) {
    const side = tagIndex % 2 === 0 ? -1 : 1;
    drawTag(distance, side, tagIndex);
    if (tagIndex % 3 === 1) drawTag(distance + 18, -side, tagIndex + 2);
    tagIndex += 1;
  }
  if (graffitiPoints.length > 0) addWireframeSegments(graffitiPoints, graffitiColor, 0.96);

  const fixtureGeometry = new THREE.BoxGeometry(8.2, 0.4, 0.42);
  const fixtureMaterial = new THREE.MeshBasicMaterial({ color: 0x353639 });
  const tubeGeometry = new THREE.CylinderGeometry(0.13, 0.13, 7.6, 12);
  const haloGeometry = new THREE.CylinderGeometry(0.5, 0.5, 8.5, 12, 1, true);
  const tubeAxis = new THREE.Vector3(0, 1, 0);
  const fixtureAxis = new THREE.Vector3(1, 0, 0);
  let lampIndex = 0;
  for (let distance = section.start + 46; distance < section.end - 22; distance += 72) {
    const frame = sampleTrack(distance);
    for (const side of [-1, 1]) {
      const position = frame.center.clone()
        .addScaledVector(frame.right, side * (section.width / 2 - 0.72))
        .addScaledVector(frame.up, section.height / 2 - 0.62);
      const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
      fixture.position.copy(position);
      fixture.quaternion.setFromUnitVectors(fixtureAxis, frame.tangent);
      trackRoot.add(fixture);

      const color = new THREE.Color(0xe7f4ff);
      const tubeMaterial = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const haloMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.position.copy(position);
      tube.quaternion.setFromUnitVectors(tubeAxis, frame.tangent);
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.position.copy(position);
      halo.quaternion.copy(tube.quaternion);
      trackRoot.add(halo, tube);
      flickeringLamps.push({
        tube,
        halo,
        color,
        phase: lampIndex * 1.71,
        flickers: lampIndex % 9 === 4,
      });

      // Faint wall wash under each fixture, leaving a clear dark interval before the next pair.
      const before = sampleTrack(distance - 18);
      const center = sampleTrack(distance);
      const after = sampleTrack(distance + 18);
      const topBefore = before.center.clone()
        .addScaledVector(before.right, side * (section.width / 2 - 0.16))
        .addScaledVector(before.up, section.height / 2 - 0.45);
      const topCenter = center.center.clone()
        .addScaledVector(center.right, side * (section.width / 2 - 0.16))
        .addScaledVector(center.up, section.height / 2 - 0.45);
      const topAfter = after.center.clone()
        .addScaledVector(after.right, side * (section.width / 2 - 0.16))
        .addScaledVector(after.up, section.height / 2 - 0.45);
      const lowerBefore = topBefore.clone().addScaledVector(before.up, -5.2);
      const lowerCenter = topCenter.clone().addScaledVector(center.up, -5.2);
      const lowerAfter = topAfter.clone().addScaledVector(after.up, -5.2);
      const washColor = color.clone().multiplyScalar(0.12);
      const washVertices = [
        [topBefore, 0.015], [topCenter, 0.6], [lowerCenter, 0.04],
        [topBefore, 0.015], [lowerCenter, 0.04], [lowerBefore, 0.005],
        [topCenter, 0.6], [topAfter, 0.015], [lowerAfter, 0.005],
        [topCenter, 0.6], [lowerAfter, 0.005], [lowerCenter, 0.04],
      ] as const;
      for (const [point, intensity] of washVertices) {
        spillPositions.push(point.x, point.y, point.z);
        spillColors.push(washColor.r * intensity, washColor.g * intensity, washColor.b * intensity);
      }
      lampIndex += 1;
    }
  }
  const spill = new THREE.BufferGeometry();
  spill.setAttribute('position', new THREE.Float32BufferAttribute(spillPositions, 3));
  spill.setAttribute('color', new THREE.Float32BufferAttribute(spillColors, 3));
  trackRoot.add(new THREE.Mesh(spill, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })));
}

function updateFlickeringLamps(time: number): void {
  for (const lamp of flickeringLamps) {
    if (!lamp.flickers) continue;
    const phase = time * 0.006 + lamp.phase;
    const flickerTick = Math.floor(time / 55);
    const irregularFlicker = Math.sin(flickerTick * 12.9898 + lamp.phase * 78.233) > 0.91;
    const dropout = Math.sin(time * 0.0015 + lamp.phase) > 0.94;
    const brightness = dropout ? 0.02 : irregularFlicker ? 0.18 : 0.88 + 0.12 * Math.sin(phase * 2.1) ** 2;
    lamp.tube.material.color.copy(lamp.color).multiplyScalar(brightness);
    lamp.halo.material.opacity = brightness < 0.2 ? 0.025 : 0.2;
  }
}

function addTunnel(section: TunnelSection): void {
  if (section.style === 'metal') {
    addMetalSideWalls(section);
    addMetalRoofAndRoad(section);
  }
  if (section.style === 'neon') addNeonSideTubes(section);
  if (section.style === 'graffiti') addGraffitiTunnel(section);

  const railPoints: THREE.Vector3[] = [];
  const ringPoints: THREE.Vector3[] = [];
  const ringStep = TUNNEL_RING_SPACING;
  const railStep = 6;

  for (let distance = section.start; distance < section.end; distance += railStep) {
    const nextDistance = Math.min(distance + railStep, section.end);
    const currentCorners = cornersAt(distance);
    const nextCorners = cornersAt(nextDistance);
    for (let corner = 0; corner < 4; corner += 1) {
      railPoints.push(currentCorners[corner], nextCorners[corner]);
    }
  }

  for (let distance = section.start; distance <= section.end; distance += ringStep) {
    if (isLevelBoundary(distance, LEVEL_LENGTH)) continue;
    const corners = cornersAt(Math.min(distance, section.end));
    for (let corner = 0; corner < 4; corner += 1) {
      ringPoints.push(corners[corner], corners[(corner + 1) % 4]);
    }
  }
  const endCorners = cornersAt(section.end);
  if ((section.end - section.start) % ringStep !== 0 && !isLevelBoundary(section.end, LEVEL_LENGTH)) {
    for (let corner = 0; corner < 4; corner += 1) {
      ringPoints.push(endCorners[corner], endCorners[(corner + 1) % 4]);
    }
  }

  const railColor = section.style === 'metal' ? 0x70f5ef
    : section.style === 'neon' ? 0xb48aff
      : section.style === 'graffiti' ? 0x555057 : 0x48dce8;
  const ringColor = section.style === 'neon' ? 0xa983ed
    : section.style === 'graffiti' ? 0x403b43 : 0x88e9ef;
  addWireframeSegments(railPoints, railColor, section.style === 'graffiti' ? 0.2 : 0.92);
  addWireframeSegments(ringPoints, ringColor, section.style === 'neon' ? 0.62 : section.style === 'graffiti' ? 0.17 : 0.54);
}

function addGate(distance: number, color: number, opacity = 0.95): void {
  const corners = cornersAt(distance);
  const points: THREE.Vector3[] = [];
  for (let corner = 0; corner < 4; corner += 1) {
    points.push(corners[corner], corners[(corner + 1) % 4]);
  }
  addLineSegments(points, color, opacity);
}

function addSharpTurnSigns(): void {
  const fillPoints: THREE.Vector3[] = [];
  const arrowFillPoints: THREE.Vector3[] = [];
  const borderPoints: THREE.Vector3[] = [];
  const postPoints: THREE.Vector3[] = [];
  const panelHeight = 3.5;
  const panelWidth = 2.8;

  for (let levelIndex = 0; levelIndex < MAX_LEVEL; levelIndex += 1) {
    const level = levelIndex + 1;
    for (const turn of sharpTurnsForLevel(level)) {
      for (const signOffset of SHARP_TURN_WARNING_OFFSETS) {
        const signDistance = turn.center + signOffset + levelIndex * LEVEL_LENGTH;
        const frame = sampleTrack(signDistance);
        const roadside = -turn.direction * (getLevel(level).tunnelWidth / 2 - 4.8);
        const panelCenter = frame.center.clone()
          .addScaledVector(frame.right, roadside)
          .addScaledVector(frame.up, panelHeight);
        const panelPoint = (horizontal: number, vertical: number, faceOffset = 0) => panelCenter.clone()
          .addScaledVector(frame.right, horizontal)
          .addScaledVector(frame.up, vertical)
          .addScaledVector(frame.tangent, -faceOffset);
        const top = panelPoint(0, panelWidth);
        const lowerLeft = panelPoint(-panelWidth * 0.9, -panelWidth * 0.55);
        const lowerRight = panelPoint(panelWidth * 0.9, -panelWidth * 0.55);
        fillPoints.push(top, lowerLeft, lowerRight);
        borderPoints.push(top, lowerLeft, lowerLeft, lowerRight, lowerRight, top);
        postPoints.push(
          frame.center.clone().addScaledVector(frame.right, roadside),
          panelPoint(0, -panelWidth * 0.55),
        );

        const shaftStart = panelPoint(-turn.direction * 1.05, -0.16, 0.07);
        const shaftEnd = panelPoint(turn.direction * 0.45, -0.16, 0.07);
        const shaftEndTop = panelPoint(turn.direction * 0.45, 0.16, 0.07);
        const shaftStartTop = panelPoint(-turn.direction * 1.05, 0.16, 0.07);
        arrowFillPoints.push(
          shaftStart, shaftEnd, shaftEndTop,
          shaftStart, shaftEndTop, shaftStartTop,
          panelPoint(turn.direction * 1.35, 0, 0.07),
          panelPoint(turn.direction * 0.35, -0.68, 0.07),
          panelPoint(turn.direction * 0.35, 0.68, 0.07),
        );
      }
    }
  }

  const fillGeometry = new THREE.BufferGeometry().setFromPoints(fillPoints);
  trackRoot.add(new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x35171a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  ));
  trackRoot.add(new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints(arrowFillPoints),
    new THREE.MeshBasicMaterial({ color: 0xfff0a8, side: THREE.DoubleSide }),
  ));
  addLineSegments(postPoints, 0x78a6b0, 0.86);
  addLineSegments(borderPoints, 0xff5b58, 0.98);
}

function buildCourse(): void {
  TUNNELS.forEach(addTunnel);
  LEVEL_ENDS.forEach((end) => addGate(end, 0xffffff, 1));
  addSharpTurnSigns();
}

buildCourse();

let gameState: GameState = 'title';
let distance = 0;
let speed = 0;
let lateralOffset = 0;
let lateralVelocity = 0;
let wallReboundTime = 0;
let cameraSteeringInput = 0;
let airborne = false;
let airElapsed = 0;
let airLaunchDistance = 0;
let airLaunchY = 0;
let airLaunchSpeed = 0;
let airLaunchVerticalVelocity = 0;
let airFlightTime = 0;
let activeGapIndex = 0;
let checkpointDistance = 0;
let checkpointSpeed = 0;
let runDistanceOrigin = 0;
let crashTime = 0;
let reducedMotion = localStorage.getItem('vector-reduced-motion') === 'true';
let muted = localStorage.getItem('vector-muted') === 'true';
let lastUiUpdate = 0;
let previousFrameTime = 0;
let elapsedTime = 0;
const pressedKeys = new Set<string>();

class SpeedAudio {
  private context: AudioContext;
  private master: GainNode;
  private engine: OscillatorNode;
  private engineFilter: BiquadFilterNode;
  private engineGain: GainNode;
  private engineBank: OscillatorNode;
  private bankFilter: BiquadFilterNode;
  private bankGain: GainNode;
  private bankPulse: OscillatorNode;
  private bankPulseDepth: GainNode;
  private engineSub: OscillatorNode;
  private subGain: GainNode;
  private engineOvertone: OscillatorNode;
  private overtoneGain: GainNode;
  private engineVibrato: OscillatorNode;
  private vibratoDepth: GainNode;
  private wallPanner: StereoPannerNode;
  private echoSend: GainNode;
  private echoDelay: DelayNode;
  private echoFilter: BiquadFilterNode;
  private echoFeedback: GainNode;
  private echoReturn: GainNode;
  private swooshBuffer: AudioBuffer;
  private lastSwooshTime = Number.NEGATIVE_INFINITY;
  private paused = false;
  private muted = false;

  constructor() {
    const AudioContextConstructor = window.AudioContext;
    this.context = new AudioContextConstructor();
    const swooshLength = Math.floor(this.context.sampleRate * 0.55);
    this.swooshBuffer = this.context.createBuffer(1, swooshLength, this.context.sampleRate);
    const swooshSamples = this.swooshBuffer.getChannelData(0);
    for (let index = 0; index < swooshLength; index += 1) {
      swooshSamples[index] = Math.random() * 2 - 1;
    }
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    this.wallPanner = this.context.createStereoPanner();
    this.wallPanner.connect(this.master);
    this.echoSend = this.context.createGain();
    this.echoSend.gain.value = 0;
    this.echoDelay = this.context.createDelay(0.5);
    this.echoDelay.delayTime.value = 0.24;
    this.echoFilter = this.context.createBiquadFilter();
    this.echoFilter.type = 'lowpass';
    this.echoFilter.frequency.value = 2400;
    this.echoFeedback = this.context.createGain();
    this.echoFeedback.gain.value = 0;
    this.echoReturn = this.context.createGain();
    this.echoReturn.gain.value = 0;
    this.wallPanner.connect(this.echoSend).connect(this.echoDelay);
    this.echoDelay.connect(this.echoReturn).connect(this.master);
    this.echoDelay.connect(this.echoFilter).connect(this.echoFeedback).connect(this.echoDelay);

    this.engine = this.context.createOscillator();
    const harmonicReal = new Float32Array(9);
    const harmonicImaginary = new Float32Array(9);
    harmonicImaginary[1] = 1;
    harmonicImaginary[2] = 0.62;
    harmonicImaginary[3] = 0.4;
    harmonicImaginary[4] = 0.28;
    harmonicImaginary[5] = 0.2;
    harmonicImaginary[6] = 0.14;
    harmonicImaginary[7] = 0.1;
    harmonicImaginary[8] = 0.07;
    harmonicReal[2] = 0.12;
    harmonicReal[4] = 0.08;
    const v8Wave = this.context.createPeriodicWave(
      harmonicReal,
      harmonicImaginary,
      { disableNormalization: true },
    );
    this.engine.setPeriodicWave(v8Wave);
    this.engine.frequency.value = 32;
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 480;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.028;
    this.engine.connect(this.engineFilter).connect(this.engineGain).connect(this.wallPanner);
    this.engine.start();

    this.engineBank = this.context.createOscillator();
    this.engineBank.setPeriodicWave(v8Wave);
    this.engineBank.frequency.value = 32.2;
    this.bankFilter = this.context.createBiquadFilter();
    this.bankFilter.type = 'bandpass';
    this.bankFilter.frequency.value = 520;
    this.bankFilter.Q.value = 0.65;
    this.bankGain = this.context.createGain();
    this.bankGain.gain.value = 0.009;
    this.engineBank.connect(this.bankFilter).connect(this.bankGain).connect(this.wallPanner);
    this.engineBank.start();

    this.bankPulse = this.context.createOscillator();
    this.bankPulse.type = 'sine';
    this.bankPulse.frequency.value = 2.4;
    this.bankPulseDepth = this.context.createGain();
    this.bankPulseDepth.gain.value = 0.0025;
    this.bankPulse.connect(this.bankPulseDepth).connect(this.bankGain.gain);
    this.bankPulse.start();

    this.engineSub = this.context.createOscillator();
    this.engineSub.type = 'sine';
    this.engineSub.frequency.value = 16;
    this.subGain = this.context.createGain();
    this.subGain.gain.value = 0.012;
    this.engineSub.connect(this.subGain).connect(this.wallPanner);
    this.engineSub.start();

    this.engineOvertone = this.context.createOscillator();
    this.engineOvertone.type = 'sine';
    this.engineOvertone.frequency.value = 96;
    this.overtoneGain = this.context.createGain();
    this.overtoneGain.gain.value = 0.004;
    this.engineOvertone.connect(this.overtoneGain).connect(this.wallPanner);
    this.engineOvertone.start();

    this.engineVibrato = this.context.createOscillator();
    this.engineVibrato.type = 'sine';
    this.engineVibrato.frequency.value = 3;
    this.vibratoDepth = this.context.createGain();
    this.vibratoDepth.gain.value = 0.25;
    this.engineVibrato.connect(this.vibratoDepth).connect(this.engine.frequency);
    this.engineVibrato.start();
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
    this.refreshMaster();
  }

  setMuted(value: boolean): void {
    this.muted = value;
    this.refreshMaster();
  }

  setPaused(value: boolean): void {
    this.paused = value;
    this.refreshMaster();
  }

  update(
    normalizedSpeed: number,
    wallProximity: number,
    wallSide: number,
    inTunnel: boolean,
    engineLoad: number,
  ): void {
    const now = this.context.currentTime;
    const amount = THREE.MathUtils.clamp(normalizedSpeed, 0, 1);
    const proximity = THREE.MathUtils.clamp(wallProximity, 0, 1);
    const load = THREE.MathUtils.clamp(engineLoad, 0, 1);
    const engineFrequency = 32 + amount * 82;
    this.engine.frequency.setTargetAtTime(engineFrequency, now, 0.08);
    this.engineBank.frequency.setTargetAtTime(engineFrequency * (1.006 + load * 0.004), now, 0.08);
    this.engineSub.frequency.setTargetAtTime(engineFrequency * 0.5, now, 0.08);
    this.engineOvertone.frequency.setTargetAtTime(engineFrequency * 2.01, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(480 + amount * 2100 + load * 650, now, 0.1);
    this.engineGain.gain.setTargetAtTime(0.028 + amount * 0.052 + load * 0.014, now, 0.12);
    this.bankFilter.frequency.setTargetAtTime(520 + amount * 480 + load * 620, now, 0.1);
    this.bankGain.gain.setTargetAtTime(0.009 + amount * 0.012 + load * 0.012, now, 0.12);
    this.bankPulse.frequency.setTargetAtTime(2.4 + amount * 7.5, now, 0.15);
    this.bankPulseDepth.gain.setTargetAtTime(0.0025 + amount * 0.004, now, 0.12);
    this.subGain.gain.setTargetAtTime(0.012 + amount * 0.025, now, 0.12);
    this.overtoneGain.gain.setTargetAtTime(0.004 + amount * 0.012, now, 0.12);
    this.engineVibrato.frequency.setTargetAtTime(2.2 + amount * 3.5, now, 0.12);
    this.vibratoDepth.gain.setTargetAtTime(0.12 + amount * 0.45, now, 0.12);
    this.wallPanner.pan.setTargetAtTime(wallSide * proximity * 0.7, now, 0.14);
    this.echoSend.gain.setTargetAtTime(inTunnel ? 0.48 : 0, now, inTunnel ? 0.12 : 0.025);
    this.echoReturn.gain.setTargetAtTime(inTunnel ? 0.42 : 0, now, inTunnel ? 0.12 : 0.025);
    this.echoFeedback.gain.setTargetAtTime(inTunnel ? 0.24 : 0, now, inTunnel ? 0.12 : 0.025);
  }

  playTunnelSwoosh(normalizedSpeed: number, wallProximity: number, pan: number): void {
    const now = this.context.currentTime;
    if (now - this.lastSwooshTime < 0.28) return;
    this.lastSwooshTime = now;

    const amount = THREE.MathUtils.clamp(normalizedSpeed, 0, 1);
    const source = this.context.createBufferSource();
    source.buffer = this.swooshBuffer;
    const proximity = THREE.MathUtils.clamp(wallProximity, 0, 1);
    const peakGain = 0.0003 + amount ** 2 * (0.004 + proximity * 0.09);
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.5);
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(peakGain, now + 0.12);
    envelope.gain.exponentialRampToValueAtTime(peakGain * 0.55, now + 0.26);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    const panner = this.context.createStereoPanner();
    panner.pan.value = THREE.MathUtils.clamp(pan, -1, 1);

    source.connect(filter).connect(envelope).connect(panner).connect(this.master);
    source.start(now);
    source.stop(now + 0.53);
  }

  private refreshMaster(): void {
    const target = this.muted || this.paused ? 0 : 1;
    this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.08);
  }
}

let speedAudio: SpeedAudio | null = null;

function currentAirHeight(): number {
  return airLaunchY + trajectoryHeight(airLaunchVerticalVelocity, airElapsed, GRAVITY);
}

function setScreenVisibility(): void {
  titleScreen.classList.toggle('is-hidden', gameState !== 'title');
  pauseScreen.classList.toggle('is-hidden', gameState !== 'paused');
  crashScreen.classList.toggle('is-hidden', gameState !== 'crashed');
  finishScreen.classList.toggle('is-hidden', gameState !== 'finished');
  hud.classList.toggle('is-hidden', gameState === 'title' || gameState === 'finished');
}

function advanceLevel(): void {
  if (currentLevel >= MAX_LEVEL) {
    gameState = 'finished';
    finishEyebrow.textContent = `LEVEL ${currentLevel} / ${MAX_LEVEL} COMPLETE`;
    finishTitle.innerHTML = 'ALL<br /><span>SECURED.</span>';
    finishCopy.textContent = 'Twenty levels. Sharper turns at every step. You kept the line.';
    speedAudio?.setPaused(true);
    setScreenVisibility();
    return;
  }

  currentLevel += 1;
  checkpointDistance = distance;
  checkpointSpeed = speed;
  gameState = 'playing';
  runState.textContent = `LEVEL ${String(currentLevel).padStart(2, '0')} / ${MAX_LEVEL}`;
  toast.textContent = `LEVEL ${String(currentLevel).padStart(2, '0')} — TURNS TIGHTER`;
  toast.classList.remove('is-hidden');
  window.setTimeout(() => toast.classList.add('is-hidden'), 1800);
  updateHud();
}

function resetRun(startLevel = 1, startSpeed = 0, startLocalDistance = 0): void {
  currentLevel = THREE.MathUtils.clamp(Math.floor(startLevel), 1, MAX_LEVEL);
  const definition = getLevel(currentLevel);
  const localDistance = definition.tunnels
    .map((section) => THREE.MathUtils.clamp(startLocalDistance, section.start, section.end))
    .sort((left, right) => Math.abs(left - startLocalDistance) - Math.abs(right - startLocalDistance))[0];
  const spawnDistance = localDistance === 0 ? STARTING_CAMERA_CLEARANCE : localDistance;
  distance = LEVEL_STARTS[currentLevel - 1] + spawnDistance;
  runDistanceOrigin = localDistance === 0 ? distance : 0;
  speed = THREE.MathUtils.clamp(startSpeed, 0, MAX_SPEED);
  lateralOffset = 0;
  lateralVelocity = 0;
  wallReboundTime = 0;
  cameraSteeringInput = 0;
  airborne = false;
  airElapsed = 0;
  activeGapIndex = GAPS.findIndex((gap) => gap.levelId === currentLevel && gap.launch >= distance);
  if (activeGapIndex < 0) activeGapIndex = GAPS.findIndex((gap) => gap.levelId > currentLevel);
  if (activeGapIndex < 0) activeGapIndex = GAPS.length;
  checkpointDistance = distance;
  checkpointSpeed = speed;
  crashTime = 0;
  pressedKeys.clear();
  const startingFrame = sampleTrack(distance);
  camera.quaternion.copy(cameraQuaternionFollowingTrack(startingFrame.tangent));
  camera.position.copy(startingFrame.center).addScaledVector(startingFrame.up, 0.35);
  camera.position.y = startingFrame.center.y + 0.35;
  gameState = 'playing';
  setScreenVisibility();
  canvas.focus({ preventScroll: true });
  speedAudio?.setPaused(false);
  void speedAudio?.resume();
  updateHud();
}

function respawnAtCheckpoint(): void {
  distance = checkpointDistance;
  speed = checkpointSpeed * 0.82;
  lateralOffset = 0;
  lateralVelocity = 0;
  wallReboundTime = 0;
  airborne = false;
  airElapsed = 0;
  crashTime = 0;
  gameState = 'playing';
  pressedKeys.clear();
  setScreenVisibility();
  speedAudio?.setPaused(false);
  runState.textContent = 'CHECKPOINT RESTORED';
  updateHud();
}

function startRun(): void {
  if (!speedAudio) {
    try {
      speedAudio = new SpeedAudio();
      speedAudio.setMuted(muted);
    } catch (error) {
      console.warn('Audio is unavailable in this browser.', error);
    }
  }
  if (speedAudio) void speedAudio.resume().catch((error: unknown) => console.warn('Audio could not start.', error));
  const testStart = getTestStartFromQuery();
  resetRun(testStart?.level ?? 1, testStart?.speed ?? 0, testStart?.localDistance ?? 0);
}

function getTestStartFromQuery(): { level: number; speed: number; localDistance: number } | null {
  if (!import.meta.env.DEV) return null;

  // Browser test entry: ?testLevel=20&testSpeed=60 (HUD units), or testPhysicalSpeed=108.
  // testDistance starts within the closest tunnel section of that level, in course units.
  const params = new URLSearchParams(window.location.search);
  if (!params.has('testLevel') && !params.has('testSpeed') && !params.has('testPhysicalSpeed')) return null;

  const requestedLevel = Number(params.get('testLevel') ?? 1);
  const displaySpeed = Number(params.get('testSpeed') ?? 0);
  const physicalSpeed = Number(params.get('testPhysicalSpeed') ?? Number.NaN);
  const requestedDistance = Number(params.get('testDistance') ?? 0);
  const level = Number.isFinite(requestedLevel) ? Math.floor(requestedLevel) : 1;
  const speed = Number.isFinite(physicalSpeed)
    ? physicalSpeed
    : Number.isFinite(displaySpeed)
      ? displaySpeed * MAX_SPEED / MAX_DISPLAY_SPEED
      : 0;
  const localDistance = Number.isFinite(requestedDistance) ? requestedDistance : 0;

  return {
    level: THREE.MathUtils.clamp(level, 1, MAX_LEVEL),
    speed: THREE.MathUtils.clamp(speed, 0, MAX_SPEED),
    localDistance: THREE.MathUtils.clamp(localDistance, 0, LEVEL_LENGTH),
  };
}

function pauseRun(): void {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  pressedKeys.clear();
  speedAudio?.setPaused(true);
  setScreenVisibility();
}

function resumeRun(): void {
  if (gameState !== 'paused') return;
  gameState = 'playing';
  speedAudio?.setPaused(false);
  setScreenVisibility();
  canvas.focus({ preventScroll: true });
}

function crash(message: string): void {
  if (gameState !== 'playing') return;
  gameState = 'crashed';
  crashTime = CRASH_DURATION;
  crashTitle.textContent = message;
  crashDetail.textContent = checkpointDistance > 0 ? 'RECALIBRATING AT CHECKPOINT' : 'RECALIBRATING AT START';
  pressedKeys.clear();
  speedAudio?.setPaused(true);
  setScreenVisibility();
}

function beginJump(gap: JumpGap, rampSlope: number): void {
  airborne = true;
  airElapsed = 0;
  airLaunchDistance = gap.launch;
  distance = gap.launch;
  airLaunchY = pathCenter(gap.launch).y;
  airLaunchSpeed = speed;
  airLaunchVerticalVelocity = launchVerticalVelocity(speed, rampSlope);
  airFlightTime = flightDuration(
    airLaunchVerticalVelocity,
    pathCenter(gap.landing).y - airLaunchY,
  );
  runState.textContent = 'IN FLIGHT';
}

function playTunnelLineSwoosh(previousDistance: number, currentDistance: number): void {
  if (!speedAudio || airborne || currentDistance <= previousDistance) return;
  const section = tunnelAtDistance(currentDistance);
  if (!section) return;

  const nextRegularLine = previousDistance < section.start
    ? section.start
    : section.start
      + (Math.floor((previousDistance - section.start) / TUNNEL_RING_SPACING) + 1) * TUNNEL_RING_SPACING;
  const nextLine = Math.min(nextRegularLine, section.end);
  if (nextLine <= currentDistance) {
    const wallDistance = section.width / 2 - PLAYER_COLLISION_RADIUS - Math.abs(lateralOffset);
    const proximity = THREE.MathUtils.clamp((5.5 - wallDistance) / 5.5, 0, 1);
    speedAudio.playTunnelSwoosh(
      speed / MAX_SPEED,
      proximity,
      Math.sign(lateralOffset) * proximity,
    );
  }
}

function completeJump(gap: JumpGap): void {
  const landingDistance = airLaunchDistance + airLaunchSpeed * airFlightTime;
  const landingCenterY = pathCenter(landingDistance).y;
  const verticalError = currentAirHeight() - landingCenterY;
  const landingTunnel = TUNNELS.find((section) => section.levelId === gap.levelId && section.start === gap.landing);
  const withinTunnel = landingDistance >= gap.landing
    && landingDistance <= (landingTunnel?.end ?? gap.landing) - 8;
  const withinHorizontalZone = Math.abs(lateralOffset) <= gap.tunnelWidth / 2 - LANDING_MARGIN;
  const withinVerticalZone = hasTunnelClearance(verticalError, gap.tunnelHeight);

  if (!withinTunnel || !withinVerticalZone) {
    const reason = !withinTunnel
      ? 'VELOCITY LOST'
      : verticalError > 0
        ? 'ROOF IMPACT'
        : 'FLOOR IMPACT';
    crash(reason);
    return;
  }

  distance = landingDistance;
  airborne = false;
  activeGapIndex += 1;
  checkpointDistance = gap.landing;
  if (!withinHorizontalZone) {
    const contactSide = Math.sign(lateralOffset) || 1;
    const wallContact = resolveTunnelWallContact(
      lateralOffset,
      contactSide * gap.tunnelWidth / 2,
      gap.tunnelWidth / 2,
      PLAYER_COLLISION_RADIUS,
    );
    const rebound = applyTunnelWallRebound(wallContact, lateralVelocity, speed);
    lateralOffset = rebound.offset;
    lateralVelocity = rebound.lateralVelocity;
    speed = rebound.speed;
    wallReboundTime = rebound.reboundDuration;
    checkpointSpeed = speed;
    runState.textContent = 'WALL REBOUND · SPEED LOST';
    return;
  }

  checkpointSpeed = speed;
  lateralVelocity *= 0.35;
  runState.textContent = 'VECTOR HELD';
}

function updateDriving(deltaTime: number): void {
  if (gameState === 'crashed') {
    crashTime -= deltaTime;
    if (crashTime <= 0) respawnAtCheckpoint();
    return;
  }
  if (gameState !== 'playing') return;

  const steerRight = pressedKeys.has('arrowright') || pressedKeys.has('d');
  const steerLeft = pressedKeys.has('arrowleft') || pressedKeys.has('a');
  const throttle = pressedKeys.has('arrowup') || pressedKeys.has('w');
  const brake = pressedKeys.has('arrowdown') || pressedKeys.has('s');
  const steerAxis = Number(steerRight) - Number(steerLeft);
  cameraSteeringInput = steerAxis === 0
    ? 0
    : smoothCameraSteeringInput(cameraSteeringInput, steerAxis, deltaTime);

  if (!airborne) {
    if (throttle) speed += 27 * SPEED_SCALE * deltaTime;
    else if (!brake) speed = Math.max(0, speed - 1.2 * SPEED_SCALE * deltaTime);
    if (brake) speed -= BRAKING_DECELERATION * deltaTime;
    speed = THREE.MathUtils.clamp(speed, 0, MAX_SPEED);
  }

  const airSteerScale = airborne ? 0.3 : 1;
  wallReboundTime = Math.max(0, wallReboundTime - deltaTime);
  const previousLateralOffset = lateralOffset;
  const lateralState = wallReboundTime > 0
    ? stepWallRebound(lateralOffset, lateralVelocity, deltaTime, steerAxis, speed)
    : stepLateralMotion(
      lateralOffset,
      lateralVelocity,
      speed,
      courseCurve(distance),
      steerAxis,
      deltaTime,
      airSteerScale,
    );
  lateralOffset = lateralState.offset;
  lateralVelocity = lateralState.velocity;

  const currentTunnel = tunnelAtDistance(distance);
  if (currentTunnel) {
    const tunnelHalfWidth = currentTunnel.width / 2;
    const wallContact = resolveTunnelWallContact(
      previousLateralOffset,
      lateralOffset,
      tunnelHalfWidth,
      PLAYER_COLLISION_RADIUS,
    );
    if (wallContact.collided) {
      const rebound = applyTunnelWallRebound(wallContact, lateralVelocity, speed);
      lateralOffset = rebound.offset;
      lateralVelocity = rebound.lateralVelocity;
      speed = rebound.speed;
      wallReboundTime = rebound.reboundDuration;
      runState.textContent = 'WALL REBOUND · SPEED LOST';
    } else {
      lateralOffset = wallContact.offset;
      const softWallEdge = tunnelHalfWidth - PLAYER_COLLISION_RADIUS - 1.25;
      if (wallReboundTime <= 0 && Math.abs(lateralOffset) > softWallEdge) {
        if (!airborne) speed = Math.max(0, speed - 24 * deltaTime);
        lateralVelocity *= Math.exp(-8 * deltaTime);
      }
    }
  }

  if (airborne) {
    airElapsed += deltaTime;
    distance = airLaunchDistance + airLaunchSpeed * airElapsed;
    if (activeGapIndex < GAPS.length && distance >= GAPS[activeGapIndex].landing) {
      const verticalOffset = currentAirHeight() - pathCenter(distance).y;
      if (!hasTunnelClearance(verticalOffset, GAPS[activeGapIndex].tunnelHeight)) {
        crash(verticalOffset > 0 ? 'ROOF IMPACT' : 'FLOOR IMPACT');
        return;
      }
    }
    if (activeGapIndex < GAPS.length && airElapsed >= airFlightTime) {
      completeJump(GAPS[activeGapIndex]);
      if (gameState !== 'playing') return;
    }
  } else {
    const previousDistance = distance;
    distance += speed * deltaTime;
    const nextGap = GAPS[activeGapIndex];
    if (nextGap && previousDistance < nextGap.launch && distance >= nextGap.launch) {
      distance = nextGap.launch;
      const rampSlope = launchRampSlope(nextGap.launch);
      if (!isUpwardLaunch(rampSlope)) {
        crash('NO LAUNCH RAMP');
        return;
      }
      beginJump(nextGap, rampSlope);
    }
    if (!airborne) playTunnelLineSwoosh(previousDistance, distance);
  }

  if (!airborne && distance >= LEVEL_ENDS[currentLevel - 1]) advanceLevel();
}

function nextGapIndex(): number {
  return Math.min(activeGapIndex, GAPS.length);
}

function minimumSafeSpeed(gap: JumpGap, rampSlope: number): number {
  const gapDistance = gap.landing - gap.launch;
  const heightDelta = pathCenter(gap.landing).y - pathCenter(gap.launch).y;
  let low = 0;
  let high = MAX_SPEED;
  for (let iteration = 0; iteration < 22; iteration += 1) {
    const candidate = (low + high) / 2;
    const prediction = predictTransfer(candidate, gapDistance, rampSlope, heightDelta, gap.tunnelHeight);
    if (prediction.clearsGap && prediction.roofClear) high = candidate;
    else low = candidate;
  }
  return high;
}

function setSignal(signal: SignalState): void {
  jumpPanel.classList.remove('jump-panel--red', 'jump-panel--amber', 'jump-panel--green', 'jump-panel--air');
  jumpPanel.classList.add(`jump-panel--${signal}`);
  signalLamp.setAttribute('data-signal', signal);
}

function updateHud(): void {
  const ratio = THREE.MathUtils.clamp(speed / MAX_SPEED, 0, 1);
  const displayedSpeed = Math.round(ratio * MAX_DISPLAY_SPEED);
  speedValue.textContent = String(displayedSpeed).padStart(2, '0');
  speedFill.style.width = `${ratio * 100}%`;
  speedMeter?.setAttribute('aria-valuenow', String(displayedSpeed));
  const displayedDistance = Math.max(0, Math.round(distance - runDistanceOrigin));
  runDistance.innerHTML = `${displayedDistance.toString().padStart(4, '0')} <small>m</small>`;
  sectionLabel.textContent = `LEVEL ${String(currentLevel).padStart(2, '0')} / ${MAX_LEVEL}`;

  if (airborne) {
    const remaining = Math.max(0, airFlightTime - airElapsed);
    setSignal('air');
    jumpStatus.textContent = 'AIRBORNE';
    jumpDetail.textContent = `HOLD LINE · LANDING IN ${remaining.toFixed(1)} SEC`;
    gapDistance.textContent = 'TRANSFER';
    runState.textContent = 'IN FLIGHT';
    return;
  }

  const upcomingIndex = nextGapIndex();
  if (upcomingIndex >= GAPS.length) {
    setSignal('green');
    jumpStatus.textContent = 'COURSE CLEAR';
    jumpDetail.textContent = 'FINISH GATE AHEAD';
    gapDistance.textContent = 'FINISH';
    return;
  }

  const gap = GAPS[upcomingIndex];
  const gapLength = Math.max(0, gap.landing - gap.launch);
  const rampSlope = launchRampSlope(gap.launch);
  const targetHeightDelta = pathCenter(gap.landing).y - pathCenter(gap.launch).y;
  const prediction = predictTransfer(speed, gapLength, rampSlope, targetHeightDelta, gap.tunnelHeight);
  const neededSpeed = minimumSafeSpeed(gap, rampSlope);
  const distanceToGap = Math.max(0, gap.launch - distance);
  const horizontalMargin = gap.tunnelWidth / 2 - LANDING_MARGIN - Math.abs(lateralOffset);
  const signal: SignalState = prediction.clearsGap && prediction.roofClear && horizontalMargin >= 1
    ? 'green'
    : speed >= neededSpeed * 0.92 && prediction.roofClear && horizontalMargin > 0
      ? 'amber'
      : 'red';
  setSignal(signal);
  gapDistance.textContent = distanceToGap > 0 ? `${Math.round(distanceToGap)} M TO GAP` : 'GAP AHEAD';
  if (signal === 'green') {
    jumpStatus.textContent = 'VECTOR READY';
    jumpDetail.textContent = 'PREDICTED LANDING: SAFE';
  } else if (signal === 'amber') {
    jumpStatus.textContent = 'MARGINAL';
    jumpDetail.textContent = horizontalMargin < 2 ? 'ALIGNMENT WINDOW IS TIGHT' : 'LANDING WINDOW IS TIGHT';
  } else {
    jumpStatus.textContent = horizontalMargin <= 0 ? 'ALIGN WITH TUNNEL' : !prediction.roofClear && prediction.clearsGap ? 'ROOF IMPACT' : 'BUILD SPEED';
    jumpDetail.textContent = horizontalMargin <= 0
      ? 'PREDICTED LANDING: FRAME IMPACT'
      : !prediction.roofClear && prediction.clearsGap
        ? 'TRAJECTORY TOO HIGH FOR TUNNEL'
      : `TARGET ${Math.ceil((neededSpeed / MAX_SPEED) * MAX_DISPLAY_SPEED)} VU · HOLD THROTTLE`;
  }
  if (gameState === 'playing') runState.textContent = signal === 'green' ? 'VECTOR READY' : 'MOMENTUM / BUILD';
}

function updateToggleLabels(): void {
  for (const button of [motionToggle, pauseMotionToggle]) {
    button.setAttribute('aria-pressed', String(reducedMotion));
    const value = button.querySelector('b');
    if (value) value.textContent = reducedMotion ? 'REDUCED' : 'FULL';
  }
  for (const button of [soundToggle, pauseSoundToggle]) {
    button.setAttribute('aria-pressed', String(muted));
    const value = button.querySelector('b');
    if (value) value.textContent = muted ? 'OFF' : 'ON';
  }
  speedAudio?.setMuted(muted);
}

function toggleMotion(): void {
  reducedMotion = !reducedMotion;
  localStorage.setItem('vector-reduced-motion', String(reducedMotion));
  updateToggleLabels();
}

function toggleSound(): void {
  muted = !muted;
  localStorage.setItem('vector-muted', String(muted));
  updateToggleLabels();
}

function updateCamera(deltaTime: number): void {
  const titleCruise = gameState === 'title';
  const viewDistance = titleCruise ? 64 + Math.sin(elapsedTime * 0.16) * 7 : distance;
  const viewOffset = titleCruise ? 0 : lateralOffset;
  const frame = sampleTrack(viewDistance);
  const playerY = airborne && !titleCruise ? currentAirHeight() : frame.center.y;
  const cameraPosition = frame.center.clone().addScaledVector(frame.right, viewOffset).addScaledVector(frame.up, 0.35);
  cameraPosition.y = playerY + 0.35;

  const smoothing = 1 - Math.exp(-14 * deltaTime);
  camera.position.lerp(cameraPosition, smoothing);

  if (!reducedMotion) {
    const speedRatio = speed / MAX_SPEED;
    camera.fov = 70 + speedRatio * 16;
    if (!titleCruise && gameState === 'playing') {
      camera.position.addScaledVector(frame.up, Math.sin(elapsedTime * 34) * speedRatio * 0.035);
    }
  } else {
    camera.fov = 70;
  }
  const trackOrientation = cameraQuaternionFollowingTrack(frame.tangent);
  if (titleCruise) {
    camera.quaternion.copy(trackOrientation);
  } else if (gameState === 'playing' && cameraSteeringInput === 0) {
    camera.quaternion.copy(trackOrientation);
  } else if (gameState === 'playing') {
    camera.quaternion.copy(cameraOrientationForSteering(
      camera.quaternion,
      trackOrientation,
      cameraSteeringInput,
      smoothing,
    ));
  }
  camera.updateProjectionMatrix();
}

function resizeRenderer(): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  for (const material of wireframeMaterials) {
    material.resolution.set(window.innerWidth, window.innerHeight);
  }
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function animate(time: number): void {
  const deltaTime = Math.min(0.05, Math.max(0, (time - previousFrameTime) / 1000));
  previousFrameTime = time;
  elapsedTime += deltaTime;
  updateDriving(deltaTime);
  updateCamera(deltaTime || 1 / 60);
  updateFlickeringLamps(time);
  renderer.render(scene, camera);
  const tunnelWidth = tunnelAtDistance(distance)?.width ?? getLevel(currentLevel).tunnelWidth;
  const wallDistance = tunnelWidth / 2 - PLAYER_COLLISION_RADIUS - Math.abs(lateralOffset);
  const wallProximity = THREE.MathUtils.clamp((5.5 - wallDistance) / 5.5, 0, 1);
  const insideTunnel = !airborne && Boolean(tunnelAtDistance(distance));
  const throttleHeld = pressedKeys.has('arrowup') || pressedKeys.has('w');
  const brakeHeld = pressedKeys.has('arrowdown') || pressedKeys.has('s');
  const engineLoad = gameState !== 'playing' ? 0 : throttleHeld ? 1 : brakeHeld ? 0.42 : 0.18;
  speedAudio?.update(
    speed / MAX_SPEED,
    wallProximity,
    Math.sign(lateralOffset),
    gameState === 'playing' && insideTunnel,
    engineLoad,
  );

  if (gameState === 'playing' && time - lastUiUpdate > 80) {
    updateHud();
    lastUiUpdate = time;
  }
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  } else {
    void document.exitFullscreen?.();
  }
}

startButton.addEventListener('click', startRun);
resumeButton.addEventListener('click', resumeRun);
pauseButton.addEventListener('click', pauseRun);
pauseRestartButton.addEventListener('click', startRun);
finishRestartButton.addEventListener('click', startRun);
motionToggle.addEventListener('click', toggleMotion);
pauseMotionToggle.addEventListener('click', toggleMotion);
soundToggle.addEventListener('click', toggleSound);
pauseSoundToggle.addEventListener('click', toggleSound);
fullscreenButton.addEventListener('click', toggleFullscreen);
window.addEventListener('resize', resizeRenderer);
window.addEventListener('keydown', (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(key)) event.preventDefault();
  if (key === 'escape') {
    if (gameState === 'playing') pauseRun();
    else if (gameState === 'paused') resumeRun();
    return;
  }
  if (gameState === 'title' && (key === 'enter' || key === ' ')) {
    startRun();
    return;
  }
  if (gameState === 'playing') pressedKeys.add(key);
});
window.addEventListener('keyup', (event: KeyboardEvent) => pressedKeys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => {
  pressedKeys.clear();
  if (gameState === 'playing') pauseRun();
});

updateToggleLabels();
setScreenVisibility();
updateHud();
renderer.setAnimationLoop(animate);
