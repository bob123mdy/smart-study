"use client";

// 单色阶（浅 → 深绿）表示学习时长多少
const LEVELS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

function levelOf(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  minutes: number;
}

export function StudyHeatmap({ data }: { data: HeatmapDay[] }) {
  // 数据按周一为起点、连续排列，切成「周」列
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));

  const weekdayLabels = ["一", "", "三", "", "五", "", "日"];

  // 月份标签：仅当该周（取第 0 天）所在月份与前一列不同才显示
  const monthLabels = weeks.map((w, i) => {
    if (!w.length) return "";
    const m = Number(w[0].date.slice(5, 7));
    const prev = i > 0 && weeks[i - 1].length ? Number(weeks[i - 1][0].date.slice(5, 7)) : null;
    return m !== prev ? `${m}月` : "";
  });

  const fmtTitle = (d: HeatmapDay) => {
    const [y, m, day] = d.date.split("-");
    return `${y}年${Number(m)}月${Number(day)}日 · ${d.minutes} 分钟`;
  };

  return (
    <div>
      <div className="flex gap-2">
        {/* 星期标签 */}
        <div className="flex flex-col gap-[2px] pt-[16px]">
          {weekdayLabels.map((w, i) => (
            <div
              key={i}
              className="flex h-3 w-4 items-center text-[10px] leading-none text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="inline-block">
            {/* 月份标签行 */}
            <div className="mb-[2px] flex gap-[2px]">
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="h-[14px] w-3 overflow-visible whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                >
                  {m}
                </div>
              ))}
            </div>
            {/* 热力图网格 */}
            <div className="flex gap-[2px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((d) => (
                    <div
                      key={d.date}
                      title={fmtTitle(d)}
                      className="h-3 w-3 rounded-[2px]"
                      style={{ backgroundColor: LEVELS[levelOf(d.minutes)] }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>少</span>
        {LEVELS.map((c) => (
          <span key={c} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: c }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
