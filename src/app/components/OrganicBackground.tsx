import { useEffect, useRef } from "react";

type Vec2 = { x: number; y: number };

class TouchTexture {
  size = 64;
  width = this.size;
  height = this.size;
  maxAge = 64;
  radius = 0.25 * this.size;
  speed = 1 / this.maxAge;
  trail: Array<{ x: number; y: number; age: number; force: number; vx: number; vy: number }> = [];
  last: { x: number; y: number } | null = null;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context not available");
    }

    this.ctx = ctx;
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  update() {
    this.clear();
    const speed = this.speed;

    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      const f = point.force * speed * (1 - point.age / this.maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;

      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      } else {
        this.drawPoint(point);
      }
    }
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point: Vec2) {
    let force = 0;
    let vx = 0;
    let vy = 0;

    if (this.last) {
      const dx = point.x - this.last.x;
      const dy = point.y - this.last.y;
      if (dx === 0 && dy === 0) {
        return;
      }

      const dd = dx * dx + dy * dy;
      const d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 20000, 2.0);
    }

    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point: { x: number; y: number; age: number; force: number; vx: number; vy: number }) {
    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height,
    };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = this.size * 5;
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius * 1;
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;

    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compilation error";
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): { program: WebGLProgram; vertexShader: WebGLShader; fragmentShader: WebGLShader } {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Unable to create program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown program link error";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(info);
  }

  return { program, vertexShader, fragmentShader };
}

