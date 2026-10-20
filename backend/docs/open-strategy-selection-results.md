# Open strategy selection: selection-only benchmark

Model: **gpt-6.1-sol**. Completed: **51/51**. Exact intended-strategy matches: **34/51 (66.7%)**. Other selections: **17**. Abstentions: **0**. Operational/output errors: **0**. Model calls: **51**.

## What was run

All 51 existing authored strategy-level fixtures were offered every eligible strategy: 2 candidates at Remember, 17 at Understand, and 16 each at Apply and Analyze. The selector could choose any candidate or none. Only the normal select_strategy call ran, including its structured plan and deterministic validation. No new rubric evaluation, diagnostic generation, default question, strategy question, suitability-check call, or model review ran. Malformed output can receive one bounded repair; operational errors are recorded separately.

The benchmark reused each case’s diagnostic state from the original full run. Those diagnostics were generated before targeted filtering and did not receive the expected strategy. Requests contain the normal topic, transcript, rubric, diagnostic state, all eligible candidate records, and eligible examples. Expected IDs, case IDs, strategy-bearing fixture titles, review guides, previous selections, generated questions, and ratings are excluded. The selection prompt is shared with the live comparison implementation.

This isolates **selection conditional on an existing diagnosis**. It is not an end-to-end evaluation of fresh diagnosis plus selection. The fixtures were deliberately authored around intended strategies; intended labels are reference targets, not independently established unique correct answers. A mismatch may be a valid alternative, a narrower probe, or an incorrect selection. Exact agreement alone does not resolve that distinction. There is one retained selection per case, not a reliability estimate across repeated samples. None of these cases was designed as a no-strategy-fit negative control.

## Agreement by learning level

| Level | Completed / cases | Intended matches | Agreement |
|---|---:|---:|---:|
| remember | 2/2 | 2 | 100.0% |
| understand | 17/17 | 9 | 52.9% |
| apply | 16/16 | 12 | 75.0% |
| analyze | 16/16 | 11 | 68.8% |

## Agreement by intended strategy

| Intended strategy | Matches / completed | Other choices |
|---|---:|---|
| Controlled comparison | 2/3 | understand: Reconcile specific claims |
| Boundary case | 1/3 | understand: Check the reason behind an answer; apply: Check the reason behind an answer |
| Remove a condition | 2/3 | analyze: Check the reason behind an answer |
| Separate a quantity from its change | 1/3 | understand: Clarify a specific term; analyze: Separate observations from inferences |
| Reconcile specific claims | 2/3 | apply: Check the reason behind an answer |
| Change representation | 1/3 | understand: Separate a quantity from its change; analyze: Check the reason behind an answer |
| Clarify a specific term | 2/2 | — |
| Recall a specific element | 1/1 | — |
| Check the reason behind an answer | 2/3 | apply: Controlled comparison |
| Trace a causal mechanism | 3/3 | — |
| Account for transfers and conservation | 2/3 | understand: Check the reason behind an answer |
| Classify using defining features | 1/3 | understand: Check the reason behind an answer; analyze: Separate necessary from sufficient conditions |
| Separate necessary from sufficient conditions | 3/3 | — |
| Separate levels of organization | 2/3 | understand: Check the reason behind an answer |
| Separate observations from inferences | 3/3 | — |
| Distinguish chance from certainty | 3/3 | — |
| Match a method to its conditions | 2/3 | understand: Check the reason behind an answer |
| Specify the system or reference | 1/3 | apply: Check the reason behind an answer; analyze: Classify using defining features |

## All case selections

