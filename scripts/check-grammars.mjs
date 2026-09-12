import { readFileSync, existsSync, statSync } from "node:fs";

/**
 * Every language the tool claims to read must have a grammar on disk.
 *
 * A missing wasm does not throw at build time; it 404s at runtime and the paste silently returns
 * nothing, which reads exactly like "your code is fine". This is the same class of failure the
 * tool reports on, so it is checked rather than trusted.
 */
const src = readFileSync("src/lang/nodes.ts", "utf8");
const declared = [...src.matchAll(/"(typescript|tsx|python)"/g)].map((m) => m[1]);
const wanted = [...new Set(declared)];

let bad = 0;
for (const lang of wanted) {
  const file = `public/grammars/tree-sitter-${lang}.wasm`;
  if (!existsSync(file)) {
    console.error(`${lang}: ${file} is missing`);
    bad++;
    continue;
  }
  const kb = Math.round(statSync(file).size / 1024);
  if (kb < 50) {
    console.error(`${lang}: ${file} is only ${kb}KB, which is not a grammar`);
    bad++;
    continue;
  }
  console.log(`${lang.padEnd(11)} ${String(kb).padStart(5)}KB`);
}
if (!existsSync("public/grammars/tree-sitter.wasm")) {
  console.error("the tree-sitter runtime itself is missing from public/grammars/");
  bad++;
}
process.exit(bad > 0 ? 1 : 0);
