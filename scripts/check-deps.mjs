import { readFileSync } from "node:fs";

/**
 * What is allowed to run on a page people paste their code into.
 *
 * React because the UI is a React app, and web-tree-sitter because a real parser is the whole
 * argument of this project: a regex sweep that quietly under-reports is the failure it exists to
 * demonstrate. Everything else is code nobody here reviewed, running beside somebody's source.
 */
const ALLOWED = new Set(["react", "react-dom", "web-tree-sitter"]);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const deps = Object.keys(pkg.dependencies ?? {});
const extra = deps.filter((d) => !ALLOWED.has(d));

if (extra.length > 0) {
  console.error(`Runtime dependencies not on the list: ${extra.join(", ")}`);
  console.error(`Allowed: ${[...ALLOWED].join(", ")}`);
  process.exit(1);
}
console.log(`${deps.length} runtime dependencies, all on the list: ${deps.join(", ")}`);
