"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, Sparkles, TrendingUp, Activity } from "lucide-react";

export interface AnalyticsMetric {
  id: string;
  label: string;
  kanjiLabel?: string;
  sublabel?: string;
  unit: string;
  good: "up" | "down";
  base: number;
  seed: number;
  amp: number;
  delta: number;
  decimals: number;
  theme?: "matcha" | "aiiro" | "shuiro" | "yamabuki";
  description?: string;
  recommendation?: string;
}

export interface Analytics7Props {
  metrics?: AnalyticsMetric[];
  title?: string;
  subtitle?: string;
  className?: string;
  defaultMetricId?: string;
}

const DEFAULT_RANGES = ["1h", "24h", "7d"] as const;
type RangeOption = (typeof DEFAULT_RANGES)[number];

const RANGE_POINT_COUNTS: Record<RangeOption, number> = {
  "1h": 12,
  "24h": 24,
  "7d": 28,
};

const THEME_STYLES = {
  matcha: {
    stroke: "#15803d",
    svgFill: "rgba(21, 128, 61, 0.12)",
    text: "text-[#15803d]",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    borderActive: "border-[#15803d] ring-2 ring-[#15803d]/20 bg-white",
    glow: "shadow-[0_4px_20px_-2px_rgba(21,128,61,0.2)]",
  },
  aiiro: {
    stroke: "#1d4ed8",
    svgFill: "rgba(29, 78, 216, 0.12)",
    text: "text-[#1d4ed8]",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    borderActive: "border-[#1d4ed8] ring-2 ring-[#1d4ed8]/20 bg-white",
    glow: "shadow-[0_4px_20px_-2px_rgba(29,78,216,0.2)]",
  },
  shuiro: {
    stroke: "#d9381e",
    svgFill: "rgba(217, 56, 30, 0.12)",
    text: "text-[#c53018]",
    badge: "bg-rose-50 text-rose-800 border-rose-200",
    borderActive: "border-[#d9381e] ring-2 ring-[#d9381e]/20 bg-white",
    glow: "shadow-[0_4px_20px_-2px_rgba(217,56,30,0.2)]",
  },
  yamabuki: {
    stroke: "#b45309",
    svgFill: "rgba(180, 83, 9, 0.12)",
    text: "text-[#b45309]",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    borderActive: "border-[#b45309] ring-2 ring-[#b45309]/20 bg-white",
    glow: "shadow-[0_4px_20px_-2px_rgba(180,83,9,0.2)]",
  },
};

function formatMetricValue(metric: AnalyticsMetric, val: number): string {
  if (metric.unit === "req/s") {
    const rounded = Math.round(val);
    if (Math.abs(rounded) >= 1e6) {
      return `${(rounded / 1e6).toFixed(Math.abs(rounded) >= 1e7 ? 0 : 1)}M`;
    }
    if (Math.abs(rounded) >= 1e3) {
      return `${(rounded / 1e3).toFixed(Math.abs(rounded) >= 1e4 ? 0 : 1)}k`;
    }
    return `${rounded}`;
  }
  return metric.decimals > 0 ? val.toFixed(metric.decimals) : `${Math.round(val)}`;
}

