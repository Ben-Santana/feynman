# Refined evaluator and learner in normal conversations

The normal `/api/chat` path now uses the same lean refined primary as the evaluator developer tool. Exact evidence citations and every rubric item plus the level task control progression. No legacy confirmation or experimental shadow call runs in normal conversations. Developer comparisons retain their explicit legacy baseline and opt-in shadow/ablation modes.

`refinedEvaluator.js` shares instructions and material construction with the comparison tool. Its conversation adapter preserves the existing checklist, progress, grade and summary response fields, while retaining the full validated assessment under `assessment.refined`. It maps unclear to the UI's existing needs-clarification status; it never recomputes a more permissive completion decision.

For unfinished ordinary stages, `strategyLearner.js` diagnoses understanding with exact learner citations, retrieves reviewed strategies, selects a grounded plan, checks the plan, generates one question, and independently checks that question. Developer comparisons use the same pipeline. Missing strategy coverage or rejected plans/questions use the ordinary rubric-based generator, without first spending a call on an unused baseline question. The diagnostic state and applied strategy are returned as `learnerModel` and saved with the concept; they are cleared at a level transition. They cannot override rubric completion.

Opening turns retain the existing opening/scenario behavior. Quantitative Analyze retains its worked-paper, review, explanation and report flow, with refined evaluation after the explanation. The strategy pipeline does not replace paper generation or paper-review acknowledgement.

These are runtime defaults, not client-selectable assessment modes. Client fields cannot switch the main API back to legacy evaluation or enable shadow. The selected provider/model remains controlled by the existing AI settings.

After pulling upstream main (`75fbd55`), developer requests use the account-authenticated transport and retain admin-only access. The evaluator and strategy CLI tools require an active admin access token in `FEYNMAN_ACCOUNT_TOKEN`; the removed four-digit access-code endpoint is no longer used. Tokens are not saved to result archives.

Human-rated held-out conversations, expert adjudication and independent evaluation of learning gains remain deferred. The previous authored-fixture results do not establish educational validity; activation here follows the user's explicit request.

Validation after integration: frontend production build passed; the full suite reported 494 passed, four deferred TODOs, and one existing Windows file-mode failure in the credential-storage test (`0666` reported versus expected `0600`). Conversation/API integration tests passed. Source lint passed with the existing ChatComposer effect warning.
