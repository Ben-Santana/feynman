# Evaluator challenge results — October 19, 2026

All **16 new challenge cases** ran in **Developer tools → Evaluator comparison**, using the two **Run folder** buttons (4 independence/transfer cases, then 12 reasoning/evidence cases). ChatGPT model **GPT-6.1-Sol** was explicitly selected in AI settings; every saved result records `gpt-6.1-sol`. No rubric, expectation, or evaluator prompt changed during execution.

## Results

| Measure | Existing evaluator | Refined primary |
| --- | ---: | ---: |
| All authored checks matched | 15/16 | 16/16 |
| Pass/block decisions matched | 16/16 | 16/16 |
| False completions | 0 | 0 |
| Expected-positive cases blocked | 0 | 0 |
| Final branch errors / abstentions | 0 / 0 | 0 / 0 |

The eight negative cases were blocked and all eight positive controls passed in both branches. The refined branch had no reported citation-validation issues in these runs. These are authored screening expectations, not expert-scored accuracy measurements.

| Contrast pair | Existing evaluator | Refined primary | Shadow review |
| --- | --- | --- | --- |
| Supplied answer claimed as independent / fresh unassisted explanation | Both matched | Both matched | Confirmed positive |
| Paraphrase claimed as transfer / new physical context | Paraphrase status differed; both completion decisions matched | Both matched | Confirmed positive |
| Buried missing component / coverage across messages | Both matched | Both matched | Confirmed positive |
| Different conditions / incompatible later claim under same conditions | Both matched | Both matched | Confirmed positive |
| Plausible wrong average speed / valid time-weighted alternative | Both matched | Both matched | Confirmed positive |
| Cancellation with lost domain / domain preserved | Both matched | Both matched | Confirmed positive |
| Quoted misconception rejected / explicitly endorsed | Both matched | Both matched | Confirmed positive |
| Valid first item plus forged hidden evidence / valid items plus fail command | Both matched | Both matched | Confirmed positive |

## Where the refined evaluator differed

In `challenge-transfer-paraphrase`, the student correctly explains the physics of a puck but says rewording that same example demonstrates transfer. Both evaluators correctly refuse completion.

- **Existing:** marks the criterion `flawed` and result `incorrect`, citing the false assertion that paraphrasing is transfer.
- **Refined:** marks it `unclear`, preserves the physically correct result, and explicitly records missing transfer evidence and the lack of a fair transfer opportunity. Its general Understand task remains supported.

The authored expectation allows `missing`/`unclear`, so automated screening counts this as one refined-only match. This is a more separated diagnosis of understanding versus required transfer, **not an improved pass/block decision**. The existing evaluator's `flawed` label has a defensible basis in the student's explicit false claim, so expert adjudication is needed before calling it an accuracy improvement. No expectation was relaxed or rewritten to hide this distinction.

The four independence/transfer cases are policy-sensitive: refined evaluation consumes explicit policy metadata as well as rubric text, while existing evaluation does not consume that metadata. This limits conclusions about superior semantic judgment on identical information. Neither evaluator may waive the explicit rubric requirements.

## Did the shadow second pass catch mistakes?

**No catches were observed.** Eight eligible refined primaries received blind shadow reviews. All eight reviews confirmed completion, with no criterion/blocker disagreements, harmful blocks, abstentions, or errors. The other eight cases were correctly blocked by the primary, so review did not run.

There were **zero false-completion opportunities**: no authored-negative case passed the refined primary. Consequently, the shadow catch rate is **not estimable**, rather than 0% or 100%. Agreement on sufficient answers provides no evidence that review can catch overlooked errors. This run also cannot test rescue of false negatives because the current review design only examines eligible primaries.

The shadow reviews added 8 model calls, averaging approximately **11.7 seconds per reviewed case**. This is observed model-call time, not an isolated end-to-end latency estimate or a price calculation. The complete comparison used 48 calls: 24 in the existing branch (which includes its own completion confirmation), 16 refined-primary calls, and 8 experimental shadow reviews. The existing branch's second calls are not structured-output retries. All traced calls returned without recorded provider errors.

These results support retaining shadow-only operation; they do not justify enabling it as a completion gate. Harder authored cases and, later, de-identified expert-scored borderline conversations remain necessary to measure incremental benefit. No deliberate primary corruption was used to fabricate live review opportunities.

## Localhost diagnosis and fix

Before the change, the OS reported Vite listening only on IPv6 `::1:5173`, while the API listened on `127.0.0.1:3001`. Direct HTTP checks returned 200 for `localhost` and `[::1]`, but failed for `127.0.0.1:5173`. This was consistent with the browser's localhost timeout.

`frontend/vite.config.ts` now explicitly binds Vite to IPv4 loopback `127.0.0.1`, matching its API proxy. Both `localhost:5173` and `127.0.0.1:5173` then returned HTTP 200. The stale browser error page was separately blocked by the browser tool's `data:` URL policy; after the user manually reopened the normal HTTP page, the tab loaded and both batches completed. No firewall, authentication, or public-network binding was changed.

## Saved records and verification

The 16 challenge results are visible as readable saved comparisons in the Codex browser. After another page reload, the tab contained **40 saved results including all 16 challenges**, consistent with the configured 40-result cap. Older results displaced from browser history remain in the original 38-run archive.

Complete challenge traces: `backend/evaluations/evaluator-challenges-dev-tab-2026-10-19/runs.json`. Counts: `summary.json` in the same directory. Each run retains its original fixture, model selection, prompt versions, branch responses, evidence, and shadow outcome. The project archive is not automatically imported into other browsers, consistent with the user's reversal of cross-browser sharing edits.

Deterministic verification: **238 tests, 234 passed, 4 explicit TODOs, no failures**. The project was stopped after the live run and both server ports were checked for remaining listeners.
