# Review and rerun of the 17 open-selection mismatches

## Initial adjudication

Reviewed the full fixed transcripts, rubrics, diagnostic objectives, selection rationales, and actual plans. **15 were valid alternative next probes; 2 were selection/target-preservation errors.** A mismatch with an authored label alone was not treated as a pedagogical error. Valid alternatives can still have less precise labels, cover only one unresolved point, or be less preferable than another probe. These are implementation judgments by the coding assistant, not independent instructor adjudication.

The two errors were: (1) the distance-table/graph case dropped the required connection to the table and examined only graph height/flatness; (2) the drying-water case requested a justification for disappearance but never requested an account of the water within the closed clothes-plus-air system. The required-evidence criteria below were saved and hashed before the rerun.

## Selection rule changes

- Choose the strategy matching the actual evidence-producing operation in the plan. An existing answer does not by itself justify the generic answer–reason strategy.
- Prefer a supported specific operation when its prerequisites hold, while retaining legitimate alternative structures.
- Preserve constitutive relationships: both sides of a requested representation mapping, the tracked quantity and system for accounting, and reference assignments that determine a result.
- Recognizing a frame or system name is not the same as applying it. Clarification remains appropriate when a concrete ambiguity blocks conceptual assessment.
- Do not force a unique label for a valid controlled contrast between procedures or a sufficiency test of a classification feature. Keep level and no-leakage constraints intact.

The implementation changes are shared by the live selector and this benchmark. No case IDs, expected choices, or subject-specific rules were added to the prompt.

## Selection-only rerun

Only the original 17 mismatches were rerun. All eligible strategies remained available. The same model and original frozen diagnostic states were used. No new questions, assessments, diagnoses, suitability checks, or model reviews were generated. The selector’s normal structured plan was retained for inspection. Original expected labels were not changed, and case-level adjudication was not sent to the model.

Completed 17/17; exact intended-label matches **11/17**, compared with **0/17** on these selected cases before refinement. Abstentions 0; errors 0; model calls 17. This is an in-sample refinement check on known mismatches, not a new full-suite accuracy estimate. The other 34 cases were not rerun.

Manual review against the frozen evidence criteria: **17/17 acceptable selections**, **0/17 remaining selection errors**. 2/2 original evidence-loss errors repaired. This assessment is separate from exact label agreement.

| Case | Original intended → selected | Initial assessment | Rerun selected | Exact intended label? | Post-rerun evidence assessment |
|---|---|---|---|---|---|
| controlled-comparison-understand | Controlled comparison → Reconcile specific claims | Valid alternative | Reconcile specific claims | No | Preserved |
| boundary-case-understand | Boundary case → Check the reason behind an answer | Valid alternative | Boundary case | Yes | Preserved |
| boundary-case-apply | Boundary case → Check the reason behind an answer | Valid alternative | Boundary case | Yes | Preserved |
| remove-condition-analyze | Remove a condition → Check the reason behind an answer | Valid alternative | Remove a condition | Yes | Preserved |
| quantity-versus-change-understand | Separate a quantity from its change → Clarify a specific term | Valid alternative | Clarify a specific term | No | Preserved |
| quantity-versus-change-analyze | Separate a quantity from its change → Separate observations from inferences | Valid alternative | Account for transfers and conservation | No | Preserved |
| reconcile-claims-apply | Reconcile specific claims → Check the reason behind an answer | Valid alternative | Reconcile specific claims | Yes | Preserved |
| representation-change-understand | Change representation → Separate a quantity from its change | Selection error | Change representation | Yes | Preserved |
| representation-change-analyze | Change representation → Check the reason behind an answer | Valid alternative | Change representation | Yes | Preserved |
| answer-reason-consistency-apply | Check the reason behind an answer → Controlled comparison | Valid alternative | Controlled comparison | No | Preserved |
| conservation-accounting-understand | Account for transfers and conservation → Check the reason behind an answer | Selection error | Account for transfers and conservation | Yes | Preserved |
| classify-by-features-understand | Classify using defining features → Check the reason behind an answer | Valid alternative | Separate necessary from sufficient conditions | No | Preserved |
| classify-by-features-analyze | Classify using defining features → Separate necessary from sufficient conditions | Valid alternative | Separate necessary from sufficient conditions | No | Preserved |
| scale-level-distinction-understand | Separate levels of organization → Check the reason behind an answer | Valid alternative | Separate levels of organization | Yes | Preserved |
| method-applicability-understand | Match a method to its conditions → Check the reason behind an answer | Valid alternative | Match a method to its conditions | Yes | Preserved |
| scope-and-reference-apply | Specify the system or reference → Check the reason behind an answer | Valid alternative | Specify the system or reference | Yes | Preserved |
| scope-and-reference-analyze | Specify the system or reference → Classify using defining features | Valid alternative | Specify the system or reference | Yes | Preserved |

