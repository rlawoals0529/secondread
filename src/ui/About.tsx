export function About() {
  return (
    <div className="stack prose">
      <h2>What this is</h2>
      <p>
        Six checks over a real syntax tree. Each one names a construct, states the question a
        reviewer has to answer about it, and says what it would have needed in order to answer
        that itself.
      </p>
      <p>
        It will not grade your code, and it is not trying to. Working from one pasted fragment
        means it cannot see the callers, the data, or whether the tests pass, and most of the
        questions worth asking need at least one of those.
      </p>

      <h3>Why a parser and not a regular expression</h3>
      <p>
        The cautionary tale this tool is built around is a cap detector written as{" "}
        <code>\[: *[A-Z_]*MAX</code>. It requires an uppercase letter directly after the colon, so
        it matched <code>[:MAX_ROWS]</code>, missed every <code>[:_constants.MAX_ROWS]</code>, and
        reported one hit where the answer was four. A tool whose whole argument is{" "}
        <em>check what your detector actually read</em> cannot itself be a pile of patterns.
      </p>
      <p>
        That leaves one problem: a pasted hunk is never a valid program. It opens with the tail of
        one function and closes inside the next. So the parser is tree-sitter, which recovers
        rather than refusing, and that was measured before anything else was built.
      </p>
      <table className="mini">
        <caption>One clean function, wrapped the four ways a real paste arrives damaged</caption>
        <tbody>
          <tr><th scope="row">nothing</th><td>the baseline</td></tr>
          <tr><th scope="row">a leading dangling brace</th><td>identical</td></tr>
          <tr><th scope="row">a trailing dangling brace</th><td>identical</td></tr>
          <tr><th scope="row">both, and a tail cut mid-expression</th><td>identical</td></tr>
        </tbody>
      </table>
      <p>
        Recovery is local: the damage does not reduce what the rest of the tree yields. The trap
        that came with it is that <code>hasError</code> is true on essentially every real paste, so
        using it to reject input would refuse everything anyone actually pastes. It is reported as{" "}
        <em>parsed with gaps</em> and never used as a gate.
      </p>

      <h3>Privacy</h3>
      <p>
        Your code never leaves the page. The only thing fetched is the grammar itself, from this
        origin, once. The page carries <code>connect-src 'self'</code>, so the browser refuses a
        request to anywhere else, including from code nobody here wrote.
      </p>
      <p>
        That is weaker than forbidding the network outright, and worth saying plainly: this page
        has to reach its own origin to load a 1.4MB grammar, so it cannot use{" "}
        <code>connect-src 'none'</code>. The browser suite has a test that fails if any request
        leaves the origin while code is being read.
      </p>

      <h3>A limit worth knowing</h3>
      <p>
        Duplication numbers identifiers by where they first appear <em>inside</em> the matched
        window, which is what lets it match a copy whose variables were renamed on the way. The
        cost is that two blocks differing only in a value bound on a line above the match look
        identical to it. The finding says so rather than hiding it.
      </p>
    </div>
  );
}
