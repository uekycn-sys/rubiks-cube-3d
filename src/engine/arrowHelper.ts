/**
 * 3D Curved Arrow and Layer Glow Highlight Generator for AI Tutor Mode
 * Features dual symmetrical, thick, glowing 3D tubular arrows located outside the cube
 * bounding box to guarantee 100% visibility from any viewing angle.
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

/**
 * Creates a pulsating semi-transparent glow wireframe box around the rotating 9-cubie layer
 */
export function createLayerHighlight(face: Face): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LayerHighlight';

  const size = new THREE.Vector3(3.2, 3.2, 3.2);
  const pos = new THREE.Vector3(0, 0, 0);

  switch (face) {
    case 'R':
      size.set(1.12, 3.2, 3.2);
      pos.set(1.0, 0, 0);
      break;
    case 'L':
      size.set(1.12, 3.2, 3.2);
      pos.set(-1.0, 0, 0);
      break;
    case 'U':
      size.set(3.2, 1.12, 3.2);
      pos.set(0, 1.0, 0);
      break;
    case 'D':
      size.set(3.2, 1.12, 3.2);
      pos.set(0, -1.0, 0);
      break;
    case 'F':
      size.set(3.2, 3.2, 1.12);
      pos.set(0, 0, 1.0);
      break;
    case 'B':
      size.set(3.2, 3.2, 1.12);
      pos.set(0, 0, -1.0);
      break;
  }

  const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const boxMat = new THREE.MeshBasicMaterial({
    color: 0x00F0FF,
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
    color: 0x00F0FF,
    linewidth: 2,
    transparent: true,
    opacity: 0.9,
  });
  const lineMesh = new THREE.LineSegments(edgesGeo, lineMat);
  lineMesh.position.copy(pos);
  group.add(lineMesh);

  return group;
}

/**
 * Creates dual symmetrical 3D curved arrows floating cleanly outside the cube face
 */
export function createCurvedArrow(move: Move): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CurvedArrow';

  const face = move[0] as Face;
  const isCCW = move.includes("'");
  const isDouble = move.includes('2');

  // Outer radius expanded beyond the 1.5 cube half-width to prevent clipping
  const radius = 1.92;
  const offset = 1.72; // Distance outside the face plane

  const center = new THREE.Vector3();
  const axisU = new THREE.Vector3();
  const axisV = new THREE.Vector3();

  // Setup coordinate plane for the face so that CW rotation corresponds to increasing angle
  switch (face) {
    case 'U':
      // Top face (+Y)
      center.set(0, offset, 0);
      axisU.set(0, 0, 1);  // +Z (front)
      axisV.set(-1, 0, 0); // -X (left)
      break;
    case 'D':
      // Bottom face (-Y)
      center.set(0, -offset, 0);
      axisU.set(0, 0, 1); // +Z (front)
      axisV.set(1, 0, 0); // +X (right)
      break;
    case 'F':
      // Front face (+Z)
      center.set(0, 0, offset);
      axisU.set(0, 1, 0); // +Y (top)
      axisV.set(1, 0, 0); // +X (right)
      break;
    case 'B':
      // Back face (-Z)
      center.set(0, 0, -offset);
      axisU.set(0, 1, 0);  // +Y (top)
      axisV.set(-1, 0, 0); // -X (left)
      break;
    case 'R':
      // Right face (+X)
      center.set(offset, 0, 0);
      axisU.set(0, 1, 0);  // +Y (top)
      axisV.set(0, 0, -1); // -Z (back)
      break;
    case 'L':
      // Left face (-X)
      center.set(-offset, 0, 0);
      axisU.set(0, 1, 0); // +Y (top)
      axisV.set(0, 0, 1); // +Z (front)
      break;
  }

  // Base arc half-angle span: normal 42 deg, double 75 deg
  const halfSpan = isDouble ? Math.PI * 0.42 : Math.PI * 0.24;

  // Arrow 1: centered at 0
  let startAngle1 = -halfSpan;
  let endAngle1 = halfSpan;

  // Arrow 2: centered at PI (symmetrical opposite side)
  let startAngle2 = Math.PI - halfSpan;
  let endAngle2 = Math.PI + halfSpan;

  // If CCW, reverse direction
  if (isCCW) {
    const tmp1 = startAngle1;
    startAngle1 = endAngle1;
    endAngle1 = tmp1;

    const tmp2 = startAngle2;
    startAngle2 = endAngle2;
    endAngle2 = tmp2;
  }

  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x00F0FF, // Electric Cyan
    emissive: 0x00F0FF,
    emissiveIntensity: 1.4,
    roughness: 0.15,
    metalness: 0.2,
  });

  // Helper to create one single arrow (tube body + cone head)
  const addSingleArrow = (startA: number, endA: number) => {
    const curve = new ArcCurve3D(center, radius, startA, endA, axisU, axisV);
    const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.075, 12, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, arrowMat);
    group.add(tubeMesh);

    // Arrowhead cone at the leading tip
    const coneGeo = new THREE.ConeGeometry(0.18, 0.38, 16);
    const coneMesh = new THREE.Mesh(coneGeo, arrowMat);

    const endPoint = curve.getPoint(1);
    const preEndPoint = curve.getPoint(0.92);
    const tangent = new THREE.Vector3().subVectors(endPoint, preEndPoint).normalize();

    coneMesh.position.copy(endPoint);
    coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    group.add(coneMesh);

    // For double turns, add a second cone at the trailing end to signify 180° rotation
    if (isDouble) {
      const coneStartMesh = coneMesh.clone();
      const startPoint = curve.getPoint(0);
      const postStartPoint = curve.getPoint(0.08);
      const startTangent = new THREE.Vector3().subVectors(startPoint, postStartPoint).normalize();
      coneStartMesh.position.copy(startPoint);
      coneStartMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), startTangent);
      group.add(coneStartMesh);
    }
  };

  // Generate 2 symmetrical arrows on opposite sides of the layer
  addSingleArrow(startAngle1, endAngle1);
  addSingleArrow(startAngle2, endAngle2);

  return group;
}
