import { expect, test, type Page } from "@playwright/test";

/**
 * The interactions that are invisible to anyone testing with a mouse.
 *
 * Two of these were written after finding real bugs: the skip link moved the viewport but left
 * focus on `body`, so the next Tab restarted at the top of the document and the link did nothing
 * for the only people who use it.
 *
 * `ready()` is not politeness. Global shortcuts are attached in an effect, so a key pressed
 * between `load` and mount goes nowhere, and the test fails for a reason that has nothing to do
 * with the behaviour it is checking.
 */
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Read" })).toBeVisible();
}

test("the tab strip follows the keyboard pattern, not just onClick", async ({ page }) => {
  await ready(page);
  // Roving tabindex: the strip costs one Tab to step over, not five.
  await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);

  await page.locator('[role="tab"][tabindex="0"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute("data-tab", "questions");
  // Focus follows selection, or the next arrow press moves from the wrong place.
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-tab"))).toBe("questions");

  await page.keyboard.press("End");
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute("data-tab", "about");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute("data-tab", "read");

  await expect(page.locator('[role="tabpanel"]:not([hidden])')).toHaveCount(1);
});

test("the skip link moves focus, not only the viewport", async ({ page }) => {
  await ready(page);
  await page.keyboard.press("Tab");
  await expect(page.locator("a.skip")).toBeFocused();

  // Polled rather than read once: the link slides in over 120ms, and a single measurement taken
  // on the first frame catches it at -52px and calls a working control broken.
  await expect
    .poll(async () => (await page.locator("a.skip").boundingBox())!.y)
    .toBeGreaterThanOrEqual(0);

  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("work");
});

test("shortcuts never eat a character while typing", async ({ page }) => {
  await ready(page);
  await page.keyboard.press("/");
  await expect(page.locator("textarea")).toBeFocused();

  const typed = "const a = 1; // 3 ? / 5";
  await page.keyboard.type(typed);
  await expect(page.locator("textarea")).toHaveValue(typed);

  await page.keyboard.press("Escape");
  await expect(page.locator("textarea")).not.toBeFocused();
});

test("the shortcut list is a real modal dialog", async ({ page }) => {
  await ready(page);
  await page.keyboard.press("?");
  // :modal is what gives focus trapping, inertness and Escape for free.
  await expect
    .poll(() => page.locator("dialog.keys").evaluate((d: HTMLDialogElement) => d.matches(":modal")))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.locator("dialog.keys").evaluate((d: HTMLDialogElement) => d.open))
    .toBe(false);
});

/* The picker is covered by e2e/palette-picker.spec.ts, vendored with the component and
   pointed at this page through e2e/palette-open.ts. Both of the tests that were here - the
   choice surviving a reload with its colour scheme, and the page really repainting rather
   than only the attribute changing - are in it. */
