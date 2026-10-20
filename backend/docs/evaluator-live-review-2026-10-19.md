# Evaluator live-model review — October 19, 2026

## Execution and saved results

All 36 authored cases were run by clicking **Run all 36 cases** in **Developer tools → Evaluator comparison**, using ChatGPT with **Account default · GPT-6.1-Sol** verified in AI settings. Saved records label the model `Account default`; they do not independently record the provider's resolved model slug. The selected default was verified before execution. Each case compares existing and refined primaries on the same original transcript. Author expectations are checked after assessment and are not sent to the evaluators.

The tab now contains all 36 evaluator-only cases in folders, retains the latest **40** results, and supports **Download all results**. All 36 original results survived a page reload. Two corrected-example reruns were then added, giving **38 saved results**. No question-strategy fixtures were included. Original snapshots and traces are preserved, including the examples subsequently revised.

Archives in `backend/evaluations/evaluator-dev-tab-2026-10-19/`:

- `initial-36-runs.json`: complete first developer-tab batch.
- `all-38-runs.json`: original batch plus two reruns, newest first.
- `summary.json`: machine-readable counts and failing checks.

These exports also preserve the data if browser storage is cleared or a different browser is used. Results in the tab belong to the browser that ran the batch (the Codex in-app browser).

After review, all 38 saved records survived another reload. The project watcher, Vite, and backend were stopped; ports 3001 and 5173 had no remaining listeners.

## Original 36-case batch

| Outcome | Existing evaluator | Refined evaluator |
| --- | ---: | ---: |
| Matched all authored checks | 34/36 | 34/36 |
| Mismatched cases | 2 | 2 |
| False completions | 0 | 0 |
| Expected-positive cases blocked | 1 | 2 |
| Model errors / abstentions | 0 / 0 | 0 / 0 |

All 12 injection and positive-control cases matched in both branches. This includes direct ignore commands, forged roles/tool output/policy, professor impersonation, encoded/repeated instructions, emotional pressure, partial evidence followed by an attack, and legitimate answers discussing or containing attacks. This single screening run does not establish general injection resistance or educational validity.

The shadow review ran on 13 eligible refined primaries. All completed, none would block, and none changed primary completion. The other 23 were not eligible for review.

## Findings and changes

1. **Clear implementation issue, found in the earlier partial CLI run:** the refined task concatenated general learning-type help into a mandatory passing requirement. In `evaluator-correction`, this added a demand to explain a method's applicability beyond the actual rubric. The refined prompt now keeps help in a separate `learningTypeGuidance` field and explicitly prohibits turning it into extra requirements. The level framework, full rubric text, every criterion, and completion gates remain mandatory. Evaluator version is `refined-evaluator-v3`; a regression verifies guidance is context rather than part of the task. The developer-tab correction case subsequently matched and passed both primaries and shadow review. The interrupted CLI checkpoint remains separately archived under `backend/evaluations/evaluator-live-2026-10-19-initial/`; it is not counted as the 36-case UI batch.

2. **Theoretical Analyze fixture ambiguity:** both primaries asked for clarification because “increased insulation” did not specify insulation between the blocks or around an already isolated pair. The example now explicitly adds insulation to the contact layer before equilibrium while preserving external isolation. Its rubric and positive expectation are unchanged. Both evaluators and the shadow review accepted the clarified example on rerun.

3. **Experimental Analyze positive fixture was incomplete for its level task:** the refined primary supported the stated causal-analysis rubric but correctly noted that the broader Analyze task had no actual theoretical comparison or discrepancy analysis. The example now supplies simulated readings and a same-bulb prediction; its authored learner response compares the readings, identifies the discrepancy relative to uncertainty, separates a possible explanation from evidence, and proposes a controlled comparison. Its rubric, task framework, and positive expectation are unchanged. Both evaluators and shadow review accepted the completed example on rerun. The original block is retained rather than relabeled as an implementation failure.

4. **Remaining existing-evaluator status mismatch:** `rubric-full-text-not-waived` correctly blocked completion in both branches. The existing evaluator labeled the checklist item `unclear` because the full rubric also demands a work explanation; the refined evaluator supported the narrower location item and blocked the full level task. The authored check expects the location item to be `supported`. No passing or rubric-gating defect was demonstrated. No production scoring change or expectation relaxation was made for this harmless allocation of the missing requirement.

The two revised fixtures were rerun individually using **Run comparison** in the same tab: **2/2 matched in both branches**, with no errors, abstentions, false completions, or shadow disagreements. Suite version is now `evaluator-conformance-2026-10-19-v2`. These are revised-example reruns, not a second complete 36-case batch; the original results above remain the baseline.

## Verification and deferred work

`npm run test:evaluator`: **232 tests, 228 passed, 4 explicit TODOs, no failures**. The added regression accounts for the increase from the previously summarized 227 passes. Frontend build and targeted evaluator frontend lint passed. The full lint command scans generated `node_modules/.vite` dependency code and fails there; that unrelated generated-code issue was not changed.

No human-rated examples were fabricated. Professor-scored complete conversations, approved references, borderline/adjudicated examples, independent ratings, held-out calibration, and release tolerances remain deferred in [implementation status](evaluator-implementation-status.md). The refined evaluator remains developer-only, and the experimental review remains shadow-only. Every rubric item must still be demonstrated before passing.
