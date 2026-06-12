import { useMemo, useState } from "react";
import { createColorHash } from "okhash";
import { paletteFrom } from "okhash/palette";

import {
  Avatar,
  Chip,
  copy,
  hasherOptions,
  IconRefresh,
  MOOD_LABELS,
  sampleNames,
  Tag,
  useHasher,
  type SharedState,
} from "../components/primitives";
import { isRelativeChroma, MOOD_NAMES } from "../lib/data";

export function SetHarmony({ shared }: { shared: SharedState }) {
  const [seedN, setSeedN] = useState(7);
  const [view, setView] = useState<"avatars" | "tags">("avatars");
  const names = useMemo(() => sampleNames(28, seedN), [seedN]);
  const hasher = useHasher(hasherOptions(shared));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <div className="chiprow">
          <Chip on={view === "avatars"} onClick={() => setView("avatars")}>
            avatars
          </Chip>
          <Chip on={view === "tags"} onClick={() => setView("tags")}>
            tags
          </Chip>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}
          onClick={() => setSeedN((s) => s + 1)}
        >
          <IconRefresh size={13} /> shuffle set
        </button>
      </div>
      <div
        className="card"
        style={{
          padding: 26,
          background: shared.dark ? "#16171b" : "var(--card)",
          borderColor: shared.dark ? "#2a2b30" : "var(--line-2)",
        }}
      >
        {view === "avatars" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {names.map((n) => (
              <Avatar key={n} name={n} hasher={hasher} size={56} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {names.map((n) => (
              <Tag key={n} name={n} hasher={hasher} />
            ))}
          </div>
        )}
      </div>
      <p className="note">
        {shared.mood} ·{" "}
        {isRelativeChroma(shared.mood)
          ? "relative chroma lets each hue reach its own gamut limit, so vivid colors pop and perceived saturation varies across the set."
          : "uniform chroma keeps every avatar at the same perceptual punch, so no single one dominates."}
      </p>
    </div>
  );
}

export function MoodGallery() {
  const names = useMemo(() => sampleNames(6, 3), []);
  return (
    <div
      className="mood-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}
    >
      {MOOD_NAMES.map((mood) => {
        const hasher = createColorHash({ mood });
        return (
          <div
            key={mood}
            className="card"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
              {mood}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {names.map((n) => {
                const c = hasher(n);
                return (
                  <div
                    key={n}
                    style={{
                      height: 30,
                      borderRadius: 7,
                      background: c.hex(),
                      color: c.foreground(),
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 11,
                      paddingRight: 11,
                      fontFamily: "var(--mono)",
                      fontSize: 11.5,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={n}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--faint)", letterSpacing: ".04em" }}
            >
              {MOOD_LABELS[mood]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PaletteLab() {
  const [seed, setSeed] = useState("acme-corp");
  const [n, setN] = useState(7);
  const palette = useMemo(() => paletteFrom(seed, n), [seed, n]);
  return (
    <div className="card" style={{ padding: 26 }}>
      <div
        style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}
      >
        <label className="label" style={{ whiteSpace: "nowrap" }}>
          seed
        </label>
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          spellCheck={false}
          style={{
            border: "1px solid var(--line-2)",
            borderRadius: 100,
            padding: "7px 14px",
            fontFamily: "var(--mono)",
            fontSize: 13,
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
            width: 160,
          }}
        />
        <label className="label" style={{ marginLeft: 8, whiteSpace: "nowrap" }}>
          n = {n}
        </label>
        <input
          type="range"
          min={2}
          max={14}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          style={{ flex: 1, minWidth: 160 }}
        />
      </div>
      <div
        style={{
          display: "flex",
          borderRadius: 10,
          overflow: "hidden",
          height: 130,
          border: "1px solid var(--line-2)",
        }}
      >
        {palette.map((c, i) => (
          <button
            key={`${c.hex()}-${i}`}
            type="button"
            className="copybtn"
            onClick={() => copy(c.hex(), "hex")}
            title={`${c.hex()} — click to copy`}
            style={{
              flex: 1,
              background: c.hex(),
              color: c.foreground(),
              display: "flex",
              alignItems: "flex-end",
              padding: 9,
            }}
          >
            <span className="mono" style={{ fontSize: 10, opacity: 0.9 }}>
              {c.hex().slice(1)}
            </span>
          </button>
        ))}
      </div>
      <p className="note">
        Hᵢ = (H₀ + i × 137.50776°) mod 360. The golden angle spaces hues evenly at any n, with no
        optimization pass.
      </p>
    </div>
  );
}
