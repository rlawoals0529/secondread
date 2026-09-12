import manifest from "./theme/palettes.json";

/**
 * The palette list, read from what yozora generated rather than kept in step by hand.
 *
 * This file used to carry its own copy of all fifteen. It was identical, which is the problem:
 * a palette added over there would have left a stylesheet with sixteen and a picker showing
 * fifteen, and the missing one is a thing that exists and cannot be chosen.
 */
export type Theme = { id: string; label: string; accent: string; scheme: "light" | "dark" };

export const THEMES = manifest as Theme[];

export const DEFAULT_THEME = "twilight-comet";
