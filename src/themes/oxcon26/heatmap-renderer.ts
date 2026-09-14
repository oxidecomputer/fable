// Adapted from the OXCON display's background (itself adapted from Paper
// Shaders' heatmap, https://github.com/paper-design/shaders): keeps the rising
// blob field and animated edge glow, drops the image/logo processing, and maps
// heat through a fixed 3-stop neutral gradient. The fable variant renders into
// a fixed-size stage canvas and takes its params per instance instead of a
// shared dialkit-mutated object.

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uSpeed;
uniform float uAngle;
uniform float uNoise;
uniform float uLinearity;
uniform float uZoom;
uniform float uSideBalls;
uniform float uStripeWidth;
uniform float uInnerGlow;
uniform float uOuterGlow;
uniform float uVisibility;
uniform float uDim;
uniform vec3 uDimColor;
uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;
uniform vec3 uBgColor;

#define PI 3.14159265358979323846

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float circle(vec2 uv, vec2 c, vec2 r) {
  return 1. - smoothstep(r[0], r[1], length(uv - c));
}

float lst(float e0, float e1, float x) {
  return clamp((x - e0) / (e1 - e0), 0., 1.);
}

float sst(float e0, float e1, float x) {
  return smoothstep(e0, e1, x);
}

float softFrame(vec2 uv, float th) {
  float f = 1.;
  f *= smoothstep(0., th, uv.y) * (1. - smoothstep(1. - th, 1., uv.y));
  f *= smoothstep(0., th, uv.x) * (1. - smoothstep(1. - th, 1., uv.x));
  return f;
}

// Rising blob field: a soft circle travels bottom-to-top, flattening as it
// moves, with drifting side balls for variety.
float blobField(vec2 uv, float t) {
  vec2 scaledUV = uv;
  float posY = mix(-1., 2., t);

  scaledUV.y -= .5;
  float mainCircleScale = sst(0., .8, posY) * lst(1.4, .9, posY);
  scaledUV *= vec2(1., 1. + 1.5 * mainCircleScale);
  scaledUV.y += .5;

  float innerR = .15;
  float outerR = 1. - .3 * (sst(.1, .2, t) * (1. - sst(.2, .5, t)));
  float s = circle(scaledUV, vec2(.5, posY - .2), vec2(innerR, outerR));
  s = pow(s, 1.4) * 1.2;

  // flat gradient that takes over above the blob
  {
    float pos = posY - uv.y;
    float topFlattener = lst(-.4, 0., pos) * (1. - sst(.0, 1.2, pos));
    topFlattener = pow(topFlattener, 3.);
    float mixer = 1. - sst(.0, .3, pos);
    s = mix(topFlattener, s, mixer);
  }

  // drifting side balls, scaled by uSideBalls
  {
    float pos = sst(.0, .6, t) * (1. - sst(.6, 1., t));
    s = mix(s, .5, uSideBalls * circle(uv, vec2(.0, 1.2 - .5 * pos), vec2(.1, .3)));
    s = mix(s, .0, uSideBalls * circle(uv, vec2(1., .5 + .5 * pos), vec2(.1, .3)));
    s = mix(s, 1., uSideBalls * circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * sst(.7, .5, t)), vec2(.07, .22)));
    s = mix(s, 1., uSideBalls * circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * (1. - sst(.5, .7, t))), vec2(.07, .22)));
    s /= max(1e-4, sst(1., .85, uv.y));
  }

  return clamp(s, 0., 1.);
}