| Case / topic | Level | Intended | Selected | Exact match |
|---|---|---|---|---|
| Interpreting a controlled salt-dissolving comparison | understand | Controlled comparison | Reconcile specific claims | No |
| Using simulated controlled insulation measurements | apply | Controlled comparison | Controlled comparison | Yes |
| Analyzing a controlled dissolving study explanation | analyze | Controlled comparison | Controlled comparison | Yes |
| Interpreting zero travel distance in a work claim | understand | Boundary case | Check the reason behind an answer | No |
| Applying resistance at zero potential difference | apply | Boundary case | Check the reason behind an answer | No |
| Analyzing a probability rule at a limiting event | analyze | Boundary case | Boundary case | Yes |
| Distinguishing a heater from stored thermal energy | understand | Remove a condition | Remove a condition | Yes |
| Predicting a state after a clamp is removed | apply | Remove a condition | Remove a condition | Yes |
| Analyzing motion after propulsion stops | analyze | Remove a condition | Check the reason behind an answer | No |
| Separating reservoir level from change in level | understand | Separate a quantity from its change | Clarify a specific term | No |
| Using a constant pressure record | apply | Separate a quantity from its change | Separate a quantity from its change | Yes |
| Analyzing constant bank balance with ongoing flows | analyze | Separate a quantity from its change | Separate observations from inferences | No |
| Reconciling equal density and unequal mass statements | understand | Reconcile specific claims | Reconcile specific claims | Yes |
| Checking two claims about resistance and current | apply | Reconcile specific claims | Check the reason behind an answer | No |
| Analyzing two definitions of a geometric figure | analyze | Reconcile specific claims | Reconcile specific claims | Yes |
| Reading an existing distance table and graph | understand | Change representation | Separate a quantity from its change | No |
| Plotting a supplied volume-time table | apply | Change representation | Change representation | Yes |
| Analyzing equivalent circuit drawings | analyze | Change representation | Check the reason behind an answer | No |
| Identifying what a student means by load | remember | Clarify a specific term | Clarify a specific term | Yes |
| Clarifying what stored means in a memory account | understand | Clarify a specific term | Clarify a specific term | Yes |
| Recalling a missing circuit component name | remember | Recall a specific element | Recall a specific element | Yes |
| Probing a reason for a dilution answer | understand | Check the reason behind an answer | Check the reason behind an answer | Yes |
| Checking the procedure behind an arithmetic answer | apply | Check the reason behind an answer | Controlled comparison | No |
| Analyzing reasoning behind a correct heat-flow direction | analyze | Check the reason behind an answer | Check the reason behind an answer | Yes |
| Connecting a drug target to a cellular effect | understand | Trace a causal mechanism | Trace a causal mechanism | Yes |
| Tracing a supplied update dependency | apply | Trace a causal mechanism | Trace a causal mechanism | Yes |
| Analyzing an incomplete infection explanation | analyze | Trace a causal mechanism | Trace a causal mechanism | Yes |
| Accounting for water in drying clothes | understand | Account for transfers and conservation | Check the reason behind an answer | No |
| Balancing charge at a circuit junction | apply | Account for transfers and conservation | Account for transfers and conservation | Yes |
| Analyzing energy accounting in a sealed device | analyze | Account for transfers and conservation | Account for transfers and conservation | Yes |
| Classifying a chemical change by relevant features | understand | Classify using defining features | Check the reason behind an answer | No |
| Classifying a supplied abstract-data behavior | apply | Classify using defining features | Classify using defining features | Yes |
| Analyzing an invalid grouping of functions | analyze | Classify using defining features | Separate necessary from sufficient conditions | No |
| Interpreting a divisibility condition | understand | Separate necessary from sufficient conditions | Separate necessary from sufficient conditions | Yes |
| Testing sufficiency with a concrete integer | apply | Separate necessary from sufficient conditions | Separate necessary from sufficient conditions | Yes |
| Analyzing reversed medical screening logic | analyze | Separate necessary from sufficient conditions | Separate necessary from sufficient conditions | Yes |
| Interpreting an average from a group | understand | Separate levels of organization | Check the reason behind an answer | No |
| Predicting aggregate resistance from reproductive differences | apply | Separate levels of organization | Separate levels of organization | Yes |
| Analyzing a community-average claim | analyze | Separate levels of organization | Separate levels of organization | Yes |
| Interpreting an observational tutoring association | understand | Separate observations from inferences | Separate observations from inferences | Yes |
| Interpreting simulated measurements with uncertainty | apply | Separate observations from inferences | Separate observations from inferences | Yes |
| Analyzing generalization from a convenience sample | analyze | Separate observations from inferences | Separate observations from inferences | Yes |
| Interpreting an expected count for a die | understand | Distinguish chance from certainty | Distinguish chance from certainty | Yes |
| Applying a sampling model to distinguish expected counts from guaranteed outcomes | apply | Distinguish chance from certainty | Distinguish chance from certainty | Yes |
| Analyzing variation in a specified random simulation | analyze | Distinguish chance from certainty | Distinguish chance from certainty | Yes |
| Explaining an assumption behind an average-speed shortcut | understand | Match a method to its conditions | Check the reason behind an answer | No |
| Selecting a method for unequal-time travel | apply | Match a method to its conditions | Match a method to its conditions | Yes |
| Analyzing an unjustified inverse calculation | analyze | Match a method to its conditions | Match a method to its conditions | Yes |
| Specifying the observer in a conveyor claim | understand | Specify the system or reference | Specify the system or reference | Yes |
| Using classical relative velocity for a moving walkway | apply | Specify the system or reference | Check the reason behind an answer | No |
| Analyzing interaction classification under a system boundary | analyze | Specify the system or reference | Classify using defining features | No |

