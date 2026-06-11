import { useState } from "react";
import type { Oklch } from "okhash";

import { copy, hasherOptions, IconCopy, useHasher, type SharedState } from "../components/primitives";
import { oklchToHex } from "../lib/colorMath";

function Bar({
  label,
  value,
  max,
  display,
  hex,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  hex: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="label">{label}</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>
          {display}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 100,
          background: "var(--line)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{ position: "absolute", inset: 0, width: `${pct}%`, background: hex, borderRadius: 100 }}
        />
      </div>
    </div>
  );
}

function ConicRing({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const segments = [];
  for (let a = 0; a < 360; a += 6) {
    const a0 = ((a - 90) * Math.PI) / 180;
    const a1 = ((a + 6 - 90) * Math.PI) / 180;
    const ri = r - 5;
    const ro = r + 5;
    const x1 = cx + Math.cos(a0) * ri;
    const y1 = cy + Math.sin(a0) * ri;
    const x2 = cx + Math.cos(a0) * ro;
    const y2 = cy + Math.sin(a0) * ro;
    const x3 = cx + Math.cos(a1) * ro;
    const y3 = cy + Math.sin(a1) * ro;
    const x4 = cx + Math.cos(a1) * ri;
    const y4 = cy + Math.sin(a1) * ri;
    segments.push(
      <path
        key={a}
        d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} L${x4} ${y4} Z`}
        fill={oklchToHex(0.68, 0.12, a)}
      />,
    );
  }
  return <g>{segments}</g>;
}

function HueWheel({ deg, hex }: { deg: number; hex: string }) {
  const r = 38;
  const cx = 46;
  const cy = 46;
  const rad = ((deg - 90) * Math.PI) / 180;
  const mx = cx + Math.cos(rad) * r;
  const my = cy + Math.sin(rad) * r;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <ConicRing cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r - 6} fill="none" stroke="var(--line-2)" strokeWidth="1" />
      <line x1={cx} y1={cy} x2={mx} y2={my} stroke="var(--ink)" strokeWidth="1.5" />
      <circle cx={mx} cy={my} r="6" fill={hex} stroke="var(--ink)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="2.5" fill="var(--ink)" />
    </svg>
  );
}

function OklchViz({ o, hex }: { o: Oklch; hex: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 92px", gap: 22, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Bar label="L · lightness" value={o.l} max={1} display={o.l.toFixed(4)} hex={hex} />
        <Bar label="C · chroma" value={o.c} max={0.37} display={o.c.toFixed(4)} hex={hex} />
        <Bar label="H · hue" value={o.h} max={360} display={`${o.h.toFixed(1)}°`} hex={hex} />
      </div>
      <HueWheel deg={o.h} hex={hex} />
    </div>
  );
}

export function Playground({ shared }: { shared: SharedState }) {
  const [text, setText] = useState("BitYoungjae");
  const { dark } = shared;

  const hasher = useHasher(hasherOptions(shared));

  const color = hasher(text.length ? text : " ");
  const hex = color.hex();
  const rgb = color.rgb();
  const o = color.oklch();
  const css = color.css();
  const fg = color.foreground();

  const ReadRow = ({ k, v, copyVal }: { k: string; v: string; copyVal?: string }) => (
    <button
      className="copybtn kv"
      style={{ width: "100%" }}
      onClick={() => copy(copyVal ?? v, k)}
      type="button"
    >
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </button>
  );

  return (
    <div
      className="pg-grid"
      style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 22 }}
    >
      <div
        className="card"
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: dark ? "#16171b" : "var(--card)",
          borderColor: dark ? "#2a2b30" : "var(--line-2)",
        }}
      >
        <div
          style={{
            background: hex,
            color: fg,
            flex: 1,
            minHeight: 280,
            padding: "28px 30px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "background .25s ease, color .25s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "var(--mono)",
              fontSize: 12,
              opacity: 0.82,
            }}
          >
            <span>colorize("{text.slice(0, 24)}")</span>
            <span>surface: {dark ? "dark" : "light"}</span>
          </div>
          <div
            style={{
              fontSize: "clamp(30px,5vw,52px)",
              fontWeight: 600,
              letterSpacing: "-.03em",
              lineHeight: 1.05,
              overflowWrap: "anywhere",
            }}
          >
            {text || "type something"}
          </div>
          <button
            className="copybtn"
            onClick={() => copy(hex, "hex")}
            type="button"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 15,
              color: fg,
              opacity: 0.92,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {hex} <IconCopy size={14} />
          </button>
        </div>
        <div
          style={{
            padding: 14,
            borderTop: `1px solid ${dark ? "#2a2b30" : "var(--line-2)"}`,
            display: "flex",
            gap: 10,
            alignItems: "center",
            background: dark ? "#16171b" : "var(--card)",
          }}
        >
          <span className="mono" style={{ color: "var(--faint)", fontSize: 14 }}>
            &gt;
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="type a name, email, id, emoji…"
            spellCheck={false}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              outline: "none",
              fontFamily: "var(--mono)",
              fontSize: 15,
              color: dark ? "#e8e6df" : "var(--ink)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card" style={{ padding: "8px 18px" }}>
          <ReadRow k="hex()" v={hex} />
          <ReadRow k="rgb()" v={`${rgb[0]}, ${rgb[1]}, ${rgb[2]}`} copyVal={`rgb(${rgb.join(", ")})`} />
          <ReadRow
            k="oklch()"
            v={`${o.l.toFixed(3)} ${o.c.toFixed(3)} ${o.h.toFixed(1)}`}
            copyVal={css}
          />
          <ReadRow k="css()" v={css} copyVal={css} />
          <ReadRow k="foreground()" v={fg} copyVal={fg} />
        </div>
        <div className="card" style={{ padding: "18px 20px" }}>
          <OklchViz o={o} hex={hex} />
        </div>
      </div>
    </div>
  );
}
