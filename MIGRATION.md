# Migration

okhash generates new OKLCH-based colors. It does not reproduce the output of
`color-hash`, `uniqolor`, `string-to-color`, or other HSL string-to-color
libraries, so colors will change when you switch. This guide maps the common
APIs onto okhash.

## What changes

- **Colors differ.** okhash chooses colors in OKLCH, not HSL, and uses a
  different hash. Every string maps to a new color. Plan for a one-time visual
  change wherever colors are shown.
- **No HSL output.** okhash exposes `hex()`, `rgb()`, `oklch()`, and `css()`.
  There is no `hsl()` method. Use `rgb()` or `hex()` for interop.
- **Strings only.** Non-string input throws `TypeError`. Convert numbers, ids,
  and objects with `String(value)` or `JSON.stringify(value)` before hashing.
- **Deterministic only.** okhash has no random-color mode. Every output is a
  pure function of the input string and the options.
- **ESM only.** The package is `"type": "module"` with a single ESM build.
  `require()` works on Node versions that support `require(esm)`.

## From color-hash

`color-hash` returns HSL/RGB/hex arrays from a `ColorHash` instance. Replace the
instance with `createColorHash` or the `hashColor` singleton.

```ts
// Before
import ColorHash from "color-hash";
const ch = new ColorHash();
ch.hex("Hello World"); // "#8796c5"
ch.rgb("Hello World"); // [135, 150, 197]

// After
import { hashColor } from "okhash";
hashColor.hex("Alice"); // "#a293cb"
hashColor.rgb("Alice"); // [162, 147, 203]
```

`hsl()` has no equivalent. Read the OKLCH coordinate with `oklch()` or `css()`
when you need the polar form, and `rgb()` or `hex()` for everything else.

### Lightness and saturation

`color-hash` took `lightness` and `saturation` arrays in HSL. okhash uses channel
specs in OKLCH, where saturation becomes `chroma`. An array still means discrete
choices; `{ min, max }` means a continuous range.

```ts
// Before
new ColorHash({ lightness: [0.35, 0.5, 0.65], saturation: [0.35] });

// After: discrete choices, or a continuous range
createColorHash({
  lightness: [0.35, 0.5, 0.65],
  chroma: { min: 0.05, max: 0.08 },
});
```

okhash chroma is an OKLCH value, not an HSL percentage, so reach for the moods
first (`pastel`, `vibrant`, `earth`, and the rest) and adjust channels only when
a mood does not fit.

### Hue ranges

```ts
// Before
new ColorHash({ hue: { min: 200, max: 260 } });

// After: same idea, and hue ranges may wrap past 0
createColorHash({ hue: [{ min: 200, max: 260 }] });
```

### Custom hash

`color-hash` let you swap the hash function to separate one app's colors from
another. okhash fixes the hash for cross-runtime stability and gives each app its
own color space through `seed`:

```ts
// Before
new ColorHash({ hash: myCustomHash });

// After
createColorHash({ seed: 0xc0ffee });
```

## From uniqolor

`uniqolor(value, options)` returns `{ color, isLight }`. okhash returns a `Color`
object, and you pick the format from it.

```ts
// Before
import uniqolor from "uniqolor";
uniqolor("Hello world!"); // { color: "#5cc653", isLight: true }

// After
import { hashColor } from "okhash";
const c = hashColor("Hello world!");
c.hex(); // the color string
c.foreground(); // "#000000" or "#ffffff", replaces the isLight boolean
```

`isLight` told you which text color to pair with the background. okhash skips the
boolean and hands you the readable text color directly through `foreground()`.

### Numbers and ids

`uniqolor` accepted numbers and stringified them for you. okhash throws on
non-strings, so convert first:

```ts
// Before
uniqolor(123);

// After
hashColor(String(123));
```

### Format, saturation, lightness

```ts
// Before
uniqolor("acme", { format: "rgb", saturation: [35, 70], lightness: 25 });

// After: saturation (0-100) becomes chroma (OKLCH), lightness becomes 0-1
const c = createColorHash({
  chroma: { min: 0.04, max: 0.09 },
  lightness: 0.45,
})("acme");
c.rgb();
```

`format` has no analog; call the matching method (`hex()`, `rgb()`, `oklch()`,
`css()`) on the `Color`.

### excludeHue

`uniqolor` excluded hue ranges. okhash includes them, so invert the set. To drop
reds, list the arc you keep instead of the arc you remove:

```ts
// Before: exclude red
uniqolor.random({
  excludeHue: [
    [0, 20],
    [325, 359],
  ],
});

// After: include everything but red
createColorHash({ hue: [{ min: 20, max: 325 }] });
```

`uniqolor.random()` has no counterpart. okhash only maps a string to a color.

## From string-to-color

`stc(value)` accepts any value and returns a hex string. okhash takes strings, so
serialize other inputs yourself.

```ts
// Before
import stc from "string-to-color";
stc("string"); // "#7f1de4"
stc(null); // "#1ad64b"

// After
import { hashColor } from "okhash";
hashColor.hex("string");
hashColor.hex(JSON.stringify(null)); // hashes the string "null"
```

`string-to-color` reads color names out of a string ("i am a red fox" lands near
red) and mixes named colors together ("red green blue"). okhash has no semantic
layer. It hashes the bytes, so `"red"` and `"blue"` get unrelated colors and no
input steers the output toward a named color.

## What okhash adds

- `foreground()` for readable text color on a generated background.
- `variant("dark")` for dark surfaces, keeping the same color identity.
- `cvdSafe: true` for color-vision-safe palettes.
- `okhash/palette` for golden-angle palettes and collision-avoiding assignment.

## Out of scope

okhash ships no compatibility mode. There is no `okhash/compat` export and no
reproduction of HSL, BKDR, or SHA-256 output. To keep the exact old colors on
some surfaces during a transition, run the old library on those surfaces until
you switch them over.
