# Question strategy testing: leakage and leading-question fixes

The original suite covered all **18 strategies across 51 supported strategy-level pairs**: Remember 2, Understand 17, Apply 16, Analyze 16. Strategies were only tested at their declared levels. The fixtures cover theoretical, experimental, and quantitative application tasks; they do not establish coverage of every subject, learner population, design task, or quantitative Analyze paper workflow.

The complete initial run preferred strategy questions in **25 pairs**, default questions in **5**, with **21 ties**. Mean scores were **9.86/10 strategy** and **9.20/10 default**; **50/51 strategy** and **45/51 default** questions met the screen. The strategy failure supplied the assessed resistor formula. Minor strategy concerns included a divisibility procedure and an explicit correction to expected-count reasoning. Several default questions grammatically assumed the student's disputed implication was true.

## Implemented changes

- Shared generation instructions distinguish observable givens from assessed definitions, formulas, procedures, causal links, and corrective alternatives. They require neutral attribution of disputed claims and direct recall elicitation at Remember. Apply and Analyze retain their method-use and reasoning requirements.
- Both generation paths reject observed solution-scaffold and factive-inference wording patterns, with bounded regeneration. Default retries receive the specific rejection reason. These are conservative wording checks, not a complete semantic detector.
- The strategy suitability checker now audits declarative clauses for supplied answers and implied conclusions, even when scientifically true or mentioned earlier. Persistent rejection retains the existing explicit fallback behavior.
- Regression tests exercise the observed faulty wording, valid neutral questions, and actual retries in both branches even when the mocked semantic checker approves. Paper generation remains exempt from conversational leakage checks.
- The benchmark runner supports explicit case subsets, fingerprints the shared guard, preserves the original full run, and labels the developer dashboard with the rerun scope.

## Affected-case comparison

First rerun: ten accepted applications and one plan rejected for solution scaffolding. Planning instructions were then tightened; only that rejected case was rerun. This combines latest case outcomes from two implementation revisions; the original outcomes remain preserved.

Eleven cases were selected from the original findings, including the related recall, method-definition, and conservation-wording concerns. Both branches were generated afresh. The model, fixtures, saved prompt version, and blind reviewer were unchanged; generation instructions and validation changed. No questions were manually rewritten for scoring.

| Measure | Before, same 11 cases | After, 11 reviewed applications |
|---|---:|---:|
| Default mean /10 | 8.00 | 9.36 |
| Strategy mean /10 | 9.45 | 10.00 |
| Default meets screen | 6/11 | 10/11 |
| Strategy meets screen | 10/11 | 11/11 |

Rerun status: 11 applied, 0 fallbacks, 0 generation errors, 0 review errors. Preferences: {"baseline":0,"enhanced":8,"tie":3,"neither":0}.

| Strategy / level | Before default / strategy | After default / strategy | Preference |
|---|---:|---:|---|
| boundary-case / apply | 8 / 8 | 9 / 10 | enhanced |
| recall-specific-element / remember | 7 / 10 | 9 / 10 | enhanced |
| mechanism-tracing / analyze | 9 / 10 | 9 / 10 | enhanced |
| conservation-accounting / understand | 9 / 9 | 10 / 10 | tie |
| conservation-accounting / analyze | 6 / 10 | 10 / 10 | tie |
| necessary-sufficient / understand | 7 / 10 | 10 / 10 | enhanced |
| necessary-sufficient / apply | 10 / 8 | 9 / 10 | enhanced |
| stochastic-reasoning / understand | 5 / 10 | 10 / 10 | enhanced |
| stochastic-reasoning / apply | 10 / 9 | 9 / 10 | enhanced |
| method-applicability / understand | 10 / 10 | 10 / 10 | tie |
| method-applicability / apply | 7 / 10 | 8 / 10 | enhanced |

## Fresh questions and remaining concerns

### boundary-case / apply

Default: I'm unsure about dividing resistance by voltage. How do you rearrange the resistor relationship to isolate current for this resistor?

Strategy: For this 10-ohm resistor at 0 volts, how would you write the resistor relationship and rearrange it to calculate current, showing which quantity you divide by?

- baseline: minor diagnosticValue: Requests isolation of current but not substitution or evaluation at zero voltage, allowing a response that does not demonstrate whether the learner can handle the specific zero-voltage case. ("How do you rearrange the resistor relationship to isolate current for this resistor?")

### recall-specific-element / remember

Default: What name do your notes give the component that opposes current?

Strategy: What is the name of the component described as opposing current in our simple circuit?

- baseline: minor grounding: Introduces an unestablished source; the learner may have no notes or no relevant entry, whereas the target can be asked directly from the shared circuit context. ("your notes")

### mechanism-tracing / analyze

Default: If entry occurred but those intervening stages could not occur, would entry alone still explain newly produced particles in your account?

