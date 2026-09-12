import { describe, expect, it } from "vitest";
import { analyse } from "../src/analyse";

const dup = async (src: string) => (await analyse(src)).questions.filter((q) => q.check === "duplication");

describe("duplication", () => {
  it("finds a copy that was renamed on the way, which is the whole point", async () => {
    // Not one identifier in common. Textual matching finds nothing here.
    const src = `
      function a(box, scale, limit) {
        const width = box.w * scale;
        const padded = width + 2;
        if (padded > limit) return limit;
        return padded;
      }
      function b(rect, factor, cap) {
        const height = rect.h * factor;
        const spaced = height + 2;
        if (spaced > cap) return cap;
        return spaced;
      }
    `;
    const found = await dup(src);
    expect(found).toHaveLength(1);
    expect(found[0].ask).toContain("twice");
  });

  it("says extract at the third copy, per Fowler", async () => {
    const one = (n: string, v: string) => `
      function ${n}(src, k) {
        const ${v} = src.value * k;
        const out = ${v} + 2;
        if (out > 99) return 99;
        return out;
      }`;
    const found = await dup(one("a", "x") + one("b", "y") + one("c", "z"));
    expect(found).toHaveLength(1);
    expect(found[0].ask).toMatch(/3 times/);
    expect(found[0].ask).toContain("Fowler");
  });

  it("does not match two blocks that merely share a statement count", async () => {
    const src = `
      function a() {
        const user = await db.users.find(id);
        logger.info("found", user.name);
        return serialise(user);
      }
      function b() {
        window.addEventListener("resize", onResize);
        cache.clear();
        throw new Error("unreachable");
      }
    `;
    expect(await dup(src)).toHaveLength(0);
  });

  it("distinguishes blocks by which identifier is reused, when the binding is in the window", async () => {
    // Slots are numbered by first appearance WITHIN the window, so this only works when the
    // binding that differs is itself inside it. Here it is: the first statement binds the value
    // that the second either does or does not consume.
    const src = `
      function a(src) {
        const first = compute(src);
        const second = refine(first);
        const third = polish(second);
      }
      function b(src) {
        const first = compute(src);
        const second = refine(src);
        const third = polish(first);
      }
    `;
    expect(await dup(src)).toHaveLength(0);
  });

  it("admits the window-local limit instead of hiding it", async () => {
    // Same two blocks as above, but with the binding statement outside every window that could
    // match. Within [refine(?), polish(second), return third] both `first` and `src` are simply
    // "the first new identifier here", so the shapes are equal and this reports a duplicate that
    // a human would reject. That is a limit of window-local numbering, not a bug, and the check
    // is required to say so in the text it hands the reader.
    const src = `
      function a(src) {
        const first = compute(src);
        const second = refine(first);
        const third = polish(second);
        return third;
      }
      function b(src) {
        const first = compute(src);
        const second = refine(src);
        const third = polish(second);
        return third;
      }
    `;
    const found = await dup(src);
    expect(found).toHaveLength(1);
    expect(found[0].cannotSee).toMatch(/outside the window|renamed|same idea/i);
  });

  it("ignores blocks below the size floor, so two short guards are not a finding", async () => {
    const src = `
      function a(x) { if (!x) return 0; return 1; }
      function b(y) { if (!y) return 0; return 1; }
    `;
    expect(await dup(src)).toHaveLength(0);
  });
});