export function OrganicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: false,
    });

    if (!gl) {
      return;
    }

    const vertexShader = `
      precision highp float;

      attribute vec2 aPosition;
      varying vec2 vUv;

      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      uniform vec3 uColor5;
      uniform vec3 uColor6;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform sampler2D uTouchTexture;
      uniform float uGrainIntensity;
      uniform float uZoom;
      uniform vec3 uDarkNavy;
      uniform float uGradientSize;
      uniform float uGradientCount;
      uniform float uColor1Weight;
      uniform float uColor2Weight;

      varying vec2 vUv;

      #define PI 3.14159265359

      float grain(vec2 uv, float time) {
        vec2 grainUv = uv * uResolution * 0.5;
        float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
        return grainValue * 2.0 - 1.0;
      }

      vec3 getGradientColor(vec2 uv, float time) {
        float gradientRadius = uGradientSize;

        vec2 center1 = vec2(
          0.5 + sin(time * uSpeed * 0.4) * 0.4,
          0.5 + cos(time * uSpeed * 0.5) * 0.4
        );
        vec2 center2 = vec2(
          0.5 + cos(time * uSpeed * 0.6) * 0.5,
          0.5 + sin(time * uSpeed * 0.45) * 0.5
        );
        vec2 center3 = vec2(
          0.5 + sin(time * uSpeed * 0.35) * 0.45,
          0.5 + cos(time * uSpeed * 0.55) * 0.45
        );
        vec2 center4 = vec2(
          0.5 + cos(time * uSpeed * 0.5) * 0.4,
          0.5 + sin(time * uSpeed * 0.4) * 0.4
        );
        vec2 center5 = vec2(
          0.5 + sin(time * uSpeed * 0.7) * 0.35,
          0.5 + cos(time * uSpeed * 0.65) * 0.35
        );
        vec2 center6 = vec2(
          0.5 + cos(time * uSpeed * 0.8) * 0.3,
          0.5 + sin(time * uSpeed * 0.75) * 0.3
        );

        vec2 center7 = vec2(
          0.5 + sin(time * uSpeed * 0.9) * 0.35,
          0.5 + cos(time * uSpeed * 0.85) * 0.35
        );
        vec2 center8 = vec2(
          0.5 + cos(time * uSpeed * 1.0) * 0.4,
          0.5 + sin(time * uSpeed * 0.95) * 0.4
        );
        vec2 center9 = vec2(
          0.5 + sin(time * uSpeed * 1.1) * 0.3,
          0.5 + cos(time * uSpeed * 1.05) * 0.3
        );
        vec2 center10 = vec2(
          0.5 + cos(time * uSpeed * 1.2) * 0.45,
          0.5 + sin(time * uSpeed * 1.15) * 0.45
        );
        vec2 center11 = vec2(
          0.5 + sin(time * uSpeed * 1.3) * 0.4,
          0.5 + cos(time * uSpeed * 1.25) * 0.4
        );
        vec2 center12 = vec2(
          0.5 + cos(time * uSpeed * 1.4) * 0.35,
          0.5 + sin(time * uSpeed * 1.35) * 0.35
        );

        vec2 zoomedUv = (uv - 0.5) / uZoom + 0.5;

        float dist1 = length(zoomedUv - center1);
        float dist2 = length(zoomedUv - center2);
        float dist3 = length(zoomedUv - center3);
        float dist4 = length(zoomedUv - center4);
        float dist5 = length(zoomedUv - center5);
        float dist6 = length(zoomedUv - center6);

        float dist7 = length(zoomedUv - center7);
        float dist8 = length(zoomedUv - center8);
        float dist9 = length(zoomedUv - center9);
        float dist10 = length(zoomedUv - center10);
        float dist11 = length(zoomedUv - center11);
        float dist12 = length(zoomedUv - center12);

        float wave1 = sin(time * uSpeed * 0.8 + dist1 * 3.0) * 0.08;
        float wave2 = cos(time * uSpeed * 0.7 + dist2 * 2.8) * 0.08;
        float wave3 = sin(time * uSpeed * 0.9 + dist3 * 3.2) * 0.08;
        float wave4 = cos(time * uSpeed * 0.75 + dist4 * 2.9) * 0.08;
        float wave5 = sin(time * uSpeed * 0.85 + dist5 * 3.1) * 0.08;
        float wave6 = cos(time * uSpeed * 0.65 + dist6 * 2.7) * 0.08;

        float wave7 = sin(time * uSpeed * 0.6 + dist7 * 2.5) * 0.08;
        float wave8 = cos(time * uSpeed * 0.55 + dist8 * 2.3) * 0.08;
        float wave9 = sin(time * uSpeed * 0.5 + dist9 * 2.1) * 0.08;
        float wave10 = cos(time * uSpeed * 0.45 + dist10 * 2.0) * 0.08;
        float wave11 = sin(time * uSpeed * 0.4 + dist11 * 1.9) * 0.08;
        float wave12 = cos(time * uSpeed * 0.35 + dist12 * 1.8) * 0.08;

        float influence1 = 1.0 - smoothstep(0.0, gradientRadius + wave1, dist1);
        float influence2 = 1.0 - smoothstep(0.0, gradientRadius + wave2, dist2);
        float influence3 = 1.0 - smoothstep(0.0, gradientRadius + wave3, dist3);
        float influence4 = 1.0 - smoothstep(0.0, gradientRadius + wave4, dist4);
        float influence5 = 1.0 - smoothstep(0.0, gradientRadius + wave5, dist5);
        float influence6 = 1.0 - smoothstep(0.0, gradientRadius + wave6, dist6);

        float influence7 = 1.0 - smoothstep(0.0, gradientRadius + wave7, dist7);
        float influence8 = 1.0 - smoothstep(0.0, gradientRadius + wave8, dist8);
        float influence9 = 1.0 - smoothstep(0.0, gradientRadius + wave9, dist9);
        float influence10 = 1.0 - smoothstep(0.0, gradientRadius + wave10, dist10);
        float influence11 = 1.0 - smoothstep(0.0, gradientRadius + wave11, dist11);
        float influence12 = 1.0 - smoothstep(0.0, gradientRadius + wave12, dist12);

        float radialGradient1 = length(zoomedUv - vec2(0.3, 0.7));
        float radialGradient2 = length(zoomedUv - vec2(0.7, 0.3));
        float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, radialGradient1);
        float radialInfluence2 = 1.0 - smoothstep(0.0, 0.8, radialGradient2);

        vec3 color = vec3(0.0);
        color += uColor1 * influence1 * (0.55 + 0.45 * sin(time * uSpeed)) * uColor1Weight;
        color += uColor2 * influence2 * (0.55 + 0.45 * cos(time * uSpeed * 1.2)) * uColor2Weight;
        color += uColor3 * influence3 * (0.55 + 0.45 * sin(time * uSpeed * 0.8)) * uColor1Weight;
        color += uColor4 * influence4 * (0.55 + 0.45 * cos(time * uSpeed * 1.3)) * uColor2Weight;
        color += uColor5 * influence5 * (0.55 + 0.45 * sin(time * uSpeed * 1.1)) * uColor1Weight;
        color += uColor6 * influence6 * (0.55 + 0.45 * cos(time * uSpeed * 0.9)) * uColor2Weight;

        if (uGradientCount > 6.0) {
          color += uColor1 * influence7 * (0.55 + 0.45 * sin(time * uSpeed * 1.4)) * uColor1Weight;
          color += uColor2 * influence8 * (0.55 + 0.45 * cos(time * uSpeed * 1.5)) * uColor2Weight;
          color += uColor3 * influence9 * (0.55 + 0.45 * sin(time * uSpeed * 1.6)) * uColor1Weight;
          color += uColor4 * influence10 * (0.55 + 0.45 * cos(time * uSpeed * 1.7)) * uColor2Weight;
        }
        if (uGradientCount > 10.0) {
          color += uColor5 * influence11 * (0.55 + 0.45 * sin(time * uSpeed * 1.8)) * uColor1Weight;
          color += uColor6 * influence12 * (0.55 + 0.45 * cos(time * uSpeed * 1.9)) * uColor2Weight;
        }

        color += mix(uColor1, uColor3, radialInfluence1) * 0.45 * uColor1Weight;
        color += mix(uColor2, uColor4, radialInfluence2) * 0.4 * uColor2Weight;

        color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;

        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(vec3(luminance), color, 1.35);

        color = pow(color, vec3(0.92));

        float brightness1 = length(color);
        float mixFactor1 = max(brightness1 * 1.2, 0.15);
        color = mix(uDarkNavy, color, mixFactor1);

        float maxBrightness = 1.0;
        float brightness = length(color);
        if (brightness > maxBrightness) {
          color = color * (maxBrightness / brightness);
        }

        return color;
      }

      void main() {
        vec2 uv = vUv;

        vec4 touchTex = texture2D(uTouchTexture, uv);
        float vx = -(touchTex.r * 2.0 - 1.0);
        float vy = -(touchTex.g * 2.0 - 1.0);
        float intensity = touchTex.b;
        uv.x += vx * 0.8 * intensity;
        uv.y += vy * 0.8 * intensity;

        vec2 center = vec2(0.5);
        float dist = length(uv - center);
        float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.04 * intensity;
        float wave = sin(dist * 15.0 - uTime * 2.0) * 0.03 * intensity;
        uv += vec2(ripple + wave);

        vec3 color = getGradientColor(uv, uTime);

        float grainValue = grain(uv, uTime);
        color += grainValue * uGrainIntensity;

        float timeShift = uTime * 0.5;
        color.r += sin(timeShift) * 0.02;
        color.g += cos(timeShift * 1.4) * 0.02;
        color.b += sin(timeShift * 1.2) * 0.02;

        float brightness2 = length(color);
        float mixFactor2 = max(brightness2 * 1.2, 0.15);
        color = mix(uDarkNavy, color, mixFactor2);

        color = clamp(color, vec3(0.0), vec3(1.0));

        float maxBrightness = 1.0;
        float brightness = length(color);
        if (brightness > maxBrightness) {
          color = color * (maxBrightness / brightness);
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    let program: WebGLProgram;
    let glVertexShader: WebGLShader;
    let glFragmentShader: WebGLShader;

    try {
      ({
        program,
        vertexShader: glVertexShader,
        fragmentShader: glFragmentShader,
      } = createProgram(gl, vertexShader, fragmentShader));
    } catch {
      return;
    }

    gl.useProgram(program);

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      gl.deleteProgram(program);
      gl.deleteShader(glVertexShader);
      gl.deleteShader(glFragmentShader);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uColor1 = gl.getUniformLocation(program, "uColor1");
    const uColor2 = gl.getUniformLocation(program, "uColor2");
    const uColor3 = gl.getUniformLocation(program, "uColor3");
    const uColor4 = gl.getUniformLocation(program, "uColor4");
    const uColor5 = gl.getUniformLocation(program, "uColor5");
    const uColor6 = gl.getUniformLocation(program, "uColor6");
    const uSpeed = gl.getUniformLocation(program, "uSpeed");
    const uIntensity = gl.getUniformLocation(program, "uIntensity");
    const uTouchTexture = gl.getUniformLocation(program, "uTouchTexture");
    const uGrainIntensity = gl.getUniformLocation(program, "uGrainIntensity");
    const uZoom = gl.getUniformLocation(program, "uZoom");
    const uDarkNavy = gl.getUniformLocation(program, "uDarkNavy");
    const uGradientSize = gl.getUniformLocation(program, "uGradientSize");
    const uGradientCount = gl.getUniformLocation(program, "uGradientCount");
    const uColor1Weight = gl.getUniformLocation(program, "uColor1Weight");
    const uColor2Weight = gl.getUniformLocation(program, "uColor2Weight");

    let touch: TouchTexture;
    try {
      touch = new TouchTexture();
    } catch {
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(glVertexShader);
      gl.deleteShader(glFragmentShader);
      return;
    }
    const touchTex = gl.createTexture();
    if (!touchTex) {
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(glVertexShader);
      gl.deleteShader(glFragmentShader);
      return;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, touchTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, touch.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);

    if (uTouchTexture) {
      gl.uniform1i(uTouchTexture, 0);
    }

    // Scheme 1 (from Inspiration): Orange + Navy.
    gl.uniform3f(uColor1, 0.945, 0.353, 0.133);
    gl.uniform3f(uColor2, 0.039, 0.055, 0.153);
    gl.uniform3f(uColor3, 0.945, 0.353, 0.133);
    gl.uniform3f(uColor4, 0.039, 0.055, 0.153);
    gl.uniform3f(uColor5, 0.945, 0.353, 0.133);
    gl.uniform3f(uColor6, 0.039, 0.055, 0.153);
    gl.uniform1f(uIntensity, 1.8);
    gl.uniform1f(uGrainIntensity, 0.08);
    gl.uniform1f(uZoom, 1.0);
    gl.uniform3f(uDarkNavy, 0.039, 0.055, 0.153);
    gl.uniform1f(uGradientSize, 0.45);
    gl.uniform1f(uGradientCount, 12.0);
    gl.uniform1f(uSpeed, 1.5);
    gl.uniform1f(uColor1Weight, 0.5);
    gl.uniform1f(uColor2Weight, 1.8);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    let rafId = 0;
    let disposed = false;
    let uTimeValue = 0;
    let lastTsMs = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uResolution) {
        gl.uniform2f(uResolution, window.innerWidth, window.innerHeight);
      }
    };

    const render = () => {
      const now = performance.now();
      const delta = Math.min((now - lastTsMs) / 1000, 0.1);
      lastTsMs = now;

      uTimeValue += delta;
      if (uTime) {
        gl.uniform1f(uTime, uTimeValue);
      }

      touch.update();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, touchTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, touch.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const tick = () => {
      if (disposed) {
        return;
      }
      render();
      rafId = window.requestAnimationFrame(tick);
    };

    const onResize = () => resize();
    const onMouseMove = (ev: MouseEvent) => {
      touch.addTouch({ x: ev.clientX / window.innerWidth, y: 1 - ev.clientY / window.innerHeight });
    };
    const onTouchMove = (ev: TouchEvent) => {
      const first = ev.touches[0];
      if (!first) {
        return;
      }
      touch.addTouch({
        x: first.clientX / window.innerWidth,
        y: 1 - first.clientY / window.innerHeight,
      });
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        render();
      }
    };

    const wakeUp = () => render();

    resize();
    render();
    tick();

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("click", wakeUp, { once: true });
    window.addEventListener("touchstart", wakeUp, { once: true, passive: true });
    window.addEventListener("mousemove", wakeUp, { once: true });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("click", wakeUp);
      window.removeEventListener("touchstart", wakeUp);
      window.removeEventListener("mousemove", wakeUp);

      gl.deleteTexture(touchTex);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(glVertexShader);
      gl.deleteShader(glFragmentShader);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <canvas ref={canvasRef} id="webGLApp" className="w-full h-full" />
    </div>
  );
}