Strategy: In your account that entry alone fully explains production, what accounts for where the new particles’ components come from and how those components become complete particles?

- baseline: minor diagnosticValue: The yes/no format does not request justification, so a response need not expose the causal reasoning specified in the diagnostic objective. ("would entry alone still explain newly produced particles in your account?")

### conservation-accounting / understand

Default: What makes you think the water no longer exists anywhere in the closed room once the clothes dry?

Strategy: What makes you think the water no longer exists anywhere in the closed room when the clothes contain less liquid water?

Blind reviewer: no concerns.

### conservation-accounting / analyze

Default: What makes you think the casing remaining stationary means the lost rotational energy cannot remain inside the device?

Strategy: For the whole device—the rotor, casing, and everything inside—what makes you think the casing staying still means the lost rotational energy cannot remain inside, given that no energy crossed the boundary?

Blind reviewer: no concerns.

### necessary-sufficient / understand

Default: What supports your claim that being even alone establishes that a number is a multiple of six?

Strategy: What makes you think that “multiples of six are even” establishes that every even number is a multiple of six?

Blind reviewer: no concerns.

### necessary-sufficient / apply

Default: How would you check your claim that $10$ is divisible by six against the meaning of divisibility by six?

Strategy: If you check 10 directly for divisibility by six, what do you find, and what does that result tell you about the proposed even-number test?

- baseline: minor diagnosticValue: A learner could describe a procedure without executing it or reconsidering whether evenness suffices, leaving the specific sufficiency inference unresolved. ("How would you check your claim")

### stochastic-reasoning / understand

Default: What makes you think equal probabilities on each roll guarantee exactly one six in each block?

Strategy: How do you think each face having the same probability on one roll relates to the number of sixes in a block of six independent rolls?

Blind reviewer: no concerns.

### stochastic-reasoning / apply

Default: I'm unsure about that zero probability. What probability do you get for no reds in ten draws when you apply your method for a specified sequence of independent draws?

Strategy: For ten independent draws with replacement, each with a one-fifth chance of red, what probability do you calculate for getting no reds, and what does that value mean for your claim that no reds is impossible?

- baseline: minor diagnosticValue: A numerical answer alone satisfies this request, leaving the learner's interpretation of the expected count and the possibility of a zero-red run less directly assessed. ("What probability do you get for no reds in ten draws when you apply your method for a specified sequence of independent draws?")

### method-applicability / understand

Default: What makes you think the two speeds can be weighted equally when the time spent at each speed differs?

Strategy: What makes you think the two speeds should have equal weight in the trip’s average speed when the time spent at each speed differs?

Blind reviewer: no concerns.

### method-applicability / apply

Default: What supports your claim that the simple arithmetic mean applies to this trip with one hour at the first speed and two hours at the second?

Strategy: For this trip—30 km/h for one hour, then 60 km/h for two hours, with no other travel time—what whole-trip average speed do you calculate, and what calculations support your result?

- baseline: minor levelFit: Elicits evaluation or justification rather than execution of a method in the Apply task. ("What supports your claim")
- baseline: major diagnosticValue: Does not require selecting and using a suitable method, leaving the authored diagnostic objective only indirectly tested. ("What supports your claim that the simple arithmetic mean applies")

## Interpretation and limits

The screen requires all five dimensions at least 1/2, total at least 8/10, and no major concern. Scores measure question design: clarity, level fit, diagnostic value, grounding, and non-leading wording. The same model generated and reviewed the questions with counterbalanced anonymous labels. One fresh pair per selected case cannot establish reliability, independent subject accuracy, improved diagnosis, or learning gains. The remaining 40 cases were not rerun after these shared changes; the full-suite results above remain historical. Prompt and regex checks reduce the observed failure modes but cannot guarantee leakage-free questions. Independent instructor review, repeated samples, open strategy selection, and actual learner responses remain necessary next validation.

## Verification and artifacts

73 targeted backend tests pass, including the new regression checks. The frontend production build passes; source lint retains the existing ChatComposer effect warning. The earlier full suite had one unrelated Windows file-mode assertion failure (214/215 passed); it was not changed here.

- [Original full results](../evaluations/strategy-levels-v5-final/results.json)
- [First affected rerun results](../evaluations/strategy-levels-v6-leakage-fix/results.json)
- [Planning-fix rerun](../evaluations/strategy-levels-v6-plan-fix/results.json)
- [Latest result per affected case](../evaluations/strategy-levels-v6-combined/results.json)
- [Frozen rerun fixtures](../evaluations/strategy-levels-v6-leakage-fix/fixtures.json)
- [Original detailed report](question-strategy-evaluation.md)

Full generation traces and every model-call request are retained under each run's cases directory. Reproduce using scripts/evaluate-question-strategies.mjs with --case-ids set to the rerun's caseIds and a new --output directory, then run this report script.
