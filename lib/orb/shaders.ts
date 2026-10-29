// GLSL for the liquid-glass orb. Three independently tunable materials so the
// outer shell, the internal ribbons, and the highlights can be adjusted on their
// own (per the visual spec). All color is warm — ivory, champagne, gold — never
// blue/cyan. The look is "transparent glass with a dark interior," not a glowing
// ball, so the shell stays near-clear in the center and only the rim + specular
// carry weight.

// ---- Outer glass shell: champagne Fresnel rim + crisp specular, clear center ----
export const GLASS_VERT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GLASS_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAudio;      // 0..1 smoothed voice level
  uniform vec3  uRimColor;   // champagne
  uniform vec3  uSpecColor;  // ivory
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float ndv = clamp(dot(N, V), 0.0, 1.0);

    // Fresnel rim: strong near the silhouette, fading to near-nothing at center.
    float fres = pow(1.0 - ndv, 3.0);

    // Two crisp specular glints suggest polished glass (narrow highlights).
    vec3 L1 = normalize(vec3(0.6, 0.95, 0.75));
    vec3 L2 = normalize(vec3(-0.7, 0.25, 0.55));
    vec3 H1 = normalize(L1 + V);
    vec3 H2 = normalize(L2 + V);
    float spec = pow(max(dot(N, H1), 0.0), 220.0) * 0.9
               + pow(max(dot(N, H2), 0.0), 340.0) * 0.5;

    float rim = fres * (0.85 + 0.30 * uAudio);
    vec3 col = uRimColor * rim * 1.1 + uSpecColor * spec * 1.5;

    // Near-clear center (see through to the dark interior), opaque only at rim/glints.
    float alpha = clamp(0.035 + rim * 0.8 + spec, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ---- Internal ribbons: translucent glass sheets, bright ivory edge, champagne body ----
export const RIBBON_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAudio;
  uniform float uWobble;   // per-ribbon motion scale
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Gentle organic breathing of the sheet along its own normal. Small enough that
    // the sphere's identity never changes; a touch livelier while speaking.
    float w = sin(uv.x * 6.2831 * 2.0 + uTime * 0.55) * 0.012
            + sin(uv.x * 6.2831 * 3.0 - uTime * 0.37) * 0.008;
    pos += normal * w * (1.0 + uAudio * 1.4) * uWobble;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const RIBBON_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAudio;
  uniform float uBright;     // per-ribbon base brightness
  uniform vec3  uEdgeColor;  // ivory
  uniform vec3  uBodyColor;  // champagne / gold
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    // Across-width profile: 0 at the sheet's center, 1 at its two long edges.
    float d = abs(vUv.y - 0.5) * 2.0;
    float edge = pow(d, 2.2);                       // bright ivory edges
    float body = 1.0 - smoothstep(0.0, 1.0, d);     // soft translucent body

    // Fresnel sheen so the sheet reads like optical glass, not a flat gradient.
    float ndv = clamp(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 1.5);

    vec3 col = mix(uBodyColor, uEdgeColor, edge);
    float level = (0.6 + 0.8 * uAudio) * uBright;
    col *= (0.5 + 0.95 * edge + 0.45 * fres) * level;

    // Partially transparent everywhere; edges carry more presence than the body.
    float alpha = (0.13 * body + 0.6 * edge + 0.22 * fres);
    alpha = clamp(alpha * uBright * (0.8 + 0.4 * uAudio), 0.0, 0.9);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ---- A few suspended gold motes (restrained; not a particle field) ----
export const MOTE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  attribute float aPhase;
  uniform float uTime;
  uniform float uAudio;
  varying float vB;
  void main() {
    vB = aBright * (0.6 + 0.8 * uAudio) * (0.6 + 0.4 * sin(uTime * 0.7 + aPhase));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1.0 + 0.4 * uAudio);
    gl_Position = projectionMatrix * mv;
  }
`;

export const MOTE_FRAG = /* glsl */ `
  precision highp float;
  varying float vB;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r) * clamp(vB, 0.0, 1.0);
    gl_FragColor = vec4(1.0, 0.86, 0.56, a);
  }
`;