// Catmull-Rom / Monotone Spline Curve to SVG path generator
function generateSvgCurvePath(points: { x: number; y: number }[], tension = 0.2): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta > 0;
  const isZero = delta === 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md ${
        isZero
          ? "bg-slate-800 text-slate-400"
          : isPositive
          ? "bg-[#2ea072]/15 text-[#34d399] border border-[#2ea072]/30"
          : "bg-[#e0533c]/15 text-[#ff7c62] border border-[#e0533c]/30"
      }`}
    >
      {isZero ? (
        <Minus className="w-3 h-3" />
      ) : isPositive ? (
        <ArrowUpRight className="w-3.5 h-3.5" />
      ) : (
        <ArrowDownRight className="w-3.5 h-3.5" />
      )}
      <span>{Math.abs(delta).toFixed(1)}%</span>
    </span>
  );
}

// Sparkline SVG component with hover scrub interaction
interface SparklineGraphProps {
  data: number[];
  width: number;
  height: number;
  active: number | null;
  baseline?: boolean;
  strokeColor?: string;
  fillColor?: string;
}

function SparklineGraph({
  data,
  width,
  height,
  active,
  baseline = false,
  strokeColor = "#2ea072",
  fillColor = "rgba(46, 160, 114, 0.2)",
}: SparklineGraphProps) {
  if (data.length === 0 || width <= 0 || height <= 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const padding = 0.15 * (max - min || 1);
  const paddedMin = min - padding;
  const paddedMax = max + padding;
  const range = paddedMax - paddedMin || 1;

  const getX = (idx: number) => {
    return (idx / (data.length - 1)) * Math.max(width - 4, 1) + 2;
  };

  const getY = (val: number) => {
    const rawY = height - 4 - ((val - paddedMin) / range) * (height - 8);
    return Math.max(2, Math.min(height - 2, rawY));
  };

  const points = data.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
  const curvePath = generateSvgCurvePath(points);

  // Area closed path
  const areaPath = `${curvePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(
    2
  )} ${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible block select-none">
      {/* Area fill */}
      <path d={areaPath} fill={fillColor} />

      {/* Baseline if in detail panel */}
      {baseline && (
        <line
          x1={0}
          x2={width}
          y1={height - 0.5}
          y2={height - 0.5}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      )}

      {/* Main Curve */}
      <path
        d={curvePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 2px 6px ${strokeColor}55)` }}
      />

      {/* Active Scrub Line & Indicator */}
      {active !== null && active >= 0 && active < data.length && (
        <g>
          <line
            x1={getX(active)}
            x2={getX(active)}
            y1={2}
            y2={height}
            stroke="#f4f6fb"
            strokeWidth={1.5}
            strokeDasharray="2 2"
            shapeRendering="crispEdges"
          />
          <circle
            cx={getX(active)}
            cy={getY(data[active])}
            r={5}
            fill="#f4f6fb"
            stroke={strokeColor}
            strokeWidth={2.5}
          />
        </g>
      )}
    </svg>
  );
}

// Element resize observer hook
function useElementDimensions<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect) {
        setDimensions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, dimensions] as const;
}

// Sparkline Card Component
interface SparklineCardProps {
  metric: AnalyticsMetric;
  data: number[];
  selected: boolean;
  onSelect: () => void;
}

function SparklineCard({ metric, data, selected, onSelect }: SparklineCardProps) {
  const [containerRef, size] = useElementDimensions<HTMLDivElement>();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const theme = THEME_STYLES[metric.theme || "matcha"];
  const latestVal = data[data.length - 1];
  const displayVal = activeIdx !== null && activeIdx >= 0 && activeIdx < data.length ? data[activeIdx] : latestVal;

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const segmentWidth = rect.width / Math.max(data.length - 1, 1);
    const index = Math.min(data.length - 1, Math.max(0, Math.round(x / segmentWidth)));
    setActiveIdx(index);
  };

  const handlePointerLeave = () => {
    setActiveIdx(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setActiveIdx((prev) => {
        const cur = prev ?? data.length - 1;
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        return Math.max(0, Math.min(data.length - 1, cur + delta));
      });
    } else if (e.key === "Home") {
      setActiveIdx(0);
    } else if (e.key === "End") {
      setActiveIdx(data.length - 1);
    } else if (e.key === "Escape") {
      setActiveIdx(null);
    }
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${metric.label}, latest ${formatMetricValue(metric, latestVal)} ${metric.unit}. ${
        selected ? "Selected" : "Select to view detailed breakdown"
      }`}
      onClick={onSelect}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col text-left rounded-2xl border p-5 transition-all duration-200 select-none cursor-pointer overflow-hidden ${
        selected
          ? `${theme.borderActive} ${theme.glow}`
          : "bg-white hover:bg-slate-50 border-[#e7e2d7] hover:border-slate-300 shadow-sm"
      }`}
    >
      {/* Background Japanese Watermark */}
      {metric.kanjiLabel && (
        <span className="absolute -right-2 -bottom-2 text-4xl sm:text-5xl font-black font-japanese text-slate-900/[0.04] select-none pointer-events-none">
          {metric.kanjiLabel}
        </span>
      )}

      {/* Card Header: Label & Delta */}
      <div className="flex items-center justify-between gap-2 w-full z-10">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800 truncate tracking-wide">
              {metric.label}
            </span>
            {metric.kanjiLabel && (
              <span className="text-[10px] text-slate-500 font-japanese font-medium">
                ({metric.kanjiLabel})
              </span>
            )}
          </div>
          {metric.sublabel && (
            <span className="text-[11px] text-slate-500 truncate">{metric.sublabel}</span>
          )}
        </div>
        <DeltaBadge delta={metric.delta} />
      </div>

      {/* Card Value */}
      <div className="mt-3 flex items-baseline gap-1.5 z-10">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
          {formatMetricValue(metric, displayVal)}
        </span>
        <span className="text-xs font-semibold text-slate-500">{metric.unit}</span>
      </div>

      {/* Micro Sparkline Preview */}
      <div ref={containerRef} className="mt-4 -mx-5 -mb-5 h-12 w-[calc(100%+2.5rem)] overflow-hidden">
        {size.width > 0 && (
          <SparklineGraph
            data={data}
            width={size.width}
            height={48}
            active={activeIdx}
            strokeColor={selected ? theme.stroke : "#94a3b8"}
            fillColor={selected ? theme.svgFill : "rgba(148, 163, 184, 0.08)"}
          />
        )}
      </div>
    </button>
  );
}

// Detail Panel Component for the Active Metric
interface DetailPanelProps {
  metric: AnalyticsMetric;
  data: number[];
  range: RangeOption;
}

function DetailPanel({ metric, data, range }: DetailPanelProps) {
  const [panelRef, panelDimensions] = useElementDimensions<HTMLDivElement>();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const theme = THEME_STYLES[metric.theme || "matcha"];
  const latestVal = data[data.length - 1];
  const displayVal = activeIdx !== null && activeIdx >= 0 && activeIdx < data.length ? data[activeIdx] : latestVal;

  const peak = Math.max(...data);
  const low = Math.min(...data);
  const avg = data.reduce((acc, v) => acc + v, 0) / data.length;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const segmentWidth = rect.width / Math.max(data.length - 1, 1);
    const index = Math.min(data.length - 1, Math.max(0, Math.round(x / segmentWidth)));
    setActiveIdx(index);
  };

  const handlePointerLeave = () => {
    setActiveIdx(null);
  };

  return (
    <div className="rounded-2xl border border-[#e7e2d7] bg-white p-6 shadow-xl relative overflow-hidden text-slate-800">
      {/* Ambient Radial Accent */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none opacity-10 blur-3xl"
        style={{ backgroundColor: theme.stroke }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-[#e7e2d7] relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: theme.stroke }} />
              {metric.label} {metric.kanjiLabel && <span className="font-japanese text-xs text-slate-500">({metric.kanjiLabel})</span>} — In-depth Telemetry
            </h3>
            <span className="text-xs text-slate-700 bg-[#f8f6f0] px-2.5 py-0.5 rounded-full border border-[#e7e2d7] font-mono">
              Window: {range}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            {metric.description ?? "Hover or scrub across the timeline graph below to inspect point-in-time metrics."}
          </p>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: theme.stroke }}>
            {formatMetricValue(metric, displayVal)}
          </span>
          <span className="text-sm font-semibold text-slate-500">{metric.unit}</span>
        </div>
      </div>

      {/* Main Graph & Telemetry Columns */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-center relative z-10">
        {/* Large Sparkline Graph with Scrubber */}
        <div
          ref={panelRef}
          role="img"
          tabIndex={0}
          aria-label={`${metric.label} over ${range}. Latest: ${formatMetricValue(metric, latestVal)} ${metric.unit}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className="relative h-28 sm:h-32 w-full cursor-crosshair rounded-xl bg-[#f8f6f0] border border-[#e7e2d7] p-3"
        >
          {panelDimensions.width > 0 && panelDimensions.height > 0 && (
            <div className="absolute inset-0 p-3">
              <SparklineGraph
                data={data}
                width={panelDimensions.width - 24}
                height={panelDimensions.height - 24}
                active={activeIdx}
                baseline={true}
                strokeColor={theme.stroke}
                fillColor={theme.svgFill}
              />
            </div>
          )}
        </div>

        {/* Telemetry Summary Stats (Peak / Avg / Low) */}
        <dl className="flex flex-col justify-center gap-2.5 rounded-xl bg-[#f8f6f0] border border-[#e7e2d7] p-4">
          <div className="flex items-center justify-between py-1 border-b border-[#e7e2d7]">
            <dt className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.stroke }} />
              Peak Value
            </dt>
            <dd className="text-xs font-bold text-slate-900 tabular-nums">
              {formatMetricValue(metric, peak)} <span className="text-[10px] text-slate-500">{metric.unit}</span>
            </dd>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-[#e7e2d7]">
            <dt className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8]" />
              Interval Average
            </dt>
            <dd className="text-xs font-bold text-slate-900 tabular-nums">
              {formatMetricValue(metric, avg)} <span className="text-[10px] text-slate-500">{metric.unit}</span>
            </dd>
          </div>

          <div className="flex items-center justify-between py-1">
            <dt className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" />
              Lowest Value
            </dt>
            <dd className="text-xs font-bold text-slate-900 tabular-nums">
              {formatMetricValue(metric, low)} <span className="text-[10px] text-slate-500">{metric.unit}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Contextual Academic Recommendation */}
      {metric.recommendation && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#f8f6f0] border border-[#e7e2d7] px-4 py-2.5 text-xs text-slate-700 relative z-10">
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: theme.stroke }} />
          <span>{metric.recommendation}</span>
        </div>
      )}
    </div>
  );
}

