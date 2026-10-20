# Borderline evaluator screening — October 19, 2026

## Added cases and execution

Added **12 multi-turn cases in six sufficient/subtle-error pairs** to **Evaluator comparison → Borderline / Multi-turn reasoning**. Total catalog: **64 cases**. These are newly authored learner-style conversations, not real student records or professor-scored reference cases.

Each pair has the same rubric, question, initial student answer, and follow-up. Only the final student answer differs. The negative cases retain a consequential error alongside correct terminology or intermediate calculations; controls resolve it. No extra independence/transfer policy metadata is supplied, and no earlier evaluator judgment is shown to the shadow reviewer. The same mandatory rubric applies to both branches.

All 12 ran by clicking **Run folder (12 cases)** in the evaluator comparison tab, with **GPT-6.1-Sol** explicitly selected in AI settings. Every exported result records `gpt-6.1-sol`. Expectations and source hashes were saved to `prospective-manifest.json` before any model calls. The cases, prompts, evaluator sources, and expected outcomes were not revised during execution.

## Outcomes

| Measure | Existing evaluator | Refined primary |
| --- | ---: | ---: |
| All authored criterion/completion checks matched | 12/12 | 12/12 |
| False completions | 0 | 0 |
| Expected-positive cases blocked | 0 | 0 |
| Final assessment errors / abstentions | 0 / 0 | 0 / 0 |
| Cases where only this branch matched | 0 | 0 |

| Pair | Error tested | Existing / refined |
| --- | --- | --- |
| Capacitor boundary | Uses fixed charge despite a connected constant-voltage battery | Both reject error and accept sufficient answer |
| Partial speed correction | Corrects the answer but retains inconsistent equal-speed weighting | Both reject error and accept genuine correction |
| Conditional probability | Starts with sound p-value intuition, then assigns posterior probabilities to hypotheses | Both reject error and accept correct conditioning |
| Aggregate confounding | Calculates subgroup rates correctly, then reverses their causal implication | Both reject error and accept bounded interpretation |
| Quantifier/counterexample | Excludes a valid counterexample because it violates the desired conclusion | Both reject error and accept correct logical explanation |
| Worst-case design | Calculates the error interval correctly, then substitutes expected value for a hard guarantee | Both reject error and accept safe non-certification |

Both branches explicitly identified the intended error mechanisms. In the partial speed correction, both retained that the final numerical answer was correct while rejecting the method. No refined-primary citation-validation issues were recorded. This batch showed **no criterion-status or completion-accuracy advantage** for the refined evaluator on the authored checks. Richer evidence fields remain an implementation feature, not demonstrated accuracy improvement.

## Shadow review

- Six reviews ran on the six eligible refined primaries.
- All six confirmed the sufficient responses.
- No criterion/blocker disagreements, harmful blocks, errors, or abstentions were observed.
- No false completions occurred in the primary, so there were **zero catch opportunities**. Catch rate is not estimable.
- The six negative cases were blocked before review and were not reviewed. The design cannot rescue primary false negatives.

The six shadow calls averaged approximately **14.3 seconds** each. This is traced model-call duration, not an isolated total-latency or price measurement. The existing branch used 19 calls, including its own second assessments; refined primary used 12 and experimental shadow used 6. The additional existing assessment on the partial-correction negative case rechecked the method despite a correct final result and agreed it was flawed. It was not a transport failure or a shadow catch. No traced provider errors were recorded.

This run shows neither incremental catches nor harm from shadow review. Agreement does not establish that the extra review is useful, and six successful confirmations do not establish safety on unseen conversations. **Keep it in shadow mode.**

## Interpretation and next evidence

Across these 12 cases and the previous 16 challenge cases, both branches made every authored pass/block decision correctly. The previous challenge batch had one status-label difference, not a completion improvement. These two batches therefore do not support claiming a real completion advantage for the refined primary or shadow review.

The cases contain realistic error patterns, but remain short, cleanly contrasted, and authored by the implementation workflow. Their semantic expectations have not been independently adjudicated. More author-generated traps alone may not distinguish strong models. De-identified instructor-rated conversations with incomplete, ambiguous, assisted, and changing explanations remain the deferred evidence needed to assess actual thresholds. Do not weaken rubrics, alter labels after observing outcomes, or inject artificial primary mistakes to manufacture a shadow benefit.

## Saved records and verification

All 12 runs are readable in the evaluator comparison tab. After a reload, the tab retained **40 results including all 12 new borderline runs**, respecting its configured history cap. Earlier full batches remain in their separate project archives.

Archive: `backend/evaluations/evaluator-borderline-dev-tab-2026-10-19/`

- `prospective-manifest.json`: frozen case inputs, expectations, suite version, and source hashes.
- `runs.json`: all 12 complete comparisons and raw model traces.
- `summary.json`: branch, paired, shadow, timing, and per-case diagnostics.

The prior localhost IPv4 fix worked without further connection changes. Deterministic tests: **239 total, 235 passed, 4 explicit TODOs, zero failures**. The project was stopped after the batch, and ports 3001 and 5173 were verified to have no listeners.
