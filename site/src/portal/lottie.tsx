import { Lottie } from "lottie-react";
import { useEffect, useState } from "react";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Self-contained Lottie JSON: Apple Pay-style spring circle + animated checkmark stroke.
 */
const SUCCESS_CHECK_DATA = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 48,
  w: 120,
  h: 120,
  nm: "SuccessCheck",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      nm: "Check",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ind: 0,
              ty: "sh",
              ks: {
                a: 0,
                k: {
                  i: [[0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0]],
                  v: [[-20, 2], [-5, 17], [22, -14]],
                  c: false,
                },
              },
            },
            {
              ty: "st",
              c: { a: 0, k: [1, 1, 1, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
              lc: 2,
              lj: 2,
            },
            {
              ty: "tm",
              s: { a: 0, k: 0 },
              e: {
                a: 1,
                k: [
                  { t: 14, s: [0], e: [100], i: { x: [0.22], y: [1] }, o: { x: [0.36], y: [0] } },
                  { t: 34, s: [100] },
                ],
              },
              o: { a: 0, k: 0 },
            },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: "CheckPath",
        },
      ],
      ip: 0,
      op: 48,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [30, 30, 100], e: [106, 106, 100], i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } },
            { t: 16, s: [106, 106, 100], e: [100, 100, 100], i: { x: [0.4], y: [1] }, o: { x: [0.4], y: [0] } },
            { t: 24, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", s: { a: 0, k: [92, 92] }, p: { a: 0, k: [0, 0] } },
            { ty: "fl", c: { a: 0, k: [0.145, 0.388, 0.922, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: "CircleFill",
        },
      ],
      ip: 0,
      op: 48,
      st: 0,
    },
  ],
};

/**
 * Self-contained Lottie JSON: Subtle celebratory particle burst (blue + brand yellow).
 */
const CELEBRATION_DATA = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 60,
  w: 160,
  h: 160,
  nm: "Celebration",
  ddd: 0,
  assets: [],
  layers: [
    ...[0, 45, 90, 135, 180, 225, 270, 315].map((deg, idx) => {
      const rad = (deg * Math.PI) / 180;
      const dx = Math.round(Math.cos(rad) * 54);
      const dy = Math.round(Math.sin(rad) * 54);
      const isYellow = idx % 2 === 0;
      return {
        ddd: 0,
        ind: idx + 1,
        nm: `Dot${idx}`,
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [100] },
              { t: 10, s: [100], e: [100] },
              { t: 38, s: [100], e: [0] },
              { t: 54, s: [0] },
            ],
          },
          r: { a: 0, k: deg },
          p: {
            a: 1,
            k: [
              { t: 2, s: [80, 80, 0], e: [80 + dx, 80 + dy, 0], i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } },
              { t: 48, s: [80 + dx, 80 + dy, 0] },
            ],
          },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 2, s: [40, 40, 100], e: [110, 110, 100] },
              { t: 22, s: [110, 110, 100], e: [60, 60, 100] },
              { t: 52, s: [60, 60, 100] },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            it: [
              { ty: "rc", s: { a: 0, k: [10, 5] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 3 } },
              { ty: "fl", c: { a: 0, k: isYellow ? [1, 0.878, 0.035, 1] : [0.231, 0.51, 0.965, 1] }, o: { a: 0, k: 100 } },
              { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
            ],
          },
        ],
        ip: 0,
        op: 60,
        st: 0,
      };
    }),
  ],
};

/**
 * Self-contained Lottie JSON: Gently floating contract document with animated signature line.
 */
const CONTRACT_SEAL_DATA = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 120,
  w: 120,
  h: 120,
  nm: "ContractSeal",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      nm: "SigLine",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 74, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ind: 0,
              ty: "sh",
              ks: {
                a: 0,
                k: {
                  i: [[0, 0], [0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0], [0, 0]],
                  v: [[-18, 2], [-8, -6], [4, 4], [18, -4]],
                  c: false,
                },
              },
            },
            { ty: "st", c: { a: 0, k: [0.145, 0.388, 0.922, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 4 }, lc: 2, lj: 2 },
            {
              ty: "tm",
              s: { a: 0, k: 0 },
              e: {
                a: 1,
                k: [
                  { t: 10, s: [0], e: [100], i: { x: [0.22], y: [1] }, o: { x: [0.36], y: [0] } },
                  { t: 55, s: [100] },
                ],
              },
              o: { a: 0, k: 0 },
            },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      nm: "DocCard",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: {
          a: 1,
          k: [
            { t: 0, s: [60, 62, 0], e: [60, 58, 0], i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } },
            { t: 60, s: [60, 58, 0], e: [60, 62, 0], i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } },
            { t: 120, s: [60, 62, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "rc", s: { a: 0, k: [64, 78] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 12 } },
            { ty: "st", c: { a: 0, k: [0.145, 0.388, 0.922, 0.35] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 } },
            { ty: "fl", c: { a: 0, k: [0.145, 0.388, 0.922, 0.08] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
    },
  ],
};

function LottieBox({ data, loop, className }: { data: object; loop: boolean; className?: string }) {
  const reduced = useReducedMotion();
  return <Lottie src={data} loop={loop && !reduced} autoplay={!reduced} className={className} />;
}

export function SuccessCheckLottie({ className = "size-16" }: { className?: string }) {
  return <LottieBox data={SUCCESS_CHECK_DATA} loop={false} className={className} />;
}

export function CelebrationLottie({ className = "size-24" }: { className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <LottieBox data={CELEBRATION_DATA} loop={false} className={className} />;
}

export function ContractSealLottie({ className = "size-12" }: { className?: string }) {
  return <LottieBox data={CONTRACT_SEAL_DATA} loop className={className} />;
}