## Per-case reasoning

### coverage-controlled-comparison-understand

**Initial assessment:** valid_alternative. Reconciliation directly probes the learner’s own acknowledgement of matched volumes versus the proposed extra-water explanation. A valid first probe; it does not establish the temperature relationship.

**Frozen required evidence:** Elicit how matched volume constrains the explanation, or its relationship to the varied temperature, without inventing a new experiment.

**Rerun selection:** Reconcile specific claims. The unresolved evidence target is how the learner relates acknowledged matched water volumes to the tentative greater-water explanation of the time difference. The needed operation is to connect those two actual statements in the existing comparison. Reconcile-claims directly performs this operation at Understand without introducing a new prediction task. Controlled-comparison is a genuine alternative for probing the role of temperature, but this probe does not construct an isolating contrast; it investigates the learner's two statements. No specific word has a demonstrated ambiguity requiring term clarification first.

**Rerun construction:** Ask one relationship question grounded in the learner's two statements: 'You said the volumes were matched, but also suggested that the warm-water cup had more water. How do those two statements fit together in your explanation of why the salt dissolved sooner?' Do not add a new experiment, prediction, definition, or corrective explanation.

**Post-rerun review:** Valid. The reconciliation plan retains matched volume versus extra-water claims and asks how they fit the observed result. Valid first probe; other control relationships remain unassessed.

### coverage-boundary-case-understand

**Initial assessment:** valid_alternative. The answer–reason construction explicitly tests the role of zero displacement in the work claim. It preserves the boundary evidence even under a broader label.

**Frozen required evidence:** Elicit the role of no displacement in the stated work claim; do not substitute effort or fatigue alone.

**Rerun selection:** Boundary case. The unresolved rubric-linked evidence is how the learner relates the crate's zero travel distance to mechanical work while maintaining that the push is large. The needed operation is to elicit that relationship at the already established zero-motion limit, not introduce a new prediction or calculation. Boundary-case directly retains this limit at Understand. Necessary-sufficient is a plausible alternative for investigating the claimed sufficiency of a large push, but the present target is specifically the role of the existing zero-distance condition. The crate is already explicitly identified as the object receiving the claimed work, so scope clarification is not needed first.

**Rerun construction:** Ask one conceptual follow-up about the existing zero-motion condition: 'In your explanation, what role does the crate's not moving play in deciding how much mechanical work the push does on the crate?' Do not introduce a moving comparison, numerical givens, a formula, or a suggested conclusion.

**Post-rerun review:** Valid. The plan explicitly probes zero motion in the existing work claim without a new exercise or supplied work rule.

### coverage-boundary-case-apply

**Initial assessment:** valid_alternative. The plan retains finite resistance, zero voltage, numerical method use, and validity of the operation at zero. It is substantively a boundary probe under a broad label.

**Frozen required evidence:** Require independent use of a resistor relationship at the supplied zero-voltage condition and reasoning about the operation’s validity.

**Rerun selection:** Boundary case. The unresolved evidence is whether the learner can select and use the resistor relationship for current at the stated zero-voltage limit. Elicit a numerical calculation and its justification in that same limiting case. Boundary-case is more specific than answer-reason-consistency here because the operation tests the learner's proposed quotient at a physically valid zero condition, not merely its general supporting warrant. A controlled comparison would add a second voltage condition unnecessarily; method-applicability would shift attention toward conditions of a method rather than executing the current calculation.

