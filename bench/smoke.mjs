import { Bench } from "tinybench";
import { hashColor } from "../dist/index.mjs";

const bench = new Bench({ time: 100 });

bench.add("hashColor.hex default", () => {
  hashColor.hex("Alice");
});

await bench.run();

console.table(bench.table());
