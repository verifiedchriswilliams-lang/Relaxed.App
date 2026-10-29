"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  GLASS_VERT,
  GLASS_FRAG,
  RIBBON_VERT,
  RIBBON_FRAG,
  MOTE_VERT,
  MOTE_FRAG,
} from "./shaders";
import { makeRibbonCurve, buildRibbonGeometry } from "./ribbonGeometry";

// Public interface the relaxed.app voice system can drive later. Kept intentionally
// small and provider-agnostic: the orb never talks to the speech service directly.
export interface OrbParams {
  /** Normalized, already-smoothed voice amplitude, 0..1. */
  audioLevel?: number;
  /** The assistant is speaking. */
  isSpeaking?: boolean;
  /** We're waiting for the user to respond. */
  isListening?: boolean;
  /** Minimize motion for accessibility. */
  reducedMotion?: boolean;
  /** Fraction of the min(viewport) the orb spans (visual size tuning). */
  scale?: number;
  className?: string;
}

type Resolved = Required<Omit<OrbParams, "className">>;

const DEFAULTS: Resolved = {
  audioLevel: 0,
  isSpeaking: false,
  isListening: false,
  reducedMotion: false,
  scale: 1,
};

// Five ribbons, asymmetric orientations, warm palette. Organic, not a gyroscope.
const RIBBONS = [
  { axis: [0.1, 1.0, 0.2], radius: 0.82, wobbleAmp: 0.06, wobbleFreq: 2, phase: 0.0, tiltAmp: 0.18, width: 0.16, bright: 1.0, edge: "#fff6e6", body: "#e9c892" },
  { axis: [1.0, 0.2, 0.3], radius: 0.80, wobbleAmp: 0.08, wobbleFreq: 3, phase: 1.3, tiltAmp: 0.22, width: 0.12, bright: 1.2, edge: "#fffaf0", body: "#f0d3a0" },
  { axis: [0.3, 0.4, 1.0], radius: 0.84, wobbleAmp: 0.05, wobbleFreq: 2, phase: 2.5, tiltAmp: 0.16, width: 0.18, bright: 0.9, edge: "#fff2dc", body: "#dcae6a" },
  { axis: [-0.6, 0.7, 0.2], radius: 0.78, wobbleAmp: 0.09, wobbleFreq: 3, phase: 0.7, tiltAmp: 0.24, width: 0.10, bright: 1.1, edge: "#fffaf0", body: "#e6c489" },
  { axis: [0.5, -0.3, 0.8], radius: 0.86, wobbleAmp: 0.06, wobbleFreq: 2, phase: 3.1, tiltAmp: 0.14, width: 0.14, bright: 0.85, edge: "#fff2dc", body: "#d8a85c" },
] as const;

