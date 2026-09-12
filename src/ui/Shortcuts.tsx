import { useEffect, useRef } from "react";

export const KEYS = [
  { keys: ["1", "…", "5"], does: "jump to a section" },
  { keys: ["/"], does: "focus the paste box" },
  { keys: ["Esc"], does: "leave the paste box" },
  { keys: ["?"], does: "this list" },
];

/**
 * Global keys, and the two rules that keep them from being a nuisance.
 *
 * 1. **Never while typing.** A shortcut that fires inside the textarea eats the character, and
 *    the character it eats is the one the user meant. So anything with a text target is ignored
 *    unless it is Escape, which is the documented way out.
 * 2. **Never over a modifier.** Cmd+1 switches browser tabs and Ctrl+/ is a devtools binding.
 *    Claiming either is taking a key that is not ours.
 */
export function useShortcuts(handlers: {
  onSection: (i: number) => void;
  onFocusPaste: () => void;
  onToggleHelp: () => void;
}) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);

      if (typing) {
        if (e.key === "Escape") (el as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        ref.current.onSection(Number(e.key) - 1);
      } else if (e.key === "/") {
        e.preventDefault();
        ref.current.onFocusPaste();
      } else if (e.key === "?") {
        e.preventDefault();
        ref.current.onToggleHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * A real `<dialog>`, opened with `showModal`.
 *
 * That one call is worth more than the markup around it: the browser traps focus inside, returns
 * it to the opener on close, makes the rest of the page inert to a screen reader, and wires
 * Escape. Every one of those is a bug in a hand-rolled div-with-a-backdrop, and they are the bugs
 * that only show up for the people least able to work around them.
 */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="keys" onClose={onClose} aria-labelledby="keys-title">
      <h2 id="keys-title">Keyboard</h2>
      <dl>
        {KEYS.map((k) => (
          <div key={k.does}>
            <dt>
              {k.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{k.does}</dd>
          </div>
        ))}
        <div>
          <dt>
            <kbd>←</kbd>
            <kbd>→</kbd>
          </dt>
          <dd>move between sections, when one is focused</dd>
        </div>
      </dl>
      <button className="menu-btn" onClick={onClose} autoFocus>
        <span className="menu-btn-label">Close</span>
      </button>
    </dialog>
  );
}
