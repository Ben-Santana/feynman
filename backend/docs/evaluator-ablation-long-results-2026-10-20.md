# Four-way ablation: long conversations, 20 October 2026

Ran the six **Long conversations / Hints and revisions** fixtures three times through the evaluator comparison developer tab, using ChatGPT **GPT-6.1-Sol** and explicit four-way ablation mode. All 18 comparisons completed without errors or abstentions. All 18 are saved in the browser's latest-40 history, with complete copies in the project archive.

## Accuracy and consistency

| Variant | All authored checks matched | Correct completion decisions | Mean call time | Median call time | Range |
| --- | --- | --- | --- | --- | --- |
| Existing first pass | 18/18 | 18/18 | 9.8 s | 9.8 s | 8.3–11.6 s |
| Existing confirmed result | 18/18 | 18/18 | 17.3 s | 18.4 s | 10.1–22.4 s |
| Lean refined primary | 18/18 | 18/18 | 16.7 s | 16.0 s | 11.9–22.7 s |
| Refined plus shadow | 18/18 | 18/18 | 24.2 s | 23.1 s | 15.9–33.1 s |

Every variant correctly blocked the nine unresolved examples and passed the nine resolved examples. There were no false completions or unnecessary blocks. Completion decisions, normalized criterion status labels, and task status labels were identical across the three repeats of every case for every variant. This does not claim identical rationale wording or quoted evidence.

The six fixtures comprise capacitor boundary conditions, average speed with partial repairs, and confounding versus replication, each with an unresolved/resolved pair. Each conversation contains 26 messages, including hints, earlier correct reasoning, partial corrections and later contradictions. Criterion checks permit the authored alternatives, such as flawed or unclear where specified; exact labels were also analyzed separately for consistency.

## What the extra passes contributed

The existing evaluator made 14 confirmation calls across 18 comparisons, adding an average **9.6 s when invoked**, or **7.5 s averaged over all comparisons**. Confirmation corrected no completion decisions and introduced no incorrect blocks.

Shadow reviewed the nine eligible refined primaries and confirmed all nine. It introduced no incorrect blocks and caught no mistakes. There were **zero false-completion opportunities**, so these runs cannot estimate its ability to catch false passes. Shadow added **15.0 s per reviewed example**, or **7.5 s averaged over all comparisons**, raising the refined mean by about **45%**.

Lean refined was about **0.6 s (3.6%) faster** than the existing confirmed result in this batch, with equal accuracy. It was about **6.9 s (70%) slower** than the existing first pass. This small observed advantage over confirmation is not evidence of a reliable speed improvement.

## Interpretation

These runs support retaining deterministic rubric and evidence safeguards and keeping shadow opt-in. Neither a confirmation call nor shadow review demonstrated an accuracy benefit here. The existing first pass had the best observed speed with the same outcomes, but this small set does not justify removing all review logic without broader testing.

The next useful evaluation is a held-out, human-rated set containing genuine first-pass false completions, plus cases that specifically exercise multi-component criteria, independence, transfer, evidence provenance and malformed outputs. These six fixtures contain no extra policy-sensitive criterion metadata, so they do not measure the refined evaluator's advantage on those features. Human examples and adjudication remain deferred for the user to supply.

## Measurement limits and reproducibility

- These are **six authored fixtures repeated three times**, not 18 independent student conversations or expert-scored educational validity evidence.
- Accuracy means agreement with frozen authored expectations. It does not establish learning gains, fairness or generalization.
- Times sum recorded model-call durations, including any additional stage. The dev tool runs the two primary branches concurrently and reuses first-pass calls across columns. These are not four independent end-to-end application latency measurements.
- Calls totaled 32 existing-evaluator calls, 18 refined-primary calls and nine shadow calls: **59 live model calls**. No errors required reruns.
- All model records identify `gpt-6.1-sol`, `lean-v1`, and `refined-evaluator-v4-lean`. Prompt versions were constant. All nine source hashes captured before the experiment remained unchanged afterward.

Archive: [manifest and frozen expectations](../evaluations/evaluator-ablation-long-2026-10-20/manifest.json), [all 18 runs](../evaluations/evaluator-ablation-long-2026-10-20/all-runs.json), [computed summary](../evaluations/evaluator-ablation-long-2026-10-20/summary.json), and [reproducible analysis](../evaluations/evaluator-ablation-long-2026-10-20/analyze.mjs). Individual round archives preserve the three six-case batches.
