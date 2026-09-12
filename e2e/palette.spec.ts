import { expect, test } from "@playwright/test";
import { describeFailures, probeContrast } from "./contrast-probe.js";
import themes from "../src/theme/palettes.json" with { type: "json" };

/**
 * The palettes, measured where they land rather than in the token files.
 *
 * The picker sits behind a tab here, so the probe runs with that tab open: the fifteen options
 * each paint themselves in the palette they offer, which is the exact shape of mistake that
 * puts a foreign palette's foreground on the current background.
 */
test("no text on the page is below AA contrast, in any palette", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Themes" }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();

  const probe = await probeContrast(page, themes);

  // A selector that stopped matching would make this pass by measuring nothing.
  expect(probe.styles).toBeGreaterThan(9);
  expect(probe.measured).toBeGreaterThan(140);

  expect(probe.failures, describeFailures(probe.failures)).toEqual([]);
});