void main() {
  vec2 suv = gl_FragCoord.xy / uResolution;
  suv.y = 1. - suv.y;

  float t = .1 * uTime * uSpeed - .3;
  float t1 = mod(t, 1.);
  float t2 = mod(t + 1. / 3., 1.);
  float t3 = mod(t + 2. / 3., 1.);

  vec2 auv = suv - .5;
  float angle = -uAngle * PI / 180.;
  float cosA = cos(angle);
  float sinA = sin(angle);
  auv = vec2(auv.x * cosA - auv.y * sinA, auv.x * sinA + auv.y * cosA) + .5;

  // Zoom the field around center so the shapes overshoot the screen edges
  auv = (auv - .5) / max(uZoom, .01) + .5;

  // Squeeze the sampling x toward center: blobs stretch into horizontal bands
  auv.x = mix(auv.x, .5, uLinearity);

  // inner glow field, carved out by three phase-shifted blob passes
  float inner = .8;
  inner = mix(inner, 0., blobField(auv, t1));
  inner = mix(inner, 0., blobField(auv, t2));
  inner = mix(inner, 0., blobField(auv, t3));
  inner *= 2. * uInnerGlow;
  inner = min(inner, 1.);
  inner = pow(inner, 1.2);

  // edge glow with a band sweeping through it
  float outer = 0.;
  {
    float tb = mod(3. * t1 - .1, 1.);
    float edgeGlow = 1. - softFrame(suv, .25);
    float y = mod(auv.y - tb, 1.);
    float band = .5 + sst(.3, .65, y) * (1. - sst(.65, 1., y));
    outer = .9 * pow(edgeGlow, .8) * band * 5. * pow(uOuterGlow, 2.);
  }

  float heat = clamp(inner + outer, 0., 1.);
  heat += (.005 + .35 * uNoise) * (hash(suv) - .5);
  heat = clamp(heat, 0., 1.);

  // 3-stop gradient: bg -> low -> mid -> high. uStripeWidth sets the width of
  // each transition: 1 = smooth blend, ~0 = hard posterized stripes.
  float mixer = heat * 3.;
  float hw = .5 * max(uStripeWidth, .001);
  float outerShape = sst(.5 - hw, .5 + hw, clamp(mixer, 0., 1.));
  vec3 gradient = uColorLow;
  gradient = mix(gradient, uColorMid, sst(.5 - hw, .5 + hw, clamp(mixer - 1., 0., 1.)));
  gradient = mix(gradient, uColorHigh, sst(.5 - hw, .5 + hw, clamp(mixer - 2., 0., 1.)));

  vec3 color = mix(uBgColor, gradient, outerShape);
  color = mix(uBgColor, color, uVisibility);
  color = mix(color, uDimColor, uDim);
  color += .02 * (hash(suv + 1.) - .5);
  fragColor = vec4(color, 1.);
}`

export const defaultShaderParams = {
  speed: 0.125,
  angle: 150,
  noise: 0.35,
  linearity: 0.75,
  zoom: 1.95,
  sideBalls: 1.0,
  stripeWidth: 1.0,
  innerGlow: 0.8,
  outerGlow: 0.15,
  minVisibility: 1,
  maxVisibility: 1,
  cycleDuration: 20,
  dimStrength: 0.4,
  dimCycleDuration: 40,
  dimPause: 2,
  dimColor: '#181A1D',
  colorLow: '#252525',
  colorMid: '#575454',
  colorHigh: '#878787',
  bgColor: '#080f11',
}

export type ShaderParams = typeof defaultShaderParams

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('shader compile failed:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function startRenderer(
  canvas: HTMLCanvasElement,
  params: ShaderParams,
  { animate = true }: { animate?: boolean } = {},
): () => void {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
  if (!gl || gl.isContextLost()) return () => {}

  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vert || !frag) return () => {}

  const program = gl.createProgram()!
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('program link failed:', gl.getProgramInfoLog(program))
    return () => {}
  }
  gl.useProgram(program)

  const u = (name: string) => gl.getUniformLocation(program, name)
  const uResolution = u('uResolution')
  const uTime = u('uTime')
  const uSpeed = u('uSpeed')
  const uAngle = u('uAngle')
  const uNoise = u('uNoise')
  const uLinearity = u('uLinearity')
  const uZoom = u('uZoom')
  const uSideBalls = u('uSideBalls')
  const uStripeWidth = u('uStripeWidth')
  const uInnerGlow = u('uInnerGlow')
  const uOuterGlow = u('uOuterGlow')
  const uVisibility = u('uVisibility')
  const uDim = u('uDim')
  const uDimColor = u('uDimColor')
  const uColorLow = u('uColorLow')
  const uColorMid = u('uColorMid')
  const uColorHigh = u('uColorHigh')
  const uBgColor = u('uBgColor')

  // Size the backing store to the canvas's *on-screen* pixels: the stage is
  // 1920×1080 CSS px but displayed through a CSS transform (a rail thumbnail
  // is ~220px wide), and getBoundingClientRect is transform-aware where
  // clientWidth is not. Re-checked every frame — the transform scale changes
  // with window/inspector resizes, which ResizeObserver can't see.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const syncSize = () => {
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round((rect.width || canvas.clientWidth) * dpr))
    const h = Math.max(1, Math.round((rect.height || canvas.clientHeight) * dpr))
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
  }
  syncSize()

  const start = performance.now()
  let raf = 0

  const drawFrame = (visibility: number, dim: number) => {
    syncSize()
    const elapsed = (performance.now() - start) / 1000
    const low = hexToRgb(params.colorLow)
    const mid = hexToRgb(params.colorMid)
    const high = hexToRgb(params.colorHigh)
    const dimColor = hexToRgb(params.dimColor)
    const bg = hexToRgb(params.bgColor)
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform1f(uTime, elapsed)
    gl.uniform1f(uSpeed, params.speed)
    gl.uniform1f(uAngle, params.angle)
    gl.uniform1f(uNoise, params.noise)
    gl.uniform1f(uLinearity, params.linearity)
    gl.uniform1f(uZoom, params.zoom)
    gl.uniform1f(uSideBalls, params.sideBalls)
    gl.uniform1f(uStripeWidth, params.stripeWidth)
    gl.uniform1f(uInnerGlow, params.innerGlow)
    gl.uniform1f(uOuterGlow, params.outerGlow)
    gl.uniform1f(uVisibility, visibility)
    gl.uniform1f(uDim, dim)
    gl.uniform3f(uDimColor, dimColor[0], dimColor[1], dimColor[2])
    gl.uniform3f(uColorLow, low[0], low[1], low[2])
    gl.uniform3f(uColorMid, mid[0], mid[1], mid[2])
    gl.uniform3f(uColorHigh, high[0], high[1], high[2])
    gl.uniform3f(uBgColor, bg[0], bg[1], bg[2])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const loop = () => {
    const elapsed = (performance.now() - start) / 1000
    const phase = 0.5 + 0.5 * Math.sin((2 * Math.PI * elapsed) / params.cycleDuration)
    const visibility =
      params.minVisibility + (params.maxVisibility - params.minVisibility) * phase
    // Secondary cycle: a slower, out-of-phase dip toward dimColor. Smoothstep
    // eases the dark dips so they linger rather than snap. Each cycle starts
    // and ends at zero dim, then holds there for dimPause seconds.
    const dimT = elapsed % (params.dimCycleDuration + params.dimPause)
    const dimPhase =
      dimT < params.dimCycleDuration
        ? 0.5 - 0.5 * Math.cos((2 * Math.PI * dimT) / params.dimCycleDuration)
        : 0
    const dim = params.dimStrength * dimPhase * dimPhase * (3 - 2 * dimPhase)
    drawFrame(visibility, dim)
    raf = requestAnimationFrame(loop)
  }

  // Thumbnails (animate: false) get the same treatment as reduced motion: one
  // static frame, no rAF loop.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const applyMotionPreference = () => {
    cancelAnimationFrame(raf)
    if (!animate || reducedMotion.matches) {
      drawFrame((params.minVisibility + params.maxVisibility) / 2, params.dimStrength / 2)
    } else {
      raf = requestAnimationFrame(loop)
    }
  }
  applyMotionPreference()
  reducedMotion.addEventListener('change', applyMotionPreference)

  return () => {
    cancelAnimationFrame(raf)
    reducedMotion.removeEventListener('change', applyMotionPreference)
    // Don't lose the context here: StrictMode remounts reuse the same canvas,
    // and a lost context can't be reacquired via getContext.
    gl.deleteProgram(program)
    gl.deleteShader(vert)
    gl.deleteShader(frag)
  }
}
