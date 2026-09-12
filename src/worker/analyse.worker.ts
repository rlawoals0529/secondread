/// <reference lib="webworker" />
import { analyse } from "../analyse";
import type { Analysis } from "../analyse";

/**
 * The reading happens here, not on the main thread.
 *
 * Loading a 1.4MB grammar and parsing a few hundred lines is tens of milliseconds of solid
 * synchronous work, and on the main thread that lands squarely between keystrokes. The symptom
 * is not a missing spinner, it is the textarea stuttering while somebody pastes, which reads as
 * a broken input rather than as a busy one.
 *
 * Messages carry a sequence number because a fast typist outruns the parser. The main thread
 * keeps only the newest reply, so a slow parse of an earlier draft cannot overwrite the result
 * for what is on screen now.
 */
type Request = { seq: number; text: string };
export type Reply =
  | { seq: number; ok: true; result: Analysis }
  | { seq: number; ok: false; error: string };

self.onmessage = async (e: MessageEvent<Request>) => {
  const { seq, text } = e.data;
  try {
    const result = await analyse(text);
    self.postMessage({ seq, ok: true, result } satisfies Reply);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ seq, ok: false, error } satisfies Reply);
  }
};
