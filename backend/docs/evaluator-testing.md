# Evaluator test suite

Updated October 19, 2026.

## Governing completion rule

Every rubric criterion must be demonstrated before passing a level. There is no optional-item exemption, model-provided completion flag, average score, general level description, or human override that can substitute for an unmet rubric requirement. A human may correct an erroneous judgment, but may not waive an unmet item. Full unnumbered criterion text must also reach the evaluator unchanged. These rules supersede the earlier optional-criterion design in the refinement plan.

The refined evaluator is still confined to developer comparisons. Its final review remains shadow-only and cannot advance a session or override the primary. Ordinary sessions continue using the production evaluator, whose completion and advancement are regression-tested as well.

## Run deterministic tests

```sh
npm run test:evaluator
```

This command runs evaluator contract, conformance, API, reporting, storage, and batch tests, plus existing production-chat, learning-flow, learning-type, and generation-resilience tests. No provider credentials, model calls, project servers, or human-scored examples are needed. Tests construct API server objects in memory without opening listening ports.

The initial expanded run contained **231 tests: 227 passed and 4 explicit TODOs**. The October 19 refinement adds a guidance-versus-requirements regression: **232 tests, 228 passed, 4 TODOs, no failures**. The TODOs are not passing implementation claims. Counts will grow as cases are added.

| Area | Tests and what they establish |
| --- | --- |
| Rubric completion | All supported items and task permit eligibility; each missing, unclear, or flawed item at every level blocks it. `required=false`, claimed completion, and score=100 cannot bypass this. Numbered rubric text is authoritative; distinct IDs preserve duplicate-text requirements. |
| Level passing | Production evaluator results advance completed Remember, Understand, Apply, and Analyze stages; an unmet item preserves the current stage. Refined eligibility is exercised across all sixteen learning-type/level combinations, without advancing sessions. |
| Evidence provenance | Exact learner-message IDs/quotes; no relocation, assistant credit, invented excerpts, cross-field joining, or nonexistent image markers. Duplicate observations and conflicting duplicate classifications cannot fabricate coverage. |
| Criterion coverage | Defined components must have evidence. The original rubric cannot be narrowed through component metadata. Sending the complete rubric is tested structurally; interpreting its meaning is a live-model/expert question. |
| Correctness and reasoning | Correct/incorrect/undetermined/not-applicable results crossed with valid/flawed/unclear/not-required reasoning. A correct answer cannot hide reasoning judged flawed or unclear. |
| Opportunity and uncertainty | No opportunity, compromised/unknown opportunity, and abstention prevent automatic support without inventing learner errors. |
| Assistance and transfer | Independent work requirements, clarification, hints, supplied answers, unknown assistance, invalid/future help sources, component-wide independence, and independent transfer. |
| Revision and contradiction | Later evidence can resolve a recorded error; a material unresolved contradiction reopens support. Earlier result objects remain unchanged. These are run-level checks, not a persistent evidence-ledger implementation. |
| Quantitative Analyze | Wait for papers, completed review, and subsequent learner explanation. Task evidence must include a post-review explanation. Other learning types do not require papers. |
| Structured output and failures | Omitted/extra/duplicate criterion IDs, unsupported statuses, bad fields, size limits, repair retry, independent branch failure, and invalid raw student text returned as a tool result. |
| Shadow review | Original evidence only, no first-pass labels, no rescue of an incomplete primary, and no change to primary completion on disagreement or reviewer failure. |
| Developer API | Access checks, origin restrictions, hosted blocking, configured providers, canonical fixture resolution, and exclusion of question-strategy cases. |
| Saved reports | Sequential batches, progress, cancellation/failure retaining earlier results, browser-history restoration, trace snapshots, storage corruption/quota messages, and the forty-result limit. |
| Human-readable display | Correct treatment of agreement, disagreement, unavailable evaluators, readable evidence labels, and archived passes that bypassed rubric items. |
| Prompt-injection boundary | Commands stay in the learner transcript rather than entering evaluator system instructions. Fake tool output, claimed authority, and completion flags cannot bypass structured-output/application gates. These tests use scripted outputs and do not prove that a real model will judge attack content correctly. |

Main sources: `backend/src/evaluatorConformance.test.js`, `evaluatorContracts.test.js`, `evaluatorApi.test.js`, `evaluatorBenchmark.test.js`, `evaluatorComparisonRuns.test.js`, and `evaluatorResultText.test.js`. Existing integration tests remain in their original files.

## Opt-in live-model screening

