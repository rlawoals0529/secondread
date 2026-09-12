import { useEffect, useState } from "react";
import { DEFAULT_THEME, THEMES } from "../themes";

const KEY = "secondread:theme";

/**
 * Fifteen palettes from yozora, switched by one attribute on the root element.
 *
 * `color-scheme` is set alongside the palette, not instead of it. Without it the browser keeps
 * painting native scrollbars, form controls and the canvas behind the page for the wrong scheme,
 * so a light palette gets a dark scrollbar down its side and the page looks broken in a way no
 * amount of CSS on our own elements fixes.
 */
export function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && THEMES.some((t) => t.id === saved)) return saved;
    } catch {
      // Storage can throw outright in a private window or with site data blocked. A theme is a
      // convenience; failing to read one is not a reason to fail to render.
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    const t = THEMES.find((x) => x.id === theme) ?? THEMES[0];
    document.documentElement.dataset.theme = t.id;
    document.documentElement.style.colorScheme = t.scheme;
    try {
      localStorage.setItem(KEY, t.id);
    } catch {
      // Same reason. The page still works; the choice just will not survive a reload.
    }
  }, [theme]);

  return [theme, setTheme] as const;
}

export function ThemePicker({ theme, onPick }: { theme: string; onPick: (id: string) => void }) {
  const groups = [
    { scheme: "dark" as const, label: "Night" },
    { scheme: "light" as const, label: "Day" },
  ];
  return (
    <div className="themes">
      {groups.map((g) => (
        <fieldset key={g.scheme} className="theme-group">
          <legend>{g.label}</legend>
          <div className="swatches">
            {THEMES.filter((t) => t.scheme === g.scheme).map((t) => (
              <button
                key={t.id}
                className="swatch"
                aria-pressed={theme === t.id}
                onClick={() => onPick(t.id)}
                data-theme={t.id}
              >
                <span className="swatch-chip" aria-hidden="true" />
                <span className="swatch-name">{t.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
