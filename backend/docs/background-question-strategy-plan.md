# Background knowledge question strategy: revised plan

Status: implemented November 2, 2026. The design below records the intended behavior; current verification and limitations are documented in `output/background-strategy-live-2026-11-02.md`.

## Purpose

Ask one simpler question about knowledge needed for an unresolved harder task, then help the student reconnect that knowledge to the original task. Keep the student supplying the explanation and solution.

Example sequence:

1. Original task: explain why a falling object reaches terminal velocity.
2. Student: “It must still be accelerating because it is moving fast.”
3. Background probe: “How is acceleration related to the net force on an object?”
4. If the response establishes that relationship, return: “How does that relationship help explain the constant speed in the original situation?”

Ask each question on its own turn. The background question does not establish that the student can solve the original task.

## Changes from the first plan

- Use the restored ordinary-chat architecture: evaluation followed by one combined strategy-selection/question-generation call. Do not move selection into evaluation or add a separate frustration detector, planner, or reviewer call.
- Treat this as a short conversational sequence rather than another standalone diagnostic question. Record the original task and the return path explicitly.
- Separate task level from probe level. Permit a bounded prerequisite probe without changing the active level or passing requirement.
- Distinguish difficulty from frustration. Frustration can prompt a change of approach, but does not establish that prerequisite knowledge is missing.
- Test return-to-task behavior and assessment integrity, not only the first generated question.

## When to choose it

Choose a background probe when a specific prerequisite could explain the demonstrated difficulty and retrieving or explaining it could help with the active task. Cite an actual student statement and link the prerequisite to one unresolved rubric item. Treat the suspected gap as a hypothesis, not a diagnosis.

Useful signals include an explicit knowledge gap, a concrete confusion about an underlying relationship, or unsuccessful follow-ups with a plausible prerequisite obstacle. Repeated difficulty is supporting context, not a required waiting period.

Avoid it when the prerequisite is already established, the original question is ambiguous, needed data are missing, or the proposed background fact has no clear path back to the harder task. Rephrase confusing wording, supply necessary observational givens, or choose a more specific diagnostic strategy where appropriate.

An explicit statement such as “I am frustrated” should affect how the system responds. A mistake or short answer alone should not be labeled frustration. Do not make emotional classification a prerequisite for helpful scaffolding.

## Distinguish it from existing strategies

Recall-specific-element requests a missing fact within a recall task. Clarify-specific-term resolves an ambiguous phrase. This strategy temporarily probes a prerequisite of a harder task and carries an obligation to return. Mechanism-tracing or answer-reason consistency can remain better choices when the student already knows the prerequisite and needs to connect or justify it directly.

Proposed ID: `background-knowledge-bridge`. Initially support active Understand, Apply, and Analyze tasks. Continue using the existing recall strategy at Remember. A background probe may itself request recall, explanation, or a simpler application when appropriate; at Understand it must stay within the established setting and avoid a new application exercise.

## Conversational behavior

Use three explicit states: original task, background probe, and return to task.

- Before the probe, record the original task, active rubric item, exact student quote, prerequisite, probe demand, and intended connection back.
- Ask one answerable background question without supplying the missing principle or answer.
- If the answer establishes the prerequisite, ask the student to use it in the original task on the next turn. Do not require a separate automatic transition call.
- If the answer is unclear, allow one targeted rephrasing or narrower probe. After two background probes, end that detour: return to an accessible part of the original task or offer a brief choice of continuing versus requesting help. Do not cycle through unrelated prerequisites or force an unanswerable return.
- If the student independently reconnects the idea and resolves the original task in their answer, assess that demonstration directly instead of requiring a redundant return question.
- If the student changes direction, honor that request and clear the pending detour when appropriate. Clear it at a level or concept transition.

The two-probe limit is a proposed product default to evaluate, not a research-derived threshold. Any explanatory help should remain visibly attributable assistance and must not silently supply the original solution.

## Assessment and state

Keep the original task level and rubric unchanged. Attach explicit background-probe context to the assistant question so the evaluator knows what opportunity the student actually received. A correct prerequisite answer alone cannot complete Apply or Analyze; an incorrect answer to a simpler question should not automatically be scored as an attempted full solution. It can still provide relevant evidence of a gap or error. Genuine volunteered original-task reasoning may count when it satisfies the existing evidence rules.

Persist the pending background sequence with the conversation, including its original question, prerequisite, probe count, probe demand, and return target. Do not rely only on the latest strategy label: another strategy choice or a reload must not erase the original task. Validate persisted metadata and its linkage to the current stage; a supplied label must never bypass completion checks. Preserve existing assistance, independent-evidence, and transfer requirements.

## Implementation scope

1. Add a reviewed strategy record and original examples to `question-strategies.json`, with requirements, contraindications, distinctions, and active-level guidance.
2. Extend the ordinary response schema and `inlineQuestionStrategies.js` with compact optional scaffolding metadata. Validate required fields only for this strategy and its continuation. Use explicit nullable/schema variants rather than adding a large plan to every response.
3. Update `strategyPlanning.js`, `questionTargeting.js`, and question-review guidance with a narrow, explicit task-level/probe-level exception. Leave ordinary diagnostic questions subject to their existing level rules. Adapt the developer planner and generator context as well, so both paths can represent the new strategy honestly.
4. Update conversation evaluation context and instructions to distinguish the prerequisite opportunity from the original task. This adds context to the existing evaluator call, not strategy selection or a new call.
5. Extend conversation persistence and restoration for the pending sequence, and update retry/cache identity where the evaluation context changes. Keep strategy construction and next-action selection inside the existing response call.
6. Add the required strategy-level comparison cases and reviewed fixture rubrics together; catalog loading currently requires coverage of every supported strategy-level pair. If initial deployment is restricted, enforce that eligibility explicitly rather than advertising unsupported levels or flows.

Keep the first implementation limited to ordinary follow-ups where catalog strategies already run. Openings and Quantitative Analyze paper flows remain outside this initial scope. Avoid importing broad background research or long example sets into every request.

## Verification and rollout

Before live testing, verify exact quote/rubric grounding, eligibility, state persistence, probe limits, return behavior, assessment opportunity, completion safeguards, and existing fallback behavior. Include a student who answers the original task while replying to the prerequisite, and one whose difficulty is confusing wording rather than missing knowledge.

Then compare short multi-turn conversations with and without the strategy using the same inputs and model. Include a genuine prerequisite gap, already-established prerequisite, explicit frustration, repeated difficulty, an ambiguous question, and a non-physics topic. Review whether the selected prerequisite is relevant, the question avoids answer leakage, the student is brought back to the original task, and the final explanation demonstrates the harder reasoning. Do not supply ideal student replies and treat completion as proof of learning.

Measure per-turn evaluation and generation time, total calls/retries, and total time/turns until return or resolution. A simpler question may add conversational turns even when each turn still uses two calls. Preserve traces and distinguish manual review from independent or learner validation.

The existing five-case live check supports the current catalog wiring and shows that moving selection between calls did not establish a latency benefit. It did not test this new background strategy or demonstrate learning gains. Roll out only after reviewing actual multi-turn behavior; no new latency or educational-effectiveness claim is established by this plan.
