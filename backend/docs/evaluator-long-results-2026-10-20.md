# Repeated long-conversation evaluation

Started October 19 and completed October 20, 2026. All model comparisons were initiated through **Evaluator comparison → Long conversations / Hints and revisions**, using **GPT-6.1-Sol** explicitly selected in AI settings. Every saved record identifies `gpt-6.1-sol`.

## Cases and repeat design

Six authored conversations form three unresolved/resolved pairs. Each contains **26 messages and approximately 508–569 words**. These are longer learner-style fixtures, not authentic student records or expert-rated reference examples.

| Pair | Messy history and decision boundary |
| --- | --- |
| Capacitor conditions | Initial misconception, limited hint, correct explanations of connected and isolated conditions, retraction, then reopened fixed-charge contradiction. The final turn either retains or resolves it. |
| Partial speed repair | Wrong initial average, guided calculation, correct time weighting, digression about rest stops, then a return to equal weights and a rounding excuse. The final turn either retains the invalid reasoning alongside the right number or retracts it. |
| Confounding and hints | Causal overclaim, hints, correction, a fresh plant/fertilizer analogy, then a late claim that replication removes systematic confounding. The final turn either retains or withdraws that claim. |

Every pair shares its first 25 messages and rubric. Only its final student turn differs. All rubric items remain mandatory. No extra policy metadata gives the refined branch an information advantage. Assistance is part of the history; independence is not invented as an additional passing requirement.

The pre-run manifest froze case inputs, expected judgments, three planned repeats, and hashes of the evaluator, legacy chat code, prompts, and learning-type definitions. Those hashes remained unchanged at completion. No labels were adjusted after seeing the outputs.

Three six-case folder runs produced 18 initial attempts. The first run had four comparisons with request failures in both branches, saved as `ChatGPT request failed (unknown error)`. Those failures are preserved. After local access was refreshed and the selected model reverified, the next two folder runs completed. The four failed cases were then retried individually with **Run comparison**. This gives **22 total attempts and 18 successfully scored comparisons, three per case**. The exact cause of the original provider failures was not established; no provider error is reclassified as a learner failure.

## Results and stability

| Outcome on 18 scored comparisons | Existing evaluator | Refined primary |
| --- | ---: | ---: |
| Expected pass/block decision | 18/18 | 18/18 |
| All authored criterion/completion checks matched | 18/18 | 17/18 |
| False completions | 0 | 0 |
| Expected-positive cases blocked | 0 | 0 |
| Abstentions | 0 | 0 |
| Original request-failed comparisons, reported separately | 4 | 4 |

| Case | Existing completion over successful repeats | Refined completion over successful repeats |
| --- | --- | --- |
| Capacitor unresolved | Block / block / block | Block / block / block |
| Capacitor resolved | Pass / pass / pass | Pass / pass / pass |
| Speed unresolved | Block / block / block | Block / block / block |
| Speed resolved | Pass / pass / pass | Pass / pass / pass |
| Confounding unresolved | Block / block / block | Block / block / block |
| Confounding resolved | Pass / pass / pass | Pass / pass / pass |

Both branches tracked unresolved errors despite earlier correct explanations and accepted explicit final corrections despite earlier mistakes and hints. **No pass/block advantage was measured for the refined evaluator.**

The one criterion-label mismatch was `long-capacitor-conditions-unresolved`. The frozen expectation marks the isolated-capacitor item supported while the connected-capacitor item blocks completion. The refined evaluator marked both flawed once and preserved isolated support twice. Its explanation for flagging both is defensible: the second item explicitly includes distinguishing isolated from connected conditions, and the learner retained an incompatible connected boundary condition. Thus the difference may reflect overlapping rubric scope rather than an incorrect domain judgment. It is recorded unchanged, not treated as a false block or evidence that the refined evaluator is more or less accurate. An independent human judgment would be needed to adjudicate that boundary.

This was the only criterion-status signature variation across the three successful repeats of each case. Existing criterion statuses and both branches' completion decisions were stable. Three repeats of six authored cases are correlated samples, not 18 independent learners or a calibrated reliability estimate.

## Shadow pass

Nine eligible refined primaries received shadow review. All nine reviews confirmed completion. There were no catches, missed false completions, harmful blocks, review errors, or abstentions. The unresolved cases never became eligible for review.

There were **zero primary false-completion opportunities**, so a catch rate cannot be estimated. Review agreement shows consistency on these sufficient controls, not incremental error detection. The current design also cannot rescue an erroneous primary block because it only reviews eligible primaries. These results do not justify promoting the shadow pass to a completion gate.

Across the successful comparisons, mean traced model-call durations were approximately **9.9 seconds in the existing branch**, **24.2 seconds for refined primary**, and **22.5 seconds for shadow review**. The existing branch made 33 calls, including its own second assessments and any repair attempts; refined primary made 18 and shadow made 9. These are call timings, not isolated end-to-end latency, controlled speed benchmarks, or prices. The shadow added work without a demonstrated accuracy benefit in this batch.

## Saved artifacts and verification

Archive: `backend/evaluations/evaluator-long-dev-tab-2026-10-19/` (the directory retains the original start date).

- `prospective-manifest.json`: frozen definitions, expectations, repeat count, and source hashes.
- `round-1-runs.json`, `round-2-runs.json`, `round-3-runs.json`: original folder runs, including failures.
- `all-22-attempts.json`: complete traces for all attempts, chronologically ordered.
- `successful-18-runs.json`: successful comparisons only, with failures separately retained above.
- `summary.json`: all-attempt and scored-only counts, per-case statuses, model/version metadata, and timings.

All 22 attempt records survived reload in the evaluator comparison tab, within the configured latest-40 history. The catalog now contains **70 authored cases**. Earlier displaced results remain in their separate batch archives. Cross-browser sharing remains undone as requested earlier.

Deterministic checks for the added cases: **240 tests, 236 passed, 4 explicit deferred TODOs, zero failures**. The project was stopped after the results were saved and ports 3001 and 5173 were verified closed.

The next useful evidence remains instructor-adjudicated real conversations and held-out cases. Longer authored transcripts can expose bookkeeping and consistency problems, but these fixtures still have explicit final resolutions, limited length, and no independent semantic ratings. No human examples, reference grounding, or educational-validity claims have been fabricated.