## Mismatches and abstentions: evidence for inspection

### Interpreting a controlled salt-dissolving comparison (understand)

Expected **Controlled comparison**; selected **Reconcile specific claims**.

Learner’s latest statement: “I think it could be because the warm-water cup had more water, even though the volumes were matched.”

Frozen diagnostic objective: At the understand level, determine how the learner reconciles the stated equal water volumes with the proposed greater-water explanation, focusing on why a matched variable cannot account for the observed between-cup difference.

Selector rationale: The learner both acknowledges matched volumes and tentatively proposes more water in the warm cup. The needed evidence is how those two actual statements fit together, not a prediction for a new comparison or a general justification of the observed outcome. Reconciliation probes that existing relationship at Understand while allowing that the learner may instead doubt the matched-volume premise.

Planned evidence: Ask one relationship-focused question grounded in the learner's wording: "You said the volumes were matched and suggested that the warm-water cup had more water. How do those two ideas fit together in your explanation of why the salt dissolved sooner?" Do not supply the relationship, require a new prediction, or add a correction.

### Interpreting zero travel distance in a work claim (understand)

Expected **Boundary case**; selected **Check the reason behind an answer**.

Learner’s latest statement: “Because the push is large, mechanical work on the stationary crate is large even though it does not move.”

Frozen diagnostic objective: At the understand level, diagnose how the learner explains the role of zero crate displacement in mechanical work, specifically whether they can distinguish a large applied force and personal effort from mechanical work on a stationary crate.

Selector rationale: The learner has explicitly answered that mechanical work on the stationary crate is large and supported it with push magnitude. The missing evidence is how the learner relates the crate's lack of movement to that answer. This strategy probes that specific supporting relationship in the existing explanation at Understand, without inventing a comparison or treating tiredness as an established misconception.

Planned evidence: Ask one conceptual follow-up grounded in the learner's claim: 'You said the large push means large mechanical work on the crate. In your explanation, what role does the crate not moving play in deciding how much mechanical work is done on it?' Do not supply a formula, definition, correct outcome, new conditions, or a calculation task.

### Applying resistance at zero potential difference (apply)

Expected **Boundary case**; selected **Check the reason behind an answer**.

Learner’s latest statement: “I would divide resistance by voltage, but dividing by zero makes the current infinite.”

Frozen diagnostic objective: At the apply level, assess whether the learner can isolate current in V = IR and apply I = V/R to V = 0 V and R = 10 ohms, justifying the calculation by identifying resistance as the nonzero denominator.

Selector rationale: The learner has supplied an infinite-current answer and a questionable supporting operation. A single quantitative follow-up can elicit the relationship and actual calculation supporting that answer without inventing a second claim, a comparison, or a new condition.

