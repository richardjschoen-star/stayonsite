import { useEffect, useRef } from "react";
import { useThemeMode } from "@/components/application/theme/theme-toggle";

/** Natural Earth 110m land, rasterized to a 100×50 equirectangular bit mask. */
const MASK_W = 100;
const MASK_H = 50;
const MASK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH//PwAAABAAAAAAIMD4/wEEAAAAAAAAAIMB/A8AAAL+AQIAHsTbh38AMAD6//8D4f//x/kAwNf/////D///HwQDAPf//////2D4/3AAAHj+////FwAC/j8eABDx////DwYA4P/3B4D6/////yMAAPj/TwDg/////z8AAAD/fwEA3Hv///8CAADw/wMAcLzu//8DAAAA/x8AACP+/v8nAAAA4P8AAPAB//9/BAAAAPgHAID/////DwAAAMCHAAD8f+//fwAAAAB4AADA/+/j/wsAAAAAJgAA/v8+PBcAAAAAgAEA4P/fwfEIAAAAAEAAAP7/AwgOAAAAAADgAcD//4AhAAAAAAAAfwC4/w8ARQAAAAAA8A8A4H8AICcAAAAAAP8DAP4BAKQAAAAAAPj/AOAfAAAABwAAAAD/DwD8AQBAIAAAAADgfwDAHwAAwAIAAAAA/AcA/g0AAC4QAAAAgH8AwM8AAPgHAAAAAPwDAPwEAMD/AAAAAMAfAMAHAAD8HwAAAAD8AAA4AADA/wEAAADABwCAAAAABA8AAAAAPAAAAAAAAGCAAAAA4AAAAAAAAAAEAAAAAA4AAAAAAAAAMAAAAGAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

const LAND: [number, number][] = (() => {
  const bytes = Uint8Array.from(atob(MASK), (c) => c.charCodeAt(0));
  const out: [number, number][] = [];
  for (let y = 0; y < MASK_H; y++) {
    const lat = 90 - (y + 0.5) * (180 / MASK_H);
    // Thin the rows toward the poles so dots stay evenly spaced on the sphere.
    const step = Math.max(1, Math.round(1 / Math.cos((lat * Math.PI) / 180)));
    for (let x = 0; x < MASK_W; x += step) {
      const i = y * MASK_W + x;
      if (bytes[i >> 3] & (1 << (i & 7))) out.push([lat, -180 + (x + 0.5) * (360 / MASK_W)]);
    }
  }
  return out;
})();

export type GlobePin = { id: string; lat: number; lon: number };

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Dot globe (after Bencho's dot-globe and Reverse UI's rotating globe). It
 * eases the chosen pin to the front, then sways gently around it with the pin
 * pulsing. Animates only while on screen; reduced motion gets a still frame.
 */
export function Globe({ pins, active, className }: { pins: GlobePin[]; active: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef({ lon: 10, lat: 30 });
  const theme = useThemeMode();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const target = pins.find((p) => p.id === active) ?? pins[0];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const style = getComputedStyle(canvas);
    const land = style.color;
    const pin = style.getPropertyValue("--color-brand-yellow").trim();
    let frame = 0;
    let visible = true;
    const start = performance.now();

    const draw = (now = start) => {
      const size = canvas.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== size * dpr) canvas.width = canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const r = size / 2 - 4;
      const { lon: lon0, lat: lat0 } = view.current;
      const project = (lat: number, lon: number) => {
        const phi = rad(lat), lam = rad(lon - lon0), phi0 = rad(lat0);
        const x = Math.cos(phi) * Math.sin(lam);
        const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam);
        const z = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
        return { x: size / 2 + x * r, y: size / 2 - y * r, z };
      };
      ctx.fillStyle = land;
      for (const [lat, lon] of LAND) {
        const p = project(lat, lon);
        if (p.z <= 0) continue;
        ctx.globalAlpha = 0.25 + p.z * 0.75;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.1 + p.z * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const g of pins) {
        const p = project(g.lat, g.lon);
        if (p.z <= 0) continue;
        const on = g.id === target.id;
        ctx.fillStyle = pin;
        if (on) {
          // Radar pulse: a ring that grows and fades every 1.8s.
          const t = reduce ? 0.35 : ((now - start) % 1800) / 1800;
          ctx.globalAlpha = (1 - t) * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5 + t * 14, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = on ? 1 : 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, on ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const v = view.current;
      const sway = reduce ? 0 : Math.sin((now - start) / 2600) * 9;
      const dLon = ((target.lon + sway - v.lon + 540) % 360) - 180;
      const dLat = target.lat * 0.6 - v.lat;
      v.lon += reduce ? dLon : dLon * 0.08;
      v.lat += reduce ? dLat : dLat * 0.08;
      draw(now);
      if (!reduce && visible) frame = requestAnimationFrame(tick);
    };
    tick(start);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible && !reduce) frame = requestAnimationFrame(tick);
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => (cancelAnimationFrame(frame), io.disconnect(), ro.disconnect());
  }, [pins, active, theme]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