**Rerun construction:** Ask one integrated follow-up: 'For the ideal 10-ohm resistor with 0 volts across it, what current do you calculate? Show the relationship you use and the values you put into it, and explain whether your calculation is valid at 0 volts.' Do not supply an equation, rearrangement, quotient, or result.

**Post-rerun review:** Valid. The plan requires the relationship, numerical application at zero voltage, and validity of the chosen operation, without supplying the formula.

### coverage-remove-condition-analyze

**Initial assessment:** valid_alternative. The plan asks for analysis of the claimed deceleration after thrust ends under the unchanged force-free condition. The diagnostic removal structure is retained.

**Frozen required evidence:** Analyze the claimed effect of thrust removal with the remaining force conditions explicit; do not invent resistance.

**Rerun selection:** Remove a condition. The unresolved evidence is whether the learner can justify the predicted decrease in speed using the conditions remaining after thrust ends. The needed operation is to examine persistence of motion after that named influence is removed, checking the explanation against the stated absence of significant external forces. Remove-condition directly preserves that structure at Analyze. Mechanism-tracing is a nearby alternative, but would emphasize an intermediate causal step rather than the explicit shutdown and remaining conditions; a generic answer-reason check is less specific.

**Rerun construction:** Ask one focused follow-up: "After shutdown, the engine stays off and no significant external forces act on the spacecraft. What makes you think its speed must decrease under those conditions? In your account, what causes that decrease?" Elicit examination of the shutdown-to-speed-change link without supplying a force law or a corrected prediction.

**Post-rerun review:** Valid. The construction analyzes the shutdown-to-deceleration claim under the remaining force-free conditions.

### coverage-quantity-versus-change-understand

**Initial assessment:** valid_alternative. “Filling rapidly” could mean gross inflow or increasing stored amount. Clarifying the exact phrase before diagnosing a value/rate error is justified. This does not complete the whole rubric.

**Frozen required evidence:** Resolve the blocking meaning of the phrase, or directly distinguish stored level, net change, and flows without assuming the learner’s intended meaning.

**Rerun selection:** Clarify a specific term. The unresolved evidence target is whether the learner's claim about rapid filling refers to change in the stored amount or to water entering the reservoir. Clarifying that phrase in the existing constant-level setting is needed before assessing the first rubric item: the two meanings support different interpretations. Clarify-specific-term takes priority because this concrete ambiguity blocks assessment. Quantity-versus-change would be a suitable subsequent operation once the meaning is known; reconciling the claims now could incorrectly presume that the learner asserted rapid accumulation.

**Rerun construction:** Ask one meaning-focused question grounded in the learner's statement: 'When you say this reservoir is “filling rapidly,” what do you mean is happening to the water while the level stays constant?' Do not supply alternative meanings, a balance rule, or a correction.

**Post-rerun review:** Valid. The exact phrase remains plausibly ambiguous. The clarification asks what happens to the water while level stays constant without supplying alternatives.

### coverage-quantity-versus-change-analyze

**Initial assessment:** valid_alternative. The evidence–inference plan examines whether equal endpoint balances justify no activity in light of stated deposits and withdrawals. This addresses the core inference without fabricating another learner claim.

**Frozen required evidence:** Relate equal endpoint balances to the stated transactions; a bare challenge to belief without that relationship is insufficient.

**Rerun selection:** Account for transfers and conservation. The unresolved evidence target is how the learner accounts for both incoming and outgoing money over the month when the endpoint balances match. Eliciting the relationship among starting balance, ending balance, total deposits, and total withdrawals directly probes the active balance-accounting rubric at Analyze. Conservation-accounting is more specific than a generic answer–reason probe because it requires an account of storage and both transfers within one account and interval. Necessary-sufficient or evidence-inference could examine the no-activity inference, but would not necessarily expose the omitted flow relationship. Reconcile-claims is not appropriate: the learner's two statements are not themselves conflicting claims.