Planned evidence: Ask one follow-up: 'For the ideal 10-ohm resistor with 0 V across it, you said the current would be infinite. What relationship would you use to calculate its current? Show how you use the given values and explain why your calculation is valid with these values.' Do not supply a formula, rearrangement, operation, or alternative answer.

### Analyzing motion after propulsion stops (analyze)

Expected **Remove a condition**; selected **Check the reason behind an answer**.

Learner’s latest statement: “Its speed must steadily decrease after shutdown because continuing speed requires continuing thrust.”

Frozen diagnostic objective: At the analyze level, examine the causal justification linking removal of thrust to decreasing speed by tracing the predicted change in velocity to its required net force and checking that reasoning against the stated force-free condition.

Selector rationale: The learner has supplied a specific prediction and a questionable supporting relationship. The needed evidence is how they justify decreasing speed under the stated force-free condition, not a new comparison or a conflict between two student claims. This strategy supports analysis of that answer–reason link without assuming an opposing force or requiring unestablished prediction prerequisites.

Planned evidence: Ask one focused question: 'You predicted that the spacecraft’s speed would steadily decrease after shutdown. What makes you think it would slow down when the engine is off and no external forces act on it?' Elicit reasoning connecting the prediction to the given conditions; do not provide a force–motion rule, a corrective contrast, or a new prediction exercise.

### Separating reservoir level from change in level (understand)

Expected **Separate a quantity from its change**; selected **Clarify a specific term**.

Learner’s latest statement: “A high level means it must be filling rapidly, even though I also said the level stays constant.”

Frozen diagnostic objective: At the understand level, assess whether the learner can reconcile the high, constant level with matched inflow and outflow by distinguishing the stored amount from net change and explaining why rapid net filling would contradict a constant level.

Selector rationale: The phrase 'filling rapidly' could refer to water entering or to the stored amount increasing. Clarifying that exact phrase is needed before treating the student's statements as contradictory or as evidence of quantity–change confusion. This probes meaning in the existing explanation at Understand without introducing a new exercise.

Planned evidence: Ask one clarification question grounded in the learner's phrase: 'In your description of the reservoir whose level stays constant, what do you mean by “filling rapidly”?' Do not offer possible meanings, a balance rule, or a corrective contrast.

### Analyzing constant bank balance with ongoing flows (analyze)

Expected **Separate a quantity from its change**; selected **Separate observations from inferences**.

Learner’s latest statement: “Matching balances prove the account had no activity; separate incoming and outgoing amounts cannot matter.”

Frozen diagnostic objective: At the analyze level, assess whether the learner can reconcile matching endpoint balances with the stated deposits and withdrawals by distinguishing zero net change from zero gross flows and identifying that equal nonzero deposit and withdrawal totals invalidate the inference of no activity.

Selector rationale: The missing evidence is the learner's warrant for inferring no transactions from matching endpoint balances, given the stated occurrence of deposits and withdrawals. This probes what the existing observations support at Analyze, without inventing a controlled contrast or treating the task's transaction statement as a second student claim.

Planned evidence: Ask one focused question: "You said matching balances prove the account had no activity. How does that conclusion fit with the statement that deposits and withdrawals both occurred during the month? Use the information given to explain your reasoning." Do not supply a balance equation, transaction amounts, or an alternative explanation.

### Checking two claims about resistance and current (apply)

Expected **Reconcile specific claims**; selected **Check the reason behind an answer**.

Learner’s latest statement: “My claims of 6 V, 3 A, and 4 ohms all agree; I do not need to check one against the others.”

Frozen diagnostic objective: At the apply level, assess whether the learner can use R = V/I with 6 V and 3 A, obtain 2 ohms, and compare that result with 4 ohms to judge the three claims inconsistent.

Selector rationale: The learner supplies a definite consistency judgment but no quantitative support. The missing evidence is use of the voltage-current-resistance relationship behind that judgment, not a controlled contrast or a causal mechanism. This strategy supports a single quantitative application in the supplied setting without providing the relationship to be used.

