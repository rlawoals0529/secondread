import type { Lang } from "../question";

/**
 * What each grammar calls the same construct.
 *
 * These names are not shared across grammars, and the differences are silent: a check written
 * against `call_expression` finds every call in TypeScript and none at all in Python, reporting
 * zero rather than failing. That is the exact shape of error this tool exists to surface, so the
 * mapping is one table read by every check rather than a string literal in each of them.
 */
type NodeNames = {
  call: string[];
  subscript: string[];
  try: string[];
  catch: string[];
  functionLike: string[];
  statementList: string[];
  loop: string[];
  /** Binary and short-circuit operators, where a `?? []` style default lives. */
  binary: string[];
};

const TS: NodeNames = {
  call: ["call_expression"],
  subscript: ["subscript_expression"],
  try: ["try_statement"],
  catch: ["catch_clause"],
  functionLike: [
    "function_declaration", "function_definition", "function_expression",
    "method_definition", "arrow_function", "generator_function_declaration",
  ],
  statementList: ["statement_block", "program", "class_body", "switch_case", "switch_default"],
  loop: ["for_statement", "for_in_statement", "for_of_statement", "while_statement", "do_statement"],
  binary: ["binary_expression"],
};

const PY: NodeNames = {
  call: ["call"],
  subscript: ["subscript"],
  try: ["try_statement"],
  catch: ["except_clause"],
  functionLike: ["function_definition", "lambda"],
  statementList: ["block", "module"],
  loop: ["for_statement", "while_statement"],
  binary: ["boolean_operator"],
};

export const names = (lang: Lang): NodeNames => (lang === "python" ? PY : TS);

/**
 * Every language this tool claims to support, so a test can assert the table covers them.
 * A language added to `Lang` without an entry here would otherwise report zero of everything.
 */
export const SUPPORTED: Lang[] = ["typescript", "tsx", "python"];
