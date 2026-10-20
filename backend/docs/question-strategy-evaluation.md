Historical initial findings. The observed leakage and leading-question issues were subsequently addressed; see [the fixes and affected-case rerun](question-strategy-leakage-rerun.md).

# Question-strategy live evaluation

Updated: 2026-10-18T22:23:16.291Z. Provider/model: **chatgpt / gpt-6.1-sol**. Corpus: `question-strategies-5`.

## Scope and method

The developer tool now has 67 fixed cases: the original 16 plus 51 targeted strategy-level cases covering all 18 strategies at each supported level (Remember 2, Understand 17, Apply 16, Analyze 16). Targeted mode offers only the intended strategy, but permits abstention and rubric fallback. It tests whether a structure can be instantiated, not whether an open selector discovers it among all candidates.

Each pair shares one rubric assessment, transcript, provider and model. The baseline receives no expected-strategy label, strategy-bearing case title, or review guide. The strategy branch receives only the eligible targeted candidate and normal planning/generation context. Authored fixture-scope rubrics narrow the original model-generated topic rubrics; both are retained. These synthetic cases are benchmark designs, not validated inventory items or an independently sampled held-out dataset. The suite samples theoretical, quantitative, and experimental learning types; it does not cover the full learning-type cross-product, design tasks, or quantitative Analyze paper-review flows.

A separate call reviews questions under deterministic counterbalanced A/B labels, without branch identities or strategy metadata. It scores clarity, level fit, diagnostic value, grounding, and non-leading wording from 0 to 2 each. It sees the same fixed transcript, scope rubric, and diagnostic objective. Ratings are same-model design opinions, not independent expert validation or observed learner performance. The generator’s own suitability checks are not counted as quality evidence.

All five dimensions >= 1, total >= 8/10, no major concern. Applied pairs only; fallbacks, no-question runs and errors excluded from quality means.

## Completion and quality

Completed attempts: **51/51**. Applications: **51**; fallbacks: **0**; no next question: **0**; current generation errors: **0**; review errors: **0**.

Across 51 reviewed applications, mean baseline score: **9.20/10**; mean strategy score: **9.86/10**. Reused fallback questions are excluded from these means.

Design-screen threshold met: default **45/51**; strategy **50/51**. These are model-review classifications, not learner mastery or empirical validation.

| Review outcome, applied pairs only | Count |
| --- | ---: |
| baseline | 5 |
| enhanced | 25 |
| tie | 21 |
| neither | 0 |

| Dimension | Default mean /2 | Strategy mean /2 |
| --- | ---: | ---: |
| clarity | 1.98 | 2.00 |
| levelFit | 1.82 | 1.98 |
| diagnosticValue | 1.65 | 1.96 |
| grounding | 1.90 | 2.00 |
| nonLeading | 1.84 | 1.92 |

| Level | Required | Applications | Fallbacks | Current errors | Reviewed pairs | Default /10 | Strategy /10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| remember | 2 | 2 | 0 | 0 | 2 | 8.50 | 10.00 |
| understand | 17 | 17 | 0 | 0 | 17 | 9.12 | 9.88 |
| apply | 16 | 16 | 0 | 0 | 16 | 9.13 | 9.69 |
| analyze | 16 | 16 | 0 | 0 | 16 | 9.44 | 10.00 |

## Strategy-level matrix

Cells show status and default/strategy scores out of 10. A dash is an unsupported level. A pending cell is not a successful test.

| Strategy | Remember | Understand | Apply | Analyze |
| --- | --- | --- | --- | --- |
| Controlled comparison | — | applied 9/9 | applied 8/10 | applied 10/10 |
| Boundary case | — | applied 10/10 | applied 8/8 | applied 9/10 |
| Remove a condition | — | applied 10/10 | applied 8/10 | applied 10/10 |
| Separate a quantity from its change | — | applied 10/10 | applied 10/10 | applied 10/10 |
| Reconcile specific claims | — | applied 10/10 | applied 9/10 | applied 8/10 |
| Change representation | — | applied 10/10 | applied 9/10 | applied 10/10 |
| Clarify a specific term | applied 10/10 | applied 10/10 | — | — |
| Recall a specific element | applied 7/10 | — | — | — |
| Check the reason behind an answer | — | applied 9/10 | applied 10/10 | applied 9/10 |
| Trace a causal mechanism | — | applied 8/10 | applied 10/10 | applied 9/10 |
| Account for transfers and conservation | — | applied 9/9 | applied 9/10 | applied 6/10 |
| Classify using defining features | — | applied 10/10 | applied 8/10 | applied 10/10 |
| Separate necessary from sufficient conditions | — | applied 7/10 | applied 10/8 | applied 10/10 |
| Separate levels of organization | — | applied 10/10 | applied 10/10 | applied 10/10 |
| Separate observations from inferences | — | applied 10/10 | applied 10/10 | applied 10/10 |
| Distinguish chance from certainty | — | applied 5/10 | applied 10/9 | applied 10/10 |
| Match a method to its conditions | — | applied 10/10 | applied 7/10 | applied 10/10 |
| Specify the system or reference | — | applied 8/10 | applied 10/10 | applied 10/10 |