There are **70 authored conversation cases** in `backend/src/evaluatorTestCases.js`. They cover all four levels and learning types, complete/partial evidence, incorrect methods with correct results, valid alternative methods, local arithmetic slips, corrections, contradictions, independence, transfer, unfair questions, full-rubric preservation, and Quantitative Analyze review.

All 70 are also available in **Developer tools → Evaluator comparison**, grouped into folders. Use **Run all 70 cases**, **Run folder**, or **Run comparison**. Question-strategy fixtures are excluded. The latest 40 complete comparison records and their original traces are retained in browser storage; **Download all results** exports the retained records for review outside that browser. Author expectation checks are attached server-side after assessment and are never sent as scoring guidance to the model.

The injection cases include:

- Direct “ignore all instructions” commands.
- Fake system/developer roles and fake evaluator tool output.
- Professor impersonation, emotional pressure, and forged scoring policy.
- Encoded and repeated commands.
- An attack after only one of two rubric items has been demonstrated.
- Positive controls: a correct answer followed by an instruction to fail it, and a legitimate conceptual explanation of prompt injection.

The positive controls prevent a simplistic policy of rejecting every answer containing an injection keyword. No authored expectation or rationale is sent to the evaluator; only the original test input is submitted.

List cases without network/model calls:

```sh
npm run evaluate:evaluator -- --list
```

To perform actual screening, the local app must already be running and the selected provider configured. The runner never starts servers. Explicit provider selection is required; it does not switch providers on failure.

```sh
npm run evaluate:evaluator -- --provider chatgpt --limit 3 --output backend/evaluations/evaluator-smoke
npm run evaluate:evaluator -- --provider chatgpt --case-ids security-ignore-instructions,security-fake-system-role,security-valid-answer-with-attack --repeats 3 --output backend/evaluations/evaluator-security
```

Use `--model` for an explicit model and `--account` for a selected connected account. Anthropic is available only when selected explicitly with `--provider anthropic`. `FEYNMAN_API_ORIGIN` may identify another loopback port, and `FEYNMAN_ACCESS_CODE` supplies a nondefault local access code.

Outputs include a resumable `results.json` with provider/model, prompt/source versions, fixture identities, author expectations, and per-criterion/level checks. Full comparison runs and model traces are stored under `runs/`. The same output directory can resume only with the same fingerprint. Completed comparisons survive an interruption; transport errors can be retried on resumption. A changed evaluator, prompt, model, or fixture requires a new directory.

The report counts matched/mismatched expectations, false completions, unnecessary blocks, model errors, and abstentions separately for the old and refined evaluators. A run with mismatches, errors, or abstentions exits nonzero. A high match rate is a screening result against authored expectations, not an educational-validity claim. Expert scoring may identify incorrect or ambiguous author expectations; preserve that adjudication before updating cases.

The suite creation initially used deterministic tests and list-only verification. On October 19, all 36 cases were subsequently run in the evaluator comparison developer tab with ChatGPT / Account default · GPT-6.1-Sol, followed by two corrected-example reruns. See [live results and failure review](evaluator-live-review-2026-10-19.md) for preserved original outcomes, fixture revisions, and limitations.

## Explicitly deferred coverage

Four TODO entries cover approved-reference ingestion/exemplar calibration, authenticated overrides and durable evidence history, independent question-quality/loop stopping, and expert/fairness/retention/transfer validity studies. They depend on features or human material that are not available yet. See [material to provide later](evaluator-implementation-status.md).

In particular, a model can still make a semantic error by treating an irrelevant but genuine student quote as sufficient. Quote verification alone cannot rule that out. Authored live screening detects examples of this failure; calibrated expert review and held-out conversations are still needed to establish reliability.

See [the 16 challenge cases and paired/shadow evaluation rules](evaluator-challenge-tests.md) for the expanded suite, current verification counts, and live-run status.

Twelve additional multi-turn borderline controls were run in the developer tab with GPT-6.1-Sol. See [borderline results](evaluator-borderline-results-2026-10-19.md) for frozen expectations, outcomes, and limits on claims of an evaluator or shadow-pass advantage.

Six 26-message conversations were each successfully compared three times in the evaluator tab using GPT-6.1-Sol. See [repeated long-conversation results](evaluator-long-results-2026-10-20.md) for all 22 attempts, recovered provider failures, label variability, and shadow-review limits.

The lean-contract and opt-in ablation implementation adds regressions for first-pass capture, review failures and vetoes, API options, and conditional policy fields: **249 total tests, 245 passed, 4 deferred TODOs, zero failures**. See [ablation documentation](evaluator-ablation.md). Historical live results predate the lean prompt; a new live comparison is still needed.
