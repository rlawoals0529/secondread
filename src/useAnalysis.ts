import { useEffect, useRef, useState } from "react";
import type { Analysis } from "./analyse";
import type { Reply } from "./worker/analyse.worker";

export type State =
  | { status: "empty" }
  | { status: "reading"; previous: Analysis | null }
  | { status: "done"; result: Analysis }
  | { status: "failed"; message: string };

/**
 * Debounced, raced, and off the main thread.
 *
 * Three things worth naming, because each is a bug this shape avoids:
 *
 * 1. **The previous result survives while the next one is computed.** Clearing to a spinner on
 *    every keystroke makes the page flash its own skeleton, and the reader loses their place in
 *    a list they were halfway through reading.
 * 2. **Replies are matched by sequence, not accepted in arrival order.** A worker is not
 *    guaranteed to answer in the order it was asked, and a slow parse of an old draft landing
 *    last would silently show the wrong answer for the current text.
 * 3. **The worker is created once**, not per keystroke. Each one loads its own copy of the
 *    grammar.
 */
export function useAnalysis(text: string, delay = 180): State {
  const [state, setState] = useState<State>({ status: "empty" });
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const latest = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("./worker/analyse.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<Reply>) => {
      // Anything but the newest request is a stale answer to a question nobody is asking.
      if (e.data.seq !== latest.current) return;
      setState(e.data.ok ? { status: "done", result: e.data.result } : { status: "failed", message: e.data.error });
    };
    return () => w.terminate();
  }, []);

  useEffect(() => {
    const body = text.trim();
    if (!body) {
      latest.current = ++seq.current; // invalidate anything in flight
      setState({ status: "empty" });
      return;
    }
    const timer = setTimeout(() => {
      const mine = ++seq.current;
      latest.current = mine;
      setState((s) => ({ status: "reading", previous: s.status === "done" ? s.result : null }));
      worker.current?.postMessage({ seq: mine, text: body });
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return state;
}

/** The result to render: the fresh one, or the last good one while a new read is in flight. */
export const shown = (s: State): Analysis | null =>
  s.status === "done" ? s.result : s.status === "reading" ? s.previous : null;
