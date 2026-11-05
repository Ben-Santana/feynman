# Apply puzzle generation

Developer tools → Puzzle generator uses the provider/model selected in AI settings.
The admin enters a description, then generates a new standalone Hairline scene.
The shared React host owns one editable input, check/reset, and deterministic
answer validation. Model-generated code never decides whether the answer passes.

`generation-prompt.md` records the learned teaching, interaction, and 3D construction
rules. `puzzleGeneration.js` assembles it with the public Hairline API index,
shared interaction helper, and three existing demo source references. The prompt
viewer exposes the full context, JSON response schema, and a
`{{PUZZLE_DESCRIPTION}}` placeholder so it can be copied for reuse.

Version 5 conditionally loads subject-specific puzzle skills through
`src/puzzleSkills.js`. Before generation, a structured selection call receives
only the puzzle description and a compact catalog of skill IDs and applicability
rules. It selects skills by the apparatus to be generated, not keyword matching.
Only selected skill files are read and appended to the generation prompt; an
empty selection appends no skills. Unknown or duplicate IDs fail validation,
with one retry for malformed selection output. Provider failures propagate;
there is no fallback that loads the entire library. Selection and generation
share the request time budget, and generation repair attempts reuse the selection.
The response includes `skillIds` for inspection.

The prompt viewer exposes the base generation prompt without skill bodies; the
GET response also includes `skillCatalog`. Actual generation appends the selected
recipes to that base context. To add a skill, write an asset in `skills/` and
register its ID, filename, and applicability in `puzzleSkills.js`. These authored
assets are separate from demo build output and survive reference rebuilds.
Shared runtime, response, and teaching contracts still apply.

`skills/circuit.md` follows the model circuit's camera and component arrangement.
It gives an ordered recipe for equations and network nodes, separate solids,
shared contact coordinates and lead routes, series/parallel meter placement,
support/depth ordering, and decision versus investigation behavior. Its acceptance
pass asks the model to reconcile visible wiring with the electrical model. This
is generation guidance; the server does not certify circuit physics or appearance.

GET /api/developer/puzzles returns the assembled prompt/schema without requiring
an AI connection. POST accepts `{ "description": "..." }` (1–8,000 characters)
and returns metadata, an input contract, a solution, scene source, and a preview
HTML document. Both endpoints require authenticated admin access. The existing
provider abstraction and account headers are used; no credentials reach the model
prompt or preview. The request includes project demo source as reference context.

Version 2 supports investigations as well as direct decision puzzles. The optional
`experiment` has its own numeric control bounds, measurement label/unit, and a
2–6 observation requirement. `input` and `solution` describe the separate final
conclusion. For an ohmic-behavior investigation, voltage is the experiment control,
current is a live observation, and Ohmic/Non-ohmic are final choices with IDs 0/1.
Category domains are derived from their choices, independent of the voltage range.
The scene uses `config.experimentValue` and `onExperimentValue`; the host tracks
sampled settings and only checks the conclusion after enough distinct settings.
Measurements can respond before checking; classification feedback cannot. Ordinary
puzzles retain their previous preparation/submission behavior. Prompt text and
reference files are read fresh for each generation and prompt-view request.

Only invalid structured/model output gets one retry. Authentication, rate limits,
transport failures, and timeouts preserve their existing error semantics. Numeric
inputs are continuous. Choice tasks require exactly one correct option, matched by exact category ID rather than numeric tolerance. The
server checks finite bounds, initial state, reachable solution, choice uniqueness,
feedback lengths, and JavaScript syntax; it does not execute generated JavaScript.

The preview is an iframe with sandbox="allow-scripts" and without allow-same-origin,
allow-top-navigation, allow-popups, or allow-forms. Its CSP denies network subresources,
connections, workers, and embedded frames. The trusted wrapper supplies the
immutable kernel, source-scoped messaging, shared hatches, and an initial-geometry
check. Parent messages are tied to the specific iframe window and run ID; only
validated numeric/choice values enter the host. Generated code has no application
account/session context. Physics, pedagogical correctness, and all animated poses
still need human review. The API/UI do not claim these have been certified.

Run `node scripts/build-apply-simulations.mjs` after editing demo sources to refresh
the bundled engine/helper/references. Assets are included by the existing Vercel
assets/** rule. The kernel and its original attribution remain unchanged.

Validation:

    node --test backend/src/puzzleGeneration.test.js backend/src/providers.test.js

A local browser test can mock the provider response to exercise the entire UI
without an external model call. A live provider run sends the full described
context to that provider and must be authorized accordingly.
