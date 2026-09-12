import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Read" })).toBeVisible();
}

const SNIPPET = "function f(ids) {\n  const r = ids.sort((a, b) => a.v - b.v);\n  return r.slice(0, MAX) ?? [];\n}";

test("a sample fills the box and leaves you looking at it", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "load a sample file" }).click();
  // The panel must not move: the point of loading a sample is to see the code.
  await expect(page.getByRole("tab", { name: "Read" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("textarea")).toContainText("loadParts");
  await expect(page.locator("textarea")).toBeFocused();
  // Scrolled to the top, not to the caret. Focusing alone puts the caret at the end and opens
  // a tall sample on its last line, which is the wrong half of the code to be shown.
  expect(await page.locator("textarea").evaluate((el: HTMLTextAreaElement) => el.scrollTop)).toBe(0);
  expect(await page.locator("textarea").evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(0);
  // And nothing has been read yet.
  await expect(page.locator(".status")).toContainText("ready to read");
});

test("nothing is read until you ask", async ({ page }) => {
  await ready(page);
  await page.locator("textarea").fill(SNIPPET);
  await expect(page.locator(".status")).toContainText("ready to read");
  await expect(page.getByRole("tab", { name: /Questions/ }).locator(".badge")).toHaveCount(0);

  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByRole("tab", { name: /Questions/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".card").first()).toBeVisible({ timeout: 30_000 });
});

test("the button is dead until there is something to read", async ({ page }) => {
  await ready(page);
  await expect(page.getByRole("button", { name: /Read it/ })).toBeDisabled();
  await page.locator("textarea").fill("   \n  ");
  await expect(page.getByRole("button", { name: /Read it/ })).toBeDisabled();
  await page.locator("textarea").fill(SNIPPET);
  await expect(page.getByRole("button", { name: /Read it/ })).toBeEnabled();
});

test("editing after a read says so rather than silently going out of date", async ({ page }) => {
  await ready(page);
  await page.locator("textarea").fill(SNIPPET);
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.locator(".card").first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("tab", { name: "Read" }).click();
  await page.locator("textarea").fill(SNIPPET + "\nconst extra = 1;");

  await expect(page.locator(".status")).toContainText("edited since the last read");
  await expect(page.getByRole("button", { name: "Read it again" })).toBeEnabled();

  // The old answers stay readable, but they are labelled.
  await page.getByRole("tab", { name: /Questions/ }).click();
  await expect(page.locator(".stale-banner")).toContainText("previous text");
  await expect(page.locator(".card").first()).toBeVisible();
});

test("cmd or ctrl and enter reads from inside the box", async ({ page }) => {
  await ready(page);
  const box = page.locator("textarea");
  await box.fill(SNIPPET);
  await box.press("ControlOrMeta+Enter");
  await expect(page.getByRole("tab", { name: /Questions/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".card").first()).toBeVisible({ timeout: 30_000 });
});

test("a plain Enter in the box is still a newline", async ({ page }) => {
  await ready(page);
  const box = page.locator("textarea");
  await box.fill("const a = 1;");
  await box.press("End");
  await box.press("Enter");
  await box.pressSequentially("const b = 2;");
  await expect(box).toHaveValue("const a = 1;\nconst b = 2;");
  await expect(page.getByRole("tab", { name: "Read" })).toHaveAttribute("aria-selected", "true");
});

test("every question carries what the check could not see", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "load a sample file" }).click();
  await page.getByRole("button", { name: "Read it" }).click();
  const cards = page.locator(".card");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(cards.nth(i).locator(".cannot")).toContainText("Cannot see");
});

test("a diff reports only the added lines, and the counts say what it passed over", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "load a sample diff" }).click();
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.locator(".status")).toContainText("diff", { timeout: 30_000 });

  await page.getByRole("tab", { name: /What it saw/ }).click();
  await page.getByRole("button", { name: /Sort keys/ }).click();
  // Scoped to the open row: every row keeps its list in the DOM behind `hidden`.
  const open = page.locator(".cov-body:not([hidden])");
  await expect(open).toHaveCount(1);
  await expect(open.locator(".site")).toHaveCount(2);
  await expect(open.locator(".site.flagged")).toHaveCount(1);
});

test("a fragment with unbalanced braces is read, not refused", async ({ page }) => {
  await ready(page);
  await page.locator("textarea").fill(`  }\n\n${SNIPPET}`);
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.locator(".status")).toContainText("parsed with gaps", { timeout: 30_000 });
  await expect(page.locator(".card").first()).toBeVisible();
});

test("no request leaves the origin while reading code", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).host !== "localhost:4173") external.push(r.url());
  });
  await ready(page);
  await page.locator("textarea").fill(`const secret = 'hunter2';\n${SNIPPET}`);
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.locator(".status")).toContainText("whole file", { timeout: 30_000 });
  expect(external).toEqual([]);
});

test("typing stays responsive while a read is in flight", async ({ page }) => {
  await ready(page);
  const box = page.locator("textarea");
  await box.fill("function f(){\n" + "  const a = xs.sort((x,y)=>x.v-y.v);\n".repeat(400) + "}");
  await page.getByRole("button", { name: "Read it" }).click();
  await page.getByRole("tab", { name: "Read" }).click();
  await box.press("End");
  await box.pressSequentially("// still typing", { delay: 5 });
  await expect(box).toContainText("// still typing");
});
