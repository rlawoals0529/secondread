import { describe, expect, it } from "vitest";
import { analyse } from "../src/analyse";
import { looksLikeDiff, prepare } from "../src/lang/diff";

/**
 * The fixture is built so that each rule can actually fail.
 *
 * An earlier version had no removed lines and a context sort that carried an id tiebreaker, so
 * two mutations survived it: dropping the removed-line filter changed nothing because there were
 * none, and treating context as added changed nothing because the only context sort would not
 * have been flagged either way. Both tests passed while measuring nothing.
 *
 * So now: one removed line carrying a construct that must not be reported, and one context line
 * carrying a construct that WOULD be flagged if context were mistaken for an addition.
 */
const DIFF = `diff --git a/src/load.ts b/src/load.ts
index 1111111..2222222 100644
--- a/src/load.ts
+++ b/src/load.ts
@@ -10,8 +10,10 @@ export async function load(ids: string[]) {
   const rows = await db.fetch(ids);
   const legacy = rows.sort((a, b) => a.score - b.score);
-  const dropped = rows.sort((a, b) => a.heat - b.heat);
+  const guessed = rows.sort((a, b) => a.weight - b.weight);
+  try {
+    return await enrich(guessed);
+  } catch {
+  }
   return legacy;
 }`;

describe("diff mode", () => {
  it("is identified by the hunk header, not by a line starting with +", () => {
    expect(looksLikeDiff(DIFF)).toBe(true);
    expect(looksLikeDiff(`const s = "a" +\n  "b";`)).toBe(false);
    expect(looksLikeDiff(`+++ not a diff, just text`)).toBe(false);
  });

  it("keeps context so the parser sees the enclosing function, and drops metadata", () => {
    const p = prepare(DIFF);
    expect(p.kind).toBe("diff");
    expect(p.source).toContain("const rows = await db.fetch(ids)");
    // The filename, not the marker. Stripping one character off "+++ b/src/load.ts" leaves
    // "++ b/src/load.ts", so asserting the absence of "+++" passes even when the header was read
    // as an added line of code.
    expect(p.source).not.toContain("b/src/load.ts");
    expect(p.source).not.toContain("diff --git");
    expect(p.source).not.toContain("index 1111111");
  });

  it("removes deleted lines entirely, so no question can be raised about code that is gone", async () => {
    const p = prepare(DIFF);
    expect(p.source).not.toContain("a.heat");
    const r = await analyse(DIFF);
    const sorts = r.coverage.find((c) => c.check === "sort-keys")!;
    expect(sorts.sites.some((s) => s.text.includes("heat"))).toBe(false);
  });

  it("sees the context sort but does not flag it, because the diff did not add it", async () => {
    const r = await analyse(DIFF);
    const sorts = r.coverage.find((c) => c.check === "sort-keys")!;
    // Both survive into the source. `score` has no tiebreaker either, so the ONLY thing keeping
    // it unflagged is that it is context. That is what makes this test bite.
    expect(sorts.found).toBe(2);
    expect(sorts.flagged).toBe(1);
    const flagged = sorts.sites.filter((s) => s.flagged);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].text).toContain("weight");
    expect(sorts.sites.some((s) => s.text.includes("score") && !s.flagged)).toBe(true);
  });

  it("points at the line in the pasted diff, not in the reassembled source", async () => {
    const r = await analyse(DIFF);
    const q = r.questions.find((x) => x.check === "sort-keys")!;
    expect(DIFF.split("\n")[q.line - 1]).toContain("a.weight - b.weight");
  });
});