**Rerun construction:** Ask one integrated follow-up: 'For this account over the month, how must the total deposits and total withdrawals relate to the matching starting and ending balances, and what does that tell you about your claim that there was no activity? Assume there were no fees, interest, or other balance adjustments.' Do not provide a formula, possible totals, or the relationship the learner should identify.

**Post-rerun review:** Valid. The newly selected quantity-accounting strategy directly relates deposits and withdrawals to equal endpoint balances and the no-activity claim. Its explicit no-other-adjustments assumption defines a usable balance scope.

### coverage-reconcile-claims-apply

**Initial assessment:** valid_alternative. The plan requests a numerical consistency check across all three claimed values and interpretation of that check. Its operation is reconciliation even though labeled answer–reason.

**Frozen required evidence:** Use the supplied voltage/current/resistance values to check their mutual consistency and interpret the result.

**Rerun selection:** Reconcile specific claims. The unresolved evidence target is whether the learner can quantitatively connect the claimed 6 V and 3 A to the claimed 4 ohms. The required operation is a numerical consistency check linking these actual claims, not simply a justification of the assertion that they agree. Reconcile-claims fits more specifically than answer-reason-consistency because the transcript supplies both the voltage/current claim and the resistance claim. No single-factor contrast, limiting condition, or uncertainty about a method's applicability is established or needed.

**Rerun construction:** Ask one integrated follow-up: 'You claimed 6 V across the resistor, 3 A through it, and a resistance of 4 ohms. Can all three claims hold together? Show a numerical check using the voltage and current to test the resistance claim.' Do not supply a formula, arithmetic procedure, or verdict.

**Post-rerun review:** Valid. The construction requires a numerical check connecting all three claims and a supported consistency judgment.

### coverage-representation-change-understand

**Initial assessment:** selection_error. The quantity/change plan asks only about graph height and flatness and drops the required correspondence with the table. It can test a related distinction but cannot establish the selected cross-representation evidence target.

**Frozen required evidence:** Explicitly connect the repeated table values to the existing graph’s height or flatness, while distinguishing constant from zero distance.

**Rerun selection:** Change representation. The unresolved evidence target is the correspondence between the repeated table entries and the height of the existing graph. Eliciting the meaning of that correspondence directly tests the first rubric item at Understand, without a new trip or calculation. Representation-change is more specific than a generic answer–reason check because the operation links two existing equivalent displays. Quantity-versus-change is a viable alternative only if it retains this correspondence; a graph-only question would drop required evidence. The learner's wording is sufficiently specific to probe this relationship rather than first requesting a definition, although representation-reading difficulty remains possible.

**Rerun construction:** Ask one conceptual correspondence question using the existing displays: 'How do the repeated 3-meter entries in the table relate to the height of the flat line on this graph, and what does that match mean about the object's distance from the start?' Do not supply an interpretation of flatness or explain how entries become graph points. Request no calculation or new graph.

**Post-rerun review:** Valid. Repaired: the plan explicitly maps the repeated table entries to the existing graph height and asks what that correspondence means for distance.

### coverage-representation-change-analyze

**Initial assessment:** valid_alternative. The answer–reason plan explicitly compares each resistor’s node attachments in both drawings. It preserves the equivalent-representation operation; the label is less precise than the construction.

**Frozen required evidence:** Compare connectivity across both layouts using the labeled nodes, then relate that comparison to the classification claim.

**Rerun selection:** Change representation. The unresolved evidence is whether the learner can map both terminals of each resistor to labeled nodes in each drawing and use the correspondence to evaluate the layout-based claim. Comparing those mappings across equivalent drawings directly performs representation-change at Analyze. A controlled comparison is a plausible alternative because layout changes while connections are held fixed, but the required evidence is specifically the correspondence across the two displays, not merely a predicted effect of changing layout. A generic answer–reason probe would not ensure that correspondence.

**Rerun construction:** Render the two sketches specified in the scenario without adding classification labels, connectivity rules, or a statement that they are equivalent. Ask one integrated follow-up: 'For each drawing, identify the labeled node connected to each end of R1 and R2. How does your comparison support or challenge your claim that the vertical drawing puts the resistors in series?' Do not supply a completed terminal mapping or the expected classification.

