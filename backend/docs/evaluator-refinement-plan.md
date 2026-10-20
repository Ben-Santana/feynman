# Evaluator refinement plan

## Objective

Current governing requirement (October 19, 2026): **every rubric criterion must be met before passing**. No model, metadata flag, component decomposition, or human override may waive an unmet item. This supersedes the earlier optional-criterion design. Refined evaluator v3 and the [comprehensive test suite](evaluator-testing.md) enforce/test this policy; semantic interpretation still requires live-model and expert validation.

Make evaluation traceable, revisable, grounded in approved instructional material, and fair to the learner. Replace the repeated second assessment with a fresh evidence review followed by a targeted audit. Application logic retains authority over completion.

This is an implementation plan, not a claim that the evaluator is an established educational measurement. Model judgments need expert validation before being used for consequential assessment.

## Research assessment and design revisions

Reviewed October 14, 2026. This is a targeted literature assessment, not a systematic review. Sources include research reviews, classroom experiments, assessment theory, and professional standards. They support different kinds of claims; a theoretical rationale or professional recommendation is not experimental evidence that an LLM implementation works. No source reviewed directly validates this app's evaluator, four evidence statuses, or proposed second-pass pipeline.

Evidence labels used below:

- **Research-supported principle:** research supports the assessment or learning principle, with limits on transfer to this conversational system.
- **Theory/standards-aligned:** justified by assessment theory or professional guidance; implementation effectiveness remains to be tested.
- **Engineering/policy choice:** useful operational design, without a demonstrated educational advantage for the exact rule.
- **Experimental:** a plausible intervention whose incremental benefit must be measured.

### Feature-by-feature assessment

