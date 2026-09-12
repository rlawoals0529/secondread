import type { Coverage, Detector, Question, SyntaxNode } from "../question";
import { lineOf, snippet, walk } from "../lang/parse";

/**
 * Repeated blocks, matched on shape rather than on text.
 *
 * Textual matching finds only copy-paste that nobody touched afterwards, which is the easy and
 * rare case. The interesting duplicate is the one where somebody renamed the variables: these two
 * are the same code and share not one identifier.
 *
 *     const width = box.w * scale;      const height = box.h * scale;
 *     if (width > limit) return limit;  if (height > limit) return limit;
 *
 * So every identifier is replaced by the position it first appeared at within the window. The two
 * fragments above both normalise to `const $0 = $1.$2 * $3; if ($0 > $4) return $4;` and match.
 * Literals are kept, because two blocks differing only in a number are usually the same rule with
 * a different constant, and that is worth seeing.
 *
 * **Fowler's rule of three decides the wording, not the detection.** Two copies are reported as an
 * observation; the third is the one that says extract. Detecting at two and grading at three is
 * deliberate: a pair that is about to become a triple is exactly what a reviewer wants to see, and
 * suppressing it until the damage is done helps nobody.
 */

const MIN_STATEMENTS = 3;
const MIN_CHARS = 60;

const STATEMENT_LIST = new Set([
  "statement_block", "block", "program", "module", "class_body",
  "switch_case", "switch_default",
]);

/** Node types whose text is an identifier we should anonymise. */
const IDENTIFIER = new Set([
  "identifier", "property_identifier", "shorthand_property_identifier",
  "type_identifier", "shorthand_property_identifier_pattern", "field_identifier",
]);

/**
 * A window's shape, with identifiers replaced by first-appearance position.
 *
 * Keyed per window rather than globally, so the same variable name in two unrelated functions does
 * not make them look alike, and two different names used the same way do.
 */
function shapeOf(nodes: SyntaxNode[]): string {
  const seen = new Map<string, number>();
  const parts: string[] = [];
  for (const node of nodes) {
    walk(node, (n) => {
      if (n.children.length > 0) return; // leaves carry the text
      if (IDENTIFIER.has(n.type)) {
        let slot = seen.get(n.text);
        if (slot === undefined) {
          slot = seen.size;
          seen.set(n.text, slot);
        }
        parts.push(`$${slot}`);
      } else if (n.type === "comment") {
        // Comments are not code. A block is not less duplicated for being commented differently.
      } else {
        parts.push(n.text);
      }
    });
  }
  return parts.join(" ");
}

export const duplication: Detector = {
  id: "duplication",
  title: "Duplication",
  blurb: "Repeated shapes, with identifiers renamed so a copy that was tidied still matches.",
  run(ctx) {
    const groups = new Map<
      string,
      { line: number; text: string; node: SyntaxNode; span: [number, number] }[]
    >();
    let windowsConsidered = 0;

    walk(ctx.root, (block) => {
      if (!STATEMENT_LIST.has(block.type)) return;
      const statements = block.namedChildren.filter((c) => c.type !== "comment");
      for (let size = statements.length; size >= MIN_STATEMENTS; size--) {
        for (let i = 0; i + size <= statements.length; i++) {
          const window = statements.slice(i, i + size);
          const chars = window.reduce((n, s) => n + s.text.length, 0);
          if (chars < MIN_CHARS) continue;
          windowsConsidered++;
          const shape = shapeOf(window);
          const last = window[window.length - 1];
          const entry = {
            line: ctx.displayLine(lineOf(window[0])),
            text: snippet(window[0], 70),
            node: window[0],
            // The whole span, because suppression has to work on overlap. A duplicated block of
            // four statements also contains two duplicated windows of three, which start on
            // different lines, so matching on the start line alone reports the same finding twice.
            span: [window[0].startIndex, last.endIndex] as [number, number],
          };
          const list = groups.get(shape);
          if (list) list.push(entry);
          else groups.set(shape, [entry]);
        }
      }
    });

    const sites: Coverage["sites"] = [];
    const questions: Question[] = [];
    const claimed: [number, number][] = [];
    const overlaps = (s: [number, number]) =>
      claimed.some(([a, b]) => s[0] < b && a < s[1]);

    // Largest windows first, so a duplicated 6-statement block is reported once rather than also
    // as the four 3-statement windows inside it.
    const repeated = [...groups.values()]
      .filter((g) => g.length > 1)
      .sort((a, b) => b[0].node.text.length - a[0].node.text.length);

    for (const group of repeated) {
      const lines = group.map((g) => g.line);
      if (group.some((g) => overlaps(g.span))) continue;
      for (const g of group) claimed.push(g.span);

      const inScope = ctx.addedLines === null || group.some((g) => ctx.addedLines!.has(lineOf(g.node)));
      for (const g of group) sites.push({ line: g.line, text: g.text, flagged: inScope });
      if (!inScope) continue;

      const n = group.length;
      questions.push({
        check: "duplication",
        line: lines[0],
        construct: group[0].text,
        ask:
          n >= 3
            ? `The same shape appears ${n} times, at lines ${lines.join(", ")}. Fowler's rule is that the third copy is the one you extract. Which of these is the one true version?`
            : `The same shape appears twice, at lines ${lines.join(" and ")}. Two copies ship; the third is the one that costs. Is a third likely, and are these the same rule or a coincidence?`,
        cannotSee:
          "Whether these express the same idea. Two blocks can share a shape and mean unrelated things, and two that mean the same thing can be about to diverge for a good reason. There is also a known limit here: identifiers are numbered by where they first appear inside the matched window, so two blocks that differ only in a value bound on a line above the match will look identical to this and are not.",
      });
    }

    return {
      questions,
      coverage: {
        check: "duplication",
        considers: "candidate blocks",
        found: windowsConsidered,
        flagged: questions.length,
        sites,
      },
    };
  },
};
