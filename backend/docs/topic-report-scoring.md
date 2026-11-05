# Topic reports and research scores

Apply `supabase/migrations/202611030001_topic_reports.sql` after the existing migrations. The API requires `SUPABASE_SECRET_KEY` for the server-only reporting RPCs. Browser clients cannot write score records or report snapshots. No historical scores are backfilled.

## Student flow

Completing every concept's assigned levels opens the topic report. **Finish topic** opens it earlier without advancing any levels. The server saves the final snapshot when the last assessment completes, even if the browser closes before opening the report. Opening the current report also saves an idempotent snapshot at the current assessment watermark. Historical report selection reads the original snapshot. Claude reviews the selected report’s goal results, assessment reasons, and cited student answers to generate 1–3 direct study instructions, capped at 15 words each. Summary generation loads separately from scores and reuses identical results within the server process. Opening it ends the session; the chat cannot be resumed.

The report groups criterion evidence as demonstrated, partially demonstrated, needs work, skipped, and not assessed. Progress counters are not used as proof of mastery. Supporting quotes are visible only in the student's report. The report prioritizes up to three evidenced errors, partial demonstrations, skips, then unassessed goals.

## Scoring contract

Each assigned rubric goal has equal weight. The evaluator's overall `level_task` still governs progression, independence, and transfer; it is excluded from numerical points.

- **1:** validated, fair, fully supported goal with no evidence or completion blockers.
- **0.5:** explicit `partialCredit.awarded` judgment with a specific missing requirement, verified learner evidence, correct result, valid reasoning, no contradiction, and no outstanding independence or transfer blocker.
- **0:** an evidenced incorrect substantive attempt or flawed reasoning.
- **Unscored:** skipped, unasked, ambiguous, unreadable, technically invalid, or otherwise unscorable evidence. `needs_clarification` alone never earns half credit.

Percentages are points divided by the number of scored goals. Each percentage is accompanied by scored/assigned counts and coverage. Blank percentages mean unavailable, not zero. Consequently, 100% with incomplete coverage does not mean every assigned goal was demonstrated.

First-attempt credit comes from the earliest fair substantive assessment for each goal. An ambiguous or assisted first attempt is frozen as unavailable; subsequent success does not replace it. Existing work at instrumentation time is flagged legacy and receives no reconstructed first score. Initial attempts occur at different times during the chat and are **not a topic pretest**.

Final credit comes from the latest valid result for that criterion at the report watermark. A later absent/ambiguous assessment does not erase a previous scored result; skips remain visible. Returning to a goal may change the final score. Evidence, assistance attribution, independent checks, transfer checks, and model/prompt/policy/rubric versions remain in append-only assessment events.

The rubric for an assigned topic is frozen from published instructor configuration. Personal sessions can extend their target using Continue, while earlier rubric goals remain fixed. Historical reports retain their original rubric version and denominator. Only assigned topics enter the research export.

## Persistence and APIs

`POST /api/chat` includes `assignmentSessionId`/`assignmentConceptId` for assigned work or `sessionId`/`conceptId` for personal work. The server resolves the saved rubric, requests explicit partial-credit and assistance judgments, verifies evidence, and persists the assessment **before** generating the next question or feedback. Responses include `assessmentRecord` with its server ID, sequence and criterion credits. Browser documents retain these references for recovery but never supply authoritative scores.

Retries use a hash of concept, level, and submitted stage transcript. The database's unique constraint preserves the original assessment and versions. A question generation failure cannot discard a saved assessment. Failed score writes block a successful turn; retry reuses the in-memory evaluator cache, or the saved assessment when persistence already succeeded.

- `POST /api/sessions/:sessionId/report?mode=early|completed`: save the report at the current watermark. Completion is checked against server records, not trusted from the requested mode.
- `GET /api/sessions/:sessionId/report`: inspect the current report without saving.
- `GET /api/sessions/:sessionId/report?snapshot=:snapshotId`: read an immutable historical report.
- `GET /api/admin/research/export?course=:courseId&kind=topics|criteria|roster|dictionary`: download a CSV or scoring dictionary.

All report requests verify ownership, approval, applicable consent, and active course enrollment. All exports require an admin account; course research files include only participants with signed agreements. Roster matching is a separate download containing identifying information.

## Study collection and classroom-grade matching

In **Admin → Analytics → Research scores**, enter the course ID. Download topic scores, criterion details, and the scoring dictionary. Default files contain the **latest** report per participant/topic and require complete first-attempt **and** final score coverage. Include incomplete coverage to inspect missingness; include earlier snapshots to study practice trajectories. Avoid treating snapshots from one student/topic as independent students.

Assessment events also retain database-assigned per-goal attempt ordinals. The topic file contains participant code, course/topic/session and snapshot IDs, timestamps, goal counts, first/final points and percentages, coverage, completion/legacy flags, rubric/policy versions, and assistance counts. The criterion file adds attempt counts, first/final event IDs and times, credits, limitations, first and final evaluator/prompt/provider/model versions, and criterion plus overall-level independent/transfer checks. It omits transcript quotes, reasons, student names, emails, and other free response text. The separate roster file joins coded participants to classroom grade records; keep it separate from analysis files. Criterion IDs map to the fixed instructor rubric, in level and item order.

Before collecting the study dataset:

1. Have instructors independently rate a consented sample of criterion answers using the 0/0.5/1 definitions. Use student reports or separately approved evidence collection; public research CSVs intentionally exclude transcript text.
2. Compare instructor/instructor and evaluator/instructor agreement, including partial-credit, fair-opportunity, and assistance judgments. Resolve ambiguous rubric requirements and revise the scoring policy if needed.
3. Freeze rubric, scoring policy, evaluator instructions, and model configuration for the collection period. Retain version metadata and analyze differing versions separately.
4. Prespecify which classroom test corresponds to each assigned topic, when chat practice must occur relative to it, which snapshots to use, and how incomplete coverage is handled. Do not select these rules after seeing grade correlations.

No instructor calibration or classroom-grade validation has been performed by this implementation. The feature records rubric performance during chat; the relationship to classroom grades remains a study question.

## Verification

`npm test` includes criterion-scoring tests, API failure/retry tests, and PostgreSQL integration tests for idempotency, immutable snapshots, enrollment/consent enforcement, exports, and personal target extensions. `npm run build` checks the report's TypeScript and production bundle. The report component has also been inspected in an isolated fixture at 1440, 768, and 390 pixels; this does not substitute for an authenticated deployment smoke test after applying the migration.