Planned evidence: Ask: 'You said the 6 V, 3 A, and 4 ohms claims all agree. What numerical check would you use to decide whether they agree? Show your calculation and what it tells you about your claim.' Do not supply a formula, select an operation, or suggest the verdict.

### Reading an existing distance table and graph (understand)

Expected **Change representation**; selected **Separate a quantity from its change**.

Learner’s latest statement: “A flat line means the object has no distance from the start; the three-meter table entries must mean movement each second.”

Frozen diagnostic objective: At the understand level, assess whether the learner can connect each repeated 3-meter distance-from-start entry to the same height on the existing horizontal graph, distinguishing constant nonzero distance from zero distance without introducing a new trip.

Selector rationale: The learner explicitly infers no distance from a flat line. The missing evidence is whether they distinguish the distance shown by the line's height from what its flatness means over time. This can be probed within the existing trip at Understand, without a new prediction or computation.

Planned evidence: Ask one linked conceptual question: 'In the graph you described as flat, what does the line's height tell you about the object's distance from the start, and how does that fit with its being flat?' Do not supply the interpretation of height or flatness, request calculations, or offer alternatives.

### Analyzing equivalent circuit drawings (analyze)

Expected **Change representation**; selected **Check the reason behind an answer**.

Learner’s latest statement: “The vertical drawing must put them in series because one resistor is visually above the other, regardless of the node labels.”

Frozen diagnostic objective: At the analyze level, assess whether the learner can map each resistor's terminals to the labeled nodes in both drawings and use that connectivity comparison to evaluate the claim that vertical placement makes the resistors series.

Selector rationale: The learner supplied a definite answer and an explicit but questionable warrant: vertical placement establishes a series connection. The missing evidence is how the resistor-terminal connections support that answer. A focused check of that link fits Analyze without assuming diagram-reading competence or inventing a second conflicting claim.

Planned evidence: Ask one integrated follow-up: 'For each resistor in each drawing, which labeled nodes are its two ends attached to? How does that comparison support or challenge your claim that the vertical drawing puts them in series?' Do not repeat the supplied connection pattern, state a series or parallel criterion, or announce whether the claim is correct.

### Checking the procedure behind an arithmetic answer (apply)

Expected **Check the reason behind an answer**; selected **Controlled comparison**.

Learner’s latest statement: “I got 6 by picking the middle entry; I would use that same procedure for any list when asked for its mean.”

Frozen diagnostic objective: At the apply level, assess whether the student can calculate the arithmetic mean by summing all readings and dividing by the number of readings on a list where selecting the middle entry yields a different result.

Selector rationale: Changing only the last reading preserves the middle entry while separating the results of the competing procedures. This supplies the missing Apply-level evidence through a quantitative calculation, without requiring a definition or inventing a contradiction between the student's claims.

Planned evidence: Ask one self-contained calculation question: 'The last reading changes from 8 to 11, so the readings are now 4, 6, and 11. What is their arithmetic mean? Show the calculation you use.' Do not name or demonstrate a procedure or mention the competing result.

### Accounting for water in drying clothes (understand)

Expected **Account for transfers and conservation**; selected **Check the reason behind an answer**.

Learner’s latest statement: “The water no longer exists anywhere in that closed room once the clothes dry.”

Frozen diagnostic objective: Elicit the reasoning linking the decrease in liquid water in the clothes to the claim of nonexistence, to distinguish difficulty understanding water vapor as a state of water from difficulty accounting for water across the closed-system boundary.

Selector rationale: The learner has supplied an explicit conclusion about nonexistence but no reason connecting it to the decrease of liquid water in the clothes. Probing that supporting relationship directly fits Understand without introducing a new exercise or assuming that two student claims contradict each other. Conservation accounting is relevant to the content, but the immediately missing evidence is the reason for the actual answer.

Planned evidence: Ask one neutral follow-up grounded in the learner's answer: 'You said the clothes contain less liquid water afterward. What makes you think the water no longer exists anywhere in the closed room once the clothes dry?' Do not supply a destination, name a state of water, offer alternatives, or state a conservation rule.

### Classifying a chemical change by relevant features (understand)

