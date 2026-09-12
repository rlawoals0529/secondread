import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis } from "./analyse";
import type { Reply } from "./worker/analyse.worker";

export type State =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "done"; result: Analysis; of: string }
  | { status: "failed"; message: string };

/**
 * Reading happens when you ask for it, not on every keystroke.
 *
 * The earlier version re-read on a debounce. Two things were wrong with that, and the second is
 * the one that matters:
 *
 * 1. It parses a paste you are still halfway through writing, repeatedly, and throws all of it
 *    away. Cheap, but it is work nobody asked for.
 * 2. **It leaves no moment that belongs to the reader.** Results appeared and changed on their
 *    own, so there was nothing to press and nothing to be waiting for, and loading a sample had
 *    to navigate somewhere to show that anything had happened. An explicit read gives the
 *    interface a beginning and an end.
 *
 * What it keeps from the debounced version is the sequence number. A worker need not reply in
 * the order it was asked, so replies that are not the newest are dropped rather than rendered.
 */
export function useAnalysis() {
  const [state, setState] = useState<State>({ status: "idle" });
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const latest = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("./worker/analyse.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<Reply & { text?: string }>) => {
      if (e.data.seq !== latest.current) return;
      setState(
        e.data.ok
          ? { status: "done", result: e.data.result, of: pending.current }
          : { status: "failed", message: e.data.error },
      );
    };
    return () => w.terminate();
  }, []);

  const pending = useRef("");

  const read = useCallback((text: string) => {
    const body = text.trim();
    if (!body) {
      latest.current = ++seq.current;
      setState({ status: "idle" });
      return;
    }
    const mine = ++seq.current;
    latest.current = mine;
    pending.current = text;
    setState({ status: "reading" });
    worker.current?.postMessage({ seq: mine, text: body });
  }, []);

  const reset = useCallback(() => {
    latest.current = ++seq.current;
    setState({ status: "idle" });
  }, []);

  return { state, read, reset };
}

/** The result on screen, if there is one. */
export const shown = (s: State): Analysis | null => (s.status === "done" ? s.result : null);

/**
 * Has the box been edited since the result was produced?
 *
 * Worth its own idea rather than clearing the result on edit. Clearing throws away something the
 * reader may still be using; saying it is out of date lets them finish reading it and decide.
 */
export const isStale = (s: State, text: string): boolean =>
  s.status === "done" && s.of !== text;
