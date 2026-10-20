# Feynman learning lab

Four learning levels: Remember, Understand, Apply, and Analyze. Create a titled session, choose its learning type, list concepts with a target level, then review an editable rubric. The learner completes the levels in order through each concept's target. The AI classmate conducts the conversation; a separate evaluator assesses the learner's evidence. Drafts, chats, and progress are saved to your account through Supabase.

Completing a concept ends its chat without a completion banner or closing reply. The level divider remains, with a Continue button when a higher level is available. Once every concept reaches its target, the learner can open a separate session summary with the demonstrated rubric goals, Analyze reports where available, and any goals that still need study. A session that finishes at Analyze opens the summary automatically. Completed sessions reopen on that page.

## Run locally

Requires Node.js 22.9+ (tested with Node 24).

1. `npm install`
2. Follow [account setup](backend/docs/accounts.md): configure Supabase, apply all SQL migrations and enable email and app password sign-in with Confirm email turned off. WPI Entra registration can be added later. Copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env` and supply the account variables.
3. Set `ANTHROPIC_API_KEY`; if the key is not workspace-scoped, also set `ANTHROPIC_WORKSPACE_ID`. Local admins may instead connect ChatGPT after login.
4. `npm run dev`
5. Open http://localhost:5173, choose **Create an account**, and sign up with any email and an app password. New accounts wait for approval in **Manage accounts**. Bootstrap your first approved admin using the setup guide to access account management and local developer tools.

The frontend reloads automatically during development. The backend restarts when its source or the shared learning types change, so prompt catalog changes take effect immediately. Saving prompts or sign-in credentials does not restart it. Restart `npm run dev` after environment changes.

The key stays on the Node server. `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-6`; use a model supporting forced tool calls. The backend binds to loopback. Backend requests require a Supabase login. Supabase data and storage policies restrict learning data to its owner. Configure the deployed origin and email delivery before launch; account setup is documented in the guide.

## Vercel services deployment

The root `vercel.json` defines one project with `backend` (Node HTTP server) and `frontend` (Vite static app). Keep the Vercel project root at the repository root. `/api/*` reaches the backend with the original `/api/` prefix; every other path reaches the frontend. The browser already calls relative `/api/...` URLs. There are no server-to-server calls between these services, so there are no service bindings; runtime binding URLs cannot be consumed by a static Vite build or browser.

Set `ANTHROPIC_API_KEY` and, if needed, `ANTHROPIC_WORKSPACE_ID` in Vercel project environment variables; optionally set `ANTHROPIC_MODEL`. Set `APP_ORIGIN` to the exact HTTPS origin when using a custom domain. Vercel deployment, branch, and production URLs are allowed automatically when their system environment variables are enabled. Also configure the frontend and backend Supabase variables and exact Auth callback URLs as described in the account guide. Backend requests validate Supabase bearer tokens; origin checks remain an additional restriction.

The hosted backend offers Anthropic only. Choose it explicitly in **AI settings**; saved ChatGPT selections are not silently switched to billed API requests. ChatGPT's local credential store, loopback callback, and developer prompt editing remain local-only. Prompts are bundled read-only for hosted inference and can be viewed by admins in Developer tools. Local credentials and `.env` files are excluded from Vercel uploads. Hosting ChatGPT connections would require a separate durable, per-user credential store and a supported hosted OAuth flow.

Use `vercel dev` from the repository root to test both services through one origin. For offline project setup, `vercel dev -L` runs without cloud authentication; set `APP_ORIGIN` to its local URL (for example `http://localhost:3000`) for hosted-origin checks. `npm run dev` retains the existing local app and ChatGPT flow.

## AI providers (local app)

New accounts default to Anthropic. Local admins can explicitly choose ChatGPT in AI settings. Eligible Plus/Pro users can authorize Feynman to use their existing ChatGPT plan; requests count toward that user's plan limits or authorized credits, with no app-owner API billing. OpenAI currently supports this flow for open-source and locally hosted personal apps; offering it in a paid or remotely hosted service requires approval. It is not unlimited free inference for every OpenAI account. See the [official integration overview](https://developers.openai.com/siwc/token-sharing-open-source).

AI settings supports saved account/workspace connections, reconnecting, signing out, model selection from the connected account's current catalog, and [managing usage in ChatGPT settings](https://chatgpt.com/settings/usage). The browser stores only provider/account/model preferences. OAuth credentials and short-lived PKCE transactions stay in `backend/.chatgpt/accounts.json`, which is ignored by Git and written atomically with owner-only permissions. The installation ID and account/client mappings survive sign-out. The callback uses `http://127.0.0.1:<backend-port>/auth/callback`; pending sign-ins survive backend restarts for ten minutes. Keep the backend running while finishing sign-in and run one backend per checkout. Never commit, share, or upload the credential store.

Both providers power conversations, independent evaluations, papers, rubric generation, concept suggestions, PDFs/images, and whiteboards. ChatGPT uses OAuth-authorized public Responses API requests with `store: false`, `stream: true`, namespaced function tools, and a required terminal completion event. Plan limits and revoked access produce actionable errors; the app never automatically switches to paid Anthropic requests. Choose Anthropic explicitly in AI settings to use those tokens. Existing API callers that omit the provider header retain Anthropic behavior.

Language-model APIs implement the JavaScript `LanguageModelProvider` base class in `backend/src/providers/`. Its shared contract uses neutral messages and JSON Schemas; each adapter handles its API's wire format and completion rules. The registry drives backend routing and AI settings, so another environment-configured API needs an adapter and one registration. See [Adding a language-model API](backend/docs/providers.md) for the contract, examples, and tests.

## Classroom role

### Question strategy comparison

Open **Developer tools → Question strategies** to compare the default learner with an experimental strategy database learner. The conversation dropdown groups sixteen fixed Understand-level transcripts under **FCI Direct Test** (six), **FCI Indirect Test** (six), and **ECE Indirect Test** (four). The FCI indirect cases cover torque, work and kinetic energy, buoyancy, spring energy, damping, and terminal velocity. The ECE cases cover signals-and-systems linearity and superposition, series current continuity, parallel branch voltage/current, and capacitor energy without current. All cases use the same seven reusable diagnostic strategies without adding electrical inventory content. Each run generates only one next question per branch. Both use the same provider/model, saved prompts, transcript, and existing rubric assessment. The experimental branch adds a diagnostic evaluator, reviewed-catalog retrieval, qualitative strategy selection, an explicit topic-specific plan, and independent suitability checks for the plan and generated question. This comparison does not use embeddings or fine-tuning. Normal conversations now use the refined evaluator and the same strategy learner; the comparison retains its original baseline.

Each result shows both Feynman questions side by side, labeled concepts, learning level and rubric items, diagnostic state, retrieval candidates, and model call details. Inventory page/item tracking is excluded from strategy records and saved results. Run one case, the selected folder, or all sixteen sequentially; the latest 20 paired results persist in browser storage. Fixed inputs do not guarantee deterministic model outputs or better questions. A completion verdict produces no comparison question. Failures remain errors rather than invented results.

The database is `backend/question-strategies.json`: controlled comparison, boundary case, remove a condition, separate a quantity from its change, reconcile specific claims, change representation, and clarify a specific term. Records describe applicability, requirements, contraindications, construction, and interpretation without embedding a mechanics answer or scenario. `design_reviewed` denotes review of the implementation and applicability rules, not independent educational validation; all records explicitly remain empirically unvalidated. No inventory page/item metadata or original PDF is bundled. The comparison endpoint is local-only, like prompt editing.

Retrieval includes all design-reviewed records compatible with the active level; common words such as equal/unequal no longer rank domain examples. The selector can return `none`. A selected plan must quote actual student evidence, name one saved rubric item, specify a concrete scenario and constraints, and distinguish plausible response patterns. The UI shows that adapted plan separately from the reusable record. Independent model checks can reject an unsupported analogy, wrong assumptions, answer leakage, or a question that does not implement the strategy. Rejected or absent fits reuse the existing default rubric question and record a `strategy_coverage_gap` event and reason in the saved developer trace. Malformed output is retried within bounds; provider failures remain errors. Selection is qualitative and makes no calibrated probability or mathematically optimal information-gain claim. Checks add model calls and latency, and are not proof of educational validity. Restart the backend after editing the JSON database.

All 16 fixture rubrics were generated once at their Understand level through `generateLevelRubric`, using `/api/developer/rubric`, the same pipeline as Chat playground's Generate items. The saved items and input/provider/model/prompt-version metadata live in `backend/comparison-rubrics.json`; comparisons load these items without making rubric-generation calls. Generation takes only concept, learning type, and level, not scripted answers. Earlier browser-saved results retain the rubric they originally used. With the local API running, `node scripts/generate-comparison-rubrics.mjs --force` explicitly regenerates all rubrics; omit `--force` to retain completed cases. The script defaults to the connected ChatGPT provider and checkpoints successful responses.

At Understand, the strategy branch must ask about meanings, mechanisms, or relationships in the existing explanation. Its planner, generator, and suitability checks prohibit numerical results, formula substitution, procedural execution, and solving new problems, including single-step calculations. The original comparison baseline retains its own instructions; normal conversations use the strategy restrictions. All reviewed examples eligible for the active level are passed to both the selector and strategy generator as reference context, including examples from strategies not ultimately selected. The result saves the full example context for inspection. Examples inform synthesis; the system selects a diagnostic method, not an example to copy. Adding a PDF does not import examples automatically: there is no CI ingestion workflow yet. Extend the JSON library with reviewed, level-labeled examples under existing strategies or new reviewed strategy definitions, then restart the backend. New comparison runs use the updated database; historical results retain their original context. Strategy-based generation is shared with ordinary chats.

Strategy questions require familiar language and one focused diagnostic point, with enough context and detail to probe understanding. Multiple sentences are welcome when they make the question easier to understand; there is no word-count target or cap. The independent suitability check rejects jargon, stacked qualifications, and confusing comparisons even when subject-correct. Length alone does not establish clarity. Rejected wording is retried within bounds; persistently unusable questions receive the logged rubric fallback. These additional clarity checks do not change the default learner.

Question generation receives a compact core: topic, level, one rubric item, the exact student claim, one diagnostic objective, and the selected strategy's construction rules, alongside the conversation and all eligible reviewed examples. Only controlled comparisons receive fixed/varied conditions; boundary, removal, and representation strategies receive necessary setting constraints. Full diagnostic summaries, selection rationales, drafted questions, response interpretations, prerequisite reports, and limitations remain with selection and validation rather than being sent to the generator. The generator no longer inherits the default branch's entire rubric and follow-up-focus prompt. Its core input is saved as `generationContext` and visible in the model call log. Default generation is unchanged.

Across all levels, the AI plays a classroom student and the user teaches it. It asks one clarifying question at a time and responds to mistakes with confusion, without giving facts, corrections, hints, or answers—even when asked. Quantitative Analyze is the exception for submitted work: it supplies a tentative classroom paper with numbered solution steps and a final answer, without revealing its verdict. The shared conversational instructions are in `chat.classroomRole` in `backend/prompts.json`; assessment runs in a separate model call.

## Learning types

Every new session requires one learning type. The type is shared across all concept chats and can only be changed on the naming page before starting. Changing an existing selection asks for confirmation, then clears every concept's rubric while keeping the concepts and target levels. Cancelling keeps both the type and rubric unchanged. A slim animated progress line across the top tracks setup from naming through rubric review. Existing saved sessions and API requests that omit it retain Quantitative behavior.

- **Theoretical / Conceptual:** define and explain concepts, apply them to a situation and make a prediction, then analyze interactions, mechanisms, changing conditions, and misconceptions.
- **Quantitative / Problem-Solving:** recall and explain methods, solve and interpret problems, then grade three worked classroom papers and explain their reasoning and corrections. A correct answer without sufficient reasoning cannot pass.
- **Experimental / Lab-Based:** recall experimental principles and procedures, connect measurements to theory, predict and interpret simulated measurements, then analyze patterns, discrepancies, and evidence-supported conclusions. All lab assessment data is clearly labeled simulated; no real experiment or measurement upload is required.
- **Design / Project-Based:** explain principles and requirements, make and justify a concrete design decision, then compare alternatives, tradeoffs, limitations, consequences, and changed constraints. Multiple defensible decisions can pass.

The non-quantitative types use backend-generated scenarios at Apply and Analyze, with an interactive discussion until each rubric requirement is supported. Their Analyze assessments use only that stage's learner evidence and produce no percentage grade or paper-review UI. Scenario facts are context, never credited as learner evidence. Generic templates, AI generation, student questions, and evaluator prompts follow the selected profile in `frontend/src/learningTypes.js`.

Returning through setup resets the generation checkbox and labels it “Re-generate rubric” when criteria already exist. Continuing with it unchecked fills missing required criteria without overwriting edits; checking it explicitly replaces the rubric with newly generated criteria. After a confirmed type change, setup generates fresh criteria for the new learning type. The type, conversations, scenarios, and progress persist in your account. A started session's learning type cannot be changed.

## Experiments

Choose a title and learning type, enter one concept and optionally add up to 19 more, and select a target level for each. Without files, the rubric receives generic criteria through the target; an optional toggle asks AI to write criteria from the concept names. Each rubric box contains editable checklist items that automatically grow to fit their text. Add, edit, or remove individual items on the rubric page before starting. AI generation returns separate, observable checklist requirements. The AI checks off supported items internally, with progress saved separately for every level. The rubric is hidden during chat and available in the session summary. Filling a higher level raises the target; clearing the highest filled level lowers it. Starting creates a separate chat for every concept, each opening with “Teach me about [concept].” Select a named concept in the chat switcher to continue it. Each passed level fills a quarter of its progress outline.

You can also upload multiple files totaling up to 5 MB. Use **Autofill concepts from files** to append suggested concept names, then choose targets for them. When you continue, AI generates a sample rubric from the uploaded materials through each selected target. Levels above the target remain blank and editable. PDFs and common images are sent to the selected provider directly; text-based files and Office-style archives are read as text first. Files with no readable text or supported media cannot be processed. Draft files are saved in private account storage and removed from the session document after it starts.

- **Remember:** the learner must recall or mention every specific point listed in that concept’s Remember criterion. Naming the concept alone only passes if that is all the criterion requires.
- **Understand:** an own-word explanation of that concept and its relevant relationships.
- **Apply:** a valid concrete application, worked through by the student.
- **Quantitative Analyze:** the AI submits three separate problems, each with numbered worked steps and a final answer. Click the paper peeking from the chat message to open the paper stack. Mark incorrect steps, then click the grade field at the top right of each paper to finalize it. Marked steps produce Fail; a paper with no marked steps produces Pass. After all papers are graded, the chat shows every marked step and asks the learner to explain what is wrong and how to correct it. If all papers pass, it asks how the steps were checked. The evaluator then checks the verdicts and explanation against the concept’s Analyze criterion. An incomplete result can be retried with a new paper set. Papers and reviews persist with the chat and are passed to the independent evaluator.

An independent evaluator assesses the active concept’s current level after each learner answer, except before the Quantitative Analyze paper review and its follow-up explanation. A correct result alone does not establish a sound explanation or method at higher levels. The server validates learner-message quotes and derives completion only when the every checklist item and the level task are supported. Each new level begins with a new assessment window, so earlier answers cannot complete it. Quantitative Analyze additionally considers the full conversation alongside the paper review. Provisional completion receives a second evaluator check. Disagreement leads to another question. The evaluator's verdict stays out of the classmate conversation. These experimental judgments are not validated educational measurements. Reference material and student messages are explicitly treated as data, not instructions.

API failures preserve the learner's draft and committed transcript. Retrying a turn repeats the assessment query. Completing Analyze ends that concept’s chat; incomplete non-quantitative Analyze assessments continue the discussion. Concept chats, drafts, and progress persist in Supabase, with account-scoped IndexedDB recovery for unsaved work. Concurrent device edits offer a server reload or a separate local copy instead of overwriting either version.

## Courses

Approved instructors can create courses from **Courses**, choose **Open** or
**Approval required** enrollment, and share the generated six-character code.
Students enter that code through **Join course**. Instructors can edit the course title
inline and use **Edit course** to choose a built-in banner, upload a JPG/PNG/WebP
image up to 5 MB, remove the banner, or change enrollment. Custom banners stay in
private course storage, visible only to the instructor and course applicants or members.
Course edits detect concurrent changes instead of overwriting them. Course enrollment does not
bypass account approval. Switching a course to Open admits every pending request;
switching back leaves enrolled students in place. Rejected requests stay rejected
until the instructor explicitly approves them.

Instructors create module drafts using the existing session setup and rubric
editor, including file-assisted AI generation. **Save draft** keeps unfinished
modules separately from personal sessions; unsaved changes also recover on the
same device. **Publish module** fixes its title, learning type, concepts, targets,
and rubrics. Publish a new module for corrections. Uploaded source files remain
private to the instructor and are not included in published module data.

Enrolled students can start each published module once and resume the same
assignment across devices. Assignments appear in **Sessions** with their course
name and cannot be edited, copied, or deleted. Instructors see student enrollment,
module completion, and concept-level progress through a restricted summary;
student conversations, evaluator evidence, whiteboards, and attachments stay
private. Progress uses the existing experimental learning evaluator.

Apply `supabase/migrations/202610170001_courses.sql` and
`supabase/migrations/202610170002_course_appearance.sql` after the account migrations
before using Courses. The migration is additive and preserves existing learning
sessions. No new environment variables are required. This version has one
instructor per course and does not include due dates, prerequisites, course
archiving.

Apply `supabase/migrations/202610190001_course_card_actions.sql` for course card
menus and pins saved per account. Pinned courses appear first. Instructors can
delete their own courses after confirmation; deletion removes the course,
modules, enrollments, and assigned sessions for all students.

Right-click a personal session on the dashboard or Sessions page to choose
**Delete session**. The options button opens the same menu. Apply
`supabase/migrations/202610190005_module_deletion.sql` to let instructors
right-click draft or published modules in their own courses and choose
**Delete module**. Deletion requires confirmation and removes that module's
student conversations and progress. Assigned sessions remain protected from
student deletion.

Apply `supabase/migrations/202610190003_leave_course.sql` to let students use
**Leave course** from a course card menu or course page. Leaving removes their
enrollment and pin but preserves assignment conversations and progress; students
must rejoin (and receive approval when required) to continue. Pending students can
use **Cancel request**. Rejected requests stay in place until instructor approval.

Apply `supabase/migrations/202610190005_course_people.sql` for the student
**People** tab. Enrolled students see the teacher and enrolled classmates with
their saved avatars. Pending and rejected requests remain visible only to the
course instructor, whose Students tab also shows avatars.

Apply `supabase/migrations/202610190002_course_dashboard_banners.sql` for all nine
dashboard banner presets in Courses. It replaces existing presets with the matching
dashboard color family and preserves uploaded images and hidden banners.

Dashboard banners use the same presets and image picker as course banners.
Apply `supabase/migrations/202610180001_dashboard_banner.sql` to enable account
saves and the private `dashboard-banners` upload bucket. This preserves existing
avatar customizations; no new environment variables are required.

## Developer tools

Local admins can access **Developer tools** directly at `/developer` or from the account menu. Students and instructors cannot access developer prompts, the playground, or model-call traces.

The **Evaluator comparison** tab offers evaluator-only examples grouped into folders, with the same read-only Fixed conversation display as Question strategies. It runs the existing evaluator and a refined evidence-based primary on the same fixed transcript, showing learner citations, assistance/opportunity judgments, validation issues, and completion blockers. A blind final review stays in shadow mode; neither branch changes regular session progress. Samples are authored smoke tests, not human-scored benchmarks. See [implementation status and human material needed later](backend/docs/evaluator-implementation-status.md).

All 70 authored evaluator cases are available in folders, including 16 paired challenges, 12 multi-turn borderline cases, and six longer conversations with hints and revisions for evidence, reasoning, independence, transfer, and shadow-review assessment. Use **Run folder** or **Run all** to compare them sequentially. The latest 40 results, original conversations, and model traces are saved in this browser for later review. **Download all results** exports the retained history. Cancelled or failed batches retain completed results.

Every rubric item must be demonstrated before passing; metadata cannot waive an item. Run `npm run test:evaluator` for the deterministic regression suite or `npm run evaluate:evaluator -- --list` to inspect the 36 authored live-screening cases without starting servers or making model calls. See [evaluator testing](backend/docs/evaluator-testing.md) for coverage, prompt-injection cases, opt-in live runs, and deferred human-validation work.

- **Prompts:** browse collapsible chat, rubric-creation, and learning-type groups, with smaller sections for each purpose or learning type. Every prompt has a short description in the sidebar and editor identifying its recipient, runtime trigger, and effect based on backend call sites and frontend entry points. Descriptions also identify direct API responses and endpoints unused by the current frontend. Search titles, descriptions, groups, or instruction text to automatically expand matching sections. Edit a prompt and choose **Save prompt** to update `backend/prompts.json` on disk. Every new chat or rubric request reads the file, so a restart is not needed. The editor keeps draft edits when changing tabs, selecting another prompt, or collapsing sections; closed groups also indicate unsaved edits. Template variables such as `{{topic}}` must be retained. If another editor changes the file, saving reports a conflict; **Reload from file** refreshes the saved version while keeping your draft for review.
- **Chat workshop:** select a learning type and any one of Remember, Understand, Apply, or Analyze. Enter a concept and that level's rubric checklist, or choose **Generate items** to create an editable checklist using the saved rubric prompts. **Regenerate items** replaces only the selected level's list. Then choose **Start test**. The chat stays at the chosen level. Quantitative Analyze generates the same three-paper review as regular sessions; other learning types introduce their assessment scenarios. The evaluator panel shows checklist judgments, supporting evidence, and the raw response. Starting a new test picks up the current setup and saved prompts. Failed requests keep the committed conversation and reply draft intact.

Playground conversations stay in the page and are not saved as learning sessions. Prompt editing requires the local backend and a writable prompt file; running chat tests requires a connected ChatGPT plan or configured Anthropic key selected in AI settings. The file-editing endpoint only accepts localhost hosts and the app's allowed local origins. It accepts catalogued prompt IDs, never arbitrary file paths.

## Checks

- `npm test` — rubric, evidence validation, completion, separation, and failure tests, plus OAuth validation, restart-safe callbacks, protected storage, token refresh/revocation, provider routing, multimodal conversion, and streamed Responses failures. Provider calls are mocked; live ChatGPT consent and inference require an eligible account.
- `npm run build` — TypeScript and production frontend build.
- `npm run lint` — frontend lint.

Editable backend prompts: `backend/prompts.json`. Assessment orchestration: `backend/src/chat.js`. HTTP boundary: `backend/src/server.js`. Frontend: `frontend/src/App.tsx`.

Claude tool-use documentation: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview

### Conversation continuity and playground saves

Understand and Apply openings are generated from the selected rubric and the preceding conversation. Previous-stage messages are sent only as opening context; subsequent evaluation continues to use new-stage evidence. Questions stay on one unresolved subtopic and provide concrete scenarios when asking about changed conditions. Quantitative Apply now supplies problem givens for the learner to work through.

Chat messages preserve plain text and render math with `$...$`, `$$...$$`, `\(...\)`, or `\[...\]`. Common signal notation (`x[an+b]`), subscripts (`V_rms`), numeric fractions (`1/2`), and phasors (`12∠30°`) are also recognized automatically. Ambiguous prose and malformed formulas remain literal. Worked papers retain Markdown formatting.

In Developer tools → Chat workshop, use **Save test** to keep the active test in this browser, including its rubric, conversation, draft, assessment, and model-call log. Reopen it from **Saved tests** to inspect or continue it. Use **Save changes** after further replies; starting or clearing a test does not delete saved copies. Saves use account-scoped IndexedDB separately from cloud learning sessions.

New evaluator comparisons use the lean contract and leave experimental shadow review off by default. Choose **Four-way ablation** to opt into review and compare the existing first pass, existing confirmed result, lean refined primary, and hypothetical refined-plus-shadow result. See [ablation controls and contracts](backend/docs/evaluator-ablation.md). Ordinary sessions use one lean refined primary, deterministic evidence and completion safeguards, and no shadow or legacy confirmation call. See [normal conversation behavior](backend/docs/conversation-refinement.md).
