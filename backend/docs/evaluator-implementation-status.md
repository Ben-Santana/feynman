# Evaluator implementation status

Updated October 20, 2026. First implementation slice of [the research-refined plan](evaluator-refinement-plan.md).

## Other chat's changes

Reviewed **Refine concept inventory strategies**, the working-tree diff, strategy catalog, and tests before editing shared files. That work expanded the catalog from seven to eighteen strategies, added strategy/level fixtures and model-review reports, restricted strategies by learning level, and added question-integrity checks against solution scaffolding and leading phrasing. Its question-comparison/review API and UI are preserved. Those model reviews are not human validation of this evaluator.

## Current simplification

New developer comparisons use the lean v4 contract, experimental review is opt-in, and four-way ablation reuses the actual first passes. See [ablation behavior and verification](evaluator-ablation.md). Existing historical results below describe the earlier full-schema implementation; saved records are preserved. Ordinary sessions retain the existing evaluator and confirmation policy.

## Implemented now

- Versioned contracts in `backend/src/evaluatorContracts.js`: stable criterion/message IDs, mandatory rubric criteria (legacy optional flags cannot waive items), defined components, opportunity, evidence status, reasoning/result separation, assistance, contradictions, abstention, and independence/transfer requirements. Developer-provided metadata is experimental configuration, not instructor approval.
- Exact learner citations must match the stated message ID and one original learner field. Assistant citations, invented or joined-field excerpts, and unsupported image markers cannot establish support. This path does not relocate quotes to another message. Image-marker validation verifies source presence; interpretation remains a model judgment.
- Application-owned completion eligibility for required criteria and the explicit level task. Support requires valid evidence covering defined components, a fair opportunity, acceptable result/reasoning judgments, and no abstention or unresolved material contradiction. Explicit independence/transfer checks require matching observations; when both are required, independent transfer evidence is necessary. Every rubric criterion must be met; any unmet item blocks completion, regardless of legacy optional metadata. Model completion flags are ignored.
- Stable observation IDs and duplicate handling. Conflicting duplicate classifications block support. Run records can be downloaded; a persistent cross-session evidence ledger is not implemented.
- Quantitative Analyze waits for the latest paper review and a subsequent learner explanation. Its refined level task cannot pass solely on pre-review citations. Other stages use the supplied current-stage transcript.
- `evaluateLegacy()` extracts the existing invocation from `chat.js` without changing prompts, quote repair, second-check triggers, reconciliation, or session completion. The other chat's question-integrity checks remain intact.
- `backend/src/evaluatorComparison.js` runs legacy and refined primaries on the same conversation, preserves partial successes, validation issues, call traces, model/provider, saved-prompt version, refined-prompt hash, and run ID. It generates no classmate questions.
- A fresh blind review receives original evidence without primary labels. It runs only after refined primary eligibility and remains **shadow only**. Its hypothetical blockers, differences, and errors cannot modify primary eligibility or advance a session. No third semantic audit call is enabled.
- Local-only, access-protected GET/POST `/api/developer/evaluator-comparison`, with existing provider selection, cancellation, input validation, and hosted restrictions.
- Separate **Developer tools → Evaluator comparison** tab: evaluator-only samples in folders, read-only fixed conversation details shared with the Question strategies tab, side-by-side judgments/evidence, completion blockers, shadow findings, raw traces, and run download. Question strategies remains a separate tab.
- **Run comparison**, **Run folder**, and **Run all** execute fixed cases sequentially with per-case progress and cancellation. Completed runs are retained if a later request fails or is cancelled. The latest 40 comparisons, including original fixture snapshots and full traces, are saved in this browser and can be expanded or downloaded individually or together later. Storage failures are reported; in-memory results remain available for download. Clear results removes this evaluator history separately from question-strategy history.

## Try the comparison

Run the app normally, open Developer tools, and select **Evaluator comparison**. The example picker uses the same folder grouping as Question strategies. Choose an example to view its folder, concepts, learning level, rubric items, and Feynman/student transcript in the same Fixed conversation display as Question strategies. Evaluator requirements, submitted papers, and review selections are also available as read-only details. Runs submit the selected case ID so the server uses the canonical fixture; no input fields or scoring settings are editable in this tab. Use a configured language model; the fruit-fly simulation is not an evaluator. Existing evaluation uses saved prompts. Refined instructions are versioned in source; unsaved prompt-editor changes are excluded.

Choose **Run folder** for the selected example's folder or **Run all** for all 36 evaluator cases. Saved comparisons appear below the fixed conversation with their case title, folder, and timestamp. They survive reloads in the same browser. Human-material dependencies remain documented below; their dropdown has been removed from the tab.

Each saved result starts with a plain-language completion summary and a side-by-side rubric table. Detailed findings use readable status labels, quote the student's evidence with one-based message numbers and assistance descriptions, and explain remaining requirements in sentences. Criterion components are shown by their text rather than internal IDs. The final review is labeled observational, with a readable outcome; raw codes, versions, and complete traces remain in the collapsed Technical details section and JSON download. This presentation also applies to previously saved runs without changing their judgments.

