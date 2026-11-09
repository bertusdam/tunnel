import * as THREE from 'three';

export function smoothCameraSteeringInput(
  current: number,
  target: number,
  deltaTime: number,
): number {
  const blend = 1 - Math.exp(-6 * Math.max(0, deltaTime));
  return current + (THREE.MathUtils.clamp(target, -1, 1) - current) * blend;
}

export function cameraOrientationForSteering(
  current: THREE.Quaternion,
  trackTarget: THREE.Quaternion,
  steeringInput: number,
  response: number,
): THREE.Quaternion {
  const steeringBlend = THREE.MathUtils.clamp(
    Math.max(Math.abs(steeringInput), 0.3) * response,
    0,
    1,
  );
  const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(current);
  const targetForward = new THREE.Vector3(0, 0, -1).applyQuaternion(trackTarget);
  const forward = currentForward.lerp(targetForward, steeringBlend).normalize();
  return cameraQuaternionFollowingTrack(forward);
}

export function cameraQuaternionFollowingTrack(tangent: THREE.Vector3): THREE.Quaternion {
  const forward = tangent.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const cameraRight = forward.clone().cross(worldUp);
  if (cameraRight.lengthSq() < 1e-8) cameraRight.set(1, 0, 0);
  cameraRight.normalize();
  const cameraUp = cameraRight.clone().cross(forward).normalize();
  const basis = new THREE.Matrix4().makeBasis(cameraRight, cameraUp, forward.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(basis).normalize();
}
