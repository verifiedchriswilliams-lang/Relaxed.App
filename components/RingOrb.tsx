"use client";

// The relaxed voice orb: a single authored frame (public/orb/calm-1.png) brought to life
// in a WebGL shader. It is always gently alive (constant solar-wind flow + orbital drift);
// when the APP speaks, the voice level drives three responses only — brightness (centred on
// the sphere), warmth (ivory -> gold), and the two ribbon rings bouncing outward. It never
// reacts to the microphone. Colour is passthrough (no tone-mapping) so the art shows as drawn.
//
// Drive it with `mode` + `level` (0..1, the app's own TTS output level):
//   - "speaking": level drives the voice responses
//   - "idle" / "listening": calm, level ignored (we never visualise the user's audio)
//
// Import it lazily (next/dynamic, ssr:false) so three.js stays out of the main bundle.

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbMode = "idle" | "speaking" | "listening";

export interface RingOrbProps {
  mode?: OrbMode;
  /** The app's own voice output level, 0..1. Only used while mode === "speaking". */
  level?: number;
  /** Optional per-frame level source (e.g. engine.voiceLevel()), read in the render
   *  loop so the orb tracks the live voice at 60fps without React re-renders.
   *  Takes precedence over `level` while speaking. */
  levelSource?: () => number;
  /** Resting warmth when quiet: 1 = most ivory/angelic, lower = warmer. */
  angelicQuiet?: number;
  /** Honour reduced-motion (slower, gentler). Defaults to the OS setting. */
  reduced?: boolean;
  /** When false, the orb holds at t=0 (its clock is paused). Flip to true at the
   *  video->orb handoff so the live orb starts from the video's last frame. Default true. */
  running?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const ANGELIC_LOUD = 0.4; // warmest (goldiest) at the loudest app peaks
const INK = new THREE.Vector3(0.0706, 0.0667, 0.0627); // app background (#121110)

const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

const FRAG = `
  precision highp float;
  uniform sampler2D tOrb;
  uniform float uTime, uImgAspect, uEnv, uBright, uAngelic; uniform vec2 uRes;
  uniform vec3 uBg;
  varying vec2 vUv;
  void main(){
    float sa = uRes.x/uRes.y;
    vec2 uv = vUv;
    vec2 sc = sa>uImgAspect ? vec2(sa/uImgAspect,1.0) : vec2(1.0,uImgAspect/sa);
    uv=(uv-0.5)*sc+0.5;
    vec2 c=uv-0.5; float r=length(c)+1e-4; float ang=atan(c.y,c.x); float t=uTime;
    float amp = 2.1;                                               // constant billowy streaming (never voice-driven)
    vec2 tang = vec2(-c.y, c.x)/r;
    float a2 = ang + 0.35*sin(r*9.0 - t*0.6) + 0.22*sin(ang*2.0 + t*0.37);
    float swirl = sin(a2*3.0 + t*0.9)*0.0065
                + sin(a2*5.0 - t*0.55)*0.0038
                + sin(a2*8.0 + t*1.3 + r*6.0)*0.0020;
    float ripple = sin(r*18.0 - t*1.1)*0.0019 + sin(r*31.0 + t*0.7)*0.0011;
    float mask = smoothstep(0.14, 0.24, r);                        // flow reaches the inner cloud; only the sphere stays anchored
    uv += ((c/r)*ripple + tang*swirl) * amp * mask;
    uv += tang * (0.006*sin(t*0.23) + 0.004) * smoothstep(0.15,0.55,r); // wind drift (constant)
    uv += tang * (r * 0.12*sin(t*0.17)) * mask;                   // orbital swing CW<->CCW (constant)
    // the ONLY voice-driven motion: inner + outer ring each bounce outward, independent rhythms
    float inner = smoothstep(0.195,0.25,r) * (1.0 - smoothstep(0.29,0.37,r));
    float outer = smoothstep(0.32,0.40,r);
    float bncIn  = 0.55 + 0.45*sin(t*1.9);
    float bncOut = 0.55 + 0.45*sin(t*1.2 + 2.1);
    uv -= (c/r) * (uEnv*0.055*inner*bncIn + uEnv*0.055*outer*bncOut);
    vec3 col = vec3(0.0);
    bool inBounds = uv.x>=0.0 && uv.x<=1.0 && uv.y>=0.0 && uv.y<=1.0;
    if(inBounds){
      col = max(texture2D(tOrb, uv).rgb - vec3(0.0706,0.0667,0.0627), 0.0); // key out the PNG's Ink background box
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 champ = mix(col, vec3(lum), 0.78) * vec3(1.0, 0.955, 0.875);     // angelic grade -> ivory/champagne
      col = mix(col, champ, uAngelic);
      float core = smoothstep(0.26, 0.0, r);
      col *= 1.0 + 0.20*uEnv*core;                                          // centre light swells with the voice
      float rim = smoothstep(0.115,0.150,r) * (1.0 - smoothstep(0.150,0.190,r));
      vec3 ring = max(texture2D(tOrb, 0.5 + (uv-0.5)*1.9).rgb - vec3(0.0706,0.0667,0.0627), 0.0);
      ring = mix(ring, vec3(dot(ring,vec3(0.299,0.587,0.114))), 0.78) * vec3(1.0,0.955,0.875);
      col += ring * rim * 0.45;                                             // ring-light wraps the sphere's rim (depth)
    }
    gl_FragColor = vec4(uBg + col*uBright, 1.0);
  }`;

export default function RingOrb({
  mode = "idle",
  level = 0,
  levelSource,
  angelicQuiet = 0.8,
  reduced,
  running = true,
  className,
  style,
}: RingOrbProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Latest props, read inside the animation loop without re-initialising WebGL.
  const live = useRef({ mode, level, levelSource, angelicQuiet, reduced, running });
  live.current = { mode, level, levelSource, angelicQuiet, reduced, running };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return; // no WebGL: render nothing (the host stays the Ink background)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // passthrough colour
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const loader = new THREE.TextureLoader();
    const tex = loader.load("/orb/calm-1.png", (t) => {
      mat.uniforms.uImgAspect.value = t.image.width / t.image.height;
    });
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tOrb: { value: tex },
        uTime: { value: 0 },
        uImgAspect: { value: 1 },
        uEnv: { value: 0 },
        uBright: { value: 1 },
        uAngelic: { value: angelicQuiet },
        uRes: { value: new THREE.Vector2(1, 1) },
        uBg: { value: INK.clone() },
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      const pr = renderer.getPixelRatio();
      mat.uniforms.uRes.value.set(w * pr, h * pr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const sm = { env: 0 };
    let runStart: number | null = null;
    let raf = 0;
    const frame = () => {
      const p = live.current;
      const red = p.reduced ?? prefersReduced;
      const nowp = performance.now();
      // Clock holds at 0 until `running` flips true (the video->orb handoff), so the
      // live orb begins exactly at the frame the video ended on.
      if (p.running) {
        if (runStart === null) runStart = nowp;
      } else {
        runStart = null;
      }
      const t = runStart !== null ? (nowp - runStart) / 1000 : 0;
      const lvl = p.levelSource ? p.levelSource() : p.level;
      const raw = p.mode === "speaking" ? Math.max(0, Math.min(1, lvl)) : 0;
      const target = red ? Math.min(raw, 0.3) : raw;
      sm.env += (target - sm.env) * 0.12;
      const rest = p.angelicQuiet;
      mat.uniforms.uTime.value = red ? t * 0.4 : t;
      mat.uniforms.uEnv.value = sm.env;
      mat.uniforms.uBright.value = 1.0 + 0.14 * sm.env;
      mat.uniforms.uAngelic.value = rest - (rest - ANGELIC_LOUD) * sm.env;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mesh.geometry.dispose();
      mat.dispose();
      tex.dispose();
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ background: "#121110", ...style }}
      aria-hidden="true"
    />
  );
}
