import type { StripMark } from '@/lib/marks';

export interface StripProps {
  marks: StripMark[];
  // Real time to 0..1 along the strip.
  x: (t: number) => number;
  height?: number;
  // Marks right of this point (0..1) draw faint, for replay. Null draws everything.
  playhead?: number | null;
  label?: string;
  className?: string;
}

const W = 1000;

// The face of Trace. Each prompt is one ink stroke above the line, as tall as
// the prompt was long. A correction is the same stroke in red pencil with a
// caret under the line. The agent's tool calls are fine ticks below, so a
// busy stretch reads as texture. A day looks like a seismograph.
export function Strip({ marks, x, height = 56, playhead = null, label, className = '' }: StripProps) {
  const base = Math.round(height * 0.68);
  const top = 4;
  const room = base - top;
  const pad = 6;
  const px = (t: number) => pad + x(t) * (W - pad * 2);
  const played = (m: StripMark) => playhead === null || x(m.t) <= playhead + 1e-9;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
      role="img"
      aria-label={label ?? `${marks.filter((m) => m.kind !== 'tool').length} prompts`}
    >
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {marks
        .filter((m) => m.kind === 'tool')
        .map((m) => (
          <line
            key={m.id}
            x1={px(m.t)}
            x2={px(m.t)}
            y1={base + 3}
            y2={base + 8}
            stroke="var(--faint)"
            strokeOpacity={played(m) ? 0.75 : 0.25}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      {marks
        .filter((m) => m.kind !== 'tool')
        .map((m) => {
          const h = 5 + m.size * (room - 5);
          const red = m.kind === 'correction';
          const on = played(m);
          const color = red ? 'var(--mark)' : 'var(--ink)';
          return (
            <g key={m.id} opacity={on ? 1 : 0.22}>
              <line
                x1={px(m.t)}
                x2={px(m.t)}
                y1={base}
                y2={base - h}
                stroke={color}
                strokeWidth={red ? 2.2 : 1.6}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {red && (
                <path
                  d={`M${px(m.t) - 5},${base + 13} L${px(m.t)},${base + 5} L${px(m.t) + 5},${base + 13}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
      {playhead !== null && marks.length > 0 && (
        <line
          x1={pad + playhead * (W - pad * 2)}
          x2={pad + playhead * (W - pad * 2)}
          y1={0}
          y2={height}
          stroke="var(--ink)"
          strokeOpacity={0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
