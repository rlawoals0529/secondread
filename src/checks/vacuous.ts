import type { Coverage, Detector, Question, SyntaxNode } from "../question";
import { lineOf, nodesOfType, snippet, walk } from "../lang/parse";

/**
 * Tests that can pass without the thing they name being true.
 *
 * Three shapes, in descending order of how certain they are:
 *
 *   1. A test with no assertion cannot fail except by throwing. That is certain from the fragment.
 *   2. A sweep or extraction test with no floor passes by finding nothing. `for (const x of found)
 *      expect(x)...` over an empty `found` is green.
 *   3. A filter or scope test with no negative case passes when the filter is a no-op. If every
 *      row in the fixture should match, nothing proves the filter did anything.
 *
 * The second and third are the ones that have actually hidden bugs, and both are invisible in a
 * passing run, which is why they are worth surfacing even though the evidence is weaker.
 */

const TEST_NAME = /^(it|test|describe)$/;
const ASSERTION = /\b(expect|assert|should|chai|sinon|verify|toEqual|toBe|toMatch|toThrow|assertEqual|assertTrue|assertRaises)\b/;

const isTestCall = (n: SyntaxNode): boolean => {
  const fn = n.childForFieldName("function");
  if (!fn) return false;
  const head = fn.text.split(".")[0];
  return TEST_NAME.test(head);
};

/** Python's convention is the function name, not a wrapping call. */
const isPyTest = (n: SyntaxNode): boolean => {
  const name = n.childForFieldName("name")?.text ?? "";
  return name.startsWith("test_");
};

export const vacuous: Detector = {
  id: "vacuous-tests",
  title: "Vacuous tests",
  blurb: "Tests that can pass without the thing they name being true.",
  run(ctx) {
    const sites: Coverage["sites"] = [];
    const questions: Question[] = [];

    const bodies: { node: SyntaxNode; label: string }[] = [];
    for (const call of nodesOfType(ctx.root, ["call_expression"])) {
      if (!isTestCall(call)) continue;
      const fnArg = call
        .childForFieldName("arguments")
        ?.namedChildren.find((a) => a.type === "arrow_function" || a.type === "function_expression");
      const body = fnArg?.childForFieldName("body");
      if (body) bodies.push({ node: body, label: snippet(call, 60) });
    }
    for (const def of nodesOfType(ctx.root, ["function_definition"])) {
      if (!isPyTest(def)) continue;
      const body = def.childForFieldName("body");
      if (body) bodies.push({ node: body, label: snippet(def.childForFieldName("name") ?? def, 60) });
    }

    for (const { node, label } of bodies) {
      const line = ctx.displayLine(lineOf(node));
      if (ctx.addedLines !== null && !ctx.addedLines.has(lineOf(node))) {
        sites.push({ line, text: label, flagged: false });
        continue;
      }

      const text = node.text;
      const hasAssertion = ASSERTION.test(text);

      // Is every assertion inside a loop, with nothing establishing the loop runs?
      let assertionsInLoop = 0;
      let assertionsTotal = 0;
      const LOOPS = new Set(["for_statement", "for_in_statement", "for_of_statement", "while_statement"]);
      walk(node, (n) => {
        if (n.children.length > 0 || !ASSERTION.test(n.text)) return;
        assertionsTotal++;
        let p: SyntaxNode | null = n.parent;
        while (p && p.startIndex >= node.startIndex) {
          if (LOOPS.has(p.type)) {
            assertionsInLoop++;
            break;
          }
          p = p.parent;
        }
      });
      // A floor is any assertion about a length or count, which is what makes a sweep non-vacuous.
      const hasFloor = /\.(length|size)\b|len\(|toHaveLength|count\b/.test(text);
      const sweepNoFloor = assertionsTotal > 0 && assertionsInLoop === assertionsTotal && !hasFloor;

      const flagged = !hasAssertion || sweepNoFloor;
      sites.push({ line, text: label, flagged });
      if (!hasAssertion) {
        questions.push({
          check: "vacuous-tests",
          line,
          construct: label,
          ask: "This test has no assertion, so it can only fail by throwing. What is it meant to prove?",
          cannotSee:
            "Whether a helper it calls asserts internally. A custom matcher or a shared `check...` function would not match the names this looks for.",
        });
      } else if (sweepNoFloor) {
        questions.push({
          check: "vacuous-tests",
          line,
          construct: label,
          ask: "Every assertion here is inside a loop and nothing asserts the loop runs. If the collection comes back empty, does this test still pass?",
          cannotSee:
            "Whether the collection is ever empty in practice. That depends on the fixture and on the code under test, and running it is the only way to find out.",
        });
      }
    }

    return {
      questions,
      coverage: { check: "vacuous-tests", considers: "test bodies", found: sites.length, flagged: questions.length, sites },
    };
  },
};
