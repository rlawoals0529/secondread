import type { Analysis } from "../analyse";
import { DETECTORS } from "../analyse";
import type { State } from "../useAnalysis";

export function Questions({
  state,
  result,
  stale,
  onGoRead,
  onReadAgain,
}: {
  state: State;
  result: Analysis | null;
  stale: boolean;
  onGoRead: () => void;
  onReadAgain: () => void;
}) {
  if (state.status === "idle") {
    return (
      <div className="stack empty">
        <h2>Nothing read yet</h2>
        <p className="hint">Paste something in Read, then press the button.</p>
        <button className="menu-btn" onClick={onGoRead}>
          <span className="menu-btn-label">Go to Read</span>
        </button>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="stack">
        <h2>Could not read that</h2>
        <p className="hint error">{state.message}</p>
      </div>
    );
  }

  const q = result?.questions ?? [];

  return (
    <div className="stack">
      <div className="row">
        <h2>
          {q.length} question{q.length === 1 ? "" : "s"}
        </h2>
        {state.status === "reading" && <span className="pill quiet">reading…</span>}
      </div>

      {stale && (
        <div className="stale-banner" role="status">
          <p>These are for the previous text. The box has been edited since.</p>
          <button className="pill" onClick={onReadAgain}>
            read it again
          </button>
        </div>
      )}

      {/*
        Announced once, politely, rather than per card. A live region that fires on every item
        makes a screen reader read the whole list aloud on every keystroke, which is worse than
        saying nothing.
      */}
      <p className="sr-only" role="status">
        {q.length} question{q.length === 1 ? "" : "s"} found
      </p>

      {q.length === 0 && (
        <p className="hint">
          None of the shapes it looks for appeared on the lines it read. That is not the same as
          the code being right. <b>What it saw</b> shows exactly how far each check reached.
        </p>
      )}

      <ol className="cards">
        {q.map((item, i) => {
          const det = DETECTORS.find((d) => d.id === item.check);
          return (
            <li key={`${item.check}-${item.line}-${i}`} className="card rise">
              <div className="card-head">
                <span className="ln">line {item.line}</span>
                <span className="tag">{det?.title ?? item.check}</span>
              </div>
              <pre className="construct">
                <code>{item.construct}</code>
              </pre>
              <p className="ask">{item.ask}</p>
              <p className="cannot">
                <b>Cannot see</b> {item.cannotSee}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