**Post-rerun review:** Valid. The construction requires terminal-to-node mappings in both diagrams and uses that comparison to examine the visual-layout claim. Actual drawing generation was not tested.

### coverage-answer-reason-consistency-apply

**Initial assessment:** valid_alternative. The changed final reading creates a valid single-factor contrast between the learner’s middle-entry rule and an arithmetic-mean procedure. Other relevant features are fixed and the calculation is requested.

**Frozen required evidence:** Elicit a calculation that distinguishes the middle-entry shortcut from an arithmetic-mean procedure, without supplying either procedure.

**Rerun selection:** Controlled comparison. The unresolved evidence target is whether the learner can apply an arithmetic-mean procedure when the middle entry no longer coincides with the mean. Change only the last reading while retaining the list length, order, and first two readings, and elicit a calculation. This isolating contrast distinguishes the competing procedures more directly than asking again for the reason behind the original answer. Method-applicability is a possible alternative for investigating conditions of use, but the present target is procedural execution, not a discussion of when a shortcut works.

**Rerun construction:** Ask one worked application question: 'Keep the first two readings, 4 and 6, the same, but change the last reading from 8 to 11. What is the arithmetic mean of 4, 6, and 11? Show the calculation you use.' Do not supply a formula or name a competing procedure in the question.

**Post-rerun review:** Valid. The controlled contrast changes one reading while holding the others fixed and asks for a calculation; this validly distinguishes the stated shortcut from a mean procedure.

### coverage-conservation-accounting-understand

**Initial assessment:** selection_error. The plan asks only why the learner believes disappearance. It never requests an account of the tracked water within the closed clothes-plus-air system, so it loses the defining evidence target.

**Frozen required evidence:** Elicit how the water is accounted for across the closed clothes-plus-room-air system during drying; do not supply a destination, state change, or conservation rule.

**Rerun selection:** Account for transfers and conservation. The unresolved evidence target is an account of the water lost by the clothes across the stated drying interval within the closed clothes-plus-room-air system. Eliciting what happens to that water performs quantity accounting at Understand without introducing a new exercise. This is more specific than asking for the reason behind the disappearance answer: the boundary is already explicit, so scope-and-reference is not needed, and the two learner statements do not themselves contradict one another. The explicit nonexistence claim does not present a concrete wording ambiguity requiring clarification first.

**Rerun construction:** Ask one conceptual follow-up grounded in the existing account: 'In your account, what happens during drying to the water that is no longer in the clothes, considering the clothes and all the air in the closed room? Explain how that fits with your statement that it no longer exists.' Do not supply a destination, state change, balance rule, or corrective alternative.

**Post-rerun review:** Valid. Repaired: the plan requests an account of water no longer in the clothes across the clothes-plus-room-air system during drying, without supplying a destination or state change.

### coverage-classify-by-features-understand

**Initial assessment:** valid_alternative. Asking why appearance change suffices directly elicits the feature used for the chemical-reaction classification. It is a reasonable feature-criterion probe under a broad label.

**Frozen required evidence:** Probe whether and why the stated appearance feature supports the classification in the existing melting situation, without teaching a criterion.

**Rerun selection:** Separate necessary from sufficient conditions. The unresolved evidence target is the learner's justification for treating changed appearance as sufficient for chemical classification despite acknowledging that the substance remains water. The needed operation is to probe the completeness of that explicit implication within the existing melting account. Necessary-sufficient fits more precisely than a generic answer–reason check. Classify-by-features is a viable alternative, but asking merely which feature the learner uses would repeat evidence already available; this probe asks why that feature is enough. No new comparison, counterexample, or application task is needed.

**Rerun construction:** Ask one conceptual follow-up: "What makes you think the change in appearance is enough to call melting a chemical reaction, even though you say the substance is still water?" Keep the implication attributed to the learner. Elicit its justification without providing a definition, a correct classification, a counterexample, or a new situation.

