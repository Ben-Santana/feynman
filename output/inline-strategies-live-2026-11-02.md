# Live ordinary-chat strategy check and rough latency comparison

Run November 2, 2026, using the connected ChatGPT account and `gpt-6.1-sol`. Five existing synthetic transcripts covered Remember, Understand, Apply, and Analyze. Each strategy branch used the ordinary `chat()` defaults with a fresh evaluator and live question generation. Benchmark titles and expected strategy IDs were withheld from the model. This exercised application logic and the real provider directly, rather than HTTP authentication or the browser UI.

All five strategy branches succeeded with exactly two calls and no retries. One of five control requests failed at the provider; it is preserved and excluded from paired averages. There were 15 live requests in total.

## Question review

The coding agent reviewed the questions against the actual selected catalog record and transcript. All five performed a defensible instance of their selected strategy. This is an unblinded, qualitative inspection by the implementing agent, not independent expert validation or evidence of learning gains. Strategy labels can overlap; matching the fixture's originally intended label was not required.

| Case | Selected strategy | Live question | Review |
| --- | --- | --- | --- |
| Missing circuit component name | recall-specific-element | What is the component that opposes current in our simple circuit called? | Requests only the missing name; does not require explanation or supply the name. |
| Unplugged kettle | reconcile-claims | How does your claim that “heat must disappear as soon as current stops” fit with the unplugged metal staying hot? | Both statements are in the learner's response. Asks about their incompatibility without supplying stored-energy reasoning. |
| Matched insulated cups | evidence-inference | With both cups starting at 80 degrees C and ending at 70 and 60 degrees C after ten minutes, what would comparing their cooling tell us about your claim that the unsleeved cup is irrelevant? | Connects existing observations to a specific inference. Matched conditions are established in the transcript. Controlled-comparison is also a plausible label; the selected evidence-inference record explicitly permits examining an existing evidence set. |
| Simplified test implication | controlled-comparison | If we keep “the test never misses C” fixed, how would allowing versus excluding false positives affect which direction of the relationship between C and a positive result is guaranteed? | Explicitly holds one rule fixed and changes one condition. Retains the implication target without supplying its direction. More abstract wording than the other questions; a clarity concern to monitor. Necessary-sufficient would also be plausible. |
| Distance table and graph | representation-change | How does your claim that the object has “no distance from the start” fit with the three-meter table entries and the height of the flat line on this same trip’s graph? | Explicitly relates the two representations of the same established trip. No new calculation or trip is introduced. Also resembles reconciliation, but preserves the required cross-representation target. |

These observations support that the live model can instantiate the selected strategies. They do not establish that supplying the catalog caused better questions: several control questions used similar structures without catalog instructions.

## Latency

Times in seconds, rounded to two decimals. Inline total is measured fresh evaluation plus response generation. Each control reuses the exact live evaluator response locally; its projected total adds the measured inline evaluator time to control elapsed time. Controls remove only catalog instructions and strategy-choice schema from the response request. They do not rerun evaluation.

| Case | Evaluator | Catalog response | Catalog total | Control response | Projected control total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall | 6.47 | 4.35 | 10.84 | Provider failure | — |
| Kettle | 15.20 | 5.32 | 20.52 | 3.21 | 18.41 |
| Cups | 6.73 | 8.92 | 15.66 | 3.49 | 10.23 |
| Test implication | 9.76 | 5.27 | 15.04 | 5.86 | 15.63 |
| Table and graph | 9.45 | 17.28 | 26.74 | 5.36 | 14.82 |

Across all five catalog runs, total latency averaged **17.76 seconds**, with a **15.66-second median** and range **10.84–26.74 seconds**.

Across the four successful pairs, response generation averaged **9.20 seconds with the catalog versus 4.48 seconds without it**. Measured catalog total averaged **19.49 seconds**, versus a **14.77-second projected control total**: approximately **4.72 seconds (32%) more** in this sample.

The higher-level response requests were about 41 KB with catalog context versus 10 KB without it (serialized request bytes, not token counts). Catalog context and selection output are plausible overhead sources, but this experiment cannot attribute the time difference to them alone.

This is a dirty benchmark: one run per input, fixed inline-first order, shared evaluator replay for controls, no warmup or randomization, and uncontrolled service load/cache effects. One failed control was excluded rather than treated as a fast success. No comparison against the old three-call strategy planner was performed.

Raw inputs, requests, responses, errors, selections, and timings are saved in `inline-strategies-live-2026-11-02.json`. Reproduce with `node scripts/benchmark-inline-strategies.mjs`; the script makes live calls and overwrites that output file, so preserve the existing artifacts before another run.