The evaluator fixtures are authored smoke tests, not human-scored examples or benchmarks. No scoring anchors are supplied to the models. A run typically makes one or two legacy calls, one refined primary call, and, if eligible, one blind review. Malformed output can cause one repair retry per assessment. Neither branch changes learner progress.

The eleven evaluator samples are grouped into **Coverage and completion**, **Reasoning and revisions**, **Assistance and opportunity**, **Assessment integrity**, and **Paper review**. Each has a short description of what to inspect. Explicit independence/transfer/component metadata stays attached to the fixed fixture. These authored samples are not expert judgments, and their descriptions are not passed as evaluator scoring instructions. Question-strategy fixtures are excluded from both the evaluator dropdown and its case-ID API; they remain in the Question strategies tab.

The tab submits only the fixed case ID; no JSON or plain-text editor is provided. For direct API clients, requests use `topic`, `level`, `learningType`, `aspects`, and alternating assistant/user `messages` ending with a learner response. Numbered `criterion` text remains authoritative when supplied. Only submit the active stage except Quantitative Analyze, which needs the full conversation, papers, review, and subsequent learner explanation.

Optional `evaluatorCriteria` must contain one definition per checklist item in order, with exact checklist text. Example configuration syntax, not a scored learner example:

```json
{
  "id": "criterion_1",
  "text": "Exact text of the first checklist item",
  "required": true,
  "components": [{ "id": "whole", "text": "Exact text of the first checklist item" }],
  "requiresIndependent": false,
  "requiresTransfer": false
}
```

When metadata is omitted, all checklist items are required, each has one whole-item component, and no additional independence/transfer requirement is invented. Evidence checks may differ between branches, but neither may waive any rubric item. The full unnumbered passing criterion is also retained in the explicit level task. Refined evaluator v3 enforces this rule; archived results that previously bypassed a criterion are displayed as incomplete without altering the saved record.

Supply stable message `id` values and `stageId` if available. Otherwise they are derived deterministically. Generated message IDs remain stable when appending to an unchanged transcript; callers slicing/reordering history should preserve explicit IDs. Rubric-definition changes create a new derived stage ID. No legacy-session migration is necessary while the new path is developer-only.

## Human material and decisions to provide later

Everything depending on professor-scored examples is deferred. Model-generated labels are not substituted for human judgments.

| Provide or decide | Contents needed | Enables |
| --- | --- | --- |
| Approved course references | Course/topic, version, approval owner, source files/links and page/section locations; conflicts and valid alternatives | Reference-grounded judgments and conflict policy |
| Human-scored complete conversations | Original questions/replies, attachments/papers/reviews, hints/answers, per-criterion judgments, exact evidence, rationale, completion decision | Calibration examples and expert reference cases |
| Borderline and contrasting cases | Concise sufficient answers, incomplete explanations, errors, corrections, contradictions, alternative methods, assisted/independent performance | Sufficiency-boundary and assistance tests |
| Independent second rater on a subset | Ratings before discussion, disagreements, adjudication reasons, unresolved disagreement | Expert-agreement measurement |
| Approved rubric definitions | Every criterion mandatory, meaningful components and integrated tasks, independence/transfer expectations, material errors, task sampling | Course-authorized completion policy |
| Calibration/held-out allocation | Separate learners/conversations for prompt examples and evaluation; no held-out examples in prompts | Uncontaminated accuracy and second-pass evaluation |
| Release tolerances | False completion, unnecessary blocking, abstention, cost/latency, access/fairness checks, burden | Decision about enabling either new primary or final review in sessions |
| Instructor-review scope | Authenticated reviewers, override permissions/reasons, storage and retention | Auditable overrides and shared review queue |

Use de-identified transcripts under the project's agreed data-handling process.

## Other deferred work

- Approved-reference ingestion and professor-example calibration/retrieval.
- Persistent revisable evidence history, normal-session integration/migration, and authenticated overrides.
- Independent question-quality review and refined follow-up generation. Opportunity is currently a model judgment, not certified question fairness.
- Loop stopping, learner-facing progress changes, and replacement of the existing quantitative percentage.
- Human validation of semantic relevance, component coverage, assistance, transfer, and misconception interpretation. Code checks provenance/structure, not semantic truth.
- Third semantic audit, different reviewer models, and new completion rules in ordinary sessions.

## Verification and limits

New contract/comparison/API tests cover quote provenance, fabricated evidence, component coverage, attempted criterion waivers, opportunity, abstention, reasoning, contradictions, assistance/transfer, duplicates, Analyze timing, blind-review isolation, partial failures, retries, and local/access/provider restrictions. Existing chat/strategy tests verify the legacy extraction. Frontend TypeScript/build and changed-component lint pass.

The full suite initially encountered sandbox-denied temporary-file renames in existing OAuth/prompt-store tests. Outside the sandbox, all but one existing test passed: the remaining OAuth test expects POSIX mode `0600`, while Windows reports `0666`. No OAuth persistence or permissions code changed. Initial browser verification was blocked by computer-use access. On October 19, the developer tab was subsequently verified in the Codex in-app browser: all 36 cases ran there, history survived reload, and two revised examples were rerun. See [live review](evaluator-live-review-2026-10-19.md). These authored screening results do not establish educational validity.
