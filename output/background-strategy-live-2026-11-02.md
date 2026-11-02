# Background knowledge strategy: implementation verification

Implemented November 2, 2026. Ordinary conversations keep response-side strategy selection and the existing two-call flow. The library now has 19 strategies and 54 strategy-level coverage fixtures (70 cases including the original 16). The new fixture rubrics and examples are authored, not model-generated or empirically validated.

## Behavior

- A concrete prerequisite obstacle can trigger a simpler question without changing the original task's level or rubric.
- Assistant messages save the prerequisite, original question, return target, probe demand, and sequence state. This survives learning-chat and Chat Workshop persistence.
- A detour allows up to two probes, then requires a return or exit. It cannot be reopened for the same rubric item during that stage. Help closes the pending detour while retaining assistance provenance.
- The evaluator sees the actual opportunity. Prerequisite-only answers cannot complete the harder task; volunteered original-task reasoning may count subject to all existing gates and exact evidence checks.
- Level transitions remove the active detour. Earlier probes remain inactive history when Quantitative Analyze receives the full concept conversation. Remember and the Quantitative Analyze paper flow do not start this strategy.
- Frustration alone does not establish a prerequisite gap. Wording ambiguity can receive clarification instead.

## Live check

Used the connected ChatGPT account and `gpt-6.1-sol`. Selection was unforced. Three original fixtures represented explicit prerequisite gaps at Understand, Apply, and Analyze. A fourth case represented confusing question wording with the core relationship already stated.

For each selected bridge, a scripted student answer supplied only the prerequisite. This tests continuation behavior; it is not an actual learner experiment or a completion/learning-gain measurement. Inputs, model instructions, response schemas, raw responses, errors, and timings are preserved in separate JSON traces.

Initial runs exposed two issues. The first run selected other strategies or a fallback rather than recognizing prerequisite gaps. Selection guidance was revised to recognize explicitly unavailable prerequisites and permit a temporary detour toward the original evidence target. The second run selected the bridge but counted the model's setup message when identifying the original question. Explicit stage-local anchor maps and schema enums fixed that indexing error. Both earlier traces are retained in `background-strategy-live-2026-11-02.json` and `background-strategy-live-2026-11-02-v2.json`.

The final run is `background-strategy-live-2026-11-02-v3.json`:

| Case | First question | Continuation | Result |
| --- | --- | --- | --- |
| Understand: terminal velocity | “What can you recall about how the net force on an object relates to its acceleration?” | Reconnects constant speed and changing velocity to the original acceleration claim. | Bridge probe → return; prerequisite answer does not complete the harder task. |
| Apply: momentum in a collision | “How are a cart’s mass and velocity related to its momentum?” | Supplies masses and signed velocities for the previously underspecified two-cart collision and asks for a momentum-based shared-velocity prediction. | Bridge probe → return to application; prerequisite answer does not complete Apply. |
| Analyze: beetle population | “How does surviving predation affect a beetle’s chance to leave offspring?” | Asks how that relationship and the given inheritance condition bear on the report's individual-change explanation. | Bridge probe → return to analysis; prerequisite answer does not complete Analyze. |
| Wording ambiguity | Clarifies “account for” and asks why constant velocity means no acceleration. | No background detour. | Selected `clarify-specific-term`, not a prerequisite bridge. |

All seven final-run turns used exactly two calls without retries or errors (14 live requests). Total per-turn times were 10.29, 12.48, 12.30, 11.88, 12.03, 9.82, and 9.52 seconds. There is no paired control here and no latency improvement claim. More conversational turns may increase total time to resolve a task even when per-turn call count stays unchanged.

The implementing agent manually reviewed these questions: they elicit the prerequisite without supplying its answer, and the continuations return to the original reasoning. The Understand continuation addresses the speed/acceleration part first rather than demanding every force relationship at once. The Apply continuation adds concrete givens because the original task supplied no numerical values; it remains the two-cart momentum task. These are small, unblinded observations, not independent expert validation.

## Automated checks

The final focused regression run passed 184 tests covering the new sequence plus existing chat, evaluator, strategy comparison, learning flow, and retry behavior. Ten background-specific tests cover two-probe limits, invalid third-probe retries without reevaluation, exact grounding, stage metadata rejection, original-task completion safeguards, volunteered solutions, persistence, help, and inactive earlier-stage context in Quantitative Analyze. Coverage fixtures exercise the separate developer planner and generation-context path.

The broader suite initially reported 530 passing, 19 failures, and four TODOs. All 19 failures were in existing temporary credential/prompt-file tests under the Windows sandbox. Rerunning those two suites outside the sandbox passed 30 of 31 tests; the remaining failure is the existing Windows POSIX credential-file mode assertion (0666 versus expected 0600). No credential/prompt implementation was changed to bypass it. Two later background-specific regression cases were included in the final 184-test focused run.

Production build passed after correcting the persisted-message TypeScript type. The existing large-bundle warning remains.

## Reproduce

`node scripts/check-background-strategy.mjs background-strategy-live-new-run.json` sends synthetic inputs through the connected account and saves local traces. Choose a new filename to preserve historical runs. Model outputs and timings can vary. Questions and student-script answers are illustrative fixtures, not validated educational instruments.
