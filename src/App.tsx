import { useCallback, useMemo, useRef, useState } from "react";
import { DETECTORS } from "./analyse";
import { SAMPLE_DIFF, SAMPLE_FILE } from "./samples";
import { shown, useAnalysis } from "./useAnalysis";
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
  const state = useAnalysis(text);
  const result = shown(state);
  const box = useRef<HTMLTextAreaElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const load = useCallback((s: string) => {
    setText(s);
    setTab("questions");
  }, []);

  useShortcuts({
    onSection: (i) => setTab(TAB_IDS[i] ?? TAB_IDS[0]),
    onFocusPaste: () => {
      setTab("read");
      // After the panel has actually rendered. Focusing a node inside a hidden panel is a no-op
      // and leaves the caret wherever it was.
      requestAnimationFrame(() => box.current?.focus());
    },
    onToggleHelp: () => setHelpOpen((v) => !v),
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

  return (
    <>
      <a className="skip" href="#work">
        Skip to the tool
      </a>

      <div className="shell grain">
        <aside className="rail">
          <header className="brand">
            <h1 className="display">secondread</h1>
            <p className="sub">
              Paste code. Find out what a reviewer would ask.
            </p>
          </header>

          <Tabs tabs={tabs} active={tab} onChange={setTab} label="Sections" />

          <div className="rail-foot">
            <p className="status" role="status">
              {state.status === "reading" && "reading…"}
              {state.status === "done" && modeLine(state.result)}
              {state.status === "failed" && `could not read that: ${state.message}`}
              {state.status === "empty" && "nothing pasted yet"}
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

        {/*
          tabIndex -1 so the skip link moves FOCUS and not just the viewport. Without it the
          browser scrolls to #work, leaves focus on body, and the next Tab starts again from the
          top of the document, which is exactly the journey the link exists to skip.
        */}
        <main id="work" className="stage" tabIndex={-1}>
          <Panel id="read" active={tab}>
            <div className="stack">
              <div className="row">
                <h2>Paste a file, or a diff</h2>
                <div className="row-actions">
                  <button className="pill" onClick={() => load(SAMPLE_FILE)}>
                    try a file
                  </button>
                  <button className="pill" onClick={() => load(SAMPLE_DIFF)}>
                    try a diff
                  </button>
                  {text && (
                    <button className="pill" onClick={() => { setText(""); box.current?.focus(); }}>
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
                placeholder={"function load(ids) {\n  const ranked = ids.sort((a, b) => a.weight - b.weight);\n  return ranked.slice(0, MAX) ?? [];\n}"}
              />
              <p id="paste-help" className="hint">
                TypeScript, TSX or Python. A unified diff is recognised by its <code>@@</code>
                {" "}header, and only the lines it adds are reported on.
              </p>
              {result && result.questions.length > 0 && (
                <button className="menu-btn wide" onClick={() => setTab("questions")}>
                  <span className="menu-btn-label">
                    See {result.questions.length} question{result.questions.length === 1 ? "" : "s"}
                  </span>
                </button>
              )}
            </div>
          </Panel>

          <Panel id="questions" active={tab}>
            <Questions state={state} result={result} onPaste={() => setTab("read")} />
          </Panel>

          <Panel id="coverage" active={tab}>
            <CoverageTable result={result} detectors={DETECTORS} />
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

function modeLine(r: import("./analyse").Analysis): string {
  const base =
    r.kind === "diff"
      ? `diff · ${r.linesAnalysed} added line${r.linesAnalysed === 1 ? "" : "s"} read`
      : `${r.lang} · whole file`;
  return r.partial ? `${base} · parsed with gaps` : base;
}
