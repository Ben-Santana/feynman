# Feynman learning lab

Four learning levels: Remember, Understand, Apply, and Analyze. Create a titled session, choose its learning type, list concepts with a target level, then review an editable rubric. The learner completes the levels in order through each concept's target. The AI classmate conducts the conversation; a separate evaluator assesses the learner's evidence. Drafts, chats, and progress are saved in this browser.

Completing a concept ends its chat without a completion banner or closing reply. The level divider remains, with a Continue button when a higher level is available. Once every concept reaches its target, the learner can open a separate session summary with the demonstrated rubric goals, Analyze reports where available, and any goals that still need study. A session that finishes at Analyze opens the summary automatically. Completed sessions reopen on that page.

## Run locally

Requires Node.js 22.9+ (tested with Node 24).

1. `npm install`
2. Optionally copy `backend/.env.example` to `backend/.env` to configure Anthropic. Set `ANTHROPIC_API_KEY`; if the key is not workspace-scoped, also set `ANTHROPIC_WORKSPACE_ID` to your Anthropic workspace ID. ChatGPT does not require an API key.
3. `npm run dev`
4. Open http://localhost:5173, then **AI settings**. Choose **ChatGPT plan** and **Continue with ChatGPT**, or choose **Anthropic / Claude** to use the configured API key.

The frontend reloads automatically during development. The backend runs without watch mode so saving sign-in credentials cannot interrupt the OAuth callback; restart `npm run dev` after backend code or environment changes.

The key stays on the Node server. `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-6`; use a model supporting forced tool calls. The backend binds to loopback. This is a local testing app, not an authenticated public service. Do not expose it publicly without authentication, rate limits, and a deployment-specific origin policy.

## Vercel services deployment

The root `vercel.json` defines one project with `backend` (Node HTTP server) and `frontend` (Vite static app). Keep the Vercel project root at the repository root. `/api/*` reaches the backend with the original `/api/` prefix; every other path reaches the frontend. The browser already calls relative `/api/...` URLs. There are no server-to-server calls between these services, so there are no service bindings; runtime binding URLs cannot be consumed by a static Vite build or browser.

Set `ANTHROPIC_API_KEY` and, if needed, `ANTHROPIC_WORKSPACE_ID` in Vercel project environment variables; optionally set `ANTHROPIC_MODEL`. Set `APP_ORIGIN` to the exact HTTPS origin when using a custom domain. Vercel deployment, branch, and production URLs are allowed automatically when their system environment variables are enabled. Origin checks do not authenticate callers; use deployment protection for this personal app before sharing a deployment that uses your API key.

The hosted backend offers Anthropic only. Choose it explicitly in **AI settings**; saved ChatGPT selections are not silently switched to billed API requests. ChatGPT's local credential store, loopback callback, and developer prompt editing remain local-only. Prompts are bundled read-only for hosted inference. Local credentials and `.env` files are excluded from Vercel uploads. Hosting ChatGPT connections would require a separate durable, per-user credential store and a supported hosted OAuth flow.

Use `vercel dev` from the repository root to test both services through one origin. For offline project setup, `vercel dev -L` runs without cloud authentication; set `APP_ORIGIN` to its local URL (for example `http://localhost:3000`) for hosted-origin checks. `npm run dev` retains the existing local app and ChatGPT flow.

## AI providers (local app)

