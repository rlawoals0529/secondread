import { describe, expect, it } from "vitest";
import { analyse } from "../src/analyse";
import { detectLang } from "../src/lang/diff";

const PY = `
def load(ids):
    ranked = sorted(rows, key=lambda r: r.weight)
    try:
        return enrich(ranked)
    except:
        pass
    return ranked[:MAX_ROWS]

def test_every_row_is_ranked():
    for row in load(ids):
        assert row.rank is not None
`;

describe("python", () => {
  it("is detected from a block opener, which cannot appear in TypeScript", () => {
    expect(detectLang(PY)).toBe("python");
    expect(detectLang("const x = { a: 1 };")).toBe("typescript");
  });

  it("finds the same constructs it finds in TypeScript", async () => {
    const r = await analyse(PY);
    expect(r.lang).toBe("python");
    const checks = new Set(r.questions.map((q) => q.check));
    expect(checks.has("sort-keys")).toBe(true);
    expect(checks.has("caps")).toBe(true);
    expect(checks.has("fail-fast")).toBe(true);
  });

  it("says a bare except catches more than the author meant", async () => {
    const r = await analyse(PY);
    const asks = r.questions.filter((q) => q.check === "fail-fast").map((q) => q.ask);
    expect(asks.some((a) => a.includes("KeyboardInterrupt"))).toBe(true);
  });

  it("reads a test_ function as a test, since python has no it() wrapper", async () => {
    const r = await analyse(PY);
    const t = r.coverage.find((c) => c.check === "vacuous-tests")!;
    expect(t.found).toBe(1);
    expect(t.flagged).toBe(1); // every assert is in the loop, and nothing asserts the loop runs
  });
});
