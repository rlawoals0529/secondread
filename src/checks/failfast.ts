import type { Coverage, Detector, Question, SyntaxNode } from "../question";
import { lineOf, nodesOfType, snippet } from "../lang/parse";
import { names } from "../lang/nodes";

/**
 * Where a value was made to go away rather than accounted for.
 *
 * Every construct here is legitimate somewhere. `?? []` on an optional field that genuinely has
 * no value is correct; `?? []` reached for because a query sometimes returns undefined and nobody
 * found out why is the upstream shape being papered over. The two are identical in the source,
 * which is exactly why this emits a question instead of a finding.
 *
 * Empty handlers are separated from handlers with a body, because an empty one cannot be doing
 * anything with the error and is the strongest signal available from a fragment.
 */
export const failFast: Detector = {
  id: "fail-fast",
  title: "Fail fast",
  blurb: "Swallowed errors, and defaults standing in for missing values.",
  run(ctx) {
    const sites: Coverage["sites"] = [];
    const questions: Question[] = [];
    const inScope = (n: SyntaxNode) => ctx.addedLines === null || ctx.addedLines.has(lineOf(n));

    const add = (n: SyntaxNode, ask: string, cannotSee: string, isQuestion: boolean) => {
      const line = ctx.displayLine(lineOf(n));
      const text = snippet(n, 90);
      sites.push({ line, text, flagged: isQuestion });
      if (isQuestion) questions.push({ check: "fail-fast", line, construct: text, ask, cannotSee });
    };

    // Catch clauses whose body holds nothing at all.
    const N = names(ctx.lang);
    for (const c of nodesOfType(ctx.root, N.catch)) {
      const body = c.childForFieldName("body") ?? c.namedChildren.at(-1);
      const statements = (body?.namedChildren ?? []).filter((s) => s.type !== "comment");
      const empty = statements.length === 0;
      const onlyPass = statements.length === 1 && statements[0].text.trim() === "pass";
      add(
        c,
        "This catches and does nothing. What reaches the caller when it fires, and how would anyone know it did?",
        "Whether anything downstream logs or re-raises. That is in the caller, which is not in the paste.",
        inScope(c) && (empty || onlyPass),
      );
    }

    // A bare `except:` catches SystemExit and KeyboardInterrupt too, which is almost never meant.
    for (const c of nodesOfType(ctx.root, ["except_clause"])) {
      const bare = /^except\s*:/.test(c.text);
      if (!bare) continue;
      add(
        c,
        "A bare `except:` also catches KeyboardInterrupt and SystemExit. Is that intended, or is a specific exception meant?",
        "Nothing. This one is answerable from the fragment, which is why it is worded as a choice rather than as a measurement.",
        inScope(c),
      );
    }

    // `?? []`, `|| []`, `?? ''` and their kin: a default in place of a value.
    const EMPTYISH = /^(\[\s*\]|\{\s*\}|''|""|``|0|null|undefined|False|None)$/;
    for (const n of nodesOfType(ctx.root, N.binary)) {
      const op = n.children.find((c) => ["??", "||", "or"].includes(c.type));
      if (!op) continue;
      const right = n.childForFieldName("right");
      if (!right || !EMPTYISH.test(right.text.trim())) continue;
      add(
        n,
        `What produces the missing value here? If the answer is "sometimes the query returns nothing and I am not sure why", the shape upstream is the bug and this hides it.`,
        "The producer. Whether the left side can legitimately be absent is a property of whatever returns it, which is not in the paste.",
        inScope(n),
      );
    }

    return {
      questions,
      coverage: {
        check: "fail-fast",
        considers: "handlers and defaults",
        found: sites.length,
        flagged: questions.length,
        sites,
      },
    };
  },
};
