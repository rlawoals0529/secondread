import { describe, expect, it } from "vitest";
import { analyse } from "../src/analyse";

/**
 * The property the whole tool rests on.
 *
 * A pasted hunk opens with the tail of one function and closes inside the next, so it is
 * virtually never a balanced program. If tree-sitter's error recovery were not local, a stray
 * brace would silently reduce what every detector can see, and the tool would report a clean
 * sweep of a fragment it had barely parsed. That is the exact failure this project exists to
 * argue against, so it is pinned rather than assumed.
 */
const CLEAN = `function load(ids) {
  const ranked = ids.sort((a, b) => a.weight - b.weight);
  try {
    return fetchAll(ranked);
  } catch {
  }
  return ranked.slice(0, MAX) ?? [];
}`;

/**
 * Duplication is excluded on purpose. Its `found` counts candidate windows rather than
 * constructs, so it scales with how many statements the input has, and one of the cases below
 * appends a real statement to simulate a cut-off tail. Including it would make the property test
 * about input length instead of about recovery.
 */
const profile = async (src: string) => {
  const r = await analyse(src);
  return r.coverage
    .filter((c) => c.check !== "duplication")
    .map((c) => `${c.check}:${c.found}`)
    .join(" ");
};

describe("parsing a fragment that is not a whole program", () => {
  it.each([
    ["a leading dangling brace", "  }\n\n" + CLEAN],
    ["a trailing dangling brace", CLEAN + "\n  }\n"],
    ["both, and a tail cut mid-expression", "  }\n\n" + CLEAN + "\n  const p = foo(bar,"],
  ])("sees the same constructs with %s as without", async (_label, wrapped) => {
    expect(await profile(wrapped)).toBe(await profile(CLEAN));
  });

  it("reports the damage rather than refusing the input", async () => {
    const r = await analyse("  }\n\n" + CLEAN);
    expect(r.partial).toBe(true);
    expect(r.questions.length).toBeGreaterThan(0);
  });

  it("a clean file is not reported as partial", async () => {
    expect((await analyse(CLEAN)).partial).toBe(false);
  });
});
