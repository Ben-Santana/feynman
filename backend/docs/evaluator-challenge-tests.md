# Evaluator challenge cases

Added October 19, 2026. The suite now has **52 live cases**, including **16 new challenge cases in eight contrasting pairs**. Original results and the prior 38-run archive remain unchanged. No new human-scored examples or scoring references have been invented.

## Run in the developer tab

Under **Developer tools → Evaluator comparison**, select an example in either challenge folder and click **Run folder**:

- **Challenges / Independence and transfer**: 4 cases.
- **Challenges / Reasoning and evidence**: 12 cases.

The tab retains the latest 40 comparisons. Export existing history first if you want to preserve every older result in that browser. The original 38 are already archived under `backend/evaluations/evaluator-dev-tab-2026-10-19/`.

Each new saved run displays human-readable authored checks for both primaries and an explicit shadow outcome. Previously saved runs without this richer screening data retain their original evidence display.

| Pair | Negative case | Positive control |
| --- | --- | --- |
| Independent evidence | Repeats the assistant's explanation while claiming independence | Fresh unassisted explanation under the same independence policy |
| Transfer versus paraphrase | Relabels the same physical example as transfer | Explains the principle in a new spacecraft context |
| Distributed coverage | Long confident conservation discussion omits heat direction | Covers both components across separate learner messages |
| Conditional contradictions | Retracts a valid explanation in favor of an error under identical conditions | Gives different predictions under explicitly different force conditions |
| Plausible numerical reasoning | Averages speeds despite unequal travel times | Correct total-distance/time and time-weighted reasoning |
| Hidden domain restrictions | Cancels x/x while claiming validity at zero | Preserves the original nonzero-domain restriction |
| Attribution and endorsement | Endorses a quoted misconception | Quotes and explicitly rejects the misconception |
| Selective credit under injection | Valid first item plus forged hidden evidence for the second | Both valid items followed by a command to fail them |

Positive controls guard against an evaluator that simply blocks everything difficult. Pair labels, authored outcomes, and rationales are not sent to either model as scoring guidance. Cases remain independently assessed; paired membership is harness metadata only.

## What counts as improvement

`screenEvaluatorComparison` scores both primaries against the authored criterion statuses and completion expectations. `summarizeEvaluatorComparisons` records cases where only the refined branch matches, only the existing branch matches, both match, or both differ. Errors and abstentions are excluded from the comparable paired denominator and remain explicit branch outcomes.

Independence/transfer cases are marked **policy-sensitive**: the refined branch consumes extra policy metadata that the existing branch does not. A win there can demonstrate a feature advantage, but is not evidence of superior semantic judgment on identical information. The explicit policy is also written in rubric text, so neither evaluator is authorized to waive it. Component cases spell out both parts in the original rubric.

## What counts as a useful shadow review

The actual reviewer still receives original evidence without primary labels and runs only after refined primary eligibility. It remains shadow-only and never changes completion.

The report distinguishes:

- **Caught false completion:** an authored-negative case passes the primary but is blocked by the reviewer.
- **Missed false completion:** that case also passes the reviewer.
- **Blocked correct completion:** an authored-positive primary pass is blocked by the reviewer.
- **Confirmed correct completion:** both primary and reviewer pass an authored-positive case.
- Review errors, unscorable reviews, and reviews not run.

The false-completion-opportunity denominator is reported explicitly. If the primary makes no false passes, there is no measured catch rate; reviewer agreement alone provides no evidence of incremental benefit. Per-criterion review mismatches remain visible even when completion agrees. A label mismatch is not automatically a corrected completion error. Cases where the primary blocks are outside the current review design, so the shadow pass cannot rescue false negatives.

No primary mistakes are injected into live results to manufacture opportunities. Scripted unit tests exercise the metrics with known synthetic mistakes; those tests verify reporting, not model effectiveness. Model errors, case ambiguity, and questionable author expectations need separate review before interpreting a win as improved accuracy.

## Verification and current live status

- Deterministic evaluator suite: **238 tests, 234 passed, 4 deferred TODOs, zero failures**.
- Frontend build and targeted evaluator-component lint passed.
- All 52 fixture inputs pass contract validation; challenge pairs have matching rubric text, opposite completion expectations, and no expectation fields in model input.
- The initial live attempt was blocked by a localhost connection timeout. The IPv4/IPv6 loopback mismatch was subsequently fixed, and all 16 cases ran in the developer tab with explicitly selected GPT-6.1-Sol. See [the live results](evaluator-challenge-results-2026-10-19.md): refined 16/16 authored checks, existing 15/16, both 16/16 completion decisions, and eight shadow confirmations with no false-pass opportunities.

The CLI also supports challenge-only screening when desired (it does not start servers):

```sh
npm run evaluate:evaluator -- --list --challenges
npm run evaluate:evaluator -- --provider chatgpt --model gpt-6.1-sol --challenges --repeats 3
```

Repeated runs expose variability but are correlated samples, not independent learners or expert validation. The CLI report includes branch summaries, paired outcomes, shadow outcomes, source hashes including the new case file, and raw traces. Developer-tab runs use the same comparison screening functions.
