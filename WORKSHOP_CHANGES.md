# Chat Workshop reliability and assessment improvements

## Changes

- Save browser-local workshop tests by account and test ID in an IndexedDB transaction. Migrate legacy arrays and refresh other tabs on save. Concurrent edits to the same ID remain last-save-wins.
- Keep weak Quantitative Analyze reviews open. Support revising the latest paper review and explicitly finishing an assessment. Label report percentages as rubric mastery. Require explicit grade selection before stamping papers.
- Focus follow-ups on one immediate objective, prioritizing cited contradictions. Change the probe after unsuccessful attempts. Question quality still depends on the model.
- Preserve labeled assistance in saved conversations. The prerequisite-review and independent-check request buttons were removed from the learning chat and Chat Workshop at the user's request. Automatic independent-evidence and transfer requirements remain for ordinary Apply and Analyze completion.
- Render simulated measurements and candidate properties as safe semantic tables. Improve prediction staging, scenario assumptions, and supplied Design Apply candidates. Numerical-consistency work was deferred; no domain-specific circuit generator is included.
- Remove ordinary strategy-planning overhead, cache successful evaluations for exact scoped retries, and deduplicate evaluator quotes through shared evidence IDs. Preserve citation, reasoning, opportunity, contradiction, independence, and transfer validation.
- Deduplicate React runtimes in Vite to fix fresh development startup.

## Verification

Eight original type/level reruns completed and were saved locally. Subsequent focused runs verified revision, help, independent transfer, neutral grading, and shared evidence. Larger browser transcripts and screenshots remain local in `output/`.

The final evaluator-focused regression run passed 41 tests:

```sh
node --test backend/src/evaluatorPrimary.test.js backend/src/workshopImprovements.test.js backend/src/evaluatorContracts.test.js backend/src/conversationRefinement.test.js
```

Earlier targeted checks also covered stale-tab persistence, migration, table rendering, and paper-deck behavior. The production build passes. Lint retains the existing `ChatComposer.tsx` set-state-in-effect warning. The full suite previously reported 523 passing, one failing, and four todo tests; the failure is a Windows POSIX file-mode assertion in `chatgpt.test.js`, outside these changes.

One sequential before/after evaluator pair used the same frozen transcript, connected account, and `gpt-6.1-sol` model. Each version used one call and passed the same completion gates:

| Metric | Before | After |
|---|---:|---:|
| Evaluator time | 33.829 s | 29.907 s |
| Response bytes | 3,735 | 3,310 |
| Request bytes | 16,457 | 17,022 |

This single pair is exploratory, not a guaranteed speedup. A separate live Analyze evaluation still took 40.2 seconds. Provider latency, long transcripts, and unique evidence remain bottlenecks. No faster model, reduced reasoning setting, incremental assessment reuse, or streaming was introduced.

## Reproduce the latency pair

With exactly one existing connected ChatGPT account:

```sh
node scripts/benchmark-workshop-latency.mjs
```

This makes two real model calls using the non-secret fixture in `backend/fixtures/workshop-latency-before.json`. Credentials stay in the existing runtime; results are written to `output/workshop-latency-comparison.json`.
