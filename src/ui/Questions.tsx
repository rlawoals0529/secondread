import type { Analysis } from "../analyse";
import { DETECTORS } from "../analyse";
import type { State } from "../useAnalysis";

export function Questions({
  state,
  result,
  onPaste,
}: {
  state: State;
  result: Analysis | null;
  onPaste: () => void;
}) {
  if (state.status === "empty") {
    return (
      <div className="stack empty">
        <h2>Nothing read yet</h2>
        <p className="hint">Paste something and the questions land here.</p>
        <button className="menu-btn" onClick={onPaste}>
          <span className="menu-btn-label">Go and paste</span>
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
        {state.status === "reading" && <span className="pill quiet">re-reading…</span>}
      </div>

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
