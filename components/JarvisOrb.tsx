'use client';

import { useEffect, useRef } from 'react';

interface JarvisOrbProps {
  loading: boolean;
  listening: boolean;
  speaking: boolean;
  size?: number;
}

export default function JarvisOrb({ loading, listening, speaking, size = 260 }: JarvisOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef({ loading, listening, speaking });
  const rafRef    = useRef<number>(0);
  const tRef      = useRef(0);

  useEffect(() => {
    stateRef.current = { loading, listening, speaking };
  }, [loading, listening, speaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

    // Fallback: canvas 2D if WebGL not available
    if (!gl) {
      canvas2DFallback(canvas, stateRef, rafRef, tRef);
      return;
    }

    // ── Particle data ──────────────────────────────────────────────────────────
    const N = 2200;
    const basePositions  = new Float32Array(N * 3);
    const phases         = new Float32Array(N);
    const speeds         = new Float32Array(N);
    const sizes          = new Float32Array(N);

    // Fibonacci sphere distribution — even spread
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < N; i++) {
      const theta = Math.acos(1 - 2 * (i + 0.5) / N);
      const phi   = 2 * Math.PI * i / goldenRatio;
      basePositions[i * 3]     = Math.sin(theta) * Math.cos(phi);
      basePositions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi);
      basePositions[i * 3 + 2] = Math.cos(theta);
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.4 + Math.random() * 0.6;
      sizes[i]  = 1.5 + Math.random() * 2.5;
    }

    // ── Shaders ────────────────────────────────────────────────────────────────
    const vsSource = `
      attribute vec3 aBase;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;

      uniform float uTime;
      uniform float uRadius;
      uniform float uNoise;     // 0-1 displacement amount
      uniform float uPulse;     // 0-1 speaking pulse
      uniform float uListenPct; // 0-1 listen compression
      uniform mat4 uRot;

      varying float vBrightness;
      varying float vDist;

      // Simple 3D noise via trig
      float noise(vec3 p, float t) {
        return sin(p.x * 4.0 + t * 1.3) * cos(p.y * 3.7 + t * 0.9) * sin(p.z * 5.1 + t * 1.1);
      }

      void main() {
        // Base radius — compress when listening, expand when speaking
        float r = uRadius * (1.0 - uListenPct * 0.18 + uPulse * 0.22);

        // Noise displacement — breathing + speaking chaos
        float nAmt = uNoise * (0.08 + uPulse * 0.22);
        float n = noise(aBase, uTime * aSpeed + aPhase) * nAmt;

        vec3 pos = aBase * (r + n * r);

        // Rotate
        vec4 rotated = uRot * vec4(pos, 1.0);

        // Perspective
        float z     = rotated.z / (2.0 * uRadius) + 1.0;
        float depth = clamp(z, 0.5, 1.5);

        gl_Position  = vec4(rotated.xy / (uRadius * 1.35), 0.0, depth);
        gl_PointSize = aSize * depth * (1.0 + uPulse * 0.8);

        // Brightness: brighter at front, varies with pulse
        vBrightness = depth * (0.6 + uPulse * 0.4 + uListenPct * 0.3);
        vDist = length(aBase.xy); // equatorial brightness
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec3 uColor;
      varying float vBrightness;
      varying float vDist;

      void main() {
        // Circular point
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = dot(cxy, cxy);
        if (r > 1.0) discard;

        float alpha = (1.0 - r) * vBrightness;
        gl_FragColor = vec4(uColor * vBrightness, alpha * 0.85);
      }
    `;

    function compileShader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const vs  = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs  = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const prg = gl.createProgram()!;
    gl.attachShader(prg, vs);
    gl.attachShader(prg, fs);
    gl.linkProgram(prg);
    gl.useProgram(prg);

    // Buffers
    function mkBuf(data: Float32Array) {
      const b = gl!.createBuffer()!;
      gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.STATIC_DRAW);
      return b;
    }

    const baseBuf  = mkBuf(basePositions);
    const phaseBuf = mkBuf(phases);
    const speedBuf = mkBuf(speeds);
    const sizeBuf  = mkBuf(sizes);

    function bindAttr(name: string, buf: WebGLBuffer, size: number) {
      const loc = gl!.getAttribLocation(prg, name);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, size, gl!.FLOAT, false, 0, 0);
    }

    bindAttr('aBase',  baseBuf,  3);
    bindAttr('aPhase', phaseBuf, 1);
    bindAttr('aSpeed', speedBuf, 1);
    bindAttr('aSize',  sizeBuf,  1);

    // Uniforms
    const uTime      = gl.getUniformLocation(prg, 'uTime');
    const uRadius    = gl.getUniformLocation(prg, 'uRadius');
    const uNoise     = gl.getUniformLocation(prg, 'uNoise');
    const uPulse     = gl.getUniformLocation(prg, 'uPulse');
    const uListenPct = gl.getUniformLocation(prg, 'uListenPct');
    const uRot       = gl.getUniformLocation(prg, 'uRot');
    const uColor     = gl.getUniformLocation(prg, 'uColor');

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);  // additive blending — glowing

    // State lerp targets
    let noiseLerp   = 0.3;
    let pulseLerp   = 0;
    let listenLerp  = 0;
    let rotY = 0;
    let rotX = 0.2;

    // Rotation matrix (Y then X)
    function rotMat(rx: number, ry: number): Float32Array {
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const cy = Math.cos(ry), sy = Math.sin(ry);
      return new Float32Array([
         cy,  sx*sy, cx*sy, 0,
          0,     cx,   -sx, 0,
        -sy,  sx*cy, cx*cy, 0,
          0,      0,     0, 1,
      ]);
    }

    const R = 0.72; // normalised radius
    let noiseTarget = 0.3, pulseTarget = 0, listenTarget = 0;
    let colorTarget = [218/255, 255/255, 1/255]; // lime #DAFF01

    function tick(ts: number) {
      const t = ts * 0.001;
      tRef.current = t;
      const { loading: ld, listening: ls, speaking: sp } = stateRef.current;

      // Targets based on state
      noiseTarget  = ld ? 0.55 : sp ? 0.75 : ls ? 0.4 : 0.28;
      pulseTarget  = sp ? 0.5 + 0.5 * Math.sin(t * 7.0) : ld ? 0.2 + 0.1 * Math.sin(t * 3.0) : 0;
      listenTarget = ls ? 1 : 0;
      colorTarget  = sp
        ? [218/255, 255/255, 1/255]     // lime — speaking
        : ls
        ? [180/255, 240/255, 255/255]   // ice blue — listening
        : ld
        ? [218/255, 200/255, 255/255]   // soft purple — thinking
        : [218/255, 255/255, 1/255];    // lime — idle

      // Smooth lerp
      const lf = 0.05;
      noiseLerp  += (noiseTarget  - noiseLerp)  * lf;
      pulseLerp  += (pulseTarget  - pulseLerp)  * (sp ? 0.3 : lf);
      listenLerp += (listenTarget - listenLerp) * lf;

      // Rotation — faster when active
      const rotSpeed = sp ? 0.012 : ls ? 0.006 : ld ? 0.009 : 0.004;
      rotY += rotSpeed;
      rotX = 0.18 + 0.04 * Math.sin(t * 0.4);

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      gl!.uniform1f(uTime,      t);
      gl!.uniform1f(uRadius,    R);
      gl!.uniform1f(uNoise,     noiseLerp);
      gl!.uniform1f(uPulse,     pulseLerp);
      gl!.uniform1f(uListenPct, listenLerp);
      gl!.uniformMatrix4fv(uRot, false, rotMat(rotX, rotY));
      gl!.uniform3f(uColor, colorTarget[0], colorTarget[1], colorTarget[2]);

      gl!.drawArrays(gl!.POINTS, 0, N);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        display: 'block',
        // Outer glow via CSS — changes with state
        filter: speaking
          ? 'drop-shadow(0 0 32px rgba(218,255,1,0.7)) drop-shadow(0 0 80px rgba(218,255,1,0.25))'
          : listening
          ? 'drop-shadow(0 0 24px rgba(180,240,255,0.6)) drop-shadow(0 0 60px rgba(180,240,255,0.2))'
          : loading
          ? 'drop-shadow(0 0 20px rgba(218,200,255,0.5))'
          : 'drop-shadow(0 0 12px rgba(218,255,1,0.25))',
        transition: 'filter 0.5s ease',
      }}
    />
  );
}

