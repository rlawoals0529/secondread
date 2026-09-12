import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyse, DETECTORS, type Analysis } from "./analyse";
import { SAMPLE_DIFF, SAMPLE_FILE } from "./samples";

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCoverage, setOpenCoverage] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(() => {
    const body = text.trim();
    if (!body) {
      setResult(null);
      setError(null);
      return;
    }
    const mine = ++run.current;
    setBusy(true);
    const t = setTimeout(() => {
      analyse(body)
        .then((r) => {
          if (run.current !== mine) return; // a later paste already won
          setResult(r);
          setError(null);
        })
        .catch((e) => {
          if (run.current !== mine) return;
          setError(e instanceof Error ? e.message : String(e));
          setResult(null);
        })
        .finally(() => {
          if (run.current === mine) setBusy(false);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [text]);

  const byCheck = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of result?.questions ?? []) m.set(q.check, (m.get(q.check) ?? 0) + 1);
    return m;
  }, [result]);

  const load = useCallback((s: string) => setText(s), []);

  return (
    <main>
      <header>
        <h1>secondread</h1>
        <p className="tagline">
          Paste code or a diff. It finds what a reviewer has to ask about, and says what it
          cannot answer.
        </p>
      </header>

      <section className="editor">
        <div className="editor-head">
          <span>{result ? modeLabel(result) : "paste a file, or a unified diff"}</span>
          <span className="samples">
            <button onClick={() => load(SAMPLE_FILE)}>try a file</button>
            <button onClick={() => load(SAMPLE_DIFF)}>try a diff</button>
            {text && <button onClick={() => setText("")}>clear</button>}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={"function load(ids) {\n  const ranked = ids.sort((a, b) => a.weight - b.weight);\n  return ranked.slice(0, MAX) ?? [];\n}"}
          aria-label="code or diff to read"
        />
      </section>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <section className="counts">
            <h2>What each check looked at</h2>
            <p className="note">
              A check reporting nothing is saying nothing until you know how much it read. These
              are its own numbers; compare them against what you already know is in the code.
            </p>
            <table>
              <tbody>
                {result.coverage.map((c) => {
                  const det = DETECTORS.find((d) => d.id === c.check)!;
                  const open = openCoverage === c.check;
                  return (
                    <tr key={c.check} className={c.flagged > 0 ? "has-questions" : ""}>
                      <th>
                        <button
                          className="disclose"
                          onClick={() => setOpenCoverage(open ? null : c.check)}
                          aria-expanded={open}
                        >
                          {det.title}
                        </button>
                        <span className="blurb">{det.blurb}</span>
                        {open && (
                          <ul className="sites">
                            {c.sites.length === 0 && <li className="muted">nothing of this shape in the input</li>}
                            {c.sites.map((s, i) => (
                              <li key={i} className={s.flagged ? "flagged" : ""}>
                                <span className="ln">{s.line}</span>
                                <code>{s.text}</code>
                              </li>
                            ))}
                          </ul>
                        )}
                      </th>
                      <td className="num">
                        <b>{c.found}</b> {c.considers}
                      </td>
                      <td className="num">
                        <b>{c.flagged}</b> asked about
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="questions">
            <h2>
              {result.questions.length} question{result.questions.length === 1 ? "" : "s"}
            </h2>
            {result.questions.length === 0 && (
              <p className="note">
                Nothing of the shapes above appeared on the lines read. That is not the same as
                the code being right: every check here is mechanical, and the table shows exactly
                how far each one reached.
              </p>
            )}
            {result.questions.map((q, i) => (
              <article key={i}>
                <div className="q-head">
                  <span className="ln">line {q.line}</span>
                  <span className="tag">{byCheck.has(q.check) && DETECTORS.find((d) => d.id === q.check)?.title}</span>
                </div>
                <code className="construct">{q.construct}</code>
                <p className="ask">{q.ask}</p>
                <p className="cannot">
                  <span>Cannot see:</span> {q.cannotSee}
                </p>
              </article>
            ))}
          </section>
        </>
      )}

      <footer>
        <p>
          Your code never leaves this page. The only thing fetched is the grammar itself, from
          this origin, once. The page carries{" "}
          <code className="inline">connect-src {"'self'"}</code>, so the browser refuses any
          request anywhere else, including from code nobody here wrote.
        </p>
        <p>
          <a href="https://github.com/rlawoals0529/secondread">source</a>
        </p>
      </footer>
      {busy && <div className="busy" aria-live="polite">reading…</div>}
    </main>
  );
}

function modeLabel(r: Analysis): string {
  const mode = r.kind === "diff" ? `diff, ${r.linesAnalysed} added line${r.linesAnalysed === 1 ? "" : "s"} read` : `${r.lang}, whole file`;
  return r.partial ? `${mode} · fragment, parsed with gaps` : mode;
}
