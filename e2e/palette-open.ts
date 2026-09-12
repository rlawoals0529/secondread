import type { Page } from "@playwright/test";

/**
 * Get the palette options on screen.
 *
 * The seam the vendored picker spec reaches the picker through. This page keeps the picker in
 * a Themes tab rather than behind a disclosure at the bottom of the work, because it is a page
 * of panels and a preference already has somewhere to live here.
 */
export async function openPalette(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Themes" }).click();
  await page.getByRole("radio").first().waitFor();
}