## Operational failures and abstentions

Recorded failed generation attempts, including recovered attempts: 7. Successful checkpoints are not regenerated on resume. Review-only retries retain the generated pair. Original failures remain in each record's attempts list.

- **coverage-controlled-comparison-understand** (applied): Recovered a previously failed request; see attempts in results.json.
- **coverage-controlled-comparison-apply** (applied): Recovered a previously failed request; see attempts in results.json.
- **coverage-controlled-comparison-analyze** (applied): Recovered a previously failed request; see attempts in results.json.
- **coverage-answer-reason-consistency-understand** (applied): Recovered a previously failed request; see attempts in results.json.
- **coverage-answer-reason-consistency-apply** (applied): Recovered a previously failed request; see attempts in results.json.
- **coverage-answer-reason-consistency-analyze** (applied): Recovered a previously failed request; see attempts in results.json.
- **coverage-evidence-inference-analyze** (applied): Recovered a previously failed request; see attempts in results.json.

## Questions requiring review

The following concerns come from the blind reviewer and need subject/expert review. They can be mistaken; a score is not an application verdict.

### coverage-boundary-case-apply

Strategy question: For this 10-ohm resistor at 0 V, the relationship is V = IR. What current do you get when you isolate I in that equation and substitute the values, showing the division you use?

- major, nonLeading: Provides the assessed principle in a task whose diagnostic objective is applying the resistor relationship after the learner has proposed an incorrect division. Quote: “the relationship is V = IR”

## Audit trail and reproduction

Fingerprint: `e7c4428c6ca2b40043d0bb408c2b552513c387991f837c426027a0b3525e881d`. Prompt version: `1ed6b362365e1015fd4ce68ea57a48f664401c3ceee0009263c8d629323a1cde`. [Full checkpoint and ratings](../evaluations/strategy-levels-v5-final/results.json). Full generation traces for completed comparisons are in the adjacent `cases/` directory. Original pilot data, including the unscoped-rubric issue, remains in `backend/evaluations/strategy-levels-v5/`.

```powershell
node scripts/generate-comparison-rubrics.mjs --suite coverage --concurrency 3
node scripts/evaluate-question-strategies.mjs --concurrency 3 --output backend/evaluations/strategy-levels-v5-final
# Resume operational failures without regenerating successful pairs:
node scripts/evaluate-question-strategies.mjs --concurrency 3 --output backend/evaluations/strategy-levels-v5-final --retry-errors
node scripts/report-question-evaluation.mjs backend/evaluations/strategy-levels-v5-final/results.json
```

The saved evaluation is exposed in Developer tools → Question strategies, independently of the browser’s 20-entry manual-run history. Reload saved evaluation reads the latest checkpoint without making model calls.

These results do not establish open-selection accuracy, robustness across model samples, independent expert agreement, transfer to unseen disciplines, accessibility for actual students, or learning gains. They identify concrete question-design and pipeline issues to investigate.

## Qualitative findings from inspecting the questions and traces

This is an implementation review by the same coding assistant, not an independent instructor rating. The blind scores above are another model-based view. Neither supplies learner-response evidence.

**The benchmark needed scope review before its scores were meaningful.** The initial topic-only rubric generation sometimes changed the construct: a pressure-change task received gas-work criteria, a program-variable clarification received psychology-memory criteria, and an all-outcomes probability boundary received criteria about nested limiting-event sequences. The generated rubrics are preserved, while the active coverage rubrics explicitly target the supplied fixed task. This is a finding about benchmark/rubric grounding, not proof that a diagnostic strategy failed.

**The abstention behavior found real fixture defects.** The original reconciliation Apply case attributed numerical claims to the student without actually putting them in a student message. The mechanism Analyze case did not establish the prerequisite biology stages. The original stochastic Apply case tested addition versus multiplication rather than the intended expectation-versus-certainty distinction. Those versions and their fallbacks remain in the scoped-run archive. The final fixtures explicitly establish the actual claims and prerequisites, and the stochastic task now applies a process model to an allegedly impossible outcome. The question-generation implementation and prompts were held fixed; unchanged complete pairs were reused rather than regenerated for better scores.