Expected **Classify using defining features**; selected **Check the reason behind an answer**.

Learner’s latest statement: “An appearance change is enough to call it a chemical reaction even if the substance is still water.”

Frozen diagnostic objective: At the understand level, diagnose how the learner weighs visible changes against unchanged substance identity when explaining whether melting is a chemical change, focusing on the justification for treating appearance change as sufficient.

Selector rationale: The student has explicitly classified melting as a chemical reaction and named appearance change as sufficient, but has not explained the supporting link. This strategy probes that link within the existing explanation at Understand, without inventing a comparison or treating the student's two statements as a contradiction. The needed evidence is the justification for the answer, not a new classification exercise or clarification of an ambiguous term.

Planned evidence: Ask one neutral follow-up: 'You said an appearance change is enough to call melting a chemical reaction, even if it is still water. What makes the appearance change enough in your explanation?' Do not supply a classification criterion, corrective contrast, counterexample, or additional task.

### Analyzing an invalid grouping of functions (analyze)

Expected **Classify using defining features**; selected **Separate necessary from sufficient conditions**.

Learner’s latest statement: “Smooth appearance establishes linearity; constant slope and additivity cannot matter.”

Frozen diagnostic objective: Analyze the sufficiency of the proposed smooth-appearance criterion by checking whether its classification of a smooth curved graph with changing slope is consistent with the constant-slope requirement for linear functions.

Selector rationale: The learner explicitly treats smooth appearance as sufficient to establish linearity. The missing evidence is analysis of that implication against the curved, changing-slope graphs already included in the task, not a limiting case or a newly constructed comparison. This fits Analyze and the theoretical rubric without requiring slope calculations or resolving the affine-versus-linear-map convention.

Planned evidence: Ask one focused question: 'The grouping includes smooth-looking curved graphs with changing slope. How do those graphs support or challenge your claim that smooth appearance establishes linearity?' Require reasoning tied to those observable features, without supplying a definition of linearity, a test, or a verdict.

### Interpreting an average from a group (understand)

Expected **Separate levels of organization**; selected **Check the reason behind an answer**.

Learner’s latest statement: “That group number must be the height of each person, not a summary across differing people.”

Frozen diagnostic objective: At the understand level, identify the learner's rationale for treating a single reported group mean as necessarily applying to every individual, distinguishing awareness of one summary number from an assumption of identical member values.

Selector rationale: The learner has supplied an explicit answer about each person's height, but the relationship supporting that answer is missing. This strategy elicits that warrant within the existing setting at Understand, without inventing a comparison or treating the two compatible student statements as contradictory.

Planned evidence: Ask one neutral follow-up about the learner's stated relationship: "What makes you think the group's one reported mean must be the height of each person?" Do not supply a definition of mean, individual measurements, a calculation, or an alternative interpretation.

### Explaining an assumption behind an average-speed shortcut (understand)

Expected **Match a method to its conditions**; selected **Check the reason behind an answer**.

Learner’s latest statement: “The two speeds can always be weighted equally, even when the time spent at each speed differs.”

Frozen diagnostic objective: Assess whether the learner can explain, using total distance and total time, why unequal durations generally require unequal time weights and why equal durations justify the unweighted mean for two distinct speeds.

Selector rationale: The learner has explicitly answered that equal weighting always works, but the relationship supporting that answer is missing. Probing how duration relates to weighting addresses that gap at Understand without inventing a comparison, a limiting case, or a second conflicting claim.

Planned evidence: Ask one conceptual follow-up: "In your account of this two-segment trip, how does the time spent at each speed relate to the weight you give that speed in the trip average?" Elicit the supporting relationship without supplying a definition, formula, duration condition, or calculation procedure. Do not introduce a new trip or request numerical results.

### Using classical relative velocity for a moving walkway (apply)

Expected **Specify the system or reference**; selected **Check the reason behind an answer**.

Learner’s latest statement: “I would subtract the directions without checking which frame each speed belongs to, and say the person is going west in the terminal.”

