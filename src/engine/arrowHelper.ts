/**
 * 3D Curved Arrow and Layer Glow Highlight Generator for AI Tutor Mode
 */

import * as THREE from 'three';
import { Face, Move } from '../core/types';

class ArcCurve3D extends THREE.Curve<THREE.Vector3> {
  private center: THREE.Vector3;
  private radius: number;
  private startAngle: number;
  private endAngle: number;
  private axisU: THREE.Vector3;
  private axisV: THREE.Vector3;

  constructor(
    center: THREE.Vector3,
    radius: number,
    startAngle: number,
    endAngle: number,
    axisU: THREE.Vector3,
    axisV: THREE.Vector3
  ) {
    super();
    this.center = center;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.axisU = axisU.clone().normalize();
    this.axisV = axisV.clone().normalize();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = this.startAngle + (this.endAngle - this.startAngle) * t;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return optionalTarget
      .copy(this.center)
      .addScaledVector(this.axisU, this.radius * cos)
      .addScaledVector(this.axisV, this.radius * sin);
  }
}

export function createLayerHighlight(face: Face): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LayerHighlight';

  const size = new THREE.Vector3(3.12, 3.12, 3.12);
  const pos = new THREE.Vector3(0, 0, 0);

  switch (face) {
    case 'R':
      size.set(1.06, 3.14, 3.14);
      pos.set(1.0, 0, 0);
      break;
    case 'L':
      size.set(1.06, 3.14, 3.14);
      pos.set(-1.0, 0, 0);
      break;
    case 'U':
      size.set(3.14, 1.06, 3.14);
      pos.set(0, 1.0, 0);
      break;
    case 'D':
      size.set(3.14, 1.06, 3.14);
      pos.set(0, -1.0, 0);
      break;
    case 'F':
      size.set(3.14, 3.14, 1.06);
      pos.set(0, 0, 1.0);
      break;
    case 'B':
      size.set(3.14, 3.14, 1.06);
      pos.set(0, 0, -1.0);
      break;
  }

  const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const boxMat = new THREE.MeshBasicMaterial({
    color: 0x38BDF8,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const boxMesh = new THREE.Mesh(boxGeo, boxMat);
  boxMesh.position.copy(pos);
  group.add(boxMesh);

  // Wireframe border
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x38BDF8,
    linewidth: 2,
    transparent: true,
    opacity: 0.85,
  });
  const lineMesh = new THREE.LineSegments(edgesGeo, lineMat);
  lineMesh.position.copy(pos);
  group.add(lineMesh);

  return group;
}

export function createCurvedArrow(move: Move): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CurvedArrow';

  const face = move[0] as Face;
  const isCCW = move.includes("'");
  const isDouble = move.includes('2');

  const radius = 1.15;
  const offset = 1.72; // Distance outside the face

  const center = new THREE.Vector3();
  const axisU = new THREE.Vector3();
  const axisV = new THREE.Vector3();

  // Setup coordinate plane for the face so that CW rotation corresponds to increasing angle
  switch (face) {
    case 'U':
      // Top face: looking from above (+Y down)
      // CW: front (+Z) to left (-X) to back (-Z) to right (+X)
      center.set(0, offset, 0);
      axisU.set(0, 0, 1);  // +Z (front)
      axisV.set(-1, 0, 0); // -X (left)
      break;
    case 'D':
      // Bottom face: looking from below (-Y up)
      // CW: front (+Z) to right (+X)
      center.set(0, -offset, 0);
      axisU.set(0, 0, 1); // +Z (front)
      axisV.set(1, 0, 0); // +X (right)
      break;
    case 'F':
      // Front face: looking at front (+Z)
      // CW: top (+Y) to right (+X)
      center.set(0, 0, offset);
      axisU.set(0, 1, 0); // +Y (top)
      axisV.set(1, 0, 0); // +X (right)
      break;
    case 'B':
      // Back face: looking at back (-Z)
      // CW: top (+Y) to left (-X)
      center.set(0, 0, -offset);
      axisU.set(0, 1, 0);  // +Y (top)
      axisV.set(-1, 0, 0); // -X (left)
      break;
    case 'R':
      // Right face: looking at right (+X)
      // CW: top (+Y) to back (-Z)
      center.set(offset, 0, 0);
      axisU.set(0, 1, 0);  // +Y (top)
      axisV.set(0, 0, -1); // -Z (back)
      break;
    case 'L':
      // Left face: looking at left (-X)
      // CW: top (+Y) to front (+Z)
      center.set(-offset, 0, 0);
      axisU.set(0, 1, 0); // +Y (top)
      axisV.set(0, 0, 1); // +Z (front)
      break;
  }

  // Arc angles
  let startAngle = -Math.PI * 0.35;
  let endAngle = Math.PI * 0.35;

  if (isDouble) {
    startAngle = -Math.PI * 0.65;
    endAngle = Math.PI * 0.65;
  }

  // If CCW, reverse the direction
  if (isCCW) {
    const temp = startAngle;
    startAngle = endAngle;
    endAngle = temp;
  }

  const curve = new ArcCurve3D(center, radius, startAngle, endAngle, axisU, axisV);
  const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.045, 8, false);
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x38BDF8,
    emissive: 0x0284C7,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.3,
  });

  const tubeMesh = new THREE.Mesh(tubeGeo, arrowMat);
  group.add(tubeMesh);

  // Arrowhead cone at the end of the arc
  const coneGeo = new THREE.ConeGeometry(0.13, 0.28, 16);
  const coneMesh = new THREE.Mesh(coneGeo, arrowMat);

  const endPoint = curve.getPoint(1);
  const preEndPoint = curve.getPoint(0.95);
  const tangent = new THREE.Vector3().subVectors(endPoint, preEndPoint).normalize();

  coneMesh.position.copy(endPoint);
  // Point cone in direction of tangent (default cone points along +Y)
  coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  group.add(coneMesh);

  // If double move, add a second arrowhead or indicator
  if (isDouble) {
    const cone2Mesh = coneMesh.clone();
    const startPoint = curve.getPoint(0);
    const postStartPoint = curve.getPoint(0.05);
    const startTangent = new THREE.Vector3().subVectors(startPoint, postStartPoint).normalize();
    cone2Mesh.position.copy(startPoint);
    cone2Mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), startTangent);
    group.add(cone2Mesh);
  }

  return group;
}
