import { describe, expect, it } from "vitest";
import { analyse } from "../src/analyse";

const SAMPLE = `
function load(ids) {
  const ranked = ids.sort((a, b) => a.weight - b.weight);
  try {
    return fetchAll(ranked);
  } catch {
  }
  return ranked.slice(0, MAX_ROWS) ?? [];
}
`;

describe("the analyser end to end", () => {
  it("finds a question from every detector that applies", async () => {
    const r = await analyse(SAMPLE);
    const byCheck = new Set(r.questions.map((q) => q.check));
    expect(r.lang).toBe("typescript");
    expect([...byCheck].sort()).toEqual(["caps", "fail-fast", "sort-keys", "try-scope"]);
  });

  it("every question says what it cannot see, because that is the point", async () => {
    const r = await analyse(SAMPLE);
    expect(r.questions.length).toBeGreaterThan(0);
    for (const q of r.questions) expect(q.cannotSee.length).toBeGreaterThan(20);
  });

  it("reports what each detector considered, not only what it flagged", async () => {
    const r = await analyse(SAMPLE);
    const sorts = r.coverage.find((c) => c.check === "sort-keys")!;
    expect(sorts.found).toBe(1);
    expect(sorts.sites).toHaveLength(1);
  });
});