// ── Canvas 2D fallback (Safari WebGL edge cases) ───────────────────────────────
function canvas2DFallback(
  canvas: HTMLCanvasElement,
  stateRef: React.MutableRefObject<{ loading: boolean; listening: boolean; speaking: boolean }>,
  rafRef: React.MutableRefObject<number>,
  tRef: React.MutableRefObject<number>,
) {
  const ctx  = canvas.getContext('2d')!;
  const dpr  = Math.min(window.devicePixelRatio ?? 1, 2);
  const size = canvas.offsetWidth;
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const N = 800;
  const pts: { x: number; y: number; z: number; phase: number; speed: number }[] = [];
  const golden = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < N; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / N);
    const phi   = 2 * Math.PI * i / golden;
    pts.push({ x: Math.sin(theta)*Math.cos(phi), y: Math.sin(theta)*Math.sin(phi), z: Math.cos(theta), phase: Math.random()*Math.PI*2, speed: 0.4+Math.random()*0.6 });
  }

  let noiseL = 0.3;

  function tick(ts: number) {
    const t = ts * 0.001;
    tRef.current = t;
    const { listening: ls, speaking: sp } = stateRef.current;
    const noiseT = sp ? 0.75 : ls ? 0.4 : 0.28;
    noiseL += (noiseT - noiseL) * 0.05;

    const half = size / 2;
    const R    = half * 0.72;
    ctx.clearRect(0, 0, size, size);

    const rotY = t * 0.004;
    const cy = Math.cos(rotY), sy = Math.sin(rotY);

    const color = sp ? '218,255,1' : ls ? '180,240,255' : '218,255,1';

    for (const p of pts) {
      const noise = Math.sin(p.x*4+t*p.speed+p.phase) * Math.cos(p.y*3.7+t*0.9) * Math.sin(p.z*5.1+t*1.1) * noiseL * 0.1;
      const r = R * (1 + noise);
      const rx = p.x * cy - p.z * sy;
      const rz = p.x * sy + p.z * cy;
      const depth = (rz / R + 2) / 3;
      const sx2 = half + rx * r;
      const sy2 = half - p.y * r;
      const alpha = depth * 0.8;
      const dotR = 1.2 * depth;
      ctx.beginPath();
      ctx.arc(sx2, sy2, dotR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fill();
    }
    rafRef.current = requestAnimationFrame(tick);
  }
  rafRef.current = requestAnimationFrame(tick);
}
