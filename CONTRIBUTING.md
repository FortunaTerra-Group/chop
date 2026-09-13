# Contributing

The standard is deliberately short. A proposed change to a rule needs one thing: a concrete failure the current wording lets through, stated as a scenario (state, actors, sequence, wrong outcome). Style improvements that do not change what a rule catches are welcome as plain PRs.

Do not add tooling, hooks, or enforcement scripts here. This repository is the standard; enforcement is whatever your organization builds around it. The one exception is `example/`: real, runnable violation-and-fix pairs that demonstrate a rule, each with its own `RUN-*.md` showing actual executed output. An example illustrates a rule; it does not enforce one. It proves what a rule catches without telling your organization how to catch it.