Frozen diagnostic objective: At the apply level, assess whether the learner can assign the given velocities to their respective frames, use one consistent east-west sign convention, and add them to obtain the person’s terminal velocity of 1 m/s east.

Selector rationale: The learner has supplied a concrete terminal-direction answer, but the calculation and reference assignments supporting it are missing. This strategy elicits quantitative application behind that answer without treating the tentative wording as an established misconception. Unlike reconcile-claims, it does not invent a conflict between recognizing different references and stating a direction; unlike a reference-clarification-only probe, it requires a calculation.

Planned evidence: Ask one self-contained follow-up: 'You suggested that the person moves west relative to the terminal. The walkway moves east at 2 m/s relative to the terminal, and the person walks west at 1 m/s relative to the walkway. What calculation would you use to find the person's velocity relative to the terminal? Show which direction you take as positive and label what each velocity in your calculation is relative to, then give the speed and direction.' Do not supply a formula, operation, or correct direction.

### Analyzing interaction classification under a system boundary (analyze)

Expected **Specify the system or reference**; selected **Classify using defining features**.

Learner’s latest statement: “Gravity between them is external just because Earth is much bigger; the stated boundary cannot matter.”

Frozen diagnostic objective: Analyze how the explicitly stated ball-plus-Earth boundary determines the classification of their mutual gravitational interaction, distinguishing system membership from relative size as a basis for classification.

Selector rationale: The missing evidence is which feature the learner uses to classify the interaction, and why that feature supports the classification in the explicitly defined system. This fits Analyze because it examines the size-based criterion in the learner's argument. The system membership is already understood, so clarifying an unspecified scope is not the primary need; nor are the two statements necessarily contradictory under the learner's rule.

Planned evidence: Ask one targeted follow-up: "The stated system is the falling ball plus Earth. You called their gravity external because Earth is much bigger. What makes Earth's size relevant to that classification for this stated system?" Treat the classification and its size-based justification as the learner's claims, not as established facts. Elicit reasoning about that criterion without providing the classification rule or a corrective alternative.

## Interpretation of this completed run

The selector matched 34/51 intended labels (66.7%). Understand was the weakest agreement level: 9/17. Mechanism tracing, necessary/sufficient conditions, evidence versus inference, and stochastic reasoning each matched 3/3 cases. Boundary cases, quantity versus change, representation changes, feature-based classification, and system/reference each matched 1/3. These tiny per-strategy samples are descriptive, not stable accuracy estimates.

Ten of the 17 mismatches selected answer-reason-consistency. That broad strategy often overlaps the intended structure: for example, it can ask for the calculation behind an answer in a boundary, reference-frame, or reconciliation task. This is evidence of label overlap and a preference for broad probes; without generating questions here, it does not establish that those ten choices would produce worse questions.

Some alternatives are substantively plausible on inspection. The matched-volume case selected reconciliation because the learner both acknowledged matched volumes and suggested different volumes. The flat distance graph selected quantity-versus-change, which directly addresses confusing graph height with change over time. The graph-classification case selected necessary/sufficient because the learner treated smoothness as sufficient for linearity. These observations are qualitative inspection by the coding assistant, not an independent scored review or a corrected accuracy metric.

Accordingly, the result is exact intended-label agreement, not 66.7% independently verified pedagogical correctness. No negative-control cases tested whether abstention is reliable, and no end-to-end question-quality or learner-response claim follows from this run.

## Audit and reproduction

- [Raw results](../evaluations/open-strategy-selection-v1/results.json)
- [Frozen fixtures](../evaluations/open-strategy-selection-v1/fixtures.json)
- Per-case request/response traces: `backend/evaluations/open-strategy-selection-v1/cases/`.
- Exact implementation snapshots: `backend/evaluations/open-strategy-selection-v1/implementation/`.
- Reproduce with `node scripts/evaluate-open-strategy-selection.mjs --output <new-directory> --concurrency 3`, then generate this report with `node scripts/report-open-strategy-selection.mjs`.

No question was selected for its review score, and no mismatched choice was silently retried to improve label agreement.
