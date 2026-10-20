# Lean evaluator and opt-in ablation

Implemented October 20, 2026. New comparisons use `refined-evaluator-v4-lean`; archived results keep their original judgments, schemas and prompt versions. This is a developer-only change. Ordinary learning sessions still use the existing evaluator and its existing confirmation policy.

## Controls

In **Developer tools → Evaluator comparison**:

- **Comparison — shadow off by default:** existing confirmed result versus lean refined primary. No experimental review call is made unless **Run experimental shadow review** is checked.
- **Four-way ablation — includes shadow review:** explicitly opts into the review and shows the four variants below. Works for individual, folder and all-case runs.

The case conversations remain read-only. Completed records retain their selected options, all variants and traces in the existing latest-40 browser history. Nothing advances a learning session. No cross-browser archive import was restored.

## Four variants

| Variant | Meaning |
| --- | --- |
| Existing first pass | The normalized first assessment from the actual existing-evaluator call, captured before its confirmation policy. |
| Existing confirmed result | The existing result after its unchanged confirmation/reconciliation policy. When confirmation is unnecessary, this reuses the first result. |
| Lean refined primary | Concise structured assessment passed through the existing deterministic evidence validator and completion rules. |
| Refined plus shadow | Hypothetical conservative policy combining that exact primary with an independent review veto. It cannot rescue an incomplete primary or advance a session. |

First passes are reused, not regenerated for each variant. The review receives original material and no earlier labels. It runs only if the refined primary is eligible. If review fails, the reviewed variant is unavailable, not labeled a confirmed pass. If confirmation fails, the existing first pass remains inspectable while the confirmed variant is unavailable. If a primary is incomplete, the reviewed variant remains incomplete without a new call.

The usual primary and `shadow` records remain observational. The hypothetical veto is stored separately under `ablation.variants.refinedWithShadow`; it never mutates either primary. A review cannot override an unmet rubric requirement.

## Concise contract

All definitions still require status, result correctness, reasoning validity, opportunity, a concise rationale, abstention reason, exact learner citations, and unresolved contradiction citations. These fields feed the existing completion gates. No model completion flag is trusted.

Per-quote relevance prose is no longer requested. For a single-component requirement, the component ID is supplied deterministically rather than repeatedly generated. For multi-component definitions, the model must still identify covered component IDs. Detailed assistance/check fields are requested only for explicit independence requirements; transfer/check fields only for explicit transfer requirements. Missing required policy fields remain invalid output. Omitted optional policy fields never imply independence, transfer, or unassisted work.

The adapter sends concise judgments through the same validator: exact original learner-message quotes, duplicate/conflicting evidence, component coverage, explicit independent/transfer evidence, correctness and reasoning, opportunity, abstention, unresolved contradictions, and post-review explanation timing remain enforced. Every rubric item and the genuine level task remain mandatory, including full unnumbered rubric text. Generic learning guidance remains context rather than an invented extra passing requirement.

The UI distinguishes assistance not requested by the lean schema from genuinely uncertain assistance in a detailed policy judgment. It does not show a fabricated per-quote explanation. Full original request/response traces remain available for audit.

## API and CLI

Local, access-gated endpoint: `POST /api/developer/evaluator-comparison`.

```json
{ "caseId": "evaluator-recall", "mode": "comparison", "shadow": false }
```

Omitting both controls selects that default. `shadow: true` opts into observational review. `mode: "ablation"` explicitly opts into all four variants, including review. Unknown modes and non-boolean shadow options return HTTP 400 before model calls. Controls are stripped before ordinary transcript validation and are not sent to either model as curriculum data. The ordinary chat API continues rejecting assessment modes.

The optional CLI accepts the same choices:

```sh
npm run evaluate:evaluator -- --provider chatgpt --model gpt-6.1-sol --mode ablation --limit 3
npm run evaluate:evaluator -- --provider chatgpt --model gpt-6.1-sol --shadow --limit 3
```

Runner fingerprints include these options and the lean contract source; do not resume a pre-change directory as if it were the same evaluation.

## Reports and interpretation

The ablation UI displays per-variant completion, authored checks, criterion/task statuses, rationale/evidence, total summed model-call time and additional-stage time. Failure and not-needed states are explicit. Results reuse calls, so the four columns are not independent samples or an end-to-end speed benchmark.

`screenEvaluatorComparison` scores all four variants against the same external authored expectations; expectations are not model input. `summarizeEvaluatorComparisons` adds per-variant match/error/abstention, false-completion and unnecessary-block counts, mean summed-call time, and confirmation/shadow effects. Effects count corrected false completions and introduced false blocks separately and exclude unavailable outcomes from the paired denominator. Existing branch/shadow reports remain compatible with archived runs without ablation data.

These are reporting and contract changes, not a claim of improved live-model accuracy or latency. A new live ablation needs its own results; historical full-schema comparisons do not validate this lean prompt. Expert-rated held-out conversations remain deferred.

## Verification

Deterministic regressions cover default-off review, explicit API opt-in, malformed options, exact shared first passes, confirmation/review failures, veto-only combination, no rescue of incomplete primaries, blind material, lean policy fields, and preservation of every completion/evidence gate. Synthetic review mistakes exercise report counters; they are not presented as live model catches.

Verified: **249 tests, 245 passed, 4 deferred TODOs, no failures**; frontend build and targeted evaluator lint passed. Browser inspection confirmed the unchecked default review control and explicit four-way mode. No live-model ablation calls were made during implementation.

Subsequent live evaluation: [three repeats of the six long conversation cases using GPT-6.1-Sol](evaluator-ablation-long-results-2026-10-20.md), run through the developer tab on 20 October 2026.
