import { useEffect, useId, useRef, useState } from 'react';

interface BorderBeamProps {
  color?: string;
  headColor?: string;
  /** Beam speed in pixels per second. Duration is derived from perimeter / speed. */
  speed?: number;
  size?: number;
  tailLength?: number;
  borderRadius?: string;
  active?: boolean;
  className?: string;
}

// Shared state for baton-passing between instances
const shared = { position: 0, timestamp: 0 };
const HANDOFF_THRESHOLD_MS = 400;

function buildKeyframes(
  name: string,
  w: number,
  h: number,
  r: number,
) {
  const arcLen = (Math.PI / 2) * r;
  const topLen = w - 2 * r;
  const rightLen = h - 2 * r;
  const bottomLen = w - 2 * r;
  const leftLen = h - 2 * r;

  const perimeter = topLen + rightLen + bottomLen + leftLen + 4 * arcLen;

  // Segments: top, TR corner, right, BR corner, bottom, BL corner, left, TL corner
  const segments = [
    topLen, arcLen, rightLen, arcLen, bottomLen, arcLen, leftLen, arcLen,
  ];

  const n = segments.length;
  const equalShare = 1 / n;
  // Blend 65% distance-proportional + 35% equal-time so short sides get more time
  const blend = 0.1;
  const timeFractions = segments.map(
    (seg) => (1 - blend) * (seg / perimeter) + blend * equalShare,
  );

  // Build keyframes with distance stops mapped to blended time stops
  const keyframes: string[] = [];
  let distPct = 0;
  let timePct = 0;

  keyframes.push(`0% { offset-distance: 0%; }`);

  for (let i = 0; i < n; i++) {
    distPct += (segments[i] / perimeter) * 100;
    timePct += timeFractions[i] * 100;

    if (i === n - 1) {
      keyframes.push(`100% { offset-distance: 100%; }`);
    } else {
      keyframes.push(
        `${timePct.toFixed(2)}% { offset-distance: ${distPct.toFixed(2)}%; }`,
      );
    }
  }

  return { css: `@keyframes ${name} {\n  ${keyframes.join('\n  ')}\n}`, perimeter };
}

export function BorderBeam({
  color = 'rgba(120, 160, 255, 0.8)',
  headColor,
  speed = 150,
  size = 20,
  tailLength = 120,
  borderRadius = '10px',
  active = true,
  className,
}: BorderBeamProps) {
  const id = useId().replace(/:/g, '_');
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);
  const [duration, setDuration] = useState(3);
  const [delay, setDelay] = useState(() => -(Math.random() * 3));
  const wasActiveRef = useRef(false);
  const [animKey, setAnimKey] = useState(0);
  const [keyframesCSS, setKeyframesCSS] = useState('');
  const animName = `border-beam-move-${id}`;

  const pathRect = `rect(0% 100% 100% 0% round ${borderRadius})`;
  const r = parseInt(borderRadius, 10) || 0;

  // Measure container, build keyframes, compute duration from perimeter
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const result = buildKeyframes(animName, width, height, Math.min(r, width / 2, height / 2));
      setKeyframesCSS(result.css);
      setDuration(result.perimeter / speed);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [animName, r, speed]);

  // Baton handoff
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      const now = performance.now();
      const gap = now - shared.timestamp;

      let newDelay: number;
      if (gap < HANDOFF_THRESHOLD_MS && shared.timestamp > 0) {
        newDelay = -(shared.position * duration);
      } else {
        newDelay = -(Math.random() * duration);
      }

      setDelay(newDelay);
      setAnimKey((k) => k + 1);
      startTimeRef.current = now;
    }

    if (!active && wasActiveRef.current) {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const offsetInDuration = ((-delay) + elapsed) % duration;
      shared.position = offsetInDuration / duration;
      shared.timestamp = performance.now();
    }

    wasActiveRef.current = active;
  }, [active, duration, delay]);

  // Generate trail segments — each follows the path but offset behind the head
  const segments = 12;
  const segmentSpacing = tailLength / segments;

  const segmentStyles = Array.from({ length: segments }, (_, i) => {
    const offset = i * segmentSpacing;
    const progress = i / (segments - 1); // 0 = head, 1 = tail end
    const opacity = i === 0 ? 1 : (1 - progress) * 0.6;
    const segSize = size * (i === 0 ? 2 : 1 - progress * 0.5);
    return { offset, opacity, segSize, progress };
  });

  return (
    <>
      <style>{`
        ${keyframesCSS}

        ${segmentStyles.map((s, i) => `
        .border-beam-seg-${id}-${i} {
          offset-path: ${pathRect};
          offset-rotate: auto;
          offset-anchor: ${s.offset}px 50%;
          animation: ${animName} ${duration}s ${delay}s linear infinite;
        }
        `).join('')}
      `}</style>
      <div
        ref={containerRef}
        className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
        style={{
          opacity: active ? 1 : 0,
          transition: 'opacity 0.4s',
          clipPath: `inset(-2px round ${borderRadius})`,
        }}
      >
        {segmentStyles.map((s, i) => (
          <div
            key={`${animKey}-${i}`}
            className={`border-beam-seg-${id}-${i}`}
            style={{
              position: 'absolute',
              width: s.segSize * 2,
              height: s.segSize * 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${i === 0 ? (headColor ?? color) : color} 0%, transparent 70%)`,
              transform: 'translate(-50%, -50%)',
              filter: `blur(${i === 0 ? size / 6 : size / 3}px)`,
              opacity: s.opacity,
            }}
          />
        ))}
      </div>
    </>
  );
}
