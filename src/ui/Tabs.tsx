import { useRef, type KeyboardEvent } from "react";

export type Tab = { id: string; label: string; badge?: number };

/**
 * Tabs with the keyboard behaviour the pattern actually specifies.
 *
 * Three things that a div-with-onClick version gets wrong, and that anyone navigating by keyboard
 * notices immediately:
 *
 * - **Roving tabindex.** Exactly one tab is in the tab order. Tab moves past the whole strip to
 *   the panel; arrows move between tabs. A strip of five focusable buttons costs five presses to
 *   step over and puts the panel five stops away from its own control.
 * - **Arrows wrap, Home and End jump.** Both are in the APG pattern and both are what a keyboard
 *   user tries first.
 * - **Focus follows selection here, deliberately.** Panels are cheap to render, so activating on
 *   arrow rather than requiring a second Enter is the faster interaction and the pattern permits
 *   it for exactly that case.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const strip = useRef<HTMLDivElement>(null);

  const move = (to: number) => {
    const next = tabs[(to + tabs.length) % tabs.length];
    onChange(next.id);
    strip.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(i + 1),
      ArrowLeft: () => move(i - 1),
      Home: () => move(0),
      End: () => move(tabs.length - 1),
    };
    const handler = keys[e.key];
    if (!handler) return;
    e.preventDefault();
    handler();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} ref={strip} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className="menu-btn"
            onClick={() => onChange(t.id)}
          >
            <span className="menu-btn-label">{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && <span className="badge">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({ id, active, children }: { id: string; active: string; children: React.ReactNode }) {
  const selected = id === active;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!selected}
      // Focusable so that tabbing off the strip lands in the panel rather than past it. -1
      // rather than 0 keeps it out of the sequential order once you are inside.
      tabIndex={selected ? 0 : -1}
      className="tabpanel"
    >
      {selected && children}
    </div>
  );
}