**Post-rerun review:** Valid. The sufficiency probe asks why appearance alone warrants the classification in the existing melting event, retaining the identity condition.

### coverage-classify-by-features-analyze

**Initial assessment:** valid_alternative. The learner explicitly claims a feature is sufficient for linearity. Testing that implication against the included curved changing-slope cases is a valid classification analysis.

**Frozen required evidence:** Examine whether smooth appearance supports the proposed grouping using the supplied curved/changing-slope cases.

**Rerun selection:** Separate necessary from sufficient conditions. The unresolved evidence target is whether the learner can analyze the claimed implication from smooth appearance to linearity using the changing-slope case already in the task. The required operation is to assess whether that condition is enough, with supporting reasoning about the existing case. Necessary-sufficient directly captures this operation. Classify-by-features is a plausible alternative, but the explicit sufficiency claim makes implication completeness the more specific target; no new counterexample or definition is supplied. The ambiguity about the meaning of smooth does not block this probe because the case retains the task's smooth-looking description.

**Rerun construction:** Ask one follow-up: 'For the smooth-looking curved graph with changing slope already included in the grouping, is smooth appearance enough to justify calling it linear? Explain how the graph’s changing slope affects your judgment.' Do not provide a definition of linearity, a slope calculation procedure, or the verdict.

**Post-rerun review:** Valid. The sufficiency probe tests the proposed feature against supplied changing-slope curved cases and requires analysis of their relevance.

### coverage-scale-level-distinction-understand

**Initial assessment:** valid_alternative. The plan directly probes the inference from a group mean to every individual’s height. It retains the part/aggregate distinction even though using answer–reason labeling. The opening assistant turn also contaminated this fixture by stating identical heights.

**Frozen required evidence:** Elicit the relationship between a reported group summary and individual values; do not demand a new calculation.

**Rerun selection:** Separate levels of organization. The unresolved rubric-linked evidence is the learner's relationship between a single mean reported for the group and the height attributed to each member. Elicit that group-to-individual link within the existing explanation, without a calculation or new case. Scale-level-distinction specifically probes this mapping. Answer-reason-consistency could elicit a warrant, but is less specific than the supported aggregate-to-member operation; reconcile-claims is not needed because the two statements are not inherently contradictory. The wording is sufficiently explicit that clarification of an ambiguous term is not the blocking issue.

**Rerun construction:** Ask one conceptual follow-up about the existing aggregate-to-member relationship: 'You said the group number must be each person's height. What makes you think the group's reported mean of 170 cm tells us that each person is 170 cm tall?' Attribute the claim to the learner without endorsing it; do not introduce a numerical example, computation, definition, or corrective alternative.

**Post-rerun review:** Valid. The construction directly probes the group-summary-to-individual inference. The inherited leading opening remains a fixture limitation.

### coverage-method-applicability-understand

**Initial assessment:** valid_alternative. The planned relationship between segment duration and weighting directly bears on the shortcut’s conditions. A broader label does not remove that evidence, though a method-applicability label would be more precise.

**Frozen required evidence:** Elicit the relationship between segment duration and validity of equal speed weighting within the existing conceptual task.

**Rerun selection:** Match a method to its conditions. The unresolved rubric-linked target is whether the learner understands the duration condition that makes equal weighting a valid average-speed shortcut. The needed operation is to explain the shortcut's applicability in the existing trip, connecting segment durations with total distance and total time, without performing a calculation. Method-applicability specifically probes the conditions for the learner's proposed method. Answer-reason-consistency is a possible broader alternative, but is less precise here because the missing support is a method's usable condition. A controlled comparison would require adding a comparison not established in this Understand-level transcript.

**Rerun construction:** Ask one conceptual follow-up: 'For the trip you described, how does the time spent at each speed affect when giving the two speeds equal weight is appropriate? Explain how this relates to the trip’s total distance and total time.' Do not supply a definition, formula, duration condition, or calculation procedure.

**Post-rerun review:** Valid. The construction elicits how duration affects the equal-weight shortcut’s applicability within the established trip, without a new numerical exercise.

### coverage-scope-and-reference-apply

