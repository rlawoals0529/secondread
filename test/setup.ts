import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configureGrammars } from "../src/lang/parse";

/**
 * Point the loader at the same files the site serves.
 *
 * `public/grammars/` is what Vite copies to the deployed site, so a test that reads from there is
 * testing the grammar the site actually ships rather than a second copy in node_modules that
 * could drift from it.
 */
configureGrammars((file) => resolve(__dirname, "../public/grammars", file));
export { readFileSync };
