const DEG_TO_RAD = Math.PI / 180;
const DENSE_SIZE = 256;
const NODE_SIZE = 128;
const HUE_STEP = 2;
const SEARCH_STEPS = 32;

const dense = Array.from({ length: DENSE_SIZE }, (_, index) => {
  if (index === 0 || index === DENSE_SIZE - 1) {
    return 0;
  }

  const lightness = index / (DENSE_SIZE - 1);
  let minChroma = Number.POSITIVE_INFINITY;

  for (let hue = 0; hue < 360; hue += HUE_STEP) {
    minChroma = Math.min(minChroma, maxChromaReference(lightness, hue));
  }

  return minChroma;
});

const nodes = Array.from({ length: NODE_SIZE }, (_, index) => {
  let minChroma = Number.POSITIVE_INFINITY;
  const start = Math.max(0, 2 * index - 2);
  const end = Math.min(DENSE_SIZE - 1, 2 * index + 2);

  for (let denseIndex = start; denseIndex <= end; denseIndex += 1) {
    minChroma = Math.min(minChroma, dense[denseIndex]);
  }

  return minChroma * 0.99;
});

for (let index = 0; index < nodes.length; index += 8) {
  console.log(
    `${nodes
      .slice(index, index + 8)
      .map(formatNode)
      .join(", ")},`,
  );
}

function formatNode(value) {
  return Number(value.toFixed(8)).toString();
}

function maxChromaReference(lightness, hue) {
  let lower = 0;
  let upper = 0.5;

  while (isInGamut(lightness, upper, hue)) {
    upper *= 2;
  }

  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (lower + upper) / 2;

    if (isInGamut(lightness, middle, hue)) {
      lower = middle;
    } else {
      upper = middle;
    }
  }

  return lower;
}

function isInGamut(lightness, chroma, hue) {
  const angle = hue * DEG_TO_RAD;
  const [red, green, blue] = oklabToLinearSrgb(
    lightness,
    Math.cos(angle) * chroma,
    Math.sin(angle) * chroma,
  );

  return red >= 0 && red <= 1 && green >= 0 && green <= 1 && blue >= 0 && blue <= 1;
}

function oklabToLinearSrgb(lightness, okA, okB) {
  const lPrime = lightness + 0.3963377774 * okA + 0.2158037573 * okB;
  const mPrime = lightness - 0.1055613458 * okA - 0.0638541728 * okB;
  const sPrime = lightness - 0.0894841775 * okA - 1.291485548 * okB;
  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
