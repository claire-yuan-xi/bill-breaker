import { photoFragment, photoVertex } from "./photo-shaders";
import {
  createProgram,
  fullscreenTriangle,
  imageTexture,
  loadImage,
  setUniforms,
  type Uniforms,
} from "./gl";

export type PhotoHandle = {
  /** 0 at the top of the page, 1 once the hero has scrolled away. */
  setProgress(p: number): void;
  dispose(): void;
};

type Vec2 = [number, number];

export type PhotoOptions = {
  src: string;
  /** R = depth (white = near), G = sky mask. Optional; guessed from colour without it. */
  depthSrc?: string;
  /** The dome, in image uv (0,0 bottom-left). The scroll dolly pushes toward it. */
  focus?: Vec2;
  /** object-position of the crop as uv, per viewport width, to match the <img>. */
  anchorFor?: (width: number) => Vec2;
  /** Where the sun sits on screen (uv) at the top of the page and once scrolled away. */
  sunFrom?: Vec2;
  sunTo?: Vec2;
  reducedMotion: boolean;
  onReady?: () => void;
  onError?: () => void;
};

const damp = (from: number, to: number, lambda: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-lambda * dt));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function mountPhoto(canvas: HTMLCanvasElement, opts: PhotoOptions): PhotoHandle {
  const gl = (canvas.getContext("webgl2", { antialias: false, alpha: false }) ??
    canvas.getContext("webgl", { antialias: false, alpha: false })) as WebGLRenderingContext | null;
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, photoVertex, photoFragment);
  gl.useProgram(program);
  const triangle = fullscreenTriangle(gl, program);
  gl.uniform1i(gl.getUniformLocation(program, "uImage"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "uDepth"), 1);

  const motion = opts.reducedMotion ? 0 : 1;
  const focus = opts.focus ?? [0.5, 0.6];
  const sunFrom = opts.sunFrom ?? [0.86, 0.9];
  const sunTo = opts.sunTo ?? [0.62, 0.7];
  const anchorFor = opts.anchorFor ?? (() => [0.5, 0.5] as Vec2);

  const textures: WebGLTexture[] = [];
  let imageAspect = 16 / 9;
  let cover: Vec2 = [1, 1];
  let anchor: Vec2 = [0.5, 0.5];
  let hasDepth = 0;
  let loaded = false;
  let disposed = false;

  loadImage(opts.src)
    .then((img) => {
      if (disposed) return;
      gl.activeTexture(gl.TEXTURE0);
      textures.push(imageTexture(gl, img)!);
      imageAspect = img.naturalWidth / img.naturalHeight;
      loaded = true;
      resize();
    })
    .catch(() => opts.onError?.());
  if (opts.depthSrc)
    loadImage(opts.depthSrc)
      .then((img) => {
        if (disposed) return;
        gl.activeTexture(gl.TEXTURE1);
        textures.push(imageTexture(gl, img)!);
        hasDepth = 1;
      })
      .catch(() => {
        /* the colour-based guess takes over */
      });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    // The light shafts loop is the costly part; cap the pixel ratio for it.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const view = w / h;
    // Same crop as object-fit: cover.
    cover = view > imageAspect ? [1, imageAspect / view] : [view / imageAspect, 1];
    anchor = anchorFor(window.innerWidth);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  // On phones a gentle tilt of the device stands in for the mouse (where the browser allows it).
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    pointer.x = Math.max(-1, Math.min(1, e.gamma / 25));
    pointer.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  };
  if (motion) window.addEventListener("deviceorientation", onTilt, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(canvas);

  // Scroll sets a target; each frame eases toward it so the camera never snaps.
  let target = 0;
  let progress = 0;
  let start = -1;
  let last = 0;
  let raf = 0;
  let readyFired = false;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible || !loaded || document.hidden) {
      last = now;
      return;
    }
    if (start < 0) start = last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - start) / 1000;
    progress = motion ? damp(progress, target, 5, dt) : target;
    eased.x = damp(eased.x, pointer.x * motion, 2.2, dt);
    eased.y = damp(eased.y, pointer.y * motion, 2.2, dt);

    // A slow establishing push-in, a faint breathing drift, then scroll dollies
    // toward the dome while the image sinks a little slower than the page.
    const intro = motion ? 1 - Math.pow(1 - Math.min(1, t / 7), 3) : 0;
    const breathe = motion ? Math.sin(t * 0.17) * 0.005 : 0;
    const zoom = 1.02 + intro * 0.03 + breathe + progress * 0.17 * motion;

    const u: Uniforms = {
      uHasDepth: hasDepth,
      uCover: cover,
      uAnchor: anchor,
      uFocus: [focus[0], focus[1] + progress * 0.04 * motion],
      uSun: [mix(sunFrom[0], sunTo[0], progress), mix(sunFrom[1], sunTo[1], progress)],
      uPointer: [eased.x, eased.y],
      uZoom: zoom,
      uLift: progress * 0.045,
      uDusk: progress,
      uTime: t,
      uMotion: motion,
      uAspect: canvas.width / canvas.height,
    };
    setUniforms(gl, program, u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!readyFired) {
      readyFired = true;
      opts.onReady?.();
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    setProgress(v) {
      target = clamp01(v);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      ro.disconnect();
      io.disconnect();
      textures.forEach((tx) => gl.deleteTexture(tx));
      gl.deleteBuffer(triangle);
      gl.deleteProgram(program);
    },
  };
}
