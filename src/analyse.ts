import type { AnalysisContext, Coverage, Lang, Question } from "./question";
import { detectLang, prepare } from "./lang/diff";
import { parse } from "./lang/parse";
import { caps, sortKeys, tryScope } from "./checks/boundary";
import { failFast } from "./checks/failfast";
import { duplication } from "./checks/duplication";
import { vacuous } from "./checks/vacuous";

export const DETECTORS = [duplication, sortKeys, tryScope, caps, failFast, vacuous];

export type Analysis = {
  kind: "diff" | "file";
  lang: Lang;
  questions: Question[];
  coverage: Coverage[];
  /** True when the tree has error nodes. Reported, never used to reject the input. */
  partial: boolean;
  linesAnalysed: number;
};

export async function analyse(text: string, hint?: Lang): Promise<Analysis> {
  const input = prepare(text);
  const lang = detectLang(input.source, hint);
  const { root, hasError } = await parse(input.source, lang);

  const ctx: AnalysisContext = {
    source: input.source,
    lang,
    root,
    addedLines: input.addedLines,
    displayLine: (line) => input.lineMap[line - 1] ?? line,
  };

  const questions: Question[] = [];
  const coverage: Coverage[] = [];
  for (const d of DETECTORS) {
    const r = d.run(ctx);
    questions.push(...r.questions);
    coverage.push(r.coverage);
  }
  questions.sort((a, b) => a.line - b.line);

  return {
    kind: input.kind,
    lang,
    questions,
    coverage,
    partial: hasError,
    linesAnalysed: input.addedLines ? input.addedLines.size : input.source.split("\n").length,
  };
}
