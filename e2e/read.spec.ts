import { expect, test } from "@playwright/test";

/** The whole pipeline, in the browser the site actually ships to. */

test("reads a pasted file and asks about what it finds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "try a file" }).click();
  const cards = page.locator(".card");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  // Every card carries what it could not see. That is the product, not a decoration.
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(cards.nth(i).locator(".cannot")).toContainText("Cannot see");
});

test("a diff reports only the added lines, and the counts say what it passed over", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "try a diff" }).click();
  await expect(page.locator(".status")).toContainText("diff", { timeout: 30_000 });

  await page.getByRole("tab", { name: /What it saw/ }).click();
  await page.getByRole("button", { name: /Sort keys/ }).click();
  // Scoped to the row that is open. Every row keeps its list in the DOM behind `hidden`, so an
  // unscoped ".site" counts all six checks' sites at once and happens to pass for the wrong
  // reason on some inputs.
  const open = page.locator(".cov-body:not([hidden])");
  await expect(open).toHaveCount(1);
  // Two sorts reach the detector; one is context, so exactly one is asked about.
  await expect(open.locator(".site")).toHaveCount(2);
  await expect(open.locator(".site.flagged")).toHaveCount(1);
});

test("a fragment with unbalanced braces is read, not refused", async ({ page }) => {
  await page.goto("/");
  await page.locator("textarea").fill(`  }

  function load(ids) {
    const ranked = ids.sort((a, b) => a.weight - b.weight);
    return ranked.slice(0, MAX) ?? [];
  }`);
  await expect(page.locator(".status")).toContainText("parsed with gaps", { timeout: 30_000 });
  await page.getByRole("tab", { name: /Questions/ }).click();
  await expect(page.locator(".card").first()).toBeVisible();
});

test("the question count reaches the section button without opening it", async ({ page }) => {
  await page.goto("/");
  await page.locator("textarea").fill("const r = xs.sort((a, b) => a.v - b.v);");
  await expect(page.getByRole("tab", { name: /Questions/ }).locator(".badge")).toHaveText("1", {
    timeout: 30_000,
  });
});

test("no request leaves the origin while reading code", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).host !== "localhost:4173") external.push(r.url());
  });
  await page.goto("/");
  await page.locator("textarea").fill("const secret = 'hunter2'; const r = xs.sort((a,b)=>a.v-b.v);");
  await expect(page.locator(".status")).toContainText("whole file", { timeout: 30_000 });
  expect(external).toEqual([]);
});

test("typing stays responsive while a read is in flight", async ({ page }) => {
  await page.goto("/");
  const box = page.locator("textarea");
  // A paste big enough that parsing is real work. If the parse ran on the main thread, the
  // characters typed straight after it would be dropped.
  await box.fill("function f(){\n" + "  const a = xs.sort((x,y)=>x.v-y.v);\n".repeat(400) + "}");
  await box.press("End");
  await box.pressSequentially("// still typing", { delay: 5 });
  await expect(box).toContainText("// still typing");
});
