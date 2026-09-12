import { useState } from "react";
import type { Analysis } from "../analyse";
import type { Detector } from "../question";

/**
 * What each check considered, not only what it flagged.
 *
 * Rendered as a real disclosure per row rather than a modal, because the useful action is
 * comparing two rows, and a modal makes you close one to see the next.
 */
export function CoverageTable({ result, detectors }: { result: Analysis | null; detectors: Detector[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!result) {
    return (
      <div className="stack empty">
        <h2>Nothing read yet</h2>
        <p className="hint">Paste something and each check reports what it looked at.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h2>What each check looked at</h2>
      <p className="hint">
        A check reporting nothing says nothing until you know how much it read. Open a row to see
        every construct it considered, and compare that against what you know is in the code.
      </p>

      <ul className="coverage">
        {result.coverage.map((c) => {
          const det = detectors.find((d) => d.id === c.check)!;
          const isOpen = open === c.check;
          return (
            <li key={c.check} className={c.flagged > 0 ? "cov flagged" : "cov"}>
              <button
                className="cov-head"
                aria-expanded={isOpen}
                aria-controls={`cov-${c.check}`}
                onClick={() => setOpen(isOpen ? null : c.check)}
              >
                <span className="cov-title">
                  <span className="chev" aria-hidden="true" />
                  {det.title}
                </span>
                <span className="cov-nums">
                  <b>{c.found}</b> <span className="unit">{c.considers}</span>
                  <b className="asked">{c.flagged}</b> <span className="unit">asked about</span>
                </span>
              </button>
              <p className="cov-blurb">{det.blurb}</p>
              <div id={`cov-${c.check}`} hidden={!isOpen} className="cov-body">
                {c.sites.length === 0 ? (
                  <p className="hint">Nothing of this shape is in the input at all.</p>
                ) : (
                  <ol className="sites">
                    {c.sites.map((s, i) => (
                      <li key={i} className={s.flagged ? "site flagged" : "site"}>
                        <span className="ln">{s.line}</span>
                        <code>{s.text}</code>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
