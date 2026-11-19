# Make the evaluator easier to pass

## Goal

Learners should pass as soon as their own answers demonstrate the required knowledge. A correct answer in everyday language, an equivalent equation, or a concrete statement should earn the same credit as textbook phrasing when it conveys the same meaning.

Start with the refined evaluator and its follow-up questions at Remember and Understand. Evaluate Apply and Analyze in a separate rollout so the replay results can isolate each change. Strategy request size is a separate workstream.

Use the same grading rules across topics and learning types. Derive requirements from the task, authored rubric, and evidence in the exchange. Use subject-specific examples as test cases for the general rules.

## Current state

- The refined evaluator now has an explicit Remember and Understand instruction to accept equivalent wording, notation, and concrete statements. Both of its prompt variants receive the instruction.
- The chat evaluator cache version was bumped so new evaluations pick up the instruction.
- The evaluator suite recorded 263 passes, zero failures, and four TODOs. Live grading of equivalent answers still needs verification.

## 1. Define the evidence needed at each level

- **Remember.** Accept accurate recall in any equivalent form. If the question asks the learner to state Ohm’s law, `V = IR` can demonstrate recall. If the task specifically asks the learner to name the quantities or state a condition, require that part too.
- **Understand.** Accept explanations in the learner’s own words. If the rubric requires direct proportionality at fixed resistance, “doubling the voltage doubles the current while resistance stays the same” demonstrates it. An equation can contribute evidence. Ask for interpretation if the task calls for it and the learner has only written the equation.
- **Explicit vocabulary.** If a task asks for the name of a relationship, require that name or a recognized equivalent. If the task asks what the relationship means, accept any scientifically equivalent explanation.
- **Citations.** Continue verifying quotes against the learner’s actual messages. Grade what the quote means in the context of the question and earlier learner evidence.
- **Partial and incorrect answers.** Give credit for knowledge already demonstrated and keep the criterion open when required evidence is missing. A material contradiction stays unresolved until the learner corrects it.

## 2. Build a replay set before changing more behavior

Use the existing evaluator runner in `scripts/evaluate-evaluator.mjs` where it supports the case. Include chat replays for cases that need a follow-up and a second grading turn. Run the same cases against the prompt before and after the wording change with the same provider, model, and settings.

For each topic, author an exact expected outcome for textbook phrasing, an equivalent paraphrase, a partial answer, and an incorrect answer. Use the same question and rubric within each group.

| Topic | Level | What the case should establish |
| --- | --- | --- |
| Ohm’s law | Remember | Recall expressed as an equation or in words earns equivalent credit when the task is to state the law. |
| Ohm’s law | Understand | Correct doubling at fixed resistance earns credit for proportionality. A direction-only answer gets one follow-up. |
| Series circuits | Understand | “The same amount of charge passes each point every second” can demonstrate equal current when there are no branches. |
| Natural selection | Understand | An everyday explanation can demonstrate how heritable variation and differences in reproduction change a population over generations. A claim that individuals change because they need to remains unresolved. |
| Independent variable | Remember | Everyday wording suffices for a definition. An explicit request to name the term requires a correct name. |

Add cases for evidence spread across two learner turns, a volunteered correction, and a learner merely echoing a substantive answer supplied by the assistant. For context-sensitive examples, include both a question that supplies the condition and a question that explicitly asks the learner to state it.

Record the judgment, cited evidence, completion state, next evidence objective, actual follow-up, turns to pass, and model request count. Repeat cases with inconsistent outcomes before attributing a difference to the prompt.

## 3. Fix the layer responsible for each failure

1. **Evaluator.** If the model treats equivalent wording as missing, inspect the criterion and level-task judgments separately. Tighten the grading instruction if either adds an unsupported wording requirement. Preserve the citation and completion checks.
2. **Follow-up generator.** If the grading identifies the right gap but the chat asks for a restatement, use the evaluator’s next evidence objective to ask about one missing idea. For “more voltage means more current,” ask what happens to current when voltage doubles and resistance stays fixed. Keep the previously established direction as evidence when grading the reply.
3. **Rubric generation.** If a generated rubric is causing the failure, check whether it makes a sample phrase, an illustrative example, or a preferred method mandatory. Rewrite the generation guidance to specify the knowledge the learner should demonstrate. Preserve explicit instructor-authored requirements and existing rubrics.

Replay the relevant cases after each change. Keep separate changes reviewable so a regression can be traced to the evaluator, the follow-up, or the rubric.

## 4. Verify and finish

