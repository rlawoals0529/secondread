import type { AnalysisContext, Coverage, Detector, Question, SyntaxNode } from "../question";
import { lineOf, nodesOfType, snippet } from "../lang/parse";
import { names } from "../lang/nodes";

/** Only report on lines the diff added. A whole-file paste reports on everything. */
const inScope = (ctx: AnalysisContext, n: SyntaxNode) =>
  ctx.addedLines === null || ctx.addedLines.has(lineOf(n));

const SORT_CALLS = new Set(["sort", "sorted", "toSorted", "nlargest", "nsmallest"]);

/**
 * Every new sort key, and whether ties in it are decided by something or by luck.
 *
 * A key whose every component is derived collapses on the common case, and a stable sort then
 * falls back to whatever order the upstream happened to return. The question is not whether a
 * sort exists; it is what fraction of rows tie on this key, which no amount of reading the sort
 * can answer.
 *
 * Flagged when no component looks like a total order - an id, a key, a name, a uuid, a slug. That
 * heuristic is named in `cannotSee` rather than trusted, because a field called `rank` may well be
 * unique and a field called `id` may well not be.
 */
const TOTAL_ORDER = /\b(id|uuid|guid|pk|key|name|slug|path|created_?at|timestamp|seq|index)\b/i;

/**
 * The part of a sort call that actually decides the order.
 *
 * Not the whole argument list, and the difference is a false negative that was live: Python's
 * `sorted(rows, key=lambda r: r.weight)` contains the token `key`, which the tiebreaker pattern
 * above matches, so every keyword-argument sort in Python cleared the check on the name of the
 * argument rather than on anything about the ordering. The comparator body is the only part worth
 * reading, so it is the only part read.
 */
function keyExpression(args: SyntaxNode | null): string {
  if (!args) return "";
  // Python: the value of the `key=` keyword argument.
  for (const child of args.namedChildren) {
    if (child.type !== "keyword_argument") continue;
    if (child.childForFieldName("name")?.text !== "key") continue;
    return child.childForFieldName("value")?.text ?? "";
  }
  // TypeScript: the comparator's body, or the whole argument when it is a bare reference.
  for (const child of args.namedChildren) {
    if (child.type === "arrow_function" || child.type === "function_expression") {
      return child.childForFieldName("body")?.text ?? child.text;
    }
  }
  return args.namedChildren.map((c) => c.text).join(" ");
}

export const sortKeys: Detector = {
  id: "sort-keys",
  title: "Sort keys",
  blurb: "Every sort, and whether its key breaks ties.",
  run(ctx) {
    const sites: Coverage["sites"] = [];
    const questions: Question[] = [];

    const N = names(ctx.lang);
    const calls = nodesOfType(ctx.root, N.call).filter((n) => {
      const fn = n.childForFieldName("function");
      if (!fn) return false;
      const last = fn.text.split(".").pop() ?? "";
      return SORT_CALLS.has(last);
    });

    for (const call of calls) {
      const text = snippet(call);
      const line = ctx.displayLine(lineOf(call));
      if (!inScope(ctx, call)) {
        sites.push({ line, text, flagged: false });
        continue;
      }
      const args = call.childForFieldName("arguments");
      const keyText = keyExpression(args);
      const hasTotal = TOTAL_ORDER.test(keyText);
      // A sort with no comparator at all sorts by the default ordering, which for objects is
      // their string form. That is worth a question of its own rather than a pass.
      const bare = !keyText || keyText.replace(/[()\s]/g, "") === "";
      const flagged = bare || !hasTotal;
      sites.push({ line, text, flagged });
      if (!flagged) continue;
      questions.push({
        check: "sort-keys",
        line,
        construct: text,
        ask: bare
          ? "This sorts with no comparator. What order does that give for these values, and is it the one you meant?"
          : "What fraction of rows tie on this key? If any do, a stable sort leaves their order to whatever the upstream returned.",
        cannotSee:
          "The data. Whether ties happen at all is a property of the rows at runtime, not of this expression. The check guessed at a tiebreaker by looking for an id-shaped field name, which is a guess about naming and not about uniqueness.",
      });
    }

    return {
      questions,
      coverage: { check: "sort-keys", considers: "sort calls", found: sites.length, flagged: questions.length, sites },
    };
  },
};