**The most useful improvements were often at Apply.** For example, the controlled-comparison question requested use of both measured cooling outcomes, the charge-accounting question requested an actual quantity and accounting justification, and the classification question requested use of the supplied removal behavior. Some default questions instead asked whether the learner's claim or shortcut made sense, leaving room to restate a belief without demonstrating application. This is a next-question design advantage in those examples, not measured learning improvement.

**The default was frequently competitive.** Several Understand and Analyze pairs asked essentially the same relationship question and were tied. In some boundary and sufficiency cases the default was preferable. The strategy route should not be treated as an automatic upgrade simply because its output has an explicit diagnostic plan.

**An answer-leakage defect survived the live suitability check.** In boundary-case Apply, the strategy question supplied “the relationship is V = IR” before asking for substitution. Selecting or correctly using that relationship was part of the assessed knowledge. The blind reviewer marked this as major leakage, despite the application checker accepting the question. The earlier pilot also produced the same kind of leak. A successful pipeline application is therefore not equivalent to a verified, non-leading question.

**A less severe sufficiency probe supplied part of the method.** The necessary/sufficient Apply question defined divisibility and instructed division by six before asking whether the result supported the claim. The reviewer preferred the default and marked that scaffolding as a minor problem. These two cases suggest a recurring Apply-level weakness: turning the learner's method choice into a supplied hint.

**The repaired stochastic case applied the right structure, but its wording was still partly corrective.** It asked for a model-based probability and did not give the answer, but the phrase “rather than impose the expected count of two” explicitly directed the learner away from their proposed approach. The reviewer preferred the default's less corrective wording. Repairing a fixture establishes a fair test; it does not guarantee a superior strategy question.

**High scores still warrant structural scrutiny.** The conservation Understand question challenged the inference that water ceased to exist, but did not directly require accounting for its location or state. It may elicit useful reasoning while only partially realizing the conservation strategy. The method-applicability Understand question introduced the total-distance/total-time definition while probing a shortcut's duration condition; even though the reviewer rated it highly, that supplied knowledge deserves an instructor's check against the intended independence requirement. Coarse near-ceiling scores can miss these distinctions.

**A useful default-question failure was asking about a source rather than eliciting the fact.** The Remember baseline asked whether a name was in the notes; the strategy question asked for the missing component name itself. Other baseline questions used “Why does ...” constructions that could sound as though the disputed causal implication was accepted. Neutral attribution such as “In your account ...” can preserve the student's claim without endorsing it. Such wording judgments remain context-sensitive.

## Recommended next changes

1. Make the assessed principle, definition, operation, and permitted task givens explicit in the diagnostic plan. Check the final wording against that boundary; do not treat a needed method as an observational given just because it is familiar.
2. Add focused regression examples for the formula-leakage and method-scaffolding cases, with instructor review. The current model checker is not a sufficient answer-leakage guard.
3. Require Apply probes to elicit actual method use and contextual interpretation when the rubric requires them. Avoid stopping at naming a method or defending a claim.
4. Check structural fidelity separately from general question quality: for example, conservation probes should elicit an account, rather than receive full credit solely for challenging an unsupported conclusion.
5. Revisit the stochastic strategy's original Apply illustration, which was a generic independent-event calculation. The revised fixture demonstrates the more specific expectation-versus-realization structure; the example should be aligned in a separately versioned refinement.
6. Validate with independent subject experts, repeated model samples, and actual learner replies before claiming improved diagnosis or learning. Add open-selection tests and more learning-type/task combinations; this suite deliberately tests targeted instantiation.

## Engineering verification

The 141 targeted backend checks passed, covering the learning flow, comparison matrix, benchmark-metadata isolation, unsupported levels, blind-review labeling, critique citations, fallback behavior, provider boundaries, and deployment restrictions. The frontend production build passed. Source-only frontend lint passed with the existing ChatComposer effect warning. The full suite passed 214 of 215 tests; the remaining existing `chatgpt.test.js` assertion expects POSIX mode 0600 while Windows reports 0666 for the temporary credential file. That assertion was not changed as part of this work.

The local developer interface was checked in the browser: all four coverage folders and all 51 new cases are available, targeted mode and rubric-review provenance are visible, and saved evaluation results are separate from the browser's 20-entry manual-run history.