- Equivalent textbook and everyday answers pass on the same turn in the replay set when they satisfy the same requirements.
- Partial answers receive a question about the missing substance and can pass on the next turn once the learner supplies it.
- Incorrect answers, unsupported guesses, and answers that omit an explicitly required term or condition stay unresolved.
- Evidence already demonstrated in the current stage continues to count across follow-ups.
- The changes add no model calls to the normal grading or follow-up path. Record any change in retries and input size separately.
- Run `npm run test:evaluator` and any focused chat or rubric tests relevant to the changes. Review live replay results alongside the automated tests.

Start by replaying the Ohm’s law pairs with the existing prompt change. Use those results to decide whether the next edit belongs in grading, follow-up generation, or rubric generation.

## 5. Define sufficient evidence at Apply and Analyze

- **Apply.** A learner can pass on the original task when they independently select or use the relevant knowledge as the task requires, carry out the application, and support the result to the extent the rubric calls for. Credit valid alternative methods. If the task supplies a method as a given, evaluate the choices and work the task actually leaves to the learner.
- **Analyze.** A learner can pass on the original task by interpreting evidence, tracing relationships, evaluating a claim, or distinguishing explanations as the rubric requires. Accept a justified conclusion that the evidence is insufficient when the scenario is genuinely underdetermined. If the rubric asks how to distinguish explanations, require a meaningful observation or test and the reasoning connecting it to the possibilities.
- **Separate result from reasoning.** Retain credit for a sound method when a learner makes an arithmetic, transcription, or analogous execution slip. Ask for a correction when the result is required. If a correct result leaves required reasoning unclear, ask for the missing reasoning.
- **Paper review.** Evaluate the learner’s justification for the relevant verdict or disputed step. Accept valid alternative explanations. Ask about the unresolved step while retaining the evidence from steps the learner already justified.

## 6. Separate transfer from independence

Today ordinary refined Apply and Analyze use transfer as part of the level-task gate, and the task definition couples that gate to independence. Simply disabling transfer can also remove the detailed independence check on turns without tracked help. Make the two requirements explicit in the task definition and validate each separately.

| Requirement | Proposed default | What satisfies it |
| --- | --- | --- |
| Transfer | Optional unless the task or rubric explicitly requires using the idea across contexts or conditions | The learner reasons correctly about the required changed condition. Volunteered evidence can satisfy this in the same turn. |
| Independent reasoning | Check who supplied the reasoning that earns credit | The learner supplies the required decisions, explanation, or inference. A fair prompt, scenario givens, or clarification can coexist with independent work. |

1. **Represent transfer as a task requirement.** Keep it when an authored criterion explicitly requires a comparison or application under changed conditions. Use task or rubric policy to carry that requirement through grading and follow-up generation. Avoid topic keywords as the trigger. Include existing saved rubrics in replay coverage, especially explicit transfer requirements expressed in different words.
2. **Attribute assistance to the reasoning it supplied.** Check cited learner evidence against the preceding exchange, including ordinary hints and supplied solutions as well as tracked help. Distinguish clarification or given information from a hint that contributes a required inference. Retain independently demonstrated parts even if the learner later asks for help on another part.
3. **Choose the smallest follow-up that resolves the gap.** Ask for an explanation in the original context when the learner gave a bare result and the reasoning is still theirs to supply. If the assistant already supplied that reasoning, ask for an independent step or inference in a small variation where it cannot be echoed. Use a changed condition when the rubric requires transfer or when it is needed to obtain fresh evidence.
4. **Keep grading and follow-up aligned.** Completion should distinguish missing required transfer from unresolved independence. Use that distinction to generate the next question, and version cached evaluator results if the grading policy changes.

## 7. Replay Apply and Analyze before rollout

Compare the current policy with optional transfer and explicit independence checks using the same transcripts, model settings, and expected outcomes. Include quantitative, experimental, and design tasks across multiple topics. For example, use rate calculations, interpretation of an experiment with competing explanations, and evaluation of a design against a constraint. Include quantitative paper review where the learner justifies a verdict.

