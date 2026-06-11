const MIN_SEED = 0;
const MAX_SEED = 0xffffffff;

export type HashPair = readonly [number, number];

export function normalizeSeed(seed: number | undefined): number {
  if (seed === undefined) {
    return 0;
  }

  if (!Number.isInteger(seed)) {
    throw new TypeError("okhash seed must be an integer");
  }

  if (seed < MIN_SEED || seed > MAX_SEED) {
    throw new RangeError("okhash seed must be a 32-bit unsigned integer");
  }

  return seed >>> 0;
}

export function cyrb53pair(input: string, seed = 0): HashPair {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ codeUnit, 2654435761);
    h2 = Math.imul(h2 ^ codeUnit, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return [h1 >>> 0, h2 >>> 0];
}
