Historical initial findings. The observed leakage and leading-question issues were subsequently addressed; see [the fixes and affected-case rerun](question-strategy-leakage-rerun.md).

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