| Replay case | Expected under the proposed policy |
| --- | --- |
| Complete independent application or analysis in the original task, with optional transfer | Pass immediately. |
| Same quality of original-task reasoning, with transfer explicitly required | Remain open until the learner independently demonstrates the required changed-condition reasoning. |
| Original and required changed-condition reasoning volunteered in one answer | Pass without a redundant follow-up. |
| Correct result with required reasoning missing | Ask for the reasoning. Pass once the learner supplies it independently. |
| Assistant supplies the decisive reasoning and learner repeats it, with optional transfer | Remain open. Ask for a focused independent check and pass once it is demonstrated. |
| Assistant supplies the decisive reasoning in a changed scenario, with required transfer | Remain open. Check that the learner independently supplies the changed-condition reasoning. |
| Assistant clarifies wording or provides scenario givens and learner supplies the reasoning | Pass when the other requirements are met. |
| Learner demonstrates one part independently and receives substantive help on another | Preserve the first part. Recheck the assisted part. |
| Valid method with an execution slip | Preserve method evidence and require correction if the result is part of the task. |
| Analyze answer explains why the evidence cannot distinguish competing accounts | Pass if it meets the rubric, including a discriminating test where required. |
| Analyze answer asserts an unsupported cause or gives a verdict without required justification | Remain open and ask for the missing evidence or reasoning. |

Include matched textbook and plain-language answers at both levels. For each replay, record which requirement blocked completion, which evidence was credited, what help was attributed to each inference, the actual follow-up, turns to pass, and model calls and retries.

Roll out when complete independent answers with optional transfer pass sooner, explicit transfer requirements are preserved, and the replay set shows no new passes for copied, incomplete, or incorrect reasoning. Verify that the change uses the existing evaluator and follow-up calls, then rerun the evaluator and relevant chat tests.

## Initial replay results

Run the grading replays with `node scripts/replay-evaluator-policy.mjs` and the transfer experiment with `node scripts/replay-evaluator-policy.mjs --advanced`. These runs grade fixed transcripts and capture the evaluator’s next objective. Full chat follow-up replays remain a separate step.

- **Remember and Understand.** On `gpt-6.1-sol`, both prompt versions accepted the plain-language Ohm’s law doubling answer and the natural selection paraphrase. Partial and incorrect answers stayed open. Both versions held back the shorter textbook statement of direct proportionality. Check whether the task expects an explanation beyond naming the relationship and add a matched textbook explanation with the same detail as the paraphrase.
- **Apply.** The independent average-speed answer passed with transfer optional and was blocked when transfer was required. The answer that echoed assistant-supplied reasoning stayed open with transfer optional and received an independent-check objective.
- **Analyze.** The independent germination answer met the rubric criterion, but the experimental level task also expected analysis of results against a theoretical prediction. Turning transfer off removed the transfer blockers and exposed that separate hurdle. Add a fixture that supplies those data and meets the current level task. Test separately whether the level task should require those elements for a rubric focused on confounding. The copied answer stayed open under both policies.

Ordinary refined Apply and Analyze now use the independent-reasoning check with transfer optional by default. Explicit rubric requirements still apply, including requirements written in plain language.

### Analyze follow-up replay

Run `node scripts/replay-evaluator-policy.mjs --advanced --analyze-only gpt-6.1-sol` to repeat the two transfer-off cases. With simulated germination counts and a temperature-only prediction supplied, the independent answer passed with no blockers. The same answer stayed open when the assistant supplied the reasoning first. Both the authored criterion and the level task reported `independent_check_needed`, and the evaluator requested fresh evidence without a worked explanation.

### Ordinary chat rollout check

Run `node scripts/replay-evaluator-policy.mjs --chat gpt-6.1-sol` to replay the ordinary chat path. The independent Apply and Analyze answers passed on the original tasks. The copied answers stayed open and generated follow-ups with fresh givens. An explicit rubric requirement to apply the method to a trip with a stationary interval stayed open and generated a question about that interval.

Run `node scripts/replay-evaluator-policy.mjs --complete gpt-6.1-sol` for the completion cases. Apply passed after the learner calculated and interpreted a new average speed. Analyze passed after the learner used an additional control group to draw a fresh inference about temperature. The explicit transfer case passed after the learner included the stationary interval and explained its effect. All three completed with no blockers.

## Response performance

- Ordinary follow-ups use a shortlist of up to three strategies and keep the full transcript. Repeated live screening measured a 44% reduction in follow-up request size from the shortlist, with mixed timing.
- A retry names the actual validation error. Valid questions with invalid optional strategy metadata return immediately. Pending prerequisite detours still require valid continuation metadata.
- Earlier skipped goals keep their original grading level and remain outside active completion. Run `node scripts/benchmark-skipped-recovery.mjs gpt-6.1-sol` to compare split and combined calls. The four synthetic pairs agreed on active completion and statuses, recovered credit, and recorded mistakes. The combined branch made one grading call per turn instead of three, but it was slower in all four pairs, so ordinary chat uses split recovery.