**Initial assessment:** valid_alternative. The plan requires references for each velocity, consistent signs, and the final numerical terminal velocity. It fully preserves the frame-composition evidence despite the broad label.

**Frozen required evidence:** Apply the supplied velocities with explicit references and consistent signs to find terminal velocity; merely name frames is insufficient.

**Rerun selection:** Specify the system or reference. The unresolved rubric-linked evidence is whether the learner can retain both velocity reference assignments while calculating terminal velocity with consistent directional signs. The needed operation is a quantitative reference transformation in the existing physical event, not just naming frames. Scope-and-reference directly elicits this at Apply. Answer-reason-consistency is a possible generic alternative because a direction was supplied, but it is less specific than testing the reference assignments that determine that direction. No contrast, limit, or actual contradiction between the learner's two statements is established.

**Rerun construction:** Ask one integrated calculation question: 'A walkway moves east at 2 m/s relative to the terminal, and a person walks west at 1 m/s relative to the walkway. What is the person's velocity relative to the terminal? Show your calculation, stating which direction you take as positive and labeling what each velocity in your calculation is measured relative to.' Do not supply a formula, prescribed arithmetic operation, signed input values, or the resulting direction.

**Post-rerun review:** Valid. The plan requires a numerical terminal-velocity calculation with consistent signs and explicit references for the inputs.

### coverage-scope-and-reference-analyze

**Initial assessment:** valid_alternative. Feature-based classification is legitimate when the boundary is already specified: the plan probes why size should govern internal/external classification for that stated system. Boundary dependence would be the more specific label.

**Frozen required evidence:** Analyze the relative relevance of the stated system membership and the learner’s size-based criterion to interaction classification; do not give the classification rule.

**Rerun selection:** Specify the system or reference. The unresolved evidence is how the learner relates the external classification to the explicitly chosen ball-plus-Earth system, rather than merely recognizing its members. The needed operation is examination of the scope used by that classification while keeping the physical interaction fixed. Scope-and-reference directly targets this at Analyze. Classify-by-features is a plausible alternative for probing the size criterion, but the decisive unresolved relationship here concerns the specified system; a generic answer-reason probe would be less specific. No transfer balance or new boundary comparison is needed.

**Rerun construction:** Ask one focused follow-up: 'When you call the gravity between the ball and Earth external, external to what system? Explain how that fits with the stated system containing both the ball and Earth.' Keep the request about the learner's classification in the original account; do not supply a classification rule or introduce a different system as a worked alternative.

**Post-rerun review:** Valid. The plan asks what system the external classification refers to and relates that to the stated ball-plus-Earth membership, without giving a classification rule.

## Limits and fixture caution

The group-height fixture opens with an assistant statement attributing identical heights to the learner; this may prime the later learner claim. It was flagged during review but left unchanged so this selection comparison retained identical inputs. Do not use it to infer a stable learner misconception.

This review is subjective and was performed by the same coding assistant that refined the rules. The evidence criteria were frozen before the rerun, but the test cases were already known. A single selection sample, no learner responses, and no negative-control cases cannot establish generalization, diagnostic effectiveness, or reliable abstention. A more specific selected label is not proof of a better generated question.

## Evidence files

- [Original 51-case selection results](../evaluations/open-strategy-selection-v1/results.json)
- [Frozen initial adjudication](../evaluations/open-strategy-selection-v2-mismatches/pre-rerun-adjudication.json)
- [17-case rerun results](../evaluations/open-strategy-selection-v2-mismatches/results.json)
- [Post-rerun manual adjudication](../evaluations/open-strategy-selection-v2-mismatches/post-rerun-adjudication.json)

Per-case requests, responses, plans, and exact implementation snapshots are stored with the rerun. Reproduce using `node scripts/evaluate-open-strategy-selection.mjs --output <new-directory> --mismatches-from backend/evaluations/open-strategy-selection-v1/results.json --adjudication backend/evaluations/open-strategy-selection-v1/mismatch-adjudication.json --concurrency 3`. Regenerate this report with `node scripts/report-open-strategy-mismatch-review.mjs`.
