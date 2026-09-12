/**
 * The one thing every check emits.
 *
 * Not a finding, and the difference is the whole point of this tool. A finding asserts that
 * something is wrong; every check here works from a single pasted fragment, with no callers, no
 * data, no test run and no contract, and none of those questions can be answered from that.
 *
 * So a check names the construct, states the question a reviewer has to answer about it, and
 * says what it would need in order to answer that itself. `cannotSee` is required rather than
 * optional, because a check that believes it can see everything is the one that reports a clean
 * sweep of a list it barely read.
 */
export type Question = {
  /** Which detector raised it. Matches a `Detector.id`. */
  check: string;
  /** 1-based, and in the coordinates of what the user pasted. */
  line: number;
  /** The source text of the construct itself, trimmed for display. */
  construct: string;
  /** What a reviewer has to answer. Always a question. */
  ask: string;
  /** What this tool would need in order to answer it, and does not have. */
  cannotSee: string;
};

/**
 * What a detector considered, not only what it flagged.
 *
 * The counts are the honest half of the output. A detector that flags one sort key out of
 * thirteen is saying something quite different from one that flags one out of one, and a
 * detector reporting zero is saying nothing at all until you know whether it looked at zero
 * constructs or at four hundred.
 *
 * This exists because of a specific failure: a caps pattern written as `\[: *[A-Z_]*MAX` found
 * one hit where the answer was four, and reported a clean sweep. It was caught only by comparing
 * its count against a number already known. Every detector here publishes both numbers so the
 * same comparison is possible without reading the source.
 */
export type Coverage = {
  check: string;
  /** Human name of the construct class this detector walks. */
  considers: string;
  /** How many of that construct the detector found in the input. */
  found: number;
  /** How many of those became questions. */
  flagged: number;
  /** Every construct considered, so a reader can check the detector's reach directly. */
  sites: { line: number; text: string; flagged: boolean }[];
};

export type Detector = {
  id: string;
  title: string;
  /** One line, shown under the heading. Says what it looks at. */
  blurb: string;
  run(ctx: AnalysisContext): { questions: Question[]; coverage: Coverage };
};

export type Lang = "typescript" | "tsx" | "python";

export type AnalysisContext = {
  /** The source actually parsed: for a diff, the added lines reassembled. */
  source: string;
  lang: Lang;
  /** Tree-sitter root node. Typed loosely to keep the checks free of the binding's types. */
  root: SyntaxNode;
  /**
   * Lines that the diff added, 1-based, in `source` coordinates. `null` when the input was a
   * whole file rather than a diff, which means every line counts.
   */
  addedLines: Set<number> | null;
  /** Maps a line in `source` back to the line the user sees in the textarea. */
  displayLine(line: number): number;
};

/** The shape this code needs from web-tree-sitter, named so the checks do not import it. */
export type SyntaxNode = {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  startIndex: number;
  endIndex: number;
  children: SyntaxNode[];
  namedChildren: SyntaxNode[];
  parent: SyntaxNode | null;
  childForFieldName(name: string): SyntaxNode | null;
  isMissing: boolean;
  hasError: boolean;
};
