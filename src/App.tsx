import { useCallback, useMemo, useRef, useState } from "react";
import { DETECTORS } from "./analyse";
import { SAMPLE_DIFF, SAMPLE_FILE } from "./samples";
import { isStale, shown, useAnalysis } from "./useAnalysis";
import { Panel, Tabs } from "./ui/Tabs";
import { ThemePicker, useTheme } from "./ui/ThemePicker";
import { Questions } from "./ui/Questions";
import { CoverageTable } from "./ui/Coverage";
import { About } from "./ui/About";
import { ShortcutsDialog, useShortcuts } from "./ui/Shortcuts";

const TAB_IDS = ["read", "questions", "coverage", "themes", "about"];

export default function App() {
  const [text, setText] = useState("");
  const [tab, setTab] = useState("read");
  const [theme, setTheme] = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const { state, read, reset } = useAnalysis();
  const result = shown(state);
  const stale = isStale(state, text);
  const box = useRef<HTMLTextAreaElement>(null);

  /** Read, then go to the answer. The only thing in the app that navigates for you. */
  const submit = useCallback(() => {
    if (!text.trim()) return;
    read(text);
    setTab("questions");
  }, [text, read]);

  /**
   * A sample fills the box and stays put.
   *
   * It used to jump straight to the questions, which meant the code being talked about was on a
   * panel you were no longer looking at. Someone clicking "try a file" wants to see the file.
   */
  const loadSample = useCallback(
    (s: string) => {
      setText(s);
      reset();
      requestAnimationFrame(() => {
        const el = box.current;
        if (!el) return;
        el.focus();
        // Focus alone leaves the caret at the end, so a sample taller than the box opens
        // scrolled to its last line. You are meant to be looking at the code, so show the top.
        el.setSelectionRange(0, 0);
        el.scrollTop = 0;
      });
    },
    [reset],
  );

  useShortcuts({
    onSection: (i) => setTab(TAB_IDS[i] ?? TAB_IDS[0]),
    onFocusPaste: () => {
      setTab("read");
      requestAnimationFrame(() => box.current?.focus());
    },
    onToggleHelp: () => setHelpOpen((v) => !v),
    onSubmit: submit,
  });

  const tabs = useMemo(
    () => [
      { id: "read", label: "Read" },
      { id: "questions", label: "Questions", badge: result?.questions.length },
      { id: "coverage", label: "What it saw" },
      { id: "themes", label: "Themes" },
      { id: "about", label: "About" },
    ],
    [result],
  );

  const canRead = text.trim().length > 0;
  const buttonLabel =
    state.status === "reading" ? "Reading…" : stale ? "Read it again" : result ? "Read it again" : "Read it";

  return (
    <>
      <a className="skip" href="#work">
        Skip to the tool
      </a>

      <div className="shell grain">
        <aside className="rail">
          <header className="brand">
            <h1 className="display">secondread</h1>
            <p className="sub">Paste code. Find out what a reviewer would ask.</p>
          </header>

          <Tabs tabs={tabs} active={tab} onChange={setTab} label="Sections" />

          <div className="rail-foot">
            <p className="status" role="status">
              {state.status === "reading" && "reading…"}
              {state.status === "done" && (stale ? "edited since the last read" : modeLine(state.result))}
              {state.status === "failed" && `could not read that: ${state.message}`}
              {state.status === "idle" && (canRead ? "ready to read" : "nothing pasted yet")}
            </p>
            <div className="rail-links">
              <button className="linkish" onClick={() => setHelpOpen(true)}>
                keyboard <kbd>?</kbd>
              </button>
              <a className="src" href="https://github.com/rlawoals0529/secondread">
                source
              </a>
            </div>
          </div>
        </aside>

        <main id="work" className="stage" tabIndex={-1}>
          <Panel id="read" active={tab}>
            <div className="stack">
              <div className="row">
                <h2>Paste a file, or a diff</h2>
                <div className="row-actions">
                  <button className="pill" onClick={() => loadSample(SAMPLE_FILE)}>
                    load a sample file
                  </button>
                  <button className="pill" onClick={() => loadSample(SAMPLE_DIFF)}>
                    load a sample diff
                  </button>
                  {text && (
                    <button
                      className="pill"
                      onClick={() => {
                        setText("");
                        reset();
                        box.current?.focus();
                      }}
                    >
                      clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                ref={box}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                aria-label="code or diff to read"
                aria-describedby="paste-help"
                placeholder={
                  "function load(ids) {\n  const ranked = ids.sort((a, b) => a.weight - b.weight);\n  return ranked.slice(0, MAX) ?? [];\n}"
                }
              />

              <div className="submit-row">
                <button
                  className="menu-btn go"
                  onClick={submit}
                  disabled={!canRead || state.status === "reading"}
                  aria-describedby="paste-help"
                >
                  <span className="menu-btn-label">{buttonLabel}</span>
                  <kbd aria-hidden="true">{modKey()}↵</kbd>
                </button>
                {stale && (
                  <p className="stale" role="status">
                    The questions below are for the previous text.
                  </p>
                )}
              </div>

              <p id="paste-help" className="hint">
                TypeScript, TSX or Python. A unified diff is recognised by its <code>@@</code>{" "}
                header, and only the lines it adds are reported on. Nothing is uploaded.
              </p>
            </div>
          </Panel>

          <Panel id="questions" active={tab}>
            <Questions
              state={state}
              result={result}
              stale={stale}
              onGoRead={() => {
                setTab("read");
                requestAnimationFrame(() => box.current?.focus());
              }}
              onReadAgain={submit}
            />
          </Panel>

          <Panel id="coverage" active={tab}>
            <CoverageTable result={result} detectors={DETECTORS} stale={stale} />
          </Panel>

          <Panel id="themes" active={tab}>
            <div className="stack">
              <h2>Fifteen palettes</h2>
              <p className="hint">
                From <a href="https://github.com/rlawoals0529/yozora">yozora</a>, vendored. The
                choice is kept in this browser and nowhere else.
              </p>
              <ThemePicker theme={theme} onPick={setTheme} />
            </div>
          </Panel>

          <Panel id="about" active={tab}>
            <About />
          </Panel>
        </main>

        <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </>
  );
}

/** Cmd on a Mac, Ctrl everywhere else. Showing the wrong one is worse than showing neither. */
function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
}

function modeLine(r: import("./analyse").Analysis): string {
  const base =
    r.kind === "diff"
      ? `diff · ${r.linesAnalysed} added line${r.linesAnalysed === 1 ? "" : "s"} read`
      : `${r.lang} · whole file`;
  return r.partial ? `${base} · parsed with gaps` : base;
}
