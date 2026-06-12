import { useMemo, useState } from "react";
import { createColorHash } from "okhash";
import { paletteFrom } from "okhash/palette";

import {
  Avatar,
  Chip,
  copy,
  demoForeground,
  hasherOptions,
  IconRefresh,
  MOOD_LABELS,
  sampleNames,
  Tag,
  useHasher,
  type SharedState,
} from "../components/primitives";
import { isRelativeChroma, MOOD_NAMES } from "../lib/data";

const POST_TEMPLATES = [
  {
    title: "Designing stable product color systems",
    excerpt: "Why deterministic hues beat hand-picked palettes once a product passes fifty entities.",
    category: "Design Systems",
    read: "6 min",
  },
  {
    title: "Hashing labels without muddy dashboards",
    excerpt: "Keeping chroma uniform so a wall of charts reads as one system, not a fruit salad.",
    category: "Engineering",
    read: "8 min",
  },
  {
    title: "Readable accents for dense activity feeds",
    excerpt: "Contrast-checked foregrounds let color carry identity without costing legibility.",
    category: "UX Notes",
    read: "4 min",
  },
  {
    title: "When generated colors need a contract",
    excerpt: "Pinning hash output across versions — and what we promise never to change.",
    category: "Release Notes",
    read: "5 min",
  },
  {
    title: "Making team badges work in dark mode",
    excerpt: "One seed, two surfaces: lightness flips while hue identity stays put.",
    category: "UI Patterns",
    read: "7 min",
  },
  {
    title: "A measured pass at perceptual balance",
    excerpt: "Measuring OKLCH spacing across 40k names to see where collisions actually hurt.",
    category: "Research",
    read: "9 min",
  },
] as const;

const TOPIC_TAGS = [
  "oklch",
  "dark-mode",
  "design-tokens",
  "a11y",
  "dataviz",
  "hashing",
  "contrast",
  "theming",
  "gamut",
  "palettes",
  "branding",
  "determinism",
] as const;

export function SetHarmony({ shared }: { shared: SharedState }) {
  const [seedN, setSeedN] = useState(7);
  const [view, setView] = useState<"avatars" | "tags" | "posts">("avatars");
  const names = useMemo(() => sampleNames(28, seedN), [seedN]);
  const hasher = useHasher(hasherOptions(shared));
  const posts = useMemo(
    () =>
      POST_TEMPLATES.map((post, i) => ({
        ...post,
        author: names[i],
        // Step 5 is coprime with the pool size, so one shuffle round never
        // repeats a tag within the visible set.
        tag: TOPIC_TAGS[(i * 5 + seedN) % TOPIC_TAGS.length],
      })),
    [names, seedN],
  );

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
          <Chip on={view === "posts"} onClick={() => setView("posts")}>
            posts
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
      {view === "posts" ? (
        <div
          className="post-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {posts.map((post) => {
            const categoryColor = hasher(post.category);
            const tagColor = hasher(post.tag);
            const divider = shared.dark ? "#26272c" : "var(--line)";
            return (
              <article
                key={`${post.title}-${post.author}`}
                className="card post-card"
                style={{
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: shared.dark ? "#16171b" : "var(--card)",
                  borderColor: shared.dark ? "#2a2b30" : "var(--line-2)",
                }}
              >
                <div style={{ height: 4, flex: "none", background: categoryColor.hex() }} />
                <div
                  style={{
                    padding: "16px 18px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          flex: "none",
                          borderRadius: 2,
                          background: categoryColor.hex(),
                        }}
                      />
                      <span
                        className="label"
                        style={{
                          color: "var(--ink-2)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {post.category}
                      </span>
                    </span>
                    <span className="label" style={{ whiteSpace: "nowrap" }}>
                      {post.read}
                    </span>
                  </div>
                  <h3
                    className="clamp-2"
                    style={{
                      margin: 0,
                      fontSize: 18,
                      lineHeight: 1.25,
                      letterSpacing: "-0.01em",
                      fontWeight: 600,
                    }}
                  >
                    {post.title}
                  </h3>
                  <p
                    className="clamp-2"
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: "var(--ink-2)",
                    }}
                  >
                    {post.excerpt}
                  </p>
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 14,
                      borderTop: `1px solid ${divider}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <Avatar name={post.author} hasher={hasher} size={26} title={post.author} />
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: "var(--ink)",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {post.author}
                    </span>
                    <span
                      style={{
                        background: tagColor.hex(),
                        color: demoForeground(tagColor),
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 100,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "52%",
                      }}
                    >
                      {post.tag}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
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
      )}
      <p className="note">
        {shared.mood} ·{" "}
        {isRelativeChroma(shared.mood)
          ? "relative chroma lets each hue reach its own gamut limit, so vivid colors pop and perceived saturation varies across the set."
          : "uniform chroma keeps every item at the same perceptual punch, so no single one dominates."}
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
                      color: demoForeground(c),
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
            title={`${c.hex()} · click to copy`}
            style={{
              flex: 1,
              background: c.hex(),
              color: demoForeground(c),
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
