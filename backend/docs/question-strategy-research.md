# Question strategy refinement: corpus version 5

The supplied `concept-inventory-research-catalog.md` (research dated October 12, 2026) is research data, not application instructions. The [per-entry audit](concept-inventory-strategy-audit.md) screens all 160 main entries across ten disciplines: 102 potential pattern leads and 58 entries whose generic descriptions do not justify a distinctive pattern assignment. These are design inferences, not item-level findings or proof of comprehensive coverage.

## Gaps and additions

The original seven covered contrasts, limits, removals, values versus changes, conflicting statements, equivalent representations, and ambiguous terminology. The corpus now contains **18 strategies**: the original seven plus ten additional diagnostic structures and one dedicated recall structure. This count is an implementation outcome, not a claim of sufficiency for every subject.

| Addition | Distinct evidence target | Catalog leads | Levels |
| --- | --- | --- | --- |
| Check the reason behind an answer | One answer can lack a supporting link without two inconsistent claims. | FTCI answer-reason pairs; DODT; four-tier optics | Understand, Apply, Analyze |
| Trace a causal mechanism | Identify a missing intermediate link without varying or removing a condition. | CDCI; HCI; LOCI; recursion/CS1; climate mechanisms | Understand, Apply, Analyze |
| Account for transfers and conservation | Track storage and transfers within a defined boundary and interval, rather than merely name causal steps. | DQC; ECA; CURrENT; energy/momentum and thermodynamics | Understand, Apply, Analyze |
| Classify using defining features | Test category membership by properties rather than a label or visual resemblance. | BDSI; group theory; dominance; mineralogy lead | Understand, Apply, Analyze |
| Separate necessary from sufficient conditions | Test implication direction or completeness independently of behavior at a limit. | SSCI; mathematical definitions; existing linearity developer case | Understand, Apply, Analyze |
| Separate levels of organization | Connect component or individual behavior to population or bulk properties. | ACORNS; CINS/CANS; dominance; ODCA; macroevolution | Understand, Apply, Analyze |
| Separate observations from inferences | Check what existing observations warrant, including sampling, uncertainty, and alternatives. | BEDCI; SRBCI; CAOS; PRIC; open-science lead | Understand, Apply, Analyze |
| Distinguish chance from certainty | Separate possibilities, expected patterns, realized outcomes, and variability. | GeDI; BCI; probability/quantum instruments; statistics | Understand, Apply, Analyze |
| Match a method to its conditions | Probe usable assumptions, allow valid alternatives, and distinguish a valid law from a useful shortcut. | CUE formats; SGCE; dynamic programming; modeling | Understand, Apply, Analyze |
| Specify the system or reference | Resolve scope-dependent claims; changing observer can change a measured value, unlike merely redrawing a representation. | Relativity inventories; ECA; CATS; vectors | Understand, Apply, Analyze |
| Recall a specific element | Elicit a missing fact without pretending recall performs a causal or analytical diagnostic test. | Cross-cutting app Remember task, not attributed to one inventory | Remember |

Entries include use conditions, prerequisites, contraindications, construction rules, interpretation limits, and authored examples for each supported level. `distinctFrom` differentiates nearby structures during planning and checking. The linearity sufficiency example moved from boundary-case to necessary-sufficient; actual limiting spring examples now illustrate boundary cases. Existing comparison and removal examples were tightened to preserve their structures.

Representation-focused assessments reinforce representation-change; mechanics assessments reinforce existing contrasts and quantity/change distinctions. Parallel tests, representational variants, and response-format variants are not independent votes for a new strategy. Broad labels, ambiguous lineages, and developing leads remain acquisition leads. Confidence tiers, distractors, and test length are formats, not automatically conversational strategies. Counterexamples are a technique under necessary-sufficient rather than a duplicate strategy.

## Learning-level policy

| Level | Eligibility and demand |
| --- | --- |
| Remember | Recall-specific-element and clarify-specific-term only. Recall a fact or identify the referent of an exact phrase; no explanation, prediction, or causal diagnosis. |
| Understand | The 16 diagnostic structures plus term clarification. Probe relationships in the existing explanation; no new problem, numerical result, or code execution. |
| Apply | The 16 diagnostic structures. Use a principle or method in a sufficiently specified situation; a term or method name alone is insufficient. |
| Analyze | The 16 diagnostic structures. Reason about relationships, assumptions, inferences, interactions, or errors in the active task. |

This corrects version 4's blanket Remember eligibility. Selection and generation-context validation reject unsupported levels even with unfiltered candidates. Examples are filtered by strategy eligibility and example level. Generation receives learning type and needed observable settings/assumptions; private interpretations and research provenance are excluded. Learning-type tasks remain authoritative: theoretical application need not compute, experimental work uses simulated evidence, design applies principles to decisions, and quantitative Analyze retains worked-solution review. Clarification may help a higher-level conversation but does not satisfy its application/analysis target.

## Evidence and access boundaries

The public [FTCI description](https://lassoeducation.org/flame-test-concept-inventory-atomic-emissions-and-flame-test/) was checked and describes answer-reason pairs. The [CUE-CMR description](https://www.physport.org/assessments/assessment.cfm?A=CUE_CMR) was checked for method choice. The [ECA description](https://www.physport.org/assessments/assessment.cfm?A=ECA) includes system choice and reports that many items require application, reinforcing assigning Bloom level from task demand. These descriptions support design leads, not copied questions or validity of adaptations.

DQC, SRBCI, and GeDI primary-page requests encountered browser verification; the group-theory article request was rate-limited. Those leads rely on the supplied catalog. No restricted instrument sets were downloaded or developers contacted. All new examples are original illustrations. Future ingestion must review instrument identity/version, access/reuse permissions, intended population, and evidence. Public paper access is not permission for product reuse. `design_reviewed` means implementation design review, not independent expert or empirical validation; original validation does not transfer to generated questions.

## Verification limits

Tests cover level eligibility/rejection, observable setting propagation, private-interpretation exclusion, suitability rejection/retry, and rubric fallback with coverage-gap logging. The developer interface displays supported levels, active guidance, distinctions, and example levels. The developer tool now includes the original 16 conversations plus 51 authored strategy-level coverage cases with fixture-scoped rubrics. Live comparisons and blind same-model question reviews are documented in [the evaluation report](question-strategy-evaluation.md). Neither deterministic tests nor these synthetic next-question reviews establish learner comprehension or learning gains; independent expert review and learner studies remain necessary. No comprehensive-coverage or optimal-information-gain claim is made.