function OrbScene({ paramsRef }: { paramsRef: React.MutableRefObject<Resolved> }) {
  const group = useRef<THREE.Group>(null);
  const smooth = useRef(0);

  // --- geometries + materials (built once; animated via uniforms) ---
  const glassGeo = useMemo(() => new THREE.SphereGeometry(1, 128, 128), []);
  const glassMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GLASS_VERT,
        fragmentShader: GLASS_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.FrontSide,
        uniforms: {
          uTime: { value: 0 },
          uAudio: { value: 0 },
          uRimColor: { value: new THREE.Color("#f6ecd8") },
          uSpecColor: { value: new THREE.Color("#fffaf0") },
        },
      }),
    [],
  );

  const ribbons = useMemo(
    () =>
      RIBBONS.map((r) => {
        const curve = makeRibbonCurve({
          axis: new THREE.Vector3(...r.axis),
          radius: r.radius,
          wobbleAmp: r.wobbleAmp,
          wobbleFreq: r.wobbleFreq,
          phase: r.phase,
          tiltAmp: r.tiltAmp,
        });
        const geometry = buildRibbonGeometry(curve, 240, r.width);
        const material = new THREE.ShaderMaterial({
          vertexShader: RIBBON_VERT,
          fragmentShader: RIBBON_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uAudio: { value: 0 },
            uBright: { value: r.bright },
            uWobble: { value: 1 },
            uEdgeColor: { value: new THREE.Color(r.edge) },
            uBodyColor: { value: new THREE.Color(r.body) },
          },
        });
        return { geometry, material };
      }),
    [],
  );

  const motes = useMemo(() => {
    const N = 44;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const bright = new Float32Array(N);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = 0, y = 0, z = 0, d = 2;
      while (d > 1) {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        d = x * x + y * y + z * z;
      }
      const rr = 0.9 * Math.cbrt(Math.random());
      const n = Math.sqrt(d) || 1;
      pos[i * 3] = (x / n) * rr;
      pos[i * 3 + 1] = (y / n) * rr;
      pos[i * 3 + 2] = (z / n) * rr;
      const big = Math.random() < 0.18;
      size[i] = big ? 4.5 + Math.random() * 2.5 : 2 + Math.random() * 1.5;
      bright[i] = big ? 0.9 : 0.3 + Math.random() * 0.35;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAudio: { value: 0 } },
    });
    return { geometry, material };
  }, []);

  // dispose everything we created imperatively
  useEffect(() => {
    return () => {
      glassGeo.dispose();
      glassMat.dispose();
      motes.geometry.dispose();
      motes.material.dispose();
      ribbons.forEach((r) => {
        r.geometry.dispose();
        r.material.dispose();
      });
    };
  }, [glassGeo, glassMat, motes, ribbons]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const p = paramsRef.current;

    // smooth the audio so individual spikes don't make it twitch
    const target = p.reducedMotion ? Math.min(p.audioLevel, 0.2) : p.audioLevel;
    smooth.current += (target - smooth.current) * Math.min(1, dt * 6);
    const a = smooth.current;

    // state floor: speaking is brightest, listening quietest, idle in between
    const floor = p.isSpeaking ? 0.34 : p.isListening ? 0.1 : 0.17;
    const audio = Math.min(1, floor + a * 0.85);

    for (const r of ribbons) {
      r.material.uniforms.uTime.value = t;
      r.material.uniforms.uAudio.value = audio;
      r.material.uniforms.uWobble.value = p.reducedMotion ? 0.25 : 1;
    }
    glassMat.uniforms.uTime.value = t;
    glassMat.uniforms.uAudio.value = audio;
    motes.material.uniforms.uTime.value = t;
    motes.material.uniforms.uAudio.value = audio;

    if (group.current) {
      // idle breathing: ~1% scale, plus a hair more while speaking. Never a bounce.
      const breath = p.reducedMotion ? 0 : Math.sin(t * 0.5) * 0.01;
      group.current.scale.setScalar(p.scale * (1 + breath + a * 0.012));
      // gentle sway instead of a constant spin, so depth reads without motion fatigue
      if (!p.reducedMotion) {
        group.current.rotation.y = Math.sin(t * 0.08) * 0.3;
        group.current.rotation.x = Math.sin(t * 0.063) * 0.12;
      }
    }
  });

  return (
    <group ref={group}>
      {ribbons.map((r, i) => (
        <mesh key={i} geometry={r.geometry} material={r.material} renderOrder={1} />
      ))}
      <points geometry={motes.geometry} material={motes.material} renderOrder={2} />
      <mesh geometry={glassGeo} material={glassMat} renderOrder={4} />
    </group>
  );
}

/**
 * Standalone, reusable liquid-glass orb. Renders its own canvas against a near-black
 * ground so it can be dropped anywhere (e.g. the voiced-onboarding hello screen) and
 * driven by the voice system through OrbParams.
 */
export default function LiquidGlassOrb(props: OrbParams) {
  const paramsRef = useRef<Resolved>({ ...DEFAULTS });
  paramsRef.current = {
    audioLevel: props.audioLevel ?? DEFAULTS.audioLevel,
    isSpeaking: props.isSpeaking ?? DEFAULTS.isSpeaking,
    isListening: props.isListening ?? DEFAULTS.isListening,
    reducedMotion: props.reducedMotion ?? DEFAULTS.reducedMotion,
    scale: (props.scale ?? 1) * 0.6,
  };

  return (
    <Canvas
      className={props.className}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: 30, position: [0, 0, 4.2], near: 0.1, far: 100 }}
    >
      <color attach="background" args={["#0d0b09"]} />
      <OrbScene paramsRef={paramsRef} />
      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.2}
          radius={0.6}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
