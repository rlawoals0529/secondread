import { Parser, Language } from "web-tree-sitter";
import type { Lang, SyntaxNode } from "../question";

const FILE: Record<Lang, string> = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  python: "tree-sitter-python.wasm",
};

/**
 * Where the grammars come from.
 *
 * The browser fetches them over HTTP from `public/grammars/`; a test run reads them off disk.
 * Rather than branching on the environment inside the loader, the host says where they are once.
 * That keeps the check modules free of any notion of a filesystem, and it means the tests
 * exercise the same loader the app does rather than a second copy of it.
 */
let resolve: (file: string) => string = (file) =>
  // BASE_URL rather than a relative path. Pages serves a project site from /secondread/, and a
  // relative "grammars/x.wasm" resolves against the page URL, so it breaks the moment the page is
  // reached without its trailing slash. A 404 here returns no tree and the app reports nothing,
  // which is indistinguishable from clean code.
  `${import.meta.env.BASE_URL}grammars/${file}`;

export function configureGrammars(resolver: (file: string) => string): void {
  resolve = resolver;
  ready = null;
  loaded.clear();
}

let ready: Promise<void> | null = null;
const loaded = new Map<Lang, Language>();

/**
 * One grammar is fetched per language actually used, never the set.
 *
 * Each TypeScript grammar is about 1.4MB and Python is 450KB, so loading all three costs three
 * megabytes to answer a question about one paste. They are fetched on the first paste that needs
 * one and cached after.
 */
async function grammar(lang: Lang): Promise<Language> {
  ready ??= Parser.init({ locateFile: (name: string) => resolve(name) });
  await ready;
  const cached = loaded.get(lang);
  if (cached) return cached;
  const lg = await Language.load(resolve(FILE[lang]));
  loaded.set(lang, lg);
  return lg;
}

export type ParseResult = {
  root: SyntaxNode;
  /**
   * True when the tree contains an ERROR or MISSING node.
   *
   * **Never use this to reject input.** Every realistic diff paste sets it: a hunk opens with the
   * tail of one function and closes inside the next, so the fragment is virtually never a
   * balanced program. Measured across four shapes of real hunk, tree-sitter's recovery is local -
   * the construct counts either side of the damage match a clean parse of the same code exactly.
   * So this is reported to the reader as context and never used as a gate.
   */
  hasError: boolean;
};

export async function parse(source: string, lang: Lang): Promise<ParseResult> {
  // The grammar first. `new Parser()` throws if the runtime has not been initialised, and
  // awaiting the grammar is what initialises it.
  const language = await grammar(lang);
  const p = new Parser();
  p.setLanguage(language);
  const tree = p.parse(source);
  if (!tree) throw new Error("the parser returned nothing, which should not happen");
  return { root: tree.rootNode as unknown as SyntaxNode, hasError: tree.rootNode.hasError };
}

/** Depth-first walk over every node. */
export function walk(node: SyntaxNode, visit: (n: SyntaxNode) => void): void {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

/** Every node of one of the given types, in source order. */
export function nodesOfType(root: SyntaxNode, types: string[]): SyntaxNode[] {
  const want = new Set(types);
  const out: SyntaxNode[] = [];
  walk(root, (n) => {
    if (want.has(n.type)) out.push(n);
  });
  return out;
}

/** 1-based line of a node's first character. */
export const lineOf = (n: SyntaxNode): number => n.startPosition.row + 1;

/** A node's text, collapsed to one line and capped, for display in a card. */
export function snippet(n: SyntaxNode, max = 120): string {
  const flat = n.text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
