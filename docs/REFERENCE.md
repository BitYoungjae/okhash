# okhash reference (OKH1)

This document describes the OKH1 algorithm okhash uses to turn a string into a
color. It is the user-facing reference for the v1 output contract: the same
string, options, and major version always produce the same color. Anything that
would change output is a major-version change.

The numbers below are the values the package ships. A few are marked
**provisional**: a final visual calibration before the v1 release may move them,
after which they freeze.

## Pipeline

For an input string `s` and a configured instance:

1. If `s` is not a string, throw `TypeError`.
2. If `normalize` is set, apply `s.normalize("NFC")`.
3. Hash: `[h1, h2] = cyrb53pair(s, seed)`.
4. Slice the bits into three samples `tH`, `tC`, `tL` (see [Bit layout](#bit-layout)).
5. `H = hueSampler(tH)`.
6. `L = lightnessSampler(tL)`.
7. `C = chromaSampler(tC, L, H)`, applying the chroma-cap algebra below.
8. Apply the Helmholtz-Kohlrausch correction to get the display lightness and a
   reclamped chroma. With `hk: false`, skip this step.
9. With `surface: "dark"`, apply the dark variant (see
   [Surface variants](#surface-variants)). The default light surface skips this.
10. Convert OKLCH to linear sRGB through the OKLab matrices.
11. Clamp each channel to `[0, 1]`, then encode through the gamma curve to an
    8-bit `(R, G, B)` triplet.
12. Return the requested format.

The 8-bit triplet is the canonical color. Every public format is a pure function
of it.

## Hash

okhash uses a two-word cyrb53:

```text
h1 = 0xdeadbeef ^ seed
h2 = 0x41c6ce57 ^ seed
for each UTF-16 code unit ch of s:
  h1 = imul(h1 ^ ch, 2654435761)
  h2 = imul(h2 ^ ch, 1597334677)
h1 = imul(h1 ^ (h1 >>> 16), 2246822507) ^ imul(h2 ^ (h2 >>> 13), 3266489909)
h2 = imul(h2 ^ (h2 >>> 16), 2246822507) ^ imul(h1 ^ (h1 >>> 13), 3266489909)
return [h1 >>> 0, h2 >>> 0]
```

- Strings hash by UTF-16 code unit (`charCodeAt`), which every JavaScript runtime
  represents identically, so emoji and non-Latin text stay deterministic across
  runtimes.
- No Unicode normalization happens unless `normalize: "NFC"` is set.
- `seed` is a 32-bit unsigned integer, default `0`. Different seeds give an app
  its own color space.

## Bit layout

```text
tH = (h1 & 0xFFFF)       / 0x10000   // 16 bits -> hue
tC = (h2 & 0xFF)         / 0x100     //  8 bits -> chroma
tL = ((h2 >>> 8) & 0xFF) / 0x100     //  8 bits -> lightness
```

Each sample lands in `[0, 1)`. The high bits of both words are reserved and unused
in v1. cyrb53's final mixing step cross-mixes `h1` and `h2`, which decorrelates the
three samples even though they read from the same two words.

## Channel specs

`hue`, `lightness`, and `chroma` accept the same shapes. For a sample `t` in
`[0, 1)`:

| Shape          | Sampling                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| `number`       | The value.                                                                        |
| `number[]`     | `arr[floor(t * len)]`, even weight per entry.                                     |
| `{ min, max }` | `min + t * (max - min)`.                                                          |
| `Range[]`      | Map `t` across the total width, then into the matching range. Width-proportional. |

`hue` ranges may wrap through 0: `{ min: 330, max: 30 }` is a 60-degree arc, with
width `(max - min + 360) % 360`. Non-hue ranges require `min <= max`.

Weighted hue (used by some moods) builds an inverse-CDF lookup table at
construction time and interpolates it.

## Channel domains and balanced defaults

| Channel   | Domain           | `balanced` default                   |
| --------- | ---------------- | ------------------------------------ |
| hue       | `[0, 360)`       | full range, no weighting             |
| lightness | `[0, 1]`         | `{ min: 0.60, max: 0.75 }`           |
| chroma    | `[0, Cmax(L,H)]` | uniform `{ min: 0.08, max: "safe" }` |

The default hue is unweighted so the default stays neutral. Aesthetic hue
shaping lives in the moods.

## Chroma modes and the cap algebra

Two gamut limits drive chroma:

- `Cmax(L, H)`: the largest in-gamut chroma for a given lightness and hue,
  computed from Ottosson's analytic sRGB cusp approximation with a `0.995` safety
  factor.
- `Csafe(L)`: the smallest `Cmax` across all hues at a lightness, so every hue can
  reach it. okhash ships `Csafe` as an embedded 128-node table indexed by
  lightness with linear interpolation. Endpoints are `0`. The table values carry
  a conservative margin, so an interpolated lookup is always at or below the true
  limit. This makes outputs in-gamut by construction with no runtime search.

Uniform mode (chroma spec is an absolute OKLCH value):

```text
hiCap       = Csafe(L)
specHi      = ("safe" -> +Infinity)
effectiveHi = min(specHi, hiCap)        // a number ceiling is an intent, capped by gamut
effectiveLo = min(specLo, effectiveHi)
C           = effectiveLo + tC * (effectiveHi - effectiveLo)
```

Relative mode (chroma spec is a ratio in `[0, 1]`):

```text
C = (effectiveLo + tC * (effectiveHi - effectiveLo)) * Cmax(L, H)
```

`Cmax(L, H)` already carries the `0.995` margin from its definition above, so the
relative formula applies it once.

"Effective range" means `effectiveLo <= C <= effectiveHi`. At some lightnesses the
gamut cap pulls the chroma below the `specLo` you asked for; the cap wins by design.
If the lightness range can never satisfy `specLo` in uniform mode, construction
throws `RangeError` and points you to relative mode.

## Helmholtz-Kohlrausch correction

At equal OKLCH lightness, saturated blues and violets look brighter than they
measure. okhash lowers the displayed lightness to compensate:

```text
w(H) = 0.5 * (1 - cos((H - 110deg) * pi / 180))   // 0 near yellow, max near blue-violet
Ld   = L - k_HK * C * w(H)                          // k_HK = 0.32 (provisional)
C    = min(C, Cmax(Ld, H))                          // reclamp to the lowered ceiling
```

Lowering lightness lowers the gamut ceiling, so the reclamp trims chroma on a small
fraction of colors. On the balanced range it touches about 0.04% of samples and
trims each by under 1%. `w(H)` is a 256-entry lookup table. The correction is on by
default for most moods and off via `hk: false`.

`110deg` is the zero-weight hue for this approximation; the maximum correction
falls 180deg away, near `290deg`. This is a small, output-stable H-K compensation
heuristic, not a full color appearance model.

**Provisional:** `k_HK = 0.32` and the `110deg` zero-weight hue.

## Surface variants

```text
variant("dark"):  H unchanged,  L' = min(Ld + 0.10, 0.86),  C' = min(0.72 * C, Cmax(L', H))
variant("light"): identity
```

`createColorHash({ surface: "dark" })` applies the dark variant to every output.
`Color.variant(surface)` rebuilds a color for the requested surface from the same
pre-variant OKLCH; asking for the surface a color already has returns that same
color.

**Provisional:** `+0.10`, the `0.86` cap, and `0.72`.

## Foreground selection

`foreground()` picks the candidate that reads best on the color, default
candidates `["#000000", "#ffffff"]`.

- `metric: "auto"` (default): maximize `|ΔL_OK|`, the OKLab lightness difference
  between background and candidate. With black and white candidates, text flips to
  black near `#646464`.
- `metric: "wcag2"`: maximize the WCAG 2 contrast ratio. With black and white
  candidates, text flips near `#767676`.
- `rank: (bg, candidate) => number`: your own comparator; the highest score wins.
  This is where you wire in APCA via `apca-w3` if you need it.

okhash does not bundle APCA.

## Color-vision-safe preset

`cvdSafe: true` replaces the channel specs (explicit channel options still win):

```text
hue:       [{ min: 35, max: 90 }, { min: 225, max: 290 }]   // blue-orange axis
lightness: { min: 0.55, max: 0.80 }                          // wide lightness spread
chroma:    uniform { min: 0.07, max: "safe" }
```

The lightness spread keeps colors distinct under simulated protanopia,
deuteranopia, and tritanopia.

## Moods

| Mood       | Lightness      | Chroma                  | Hue weighting                 | H-K |
| ---------- | -------------- | ----------------------- | ----------------------------- | --- |
| `balanced` | `{0.60, 0.75}` | uniform `{0.08, safe}`  | none                          | on  |
| `pastel`   | `{0.78, 0.88}` | uniform `{0.04, 0.07}`  | none                          | off |
| `vibrant`  | `{0.58, 0.70}` | relative `{0.80, 0.95}` | none                          | on  |
| `jewel`    | `{0.42, 0.55}` | relative `{0.70, 0.90}` | 90-130deg weight 0.4, else 1  | on  |
| `earth`    | `{0.50, 0.68}` | uniform `{0.05, 0.09}`  | 20-110deg weight 1, else 0.15 | on  |
| `neon`     | `{0.65, 0.78}` | relative `{0.90, 1.00}` | none                          | on  |

Chroma ceilings in uniform moods are intents; the cap algebra above pulls them to
what the gamut allows at each lightness.

**Provisional:** the `jewel` and `earth` hue weights.

## Palette module

`okhash/palette` builds related sets of colors on top of the core pipeline, reusing
the same hash, channel specs, and constants documented above.

- `paletteFrom(seed, n, options?)` returns `n` colors from one seed. It hashes the
  seed once, then for each step advances the hue sample by the golden angle
  (`137.50776405003785°`, taken as a fraction of 360) and cycles the lightness
  offset through `[0, +0.05, -0.05]`. Hues spread evenly at any `n` with no
  optimization pass.
- `distinctAssign(keys, options?)` assigns one color per key and separates colors
  that land too close. It sorts the unique keys by code unit and hashes each to its
  anchor color. When a color falls within `threshold` (default `0.09` ΔE_OK) of an
  earlier one, it advances the hue by the golden angle for up to 360 attempts and
  keeps the most separated candidate. Sorting the keys first keeps the result
  order-independent.

`ΔE_OK` is the Euclidean distance between two colors in OKLab.

## Canonical color and CSS

The canonical color is the quantized 8-bit `(R, G, B)` triplet. `hex()`, `rgb()`,
`oklch()`, and `css()` all derive from it:

- `oklch()` returns the OKLCH inverse of the triplet at full precision.
- `css()` formats that value as `oklch(L C H)` with 6 decimals for L and C and 3
  for H. So `css()` equals `"oklch(" + format(oklch()) + ")"`, and parsing it back
  to sRGB returns the same triplet.

Building CSS yourself from `oklch()` therefore matches `css()` and `hex()`.

## Determinism across runtimes

ECMA-262 does not pin the last bit of `Math.cos`, `sin`, `pow`, or `cbrt`. Two
things keep that from mattering: V8-family runtimes share one implementation, and
the output quantizes to 8-bit sRGB, so a floating-point difference flips a result
only when it sits within about `1e-13` of a rounding boundary. The cross-runtime
golden suite runs the corpus on Node, Deno, Bun, and workers, plus Chromium,
Firefox, and WebKit, to catch any divergence.

## Constants

| Constant          | Value                                                | Status      |
| ----------------- | ---------------------------------------------------- | ----------- |
| hash              | cyrb53, seed-parameterized                           | fixed       |
| bit layout        | `tH=h1[0:16]`, `tC=h2[0:8]`, `tL=h2[8:16]`           | fixed       |
| OKLab matrices    | Ottosson standard                                    | fixed       |
| gamma LUT         | 4096+1 entries                                       | fixed       |
| Csafe table       | 128 nodes, linear interpolation, conservative margin | fixed       |
| Cmax              | Ottosson cusp approximation, margin `0.995`          | fixed       |
| `k_HK` / `w(H)`   | `0.32` / `0.5(1 - cos(H - 110deg))`, max at `290deg` | provisional |
| dark variant      | `L + 0.10` (cap `0.86`), `C * 0.72`                  | provisional |
| golden angle      | `137.50776405003785deg`                              | fixed       |
| ΔE_OK threshold   | `0.09` (distinctAssign default)                      | provisional |
| cache default     | 256 entries, FIFO                                    | fixed       |
| `css()` precision | L and C 6 decimals, H 3 decimals                     | fixed       |

## Versioning

- **major**: changes output. Algorithm, constants, mood definitions, default
  options.
- **minor**: adds without changing output. New mood, new method, new opt-in
  option.
- **patch**: never changes output. Golden fixtures block drift.
