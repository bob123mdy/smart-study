"use client";

const SIZE = 150;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 58;
const STROKE = 16;
const GAP_DEG = 2;

const COLORS = {
  mastered: "#10b981", // 绿 —— 状态色「已完成/良好」
  learning: "#f59e0b", // 琥珀 —— 状态色「进行中」
  notStarted: "#e2e8f0", // 灰 —— 中性「未开始」
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, endDeg);
  const e = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function CompletionRing({
  mastered,
  learning,
  notStarted,
}: {
  mastered: number;
  learning: number;
  notStarted: number;
}) {
  const total = mastered + learning + notStarted;
  const rate = total ? Math.round((mastered / total) * 100) : 0;

  const segments = [
    { key: "mastered", value: mastered, color: COLORS.mastered, label: "已掌握" },
    { key: "learning", value: learning, color: COLORS.learning, label: "学习中" },
    { key: "notStarted", value: notStarted, color: COLORS.notStarted, label: "未开始" },
  ].filter((s) => s.value > 0);

  const hasData = total > 0 && segments.length > 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE}>
          {!hasData ? (
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={COLORS.notStarted}
              strokeWidth={STROKE}
            />
          ) : (
            (() => {
              let acc = 0;
              return segments.map((s) => {
                const frac = s.value / total;
                const start = acc * 360;
                acc += frac;
                const end = acc * 360;
                if (frac >= 0.999) {
                  return (
                    <circle
                      key={s.key}
                      cx={CX}
                      cy={CY}
                      r={R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={STROKE}
                    />
                  );
                }
                return (
                  <path
                    key={s.key}
                    d={arc(CX, CY, R, start + GAP_DEG, end - GAP_DEG)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeLinecap="butt"
                  />
                );
              });
            })()
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold">{rate}%</div>
          <div className="text-xs text-muted-foreground">完成率</div>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {[
          { color: COLORS.mastered, label: "已掌握", value: mastered },
          { color: COLORS.learning, label: "学习中", value: learning },
          { color: COLORS.notStarted, label: "未开始", value: notStarted },
        ].map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
            <span className="text-muted-foreground">{it.label}</span>
            <span className="ml-auto font-medium tabular-nums">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
