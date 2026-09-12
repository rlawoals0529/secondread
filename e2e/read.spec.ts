import { expect, test } from "@playwright/test";

/** The whole pipeline, in the browser the site actually ships to. */

test("reads a pasted file and asks about what it finds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "try a file" }).click();
  const cards = page.locator(".questions article");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  // Every card must carry what it cannot see. That is the product, not a decoration.
  const n = await cards.count();
  for (let i = 0; i < n; i++) await expect(cards.nth(i).locator(".cannot")).toContainText("Cannot see");
});

test("a diff reports only the added lines, and the counts say how many it passed over", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "try a diff" }).click();
  await expect(page.locator(".editor-head")).toContainText("diff", { timeout: 30_000 });
  await page.getByRole("button", { name: "Sort keys" }).click();
  const sites = page.locator(".sites li");
  await expect(sites).toHaveCount(2);
  // Two sorts present, one of them context, so exactly one is flagged.
  await expect(page.locator(".sites li.flagged")).toHaveCount(1);
});

test("a fragment with unbalanced braces is read, not refused", async ({ page }) => {
  await page.goto("/");
  await page.locator("textarea").fill(`  }

  function load(ids) {
    const ranked = ids.sort((a, b) => a.weight - b.weight);
    return ranked.slice(0, MAX) ?? [];
  }`);
  await expect(page.locator(".editor-head")).toContainText("parsed with gaps", { timeout: 30_000 });
  await expect(page.locator(".questions article").first()).toBeVisible();
});

test("no request leaves the origin while reading code", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.host !== "localhost:4173") external.push(r.url());
  });
  await page.goto("/");
  await page.locator("textarea").fill("const secret = 'hunter2'; const r = xs.sort((a,b)=>a.v-b.v);");
  await expect(page.locator(".questions article").first()).toBeVisible({ timeout: 30_000 });
  expect(external).toEqual([]);
});