/**
 * Every new `try`, and what is outside it.
 *
 * Where a contract says a function never raises, the question is whether the *whole* body is
 * inside the try, never whether a try exists. So this reports the statements in the enclosing
 * function that sit outside the block, which is the thing a reader would otherwise have to
 * reconstruct by eye.
 */
export const tryScope: Detector = {
  id: "try-scope",
  title: "Error boundaries",
  blurb: "Every try, and what sits outside it.",
  run(ctx) {
    const sites: Coverage["sites"] = [];
    const questions: Question[] = [];
    const N = names(ctx.lang);
    const tries = nodesOfType(ctx.root, N.try);

    const FUNCTION = new Set(N.functionLike);

    for (const t of tries) {
      const text = snippet(t, 60);
      const line = ctx.displayLine(lineOf(t));
      if (!inScope(ctx, t)) {
        sites.push({ line, text, flagged: false });
        continue;
      }
      // Walk up to the enclosing function and count sibling statements outside this try.
      let fn: SyntaxNode | null = t.parent;
      while (fn && !FUNCTION.has(fn.type)) fn = fn.parent;
      const body = fn?.childForFieldName("body");
      const siblings = body ? body.namedChildren.filter((c) => c.type !== "comment") : [];
      // Position, not identity: a node is outside this try if it ends before it starts or starts
      // after it ends, which also excludes the try itself without needing node ids.
      const outside = siblings.filter((s) => s.endIndex <= t.startIndex || s.startIndex >= t.endIndex);
      const flagged = outside.length > 0;
      sites.push({ line, text, flagged });
      if (!flagged) continue;
      questions.push({
        check: "try-scope",
        line,
        construct: text,
        ask: `${outside.length} statement${outside.length === 1 ? "" : "s"} in this function sit outside the try. If the contract says this never raises, do they belong inside it?`,
        cannotSee:
          "The contract. Whether callers are promised this cannot throw is written in a docstring, a type, or nowhere at all, and none of those are in the paste.",
      });
    }

    return {
      questions,
      coverage: { check: "try-scope", considers: "try statements", found: sites.length, flagged: questions.length, sites },
    };
  },
};

/**
 * Caps and slices, and whether the reader is told they were applied.
 *
 * A row cap that truncates silently is the one that costs someone a day: the answer looks
 * complete and is not. The question is whether truncation is visible in what comes back.
 *
 * The pattern this replaces is the cautionary tale in the skill this tool comes from. Written as
 * a regex it was `\[: *[A-Z_]*MAX`, which requires an uppercase letter directly after the colon,
 * so it matched `[:MAX_ROWS]` and missed every `[:_constants.MAX_ROWS]` - one hit where the answer
 * was four. An AST does not have that failure mode, because a slice is a node whether or not its
 * bound is spelled the way somebody imagined.
 */
export const caps: Detector = {
  id: "caps",
  title: "Caps and slices",
  blurb: "Every truncation, and whether it announces itself.",
  run(ctx) {
    const sites: Coverage["sites"] = [];
    const questions: Question[] = [];

    const N = names(ctx.lang);
    const slices = nodesOfType(ctx.root, [...N.subscript, "slice"]).filter((n) =>
      n.text.includes(":") || /\bslice\b/.test(n.text),
    );
    const sliceCalls = nodesOfType(ctx.root, N.call).filter((n) => {
      const fn = n.childForFieldName("function");
      const last = fn?.text.split(".").pop() ?? "";
      return last === "slice" || last === "take" || last === "head" || last === "limit";
    });

    for (const n of [...slices, ...sliceCalls].sort((a, b) => a.startIndex - b.startIndex)) {
      const text = snippet(n, 80);
      const line = ctx.displayLine(lineOf(n));
      if (!inScope(ctx, n)) {
        sites.push({ line, text, flagged: false });
        continue;
      }
      sites.push({ line, text, flagged: true });
      questions.push({
        check: "caps",
        line,
        construct: text,
        ask: "When this truncates, does the caller find out? A cap that is invisible in the payload reads as a complete answer.",
        cannotSee:
          "What is returned. Whether a `truncated` flag or a total count travels alongside this is a property of the response shape, which is not in the paste.",
      });
    }

    return {
      questions,
      coverage: { check: "caps", considers: "slices and caps", found: sites.length, flagged: questions.length, sites },
    };
  },
};