| Planned feature | Grounding | Refinement and limitation |
| --- | --- | --- |
| Independent criterion assessment | Research-supported principle: analytic, domain-specific rubrics can improve scoring reliability [R2]. | Keep separate judgments, but preserve relationships among components. Do not assume a checklist represents an integrated competence adequately. Exact statuses and stable IDs are engineering choices. |
| Approved references | Theory/standards-aligned: content alignment and defensible interpretation [R1, R3]. | Instructor approval establishes course scope, not scientific correctness. Distinguish missing coverage from genuine conflict; valid alternative methods need expert adjudication when the reference bundle is restrictive. Approval workflow and abstention rules are policy choices. |
| Scoring examples | Research-supported for human rubric scoring [R2]. | Use diverse exemplars and train/calibrate human raters. Whether exemplars improve this LLM must be tested; avoid using held-out cases as prompt examples. |
| Traceable observations | Theory/standards-aligned: claims must be connected to observations through an interpretation [R1]. | Exact quote verification is an engineering safeguard. A matching quote alone does not validate an inference. Include task context and a relevance explanation. |
| Correctness versus reasoning | Research-supported rationale for eliciting explanations; assessment inference remains task-specific [R1, R5]. | Require explanations only when they belong to the criterion. Preserve conceptual credit for local calculation errors while recording execution errors separately. Do not require verbose explanations for recall. |
| Intended learning level | Theory-aligned classification [R6]. | Bloom categories describe objectives, not a validated learner ability scale. Add knowledge type and concrete task expectations; do not infer a universal prerequisite ladder. |
| Gaps versus misconceptions | Theory/research-aligned caution about inference and context [R1, R8]. | Record an observed error before inferring a stable misconception. Seek discriminating evidence when that distinction affects the next task. A fixed number of confirming responses is not established here. |
| Assistance provenance | Research/theory-aligned; dynamic assessment values responsiveness to support [R7]. | Preserve assisted learning evidence. Restrict credit only for a criterion explicitly requiring independence. Categories are provisional descriptors, not a numerical assistance penalty. L2 findings do not validate engineering-domain classification. |
| Question quality | Theory/standards-aligned: evidence depends on the task and assessment conditions [R1, R3]. | Distinguish clear access/wording defects from model uncertainty. A leading prompt can support assisted performance but cannot establish independence in the reasoning it supplied. Automated detection needs validation. |
| One next question | Research supports using evidence to adapt learning and actionable feedback [R4, R9]. | Exactly one question and a fixed priority order are interface hypotheses. Prefer one manageable evidence objective; test whether the question elicits useful evidence. |
| Revisable history | Theory-aligned treatment of uncertain observations [R1]. | Event sourcing, supersession, and duplicate detection are engineering choices. Repeated responses may demonstrate stability but are not automatically independent trials. |
| Full coverage and transfer | Research supports examining performance in new contexts [R10]. | Define near-transfer tasks and sampling in advance. Avoid claiming broad transfer or durable mastery from one new problem. Include an integrated task when component coverage is insufficient. |
| Explicit completion | Criterion-based decision is policy, informed by validity standards [R3]. | All-required-items is retained as a transparent provisional course rule, not an empirically optimal mastery cutoff. Instructors define sufficiency and exceptions before assessment. |
| Fresh final review / second pass | Experimental. | Original-evidence review is defensible; blind LLM review plus audit is not established as better education assessment. Evaluate accuracy, overblocking, burden, and cost before promoting it. |
| Abstention / human review | Theory/standards-aligned recognition of limitations [R1, R3]. | Thresholds, queue routing, and abstention enums are engineering/policy. Avoid unnecessary abstention when accessible clarification can resolve the issue. Human ratings also need calibration. |
| Loop stopping | Engineering/policy choice; formative feedback motivates adaptation [R4, R9]. | No universal turn limit is established. Offer pause, study, a different representation, or review. Do not equate reaching the limit with poor ability. |
| Consistency / manipulation resistance | Fairness is standards-aligned [R3]; prompt-injection protection is engineering. | Matched response tests are useful but do not prove demographic or accessibility fairness. Evaluate relevant language and access conditions with suitable consent and data. |
| Transparent progress | Research-supported rationale for explicit expectations and useful feedback [R2, R4]. | Coverage counts are descriptive, not calibrated mastery scores. Feedback must help the learner take a next step, rather than merely displaying statuses. |
| Human correction / validation | Standards-aligned [R3]. | Versioning and overrides are governance mechanisms. Expert agreement is a reference measure, not proof of learning benefit. Measure subsequent performance too. |

### Changes to the educational interpretation

1. **Separate learning support from evidence of independence.** Store assisted and independent performance without treating help-seeking as failure. A fresh unassisted task is required only where the approved criterion calls for independent performance. The assistance taxonomy is an operational hypothesis; test whether raters can apply it consistently. [R7]
2. **Make success conditions course-specific.** Define accepted reasoning, necessary precision, material errors, integrated performance, and task sampling before collecting evidence. Retain all-required-items completion as the current explicit product rule, subject to instructor validation; do not advertise it as research-established mastery. [R2, R3]
3. **Use Bloom for alignment, not ability measurement.** Store factual, conceptual, procedural, or metacognitive knowledge targets alongside task expectations. Keep the app's existing sequential stages for compatibility, but identify that sequence as a product choice. Broader evidence reuse or a different progression would be a separately tested change. [R6]
4. **Avoid atomizing complex performance.** Instructors approve criterion decomposition. Where the target involves coordinating ideas or methods, include an integrated observation as well as component evidence. Do not let a model manufacture additional components or demand separate quotations when one explanation genuinely supports several requirements. [R1, R2]
5. **Treat a contradiction as contextual evidence.** Establish that two statements refer to comparable conditions before reopening support. Preserve resolved errors and local slips in history without permanently blocking progress. Hypothesized misconceptions should remain revisable. [R8]
6. **Separate completion from retention and transfer.** Completion means the sampled session evidence meets the configured rubric. Add delayed checks and new contexts to the validation study; broader claims require broader evidence. [R10]
7. **Retain the classmate role without presenting its no-hints rule as universally optimal teaching.** Research on feedback and problem-solving followed by instruction does not justify endless questioning without instructional consolidation. At a stalled loop, offer approved study material or human help outside the assessment dialogue; record any ensuing assistance before reassessment. Changing the classmate to teach directly is outside this evaluator refinement. [R4, R11]