// React Bits Pro "Analytics 7" Master Block
export default function Analytics7({
  metrics,
  title = "Student Academic Analytics",
  subtitle = "Live performance signals from attendance records, vocabulary drills, and proctored examinations.",
  className = "",
  defaultMetricId,
}: Analytics7Props) {
  const [selectedRange, setSelectedRange] = useState<RangeOption>("24h");

  // Fallback student telemetry data if none provided
  const activeMetrics: AnalyticsMetric[] = useMemo(() => {
    if (metrics && metrics.length > 0) return metrics;
    return [
      {
        id: "attendance",
        label: "Attendance Rate",
        kanjiLabel: "出席率",
        sublabel: "Course Session Logs",
        unit: "%",
        good: "up",
        base: 92.4,
        seed: 1.4,
        amp: 0.08,
        delta: 3.2,
        decimals: 1,
        theme: "matcha",
        description: "Official RIT Japanese attendance quota. ≥75% is required for mid-semester exam clearance.",
        recommendation: "Excellent standing! You are safely above the 75% JLPT course clearance threshold.",
      },
      {
        id: "kanji",
        label: "Kanji & Vocab Mastery",
        kanjiLabel: "漢字・語彙",
        sublabel: "Weekly Drill Scores",
        unit: "%",
        good: "up",
        base: 85.0,
        seed: 3.2,
        amp: 0.12,
        delta: 5.6,
        decimals: 1,
        theme: "aiiro",
        description: "Cumulative accuracy across JLPT Kanji reading, pitch accent, and vocabulary recognition drills.",
        recommendation: "Focus on Group 2 Godan verb conjugations and Nakadaka pitch accents in tonight's practice.",
      },
      {
        id: "exam",
        label: "Exam & Quiz Average",
        kanjiLabel: "試験成績",
        sublabel: "Proctored Testing",
        unit: "pts",
        good: "up",
        base: 88.5,
        seed: 5.1,
        amp: 0.1,
        delta: 4.1,
        decimals: 1,
        theme: "shuiro",
        description: "Average score across proctored JLPT practice modules, listening comprehension, and timed quizzes.",
        recommendation: "Next proctored JLPT Mock Exam unlocks this Friday at 10:00 AM JST.",
      },
      {
        id: "speaking",
        label: "AI Tutor Practice Time",
        kanjiLabel: "音声練習",
        sublabel: "Sensei Voice Sessions",
        unit: "hrs",
        good: "up",
        base: 5.8,
        seed: 7.3,
        amp: 0.14,
        delta: 12.8,
        decimals: 1,
        theme: "yamabuki",
        description: "Total duration engaged in voice conversational dialogue with the fine-tuned Japanese AI Sensei.",
        recommendation: "You logged 45 minutes of spoken Japanese yesterday! 15 more minutes reaches your weekly target.",
      },
    ];
  }, [metrics]);

  const [activeMetricId, setActiveMetricId] = useState<string | null>(
    defaultMetricId ?? activeMetrics[0]?.id ?? null
  );

  const numPoints = RANGE_POINT_COUNTS[selectedRange];

  // Synthesize realistic curves anchored to student metrics
  const telemetryData = useMemo(() => {
    return activeMetrics.map((m) => {
      return Array.from({ length: numPoints }, (_, idx) => {
        const factor = m.amp * (
          0.5 * Math.sin(0.7 * idx + m.seed) +
          0.34 * Math.sin(0.23 * idx + 2.1 * m.seed) +
          0.12 * Math.sin(1.9 * idx + 0.6 * m.seed)
        );
        const val = m.base * (1 + factor);
        const multiplier = 10 ** m.decimals;
        return Math.max(m.decimals > 0 ? 0.1 : 1, Math.round(val * multiplier) / multiplier);
      });
    });
  }, [activeMetrics, numPoints]);

  const selectedIndex = activeMetrics.findIndex((m) => m.id === activeMetricId);
  const selectedMetric = selectedIndex >= 0 ? activeMetrics[selectedIndex] : null;

  return (
    <div className={`w-full ${className}`}>
      {/* Top Header & Range Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#15803d]" />
            {title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        {/* Timeframe Selector Pill (1h, 24h, 7d) */}
        <div
          role="radiogroup"
          aria-label="Analytics Timeframe"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-[#e7e2d7] p-1"
        >
          {DEFAULT_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              role="radio"
              aria-checked={selectedRange === range}
              tabIndex={selectedRange === range ? 0 : -1}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 select-none ${
                selectedRange === range
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Sparkline Cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeMetrics.map((metric, idx) => (
          <SparklineCard
            key={metric.id}
            metric={metric}
            data={telemetryData[idx]}
            selected={metric.id === activeMetricId}
            onSelect={() => setActiveMetricId((cur) => (cur === metric.id ? null : metric.id))}
          />
        ))}
      </div>

      {/* Sliding Collapsible Detail Panel */}
      <div
        className={`transition-all duration-300 ease-out grid ${
          selectedMetric ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0 mt-0"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          {selectedMetric && selectedIndex >= 0 && (
            <DetailPanel
              metric={selectedMetric}
              data={telemetryData[selectedIndex]}
              range={selectedRange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