ChatGPT is the frontend's default provider. Eligible Plus/Pro users can authorize Feynman to use their existing ChatGPT plan; requests count toward that user's plan limits or authorized credits, with no app-owner API billing. OpenAI currently supports this flow for open-source and locally hosted personal apps; offering it in a paid or remotely hosted service requires approval. It is not unlimited free inference for every OpenAI account. See the [official integration overview](https://developers.openai.com/siwc/token-sharing-open-source).

AI settings supports saved account/workspace connections, reconnecting, signing out, model selection from the connected account's current catalog, and [managing usage in ChatGPT settings](https://chatgpt.com/settings/usage). The browser stores only provider/account/model preferences. OAuth credentials and short-lived PKCE transactions stay in `backend/.chatgpt/accounts.json`, which is ignored by Git and written atomically with owner-only permissions. The installation ID and account/client mappings survive sign-out. The callback uses `http://127.0.0.1:<backend-port>/auth/callback`; pending sign-ins survive backend restarts for ten minutes. Keep the backend running while finishing sign-in and run one backend per checkout. Never commit, share, or upload the credential store.

Both providers power conversations, independent evaluations, papers, rubric generation, concept suggestions, PDFs/images, and whiteboards. ChatGPT uses OAuth-authorized public Responses API requests with `store: false`, `stream: true`, namespaced function tools, and a required terminal completion event. Plan limits and revoked access produce actionable errors; the app never automatically switches to paid Anthropic requests. Choose Anthropic explicitly in AI settings to use those tokens. Existing API callers that omit the provider header retain Anthropic behavior.

Language-model APIs implement the JavaScript `LanguageModelProvider` base class in `backend/src/providers/`. Its shared contract uses neutral messages and JSON Schemas; each adapter handles its API's wire format and completion rules. The registry drives backend routing and AI settings, so another environment-configured API needs an adapter and one registration. See [Adding a language-model API](backend/docs/providers.md) for the contract, examples, and tests.

## Classroom role

Across all levels, the AI plays a classroom student and the user teaches it. It asks one clarifying question at a time and responds to mistakes with confusion, without giving facts, corrections, hints, or answers—even when asked. Quantitative Analyze is the exception for submitted work: it supplies a tentative classroom paper with numbered solution steps and a final answer, without revealing its verdict. The shared conversational instructions are in `chat.classroomRole` in `backend/prompts.json`; assessment runs in a separate model call.

## Learning types

Every new session requires one learning type. The type is shared across all concept chats and can only be changed on the naming page before starting. Changing an existing selection asks for confirmation, then clears every concept's rubric while keeping the concepts and target levels. Cancelling keeps both the type and rubric unchanged. A slim animated progress line across the top tracks setup from naming through rubric review. Existing saved sessions and API requests that omit it retain Quantitative behavior.

- **Theoretical / Conceptual:** define and explain concepts, apply them to a situation and make a prediction, then analyze interactions, mechanisms, changing conditions, and misconceptions.
- **Quantitative / Problem-Solving:** recall and explain methods, solve and interpret problems, then grade three worked classroom papers and explain their reasoning and corrections. A correct answer without sufficient reasoning cannot pass.
- **Experimental / Lab-Based:** recall experimental principles and procedures, connect measurements to theory, predict and interpret simulated measurements, then analyze patterns, discrepancies, and evidence-supported conclusions. All lab assessment data is clearly labeled simulated; no real experiment or measurement upload is required.
- **Design / Project-Based:** explain principles and requirements, make and justify a concrete design decision, then compare alternatives, tradeoffs, limitations, consequences, and changed constraints. Multiple defensible decisions can pass.

The non-quantitative types use backend-generated scenarios at Apply and Analyze, with an interactive discussion until each rubric requirement is supported. Their Analyze assessments use only that stage's learner evidence and produce no percentage grade or paper-review UI. Scenario facts are context, never credited as learner evidence. Generic templates, AI generation, student questions, and evaluator prompts follow the selected profile in `frontend/src/learningTypes.js`.

Returning through setup resets the generation checkbox and labels it “Re-generate rubric” when criteria already exist. Continuing with it unchecked fills missing required criteria without overwriting edits; checking it explicitly replaces the rubric with newly generated criteria. After a confirmed type change, setup generates fresh criteria for the new learning type. The type, conversations, scenarios, and progress persist in this browser. A started session's learning type cannot be changed.

## Experiments

Choose a title and learning type, enter one concept and optionally add up to 19 more, and select a target level for each. Without files, the rubric receives generic criteria through the target; an optional toggle asks AI to write criteria from the concept names. Each rubric box contains editable checklist items that automatically grow to fit their text. Add, edit, or remove individual items on the rubric page before starting. AI generation returns separate, observable checklist requirements. The AI checks off supported items internally, with progress saved separately for every level. The rubric is hidden during chat and available in the session summary. Filling a higher level raises the target; clearing the highest filled level lowers it. Starting creates a separate chat for every concept, each opening with “Teach me about [concept].” Select a named concept in the chat switcher to continue it. Each passed level fills a quarter of its progress outline.

You can also upload multiple files totaling up to 5 MB. Use **Autofill concepts from files** to append suggested concept names, then choose targets for them. When you continue, AI generates a sample rubric from the uploaded materials through each selected target. Levels above the target remain blank and editable. PDFs and common images are sent to the selected provider directly; text-based files and Office-style archives are read as text first. Files with no readable text or supported media cannot be processed. Draft files are saved in this browser and removed from the saved session after it starts.

- **Remember:** the learner must recall or mention every specific point listed in that concept’s Remember criterion. Naming the concept alone only passes if that is all the criterion requires.
- **Understand:** an own-word explanation of that concept and its relevant relationships.
- **Apply:** a valid concrete application, worked through by the student.
- **Quantitative Analyze:** the AI submits three separate problems, each with numbered worked steps and a final answer. Click the paper peeking from the chat message to open the paper stack. Mark incorrect steps, then click the grade field at the top right of each paper to finalize it. Marked steps produce Fail; a paper with no marked steps produces Pass. After all papers are graded, the chat shows every marked step and asks the learner to explain what is wrong and how to correct it. If all papers pass, it asks how the steps were checked. The evaluator then checks the verdicts and explanation against the concept’s Analyze criterion. An incomplete result can be retried with a new paper set. Papers and reviews persist with the chat and are passed to the independent evaluator.

An independent evaluator assesses the active concept’s current level after each learner answer, except before the Quantitative Analyze paper review and its follow-up explanation. A correct result alone does not establish a sound explanation or method at higher levels. The server validates learner-message quotes and derives completion only when the every checklist item and the level task are supported. Each new level begins with a new assessment window, so earlier answers cannot complete it. Quantitative Analyze additionally considers the full conversation alongside the paper review. Provisional completion receives a second evaluator check. Disagreement leads to another question. The evaluator's verdict stays out of the classmate conversation. These experimental judgments are not validated educational measurements. Reference material and student messages are explicitly treated as data, not instructions.

API failures preserve the learner's draft and committed transcript. Retrying a turn repeats the assessment query. Completing Analyze ends that concept’s chat; incomplete non-quantitative Analyze assessments continue the discussion. Concept chats, drafts, and progress persist locally in IndexedDB. Browser storage can be cleared by the browser or its user.

## Developer tools

Access **Developer tools** directly at `/developer`.

- **Prompts:** browse collapsible chat, rubric-creation, and learning-type groups, with smaller sections for each purpose or learning type. Every prompt has a short description in the sidebar and editor identifying its recipient, runtime trigger, and effect based on backend call sites and frontend entry points. Descriptions also identify direct API responses and endpoints unused by the current frontend. Search titles, descriptions, groups, or instruction text to automatically expand matching sections. Edit a prompt and choose **Save prompt** to update `backend/prompts.json` on disk. Every new chat or rubric request reads the file, so a restart is not needed. The editor keeps draft edits when changing tabs, selecting another prompt, or collapsing sections; closed groups also indicate unsaved edits. Template variables such as `{{topic}}` must be retained. If another editor changes the file, saving reports a conflict; **Reload from file** refreshes the saved version while keeping your draft for review.
- **Chat playground:** select a learning type and any one of Remember, Understand, Apply, or Analyze. Enter a concept and that level's rubric checklist, or choose **Generate items** to create an editable checklist using the saved rubric prompts. **Regenerate items** replaces only the selected level's list. Then choose **Start test**. The chat stays at the chosen level. Quantitative Analyze generates the same three-paper review as regular sessions; other learning types introduce their assessment scenarios. The evaluator panel shows checklist judgments, supporting evidence, and the raw response. Starting a new test picks up the current setup and saved prompts. Failed requests keep the committed conversation and reply draft intact.

Playground conversations stay in the page and are not saved as learning sessions. Prompt editing requires the local backend and a writable prompt file; running chat tests requires a connected ChatGPT plan or configured Anthropic key selected in AI settings. The file-editing endpoint only accepts localhost hosts and the app's allowed local origins. It accepts catalogued prompt IDs, never arbitrary file paths.

## Checks

- `npm test` — rubric, evidence validation, completion, separation, and failure tests, plus OAuth validation, restart-safe callbacks, protected storage, token refresh/revocation, provider routing, multimodal conversion, and streamed Responses failures. Provider calls are mocked; live ChatGPT consent and inference require an eligible account.
- `npm run build` — TypeScript and production frontend build.
- `npm run lint` — frontend lint.

Editable backend prompts: `backend/prompts.json`. Assessment orchestration: `backend/src/chat.js`. HTTP boundary: `backend/src/server.js`. Frontend: `frontend/src/App.tsx`.

Claude tool-use documentation: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