### Research sources and scope

- **R1:** National Research Council (2001), [Knowing What Students Know, Chapter 2](https://www.nationalacademies.org/read/10019/chapter/4). Assessment framework: coordinate cognition, observations, and interpretation; observations are uncertain samples. Supports defensible evidence design, not this exact architecture.
- **R2:** Jönsson and Svingby (2007), [The use of scoring rubrics: reliability, validity and educational consequences](https://researchportal.hkr.se/en/publications/the-use-of-scoring-rubrics-reliability-validity-and-educational-c-2/). Review of 75 studies: analytic, topic-specific rubrics with exemplars/rater training can improve reliability; rubrics alone do not establish validity. Human scoring findings are not direct LLM evidence.
- **R3:** AERA, APA, NCME (2014), [Standards for Educational and Psychological Testing](https://www.testingstandards.net/uploads/7/6/6/4/76643089/standards_2014edition.pdf), especially Chapters 1–3, 5, and 6 and Standards 5.21–5.23. Professional standards for validity, reliability, fairness, and defensible decision rules; not an experiment testing this feature set.
- **R4:** Shute (2007), [Focus on Formative Feedback](https://myweb.fsu.edu/vshute/pdf/shute%202007_f.pdf), research-report version of the later journal review. Supports specific, manageable feedback responsive to task and learner; does not establish a universal timing, one-question rule, or prohibition on explanations.
- **R5:** Aleven and Koedinger (2002), [Learning by doing and explaining with a computer-based Cognitive Tutor](https://doi.org/10.1207/s15516709cog2602_1). Classroom experiments support scaffolded self-explanation in geometry. Does not show that every correct response requires an explanation or that this evaluator can judge explanations accurately.
- **R6:** Krathwohl (2002), [A revision of Bloom's taxonomy: an overview](https://doi.org/10.1207/s15430421tip4104_2). Conceptual framework with knowledge and cognitive-process dimensions, not a calibrated diagnostic scale or proof that all students must traverse this app's four stages in order.
- **R7:** Poehner and Wang (2020), [Dynamic Assessment and second language development](https://www.cambridge.org/core/journals/language-teaching/article/dynamic-assessment-and-second-language-development/6926234FDE72C27BF93941383DCB6388). Domain-specific research timeline: responsiveness to mediation provides information beyond independent performance. Assistance tracking is motivated by this principle; the proposed categories need local validation.
- **R8:** diSessa (2014), [The Construction of Causal Schemes: Learning Mechanisms at the Knowledge Level](https://doi.org/10.1111/cogs.12131). Theory and analysis of conceptual learning motivate context-sensitive, revisable interpretation rather than automatic stable-misconception labels. Does not supply a universal diagnostic threshold.
- **R9:** Black and Wiliam (1998), [Assessment and Classroom Learning](https://assess.ucr.edu/sites/default/files/2019-02/blackwiliam_1998.pdf). Review motivates formative use of evidence to change subsequent teaching/learning. Displaying progress or collecting labels alone is not the intervention.
- **R10:** National Research Council (2000), [How People Learn, Chapter 3: Learning and Transfer](https://www.nationalacademies.org/read/9853/chapter/6). Research synthesis distinguishes remembering from using knowledge in new contexts; transfer is sensitive to learning and task context. Does not justify broad mastery claims from a single task.
- **R11:** Sinha and Kapur (2021), [When Problem Solving Followed by Instruction Works](https://journals.sagepub.com/doi/10.3102/00346543211019105). Meta-analysis favors preparatory problem solving under particular designs and populations, followed by instruction. It is not evidence for indefinite unsupported discovery or chatbot questioning alone.

The absence of direct evidence in this targeted review means a feature remains unvalidated here; it does not prove that no relevant research exists. The implementation priorities below retain safeguards while treating educational impact and second-pass benefit as hypotheses.

## Existing implementation

Implementation update, October 18, 2026: the first contract, evidence-validation, and completion-eligibility slice is implemented in the developer-only comparison path. Blind final review is shadow-only; ordinary sessions retain the existing evaluator. See [implementation status and human material to provide later](evaluator-implementation-status.md) for scope and deferred dependencies. Remaining sections describe the target architecture rather than features already enabled in sessions.

- `backend/src/chat.js` assembles evaluator prompts, requests one judgment per checklist item and an overall task judgment, validates learner quotes, computes completion, and reconciles a second assessment.
- `backend/prompts.json` and `backend/src/promptCatalog.js` contain editable evaluator instructions and prompt metadata.
- `backend/src/structuredOutput.js` handles malformed-output retries and exact checklist matching.
- `frontend/src/learningFlow.ts` controls stage evidence windows and advancement. Quantitative Analyze uses the full concept conversation.
- Provider adapters supply structured responses through a common interface. The classmate and evaluator currently share the selected provider/model.
- The existing second pass repeats assessment with a short additional instruction. Reconciliation compares statuses and replaces disagreement explanations with a generic message.
- Current quote validation proves that text occurs in a learner message; it does not establish that the quote entails the criterion, is independent, or covers the whole requirement.

## Proposed feature set

| Feature | Behavior to implement | Acceptance condition |
| --- | --- | --- |
| Independent criterion assessment | Give each criterion a stable ID, mandatory flag (always true), intended learning level, and explicitly defined components. Assess each separately. Use `missing`, `unclear`, `flawed`, and `supported`; keep opportunity separate. | Support must be justified separately for each criterion; the same substantive observation may legitimately support multiple criteria. A criterion with no fair opportunity is displayed as unassessed, not failed. |
| Approved reference grounding | Attach instructor-approved, versioned references to the rubric. Cite reference locations where judgments depend on them. Accept valid alternatives. Record absent or conflicting reference coverage. | Reference conflicts yield an abstention or review request; the evaluator cannot add passing requirements. Lack of references is disclosed, with a configurable policy for whether assessment may proceed. |
| Approved scoring examples | Supply versioned professor-scored examples relevant to the criterion and level, including borderline and alternative-method cases. | Examples calibrate sufficiency without requiring the learner to reproduce their wording or method. |
| Traceable evidence observations | Store learner message IDs, exact excerpts or image references, concise relevance explanations, criterion/component links, and source context. Validate citations against original messages. | Assistant text cannot be credited as learner evidence. Invalid citations are rejected or removed and dependent support is withdrawn. |
| Correctness and reasoning separation | Record result correctness separately from method, explanation, assumptions, and interpretation when relevant. Distinguish local arithmetic errors from conceptual errors. | A correct answer with invalid reasoning cannot pass a reasoning criterion; an unrelated arithmetic error does not erase valid conceptual evidence. |
| Learning-level alignment | Evaluate the demonstrated performance against the criterion's recall, explanation, application, or analysis target. | Vocabulary and question wording alone do not establish capability. |
| Gap and misconception distinction | Record missing or ambiguous evidence separately from identifiable errors. Treat misconception labels as hypotheses supported by specific learner statements. | Omitted reasoning cannot become a misconception without evidence; multiple plausible interpretations trigger clarification. |
| Assistance provenance | Classify each observation as no substantive help, clarification, hint, supplied explanation/answer, or unknown. Record the relevant assistance messages. | Repeating supplied reasoning cannot satisfy an independence requirement. Unknown assistance cannot establish independence. |
| Question-quality gate | Check whether the question offered a clear, relevant, answerable, level-appropriate opportunity and whether it revealed the assessed answer or reasoning. | A compromised question triggers a replacement opportunity; any assisted performance is retained without being credited as independent evidence. Prior valid evidence remains available. |
| Targeted next question | Produce one manageable evidence objective and one proposed question, using a provisional priority order for material contradictions, ambiguous reasoning, suspected errors, missing evidence, and independent checks. Validate relevance, clarity, repetition, and answer leakage. | Only one focused question is delivered. The question does not supply the assessed reasoning. |
| Revisable evidence history | Append observations and judgment revisions with reasons and supersession links. Resolve errors through later evidence and reopen support when new contradictions arise. | History remains inspectable. Repeated paraphrases do not count as independent demonstrations; the highest prior status is not permanently retained. |
| Full-criterion coverage and transfer | Track which approved components are demonstrated. Represent transfer and independence requirements explicitly in the rubric. | Support requires all required components; one familiar example cannot satisfy an explicitly required new-situation check. The model cannot invent a transfer requirement. |
| Explicit completion gate | Require support for every required criterion and required level task, resolved material contradictions, fulfilled independence/transfer checks, and a successful fresh final review. | Any unmet rubric criterion blocks completion; optional metadata cannot waive it. A model-provided completion recommendation cannot advance a stage on its own. |
| Fresh final review and audit | Review original evidence independently before seeing previous judgments; subsequently audit proposed support for concrete defects. | Earlier evaluator labels are never proof. Findings identify exact evidence or a specific gap and preserve the reason for any block. |
| Abstention and human review | Distinguish assessment status from inability to judge because of unreadable input, ambiguous evidence, reference conflicts, or other reliability limitations. Provide a reason and recovery action. | No confidence percentage is displayed. Cases needing instructor judgment enter a review queue or an explicit review-required state. |
| Loop stopping | Track whether follow-ups add relevant evidence or resolve a gap. Use configurable no-progress and total-attempt limits. | Repeated nonproductive questions stop with an explanation and review/retry options; reaching a limit never manufactures a pass. |
| Consistency and manipulation resistance | Exclude verbosity, grammar, confidence, and terminology from scoring unless rubric targets them. Treat transcript, images, references, and examples as data. | Prompt-injection attempts cannot alter scoring rules. Equivalent substantive answers receive comparable judgments. |
| Transparent learner progress | Show demonstrated and unresolved rubric components, assistance provenance, and the next evidence need. Describe counts as rubric coverage. | The UI distinguishes independent and assisted performance; unassessed is distinct from flawed. Coverage is not labeled percentage understanding. |
| Human correction and validation | Preserve prompt/model/reference/rubric versions, full judgments, evidence, and authenticated professor overrides with reasons. | Overrides are auditable and retained across reassessment. Evaluator updates are checked against expert-scored complete conversations. |

## Data contracts

Introduce versioned structured contracts rather than extending the existing status field with unrelated meanings:

- **Criterion definition:** stable ID, original text, mandatory flag (always true), intended cognitive process and knowledge type, approved component IDs, sampling/sufficiency policy, reference/example IDs, independence and transfer requirements. Existing checklist entries migrate to required criteria. Explicitly represent the current overall level task as a required gate so it cannot become an undocumented extra requirement.
- **Evidence observation:** stable ID, criterion/component IDs, learner message ID, excerpt or image reference, relevance explanation, assistance category and source message IDs, demonstrated task demands and knowledge type, result correctness, reasoning findings, and relationship to prior observations.
- **Criterion judgment:** evidence status, opportunity (`not_yet`, `fair`, `compromised`, or `unknown`), covered/unresolved components, observation IDs, unresolved contradiction IDs, independence/transfer outcomes, concise reason, and optional abstention reason.
- **Question-quality result:** assessed message ID, criterion/component target, clear/relevant/answerable/level-appropriate findings, substantive assistance or leakage, and replacement objective when necessary.
- **Review finding:** criterion/component ID, `confirmed`, `insufficient_evidence`, `contradicted`, or `unable_to_judge`, original evidence citations, specific defect or confirmation rationale, and next evidence objective if needed.
- **Assessment event:** immutable event ID, parent assessment ID, stage ID, rubric/reference/example versions, evaluator prompt/model versions, observations, judgments, review findings, completion recommendation, and application gate outcome.
- **Professor override:** authenticated actor, timestamp, scope, previous/new judgment, reason, and evidence references. Preserve the model judgment alongside the effective overridden judgment. Define explicitly whether an override satisfies a completion gate; never infer it from a free-text note.

Use stable message IDs rather than relying on array positions across stage slicing. Preserve legacy indices for display/migration. Treat `[Whiteboard image]` as an image source reference, not a textual description proving what the drawing contains. Unreadable drawings require abstention or a text clarification.

Distinguish opportunity to demonstrate in the chat from opportunity to learn the content; the first can be inferred from tasks, while the second requires instructional context. A chat question alone cannot establish opportunity to learn.

Store records with the existing browser session initially if appropriate for a research prototype. Durable shared instructor review requires a separately scoped authenticated backend persistence layer; browser-local records cannot provide trustworthy professor identity or cross-device audit history.

## Evaluation flow

1. Validate input and resolve immutable rubric, approved references, and scoring-example versions.
2. Establish the active stage evidence window. Preserve existing Quantitative Analyze scope intentionally; do not let earlier-stage evidence satisfy a new-stage independence requirement.
3. Check the assessment opportunity and assistance context. Merge genuinely new observations with the evidence history; do not simply accumulate all previous supported labels.
4. Perform the primary criterion assessment with original relevant evidence and the approved rubric. Validate citations, criterion coverage, and output contracts in code.
5. If incomplete, select one evidence objective and generate/validate one question. If the opportunity was compromised, repair the question. If evaluation is unreliable or the loop has stalled, abstain or recommend human review.
6. When completion is provisionally eligible, conduct the fresh final review below.
7. Apply deterministic completion rules. Store the full event and surface understandable progress. Advance only if the gate passes.

For efficiency, opportunity/assistance analysis and primary assessment may initially share a structured call. Keep their outputs separate so they can be validated and later split if expert evaluation shows correlated mistakes.

## Redesigned second pass

### A. Blind evidence review

Run a separate call with the original relevant transcript, rubric, course references, scoring examples, question context, and assistance history. Exclude first-pass statuses, reasons, and completion recommendations. Ask the reviewer to identify sufficient evidence, uncovered components, material contradictions, and unmet independence/transfer requirements. It must assess the learner's actual performance without adding requirements.

A final original-evidence review remains a required feature from the supplied requirements. Its blind LLM implementation is experimental: run in shadow mode first, and enforce it only after the release study supports the configured decision policy. Until then, preserve the existing production completion gate. Consider targeted reviews of a disputed correct-result/flawed-reasoning judgment during incomplete assessment, but keep them bounded to avoid repeated full reviews on every turn.

### B. Targeted audit

After the blind findings are fixed, compare them with the primary assessment. Audit each proposed supported item for a concrete defect: irrelevant evidence, uncovered component, wrong learning level, unresolved contradiction, supplied reasoning, invalid method, or unmet required transfer. Where deterministic checks suffice, use code. Use a narrow model audit only when the evidence interpretations differ or require semantic review.

The audit must confirm valid support as readily as it identifies defects. Rejection requires a specific missing demonstration or evidence-supported error; a generic instruction to be stricter is insufficient.

### C. Reconciliation

- Confirmed support remains supported.
- Insufficient evidence becomes `unclear` or `missing`, according to whether relevant evidence exists.
- Demonstrated unresolved error becomes `flawed` and retains the cited contradiction/error.
- Inability to judge records abstention and blocks automatic completion pending recovery or review.
- Unresolved semantic disagreement blocks completion and produces one targeted evidence request or human review; neither majority voting nor averaging determines completion.
- Retain findings from both passes and the final reconciliation reason. Do not replace useful findings with a generic disagreement message.

Start with the same selected model to isolate the effect of the workflow. Add separately configurable reviewer provider/model selection later only if validation demonstrates benefit. A second call or a different model does not establish independence statistically.

For Quantitative Analyze, the reviewer independently checks the exercise solutions and the learner's verdicts/corrections. Record these checks against the original problem and steps; do not accept the classmate's tentative solutions as authoritative. Add deterministic calculation checks where feasible and appropriate, without assuming symbolic checks establish conceptual understanding.

## Application completion rules

Automatic completion requires all of the following:

These are proposed application rules for the refined evaluator, enforced after validation and rollout. The all-required-items policy is an instructor-approved sufficiency decision, not a universal educational threshold. Completion describes session rubric coverage under sampled conditions, not durable mastery.

- Every required criterion and the explicit required level task is supported across all required components.
- No material unresolved contradiction remains.
- Required independence and transfer checks have valid learner evidence.
- The fresh final review confirms sufficiency, and all audit disagreements are resolved.
- No unresolved reliability condition prevents judging a required item.

No rubric criterion may remain unmet when completion is granted. An unfair question, no opportunity, or insufficient evidence blocks demonstration of a required item but is not reported as learner failure. Failures in providers or structured-output validation do not alter progress or produce completion.

## Implementation sequence

### Phase 0: Assessment specification and expert baseline

Before model changes, instructors define target claims, integrated/component evidence, acceptable alternative methods, task sampling, assistance expectations, material errors, and completion policy. Build a pilot set of complete conversations and have at least two qualified raters independently score a subset before discussion and adjudication. Revise ambiguous rubrics and record expert disagreements; do not treat a single professor label as unquestionable ground truth. Establish baseline error rates and decision costs. Review instructions with learners for accessibility and clarity.

Deliverable: a defensible assessment specification and calibrated reference set. This foundation can proceed alongside engineering contract work, but must precede claims about improved evaluation.

### Phase 1: Contracts and deterministic safeguards

Extract assessment schemas, citation validation, and completion rules from `chat.js` into focused modules. Add stable criterion/message IDs, schema versions, required flags, separate opportunity, explicit task definitions, and evidence observations. Map legacy `needs_clarification` to `unclear` at the new contract boundary while supporting old saved sessions. Keep result correctness separate.

Deliverable: validated structured records and application-owned completion, with meaningful tests for fabricated citations, attempted rubric waivers, component coverage, and migration.

### Phase 2: Grounding and assessment quality

Add approved reference/example bundles and configuration for missing-reference policy. Add opportunity checks, assistance provenance, learning-level checks, misconception evidence, and component/transfer coverage. Update prompt catalog and developer traces. Define the instructor approval workflow before describing arbitrary learner uploads as approved materials.

Deliverable: grounded assessments that distinguish evidence gaps, errors, assistance, and unreliable opportunities.

### Phase 3: Fresh review and audit

Replace `chat.secondAssessment` and status-only `reconcile()` with blind evidence review, targeted audit, and finding-based reconciliation. Version prompts and expose traces in developer tools. Preserve meaningful reasons and next evidence objectives. Validate image/reference citations and review schemas.

Deliverable: a shadow-mode review/audit experiment against original evidence. Promote it to the completion path only if held-out results justify its error and burden tradeoffs; keep original-evidence review as the design requirement while testing the implementation.

### Phase 4: History, follow-ups, and progress

Persist assessment events and revisions in the learning store. Add no-progress tracking and bounded assessment loops. Improve follow-up generation and question validation. Update rubric progress, review feedback, and developer panels to show coverage, opportunity, assistance, contradictions, abstention, and final-review findings.

Replace or relabel the existing Quantitative Analyze percentage, which averages status values, with rubric coverage and explicit assessment findings. Do not present it as a percentage of understanding; a conventional course grade requires its own approved scoring policy.

Deliverable: transparent revisable progress and productive, bounded questioning across regular sessions and playgrounds.

### Phase 5: Human review and expert validation

Implement authenticated instructor review and versioned overrides once storage/identity scope is agreed. Expand the Phase 0 reference set and evaluation runner, preserving independent ratings and adjudications. Compare the existing repeated second pass with the new review flow under the same model; then assess alternative reviewer models if useful.

Deliverable: auditable corrections and evidence that refinements reduce false completion without excessive blocking or unfairness.

## Validation and release criteria

Use complete conversations and independently assessed follow-up tasks; isolated-answer tests remain useful for citation and schema checks but cannot establish conversation-level validity. Include valid alternative methods, concise and verbose equivalents, correct results with faulty reasoning, unrelated arithmetic mistakes, hints and supplied answers, repaired misconceptions, later contradictions, ambiguous questions, unreadable images, transfer requirements, conflicting references, attempted rubric waivers, and manipulation attempts.

Measure false completion, unnecessary blocking of expert-supported performance, agreement per criterion/component, citation validity, assistance classification, question quality, loop frequency, latency, and cost. Check fairness across matched answer variants that differ in grammar, vocabulary, and verbosity but preserve substantive evidence. Do not substitute self-reported model confidence for measured performance.

Set numeric release thresholds with the instructors before scoring the held-out set. Keep a held-out conversation set and preserve adjudication reasons. Compare primary-only, current repeated second-pass, and proposed review/audit behavior. Release incrementally behind a versioned evaluator flag; retain prior records and a rollback route. Run existing learning-flow, learning-type, rubric, provider, and generation-resilience checks alongside new meaningful contract and completion tests.

Separate three validation questions:

1. **Can the system interpret evidence defensibly?** Measure independent expert agreement before adjudication, model agreement with adjudicated decisions, per-status confusion matrices, false-completion and unnecessary-blocking rates, and uncertainty intervals. Report abstentions separately so apparent accuracy cannot improve simply by avoiding difficult cases. Keep splits at learner/conversation level and isolate calibration examples from held-out cases.
2. **Does the extra review help?** Run paired evaluations on the same conversations and repeat a subset to assess output stability. Compare the primary assessment, existing second pass, blind review alone, and blind review plus targeted audit. Report both newly caught false passes and newly blocked valid passes, including effects of longer transcripts, assistance, corrected errors, and task type. A higher disagreement rate is not evidence of improvement. Begin in shadow mode; do not automatically add the third semantic audit call if it shows no incremental value.
3. **Does the resulting interaction help learning?** Use an appropriately designed pilot with comparable groups or randomized assignment where feasible, pre-assessment, immediate independent tasks, delayed checks, and defined near-transfer tasks. Measure productive evidence elicitation, learner burden, disengagement, and access barriers. Scoring agreement alone cannot establish learning gains. Treat small samples and subgroup comparisons as exploratory when precision is insufficient.

Operational fairness checks should include accessible alternative representations and language variants, while preserving the actual target construct. Do not remove language demands when language itself is the assessed objective. Qualitative learner interviews can identify misunderstandings that matched-text tests miss. These study designs are proposed evaluation methods, not a guarantee of causal conclusions from an uncontrolled deployment.

## Decisions to settle before implementation

- Who approves course references, criterion components, and scoring examples, and where are versions stored?
- Which criteria require independent performance or transfer, and what constitutes substantive help in the course?
- What should the app do when approved references are absent, inconsistent, or insufficient?
- What limits define an unproductive loop, and what approved study, pause, alternate representation, and human-review options are available?
- Is instructor review browser-local for a prototype, or authenticated and shared through backend storage?
- What expert-defined error thresholds, latency, and cost budgets govern rollout?

These decisions do not block implementing the contract, evidence validation, and blind review foundations. They do govern grounding policy, completion semantics, and claims about instructor correction.
