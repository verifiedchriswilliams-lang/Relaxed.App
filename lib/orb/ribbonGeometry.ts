import * as THREE from "three";

// Build the internal "liquid-glass ribbons" as real 3D swept surfaces so they have
// genuine depth, parallax, and view-dependent shading (not a flat 2D billboard).
//
// Each ribbon is a closed, organically-perturbed loop tilted through the sphere.
// We sweep a thin strip along the loop using the curve's Frenet frame: the strip's
// width runs along the binormal, its surface normal is the frame normal (so the
// Fresnel/edge shading in RIBBON_FRAG behaves like a sheet of glass).

export interface RibbonCurveOptions {
  axis: THREE.Vector3; // loop plane axis (the loop lies roughly perpendicular to this)
  radius: number; // base loop radius (keep < 1 so it sits inside the shell)
  wobbleAmp: number; // radial undulation amount
  wobbleFreq: number; // radial undulation frequency (integer-ish for a closed loop)
  phase: number; // phase offset so ribbons differ
  tiltAmp: number; // out-of-plane push along the axis -> real 3D waviness
  points?: number; // control points for the loop
}

export function makeRibbonCurve(o: RibbonCurveOptions): THREE.CatmullRomCurve3 {
  const A = o.axis.clone().normalize();
  const ref =
    Math.abs(A.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const U = new THREE.Vector3().crossVectors(A, ref).normalize();
  const W = new THREE.Vector3().crossVectors(A, U).normalize();

  const n = o.points ?? 28;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = o.radius + o.wobbleAmp * Math.sin(o.wobbleFreq * a + o.phase);
    const tilt = o.tiltAmp * Math.cos((o.wobbleFreq + 1.0) * a + o.phase * 1.3);
    pts.push(
      new THREE.Vector3()
        .addScaledVector(U, Math.cos(a) * r)
        .addScaledVector(W, Math.sin(a) * r)
        .addScaledVector(A, tilt),
    );
  }
  // Closed Catmull-Rom loop: no endpoints, so the ribbon reads as continuous.
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
}

export function buildRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  lengthSegs: number,
  width: number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(lengthSegs, true);
  const pts = curve.getSpacedPoints(lengthSegs); // lengthSegs + 1 points
  const count = pts.length;
  const half = width / 2;

  const positions = new Float32Array(count * 2 * 3);
  const normals = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);

  const lastN = frames.normals.length - 1;
  for (let i = 0; i < count; i++) {
    const p = pts[i];
    const idx = Math.min(i, lastN);
    const B = frames.binormals[idx];
    const N = frames.normals[idx];

    const po = i * 6;
    positions[po] = p.x - B.x * half;
    positions[po + 1] = p.y - B.y * half;
    positions[po + 2] = p.z - B.z * half;
    positions[po + 3] = p.x + B.x * half;
    positions[po + 4] = p.y + B.y * half;
    positions[po + 5] = p.z + B.z * half;

    normals[po] = N.x; normals[po + 1] = N.y; normals[po + 2] = N.z;
    normals[po + 3] = N.x; normals[po + 4] = N.y; normals[po + 5] = N.z;

    const uo = i * 4;
    const u = i / lengthSegs;
    uvs[uo] = u; uvs[uo + 1] = 0;
    uvs[uo + 2] = u; uvs[uo + 3] = 1;
  }

  const indices: number[] = [];
  for (let i = 0; i < lengthSegs; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, d, a, d, c);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}
