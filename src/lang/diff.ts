import type { Lang } from "../question";

export type ParsedInput = {
  kind: "diff" | "file";
  /** What to hand the parser. For a diff this is the added lines, prefixes stripped. */
  source: string;
  /** Line numbers within `source` that the diff added. `null` for a whole file. */
  addedLines: Set<number> | null;
  /** source line (1-based) -> the line in the raw paste, so the UI can point at what was typed. */
  lineMap: number[];
};

/**
 * Is this a unified diff, or a file?
 *
 * Deliberately not "does any line start with +". A TypeScript file is full of lines starting with
 * `+` in string concatenation, and a Python file can start a continuation with one. A unified
 * diff is identified by its *headers*: a hunk header is the only line shaped `@@ -a,b +c,d @@`,
 * and it is what the parsing below actually relies on. Requiring it means a file that happens to
 * contain `+foo` is read as a file, which is the safe direction to be wrong in: reading a diff as
 * a file analyses more than was asked, while reading a file as a diff analyses almost nothing.
 */
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function looksLikeDiff(text: string): boolean {
  return text.split("\n").some((l) => HUNK.test(l));
}

/**
 * Turn a paste into something parseable, and remember where every line came from.
 *
 * For a diff the added and context lines are both kept, with their markers stripped. Keeping
 * context is not optional: a hunk of nothing but added lines is rarely valid syntax, and the
 * surrounding context is what lets the parser see the enclosing function at all. Only the added
 * lines are then *reported* on, which is the difference between reviewing a change and reviewing
 * the file it landed in.
 *
 * Removed lines are dropped. They are not in the result, so a question about one is a question
 * about code that no longer exists.
 */
export function prepare(text: string): ParsedInput {
  if (!looksLikeDiff(text)) {
    const lines = text.split("\n");
    return { kind: "file", source: text, addedLines: null, lineMap: lines.map((_, i) => i + 1) };
  }

  const out: string[] = [];
  const added = new Set<number>();
  const lineMap: number[] = [];
  const raw = text.split("\n");
  let inHunk = false;

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (HUNK.test(line)) {
      inHunk = true;
      continue;
    }
    // Everything before the first hunk header is file metadata: ---, +++, index, diff --git.
    // `+++ b/file.ts` starts with + and is emphatically not an added line of code.
    if (!inHunk) continue;
    if (line.startsWith("diff --git") || line.startsWith("index ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("-")) continue;
    if (line.startsWith("\\")) continue; // "\ No newline at end of file"

    const isAdded = line.startsWith("+");
    const body = isAdded || line.startsWith(" ") ? line.slice(1) : line;
    out.push(body);
    lineMap.push(i + 1);
    if (isAdded) added.add(out.length); // 1-based, in `source` coordinates
  }

  return { kind: "diff", source: out.join("\n"), addedLines: added, lineMap };
}

/**
 * Which grammar to parse with.
 *
 * The two TypeScript grammars are not nested: `<number>value` parses under `typescript` and
 * fails under `tsx`, while a JSX element does the reverse. Measured, not assumed. So the JSX
 * test decides, and it is deliberately narrow - a tag-shaped token in a position where an
 * expression can start - because the cost of guessing tsx for a plain .ts file is every type
 * assertion in it becoming an error node.
 */
export function detectLang(source: string, hint?: Lang): Lang {
  if (hint) return hint;

  // Python first, and on evidence that cannot appear in TypeScript: a block opener is a colon at
  // the end of a line, and `elif` and `def` are not identifiers anyone writes at the start of a
  // line in TS. A brace-and-semicolon file never matches these.
  if (/^[ \t]*(def |class |elif |except\b|with )[^\n]*:[ \t]*$/m.test(source)) return "python";
  if (/^[ \t]*(from [\w.]+ import |import [\w.]+$)/m.test(source)) return "python";

  // Then JSX, which decides between the two TypeScript grammars. Narrow on purpose: an element
  // has to sit where an expression can start, because guessing tsx for a plain .ts file turns
  // every `<number>value` assertion into an error node.
  if (/(?:return|=>|\(|,|=)\s*<[A-Za-z][\w.]*(?:\s[^<>]*)?\/?>/.test(source)) return "tsx";

  return "typescript";
}
