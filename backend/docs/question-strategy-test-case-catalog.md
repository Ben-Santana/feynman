# Test cases and exact default-versus-strategy questions

This catalog displays all 51 cases actually run for the 18-strategy evaluation, plus the newer question pairs from the 11 affected-case reruns. The developer tool also contains 16 older fixtures; those are not part of the 51-case coverage benchmark shown here.

**How the pairs were tested:** the two branches shared the fixed conversation, active rubric, and rubric assessment. Default generation received no expected-strategy label or review guide. The strategy branch was offered the intended supported strategy and could abstain. This tests targeted strategy application, not open strategy selection. No student answered the generated follow-ups: these are next-question design comparisons using authored synthetic cases, not copied or validated concept-inventory items.

**Levels:** Remember 2; Understand 17; Apply 16; Analyze 16. Clarification supports Remember/Understand; recall supports Remember only; the other 16 strategies support Understand/Apply/Analyze. This does not cover every learning-type/task combination or quantitative Analyze paper workflows.

**Reading the questions:** Initial pairs are quoted exactly from the complete 51-case run. Eleven cases additionally show their latest post-fix pair, clearly labeled. Latest results combine ten cases from the first leakage-fix revision and the divisibility Apply case from the subsequent planning fix; the rejected intermediate plan remains in the run archives. The remaining 40 questions are historical pre-fix outputs.

## Coverage at a glance

| Strategy | Remember | Understand | Apply | Analyze |
|---|---|---|---|---|
| Controlled comparison | Not supported | Interpreting a controlled salt-dissolving comparison | Using simulated controlled insulation measurements | Analyzing a controlled dissolving study explanation |
| Boundary case | Not supported | Interpreting zero travel distance in a work claim | Applying resistance at zero potential difference | Analyzing a probability rule at a limiting event |
| Remove a condition | Not supported | Distinguishing a heater from stored thermal energy | Predicting a state after a clamp is removed | Analyzing motion after propulsion stops |
| Separate a quantity from its change | Not supported | Separating reservoir level from change in level | Using a constant pressure record | Analyzing constant bank balance with ongoing flows |
| Reconcile specific claims | Not supported | Reconciling equal density and unequal mass statements | Checking two claims about resistance and current | Analyzing two definitions of a geometric figure |
| Change representation | Not supported | Reading an existing distance table and graph | Plotting a supplied volume-time table | Analyzing equivalent circuit drawings |
| Clarify a specific term | Identifying what a student means by load | Clarifying what stored means in a memory account | Not supported | Not supported |
| Recall a specific element | Recalling a missing circuit component name | Not supported | Not supported | Not supported |
| Check the reason behind an answer | Not supported | Probing a reason for a dilution answer | Checking the procedure behind an arithmetic answer | Analyzing reasoning behind a correct heat-flow direction |
| Trace a causal mechanism | Not supported | Connecting a drug target to a cellular effect | Tracing a supplied update dependency | Analyzing an incomplete infection explanation |
| Account for transfers and conservation | Not supported | Accounting for water in drying clothes | Balancing charge at a circuit junction | Analyzing energy accounting in a sealed device |
| Classify using defining features | Not supported | Classifying a chemical change by relevant features | Classifying a supplied abstract-data behavior | Analyzing an invalid grouping of functions |
| Separate necessary from sufficient conditions | Not supported | Interpreting a divisibility condition | Testing sufficiency with a concrete integer | Analyzing reversed medical screening logic |
| Separate levels of organization | Not supported | Interpreting an average from a group | Predicting aggregate resistance from reproductive differences | Analyzing a community-average claim |
| Separate observations from inferences | Not supported | Interpreting an observational tutoring association | Interpreting simulated measurements with uncertainty | Analyzing generalization from a convenience sample |
| Distinguish chance from certainty | Not supported | Interpreting an expected count for a die | Applying a sampling model to distinguish expected counts from guaranteed outcomes | Analyzing variation in a specified random simulation |
| Match a method to its conditions | Not supported | Explaining an assumption behind an average-speed shortcut | Selecting a method for unequal-time travel | Analyzing an unjustified inverse calculation |
| Specify the system or reference | Not supported | Specifying the observer in a conveyor claim | Using classical relative velocity for a moving walkway | Analyzing interaction classification under a system boundary |

## All fixed inputs and generated pairs

### Controlled comparison

#### Understand: Interpreting a controlled salt-dissolving comparison

Case: `coverage-controlled-comparison-understand`. Learning type: experimental.

**Fixed conversation**

> **Feynman:** In our simulated comparison, equal salt masses are stirred at the same rate in equal volumes of water at two temperatures. What does this comparison tell you?
>
> **Learner:** The salt dissolves sooner in the warmer water.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I think it could be because the warm-water cup had more water, even though the volumes were matched.

**Evidence the test sought:** Interpret the varied temperature and fixed volume in the existing comparison.

**Active rubric**

- Explains why matched water volumes cannot account for the observed dissolving-time difference.
- Explains the role of varying water temperature while holding the other stated conditions fixed.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How could the warm-water cup have more water if the volumes were matched? |
| Strategy | How does having matched water volumes fit with your idea that the warm-water cup had more water? |

Initial blind design scores: default 9/10; strategy 9/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Using simulated controlled insulation measurements

Case: `coverage-controlled-comparison-apply`. Learning type: experimental.

**Fixed conversation**

> **Feynman:** Two identical covered cups start at 80 degrees C in the same room. One has a foam sleeve and one has none. After ten minutes their temperatures are 70 and 60 degrees C. All other conditions are matched. How would you use these measurements?
>
> **Learner:** The foam cup stayed warmer.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would compare 70 with the starting 80 only; the unsleeved cup is irrelevant to identifying the sleeve effect.

**Evidence the test sought:** Use both groups to isolate the sleeve-associated difference.

**Active rubric**

- Uses both matched cups to determine the difference in cooling associated with the sleeve.
- Connects the measured cooling difference to the controlled comparison rather than the sleeved cup alone.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why do you consider the unsleeved cup irrelevant when identifying the sleeve effect in these matched conditions? |
| Strategy | With both cups starting at 80°C and ending at 70°C with the sleeve and 60°C without it after ten minutes, what difference in cooling would you attribute to the sleeve, and why? Use the amount each cup cooled to support your answer. |

Initial blind design scores: default 8/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing a controlled dissolving study explanation

Case: `coverage-controlled-comparison-analyze`. Learning type: experimental.

**Fixed conversation**

> **Feynman:** In a simulated study, equally sized sugar cubes dissolve in equal water volumes at the same temperature. Stirring speed differs. A report attributes faster dissolving to warmer water. Analyze that account.
>
> **Learner:** Stirring and temperature can both affect dissolving.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Since temperature can matter generally, the report can blame temperature here even though it was held fixed.

**Evidence the test sought:** Relate the proposed cause to the one varied factor and fixed temperature.

**Active rubric**

- Analyzes whether an explanation based on changed temperature is supported when temperature was held fixed.
- Uses the varied stirring speed and controlled conditions to justify the analysis.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how temperature’s general effect supports the report’s claim when the water temperature stayed the same across trials. What evidence in this study connects temperature to the difference in dissolving time? |
| Strategy | In this study, stirring speed changed while water temperature, sugar cube size, and water volume stayed the same. What evidence from that comparison supports or challenges the report’s claim that warmer water caused the faster dissolving? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Boundary case

#### Understand: Interpreting zero travel distance in a work claim

Case: `coverage-boundary-case-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You described work by a constant force on a crate that remains against an immovable wall. How does your explanation handle its zero travel distance?
>
> **Learner:** The person is pushing and getting tired.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Because the push is large, mechanical work on the stationary crate is large even though it does not move.

**Evidence the test sought:** Interpret the zero-displacement limit for work on the crate.

**Active rubric**

- Explains how zero displacement affects mechanical work on the stationary crate.
- Distinguishes effort by the person from mechanical work on the specified crate.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how the crate's lack of movement fits your claim. What role does travel distance play in deciding how much mechanical work the push does on it? |
| Strategy | What does the person's getting tired tell you about mechanical work on the crate itself, given that the crate never moves? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Applying resistance at zero potential difference

Case: `coverage-boundary-case-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** An ideal 10-ohm resistor has zero potential difference across it. Use the familiar resistor relationship to find its current.
>
> **Learner:** I use the relation between voltage, resistance, and current.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would divide resistance by voltage, but dividing by zero makes the current infinite.

**Evidence the test sought:** Apply the resistor relationship at the specified zero-voltage limit.

**Active rubric**

- Uses the appropriate resistor relationship to calculate current for the stated finite resistance at zero voltage.
- Explains why the chosen operation is valid at the stated zero-voltage limit.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure about the division step. How did you choose voltage as the quantity to divide by when isolating current in your resistor relationship? |
| Strategy | For this 10-ohm resistor at 0 V, the relationship is V = IR. What current do you get when you isolate I in that equation and substitute the values, showing the division you use? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | I'm unsure about dividing resistance by voltage. How do you rearrange the resistor relationship to isolate current for this resistor? |
| Strategy | For this 10-ohm resistor at 0 volts, how would you write the resistor relationship and rearrange it to calculate current, showing which quantity you divide by? |

Initial blind design scores: default 8/10; strategy 8/10. Latest: default 9/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing a probability rule at a limiting event

Case: `coverage-boundary-case-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A proposed rule says every event with some outcomes must have a probability strictly between zero and one. We are discussing the event consisting of every outcome in the sample space. Analyze that rule.
>
> **Learner:** An event can include many possible outcomes.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Even an event containing the whole sample space must be uncertain, so its probability cannot be one.

**Evidence the test sought:** Examine the all-outcomes boundary of the proposed probability rule.

**Active rubric**

- Analyzes the proposed strict-between-zero-and-one rule using the event containing the whole sample space.
- Distinguishes uncertainty about the individual outcome from certainty that it belongs to the all-outcomes event.

| Initial generated follow-up | Exact question |
|---|---|
| Default | When you say that event is uncertain, do you mean uncertainty about which outcome occurs or about whether that outcome belongs to the event containing the whole sample space? |
| Strategy | If the event includes every possible outcome, how does not knowing which individual outcome will occur support your claim that the event’s probability cannot be one? |

Initial blind design scores: default 9/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Remove a condition

#### Understand: Distinguishing a heater from stored thermal energy

Case: `coverage-remove-condition-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** An electric kettle has just been unplugged. You said its metal stays hot briefly and then cools in the room. Explain that account.
>
> **Learner:** The electricity heats the kettle.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The heat must disappear as soon as current stops; I cannot explain why the unplugged metal stays hot.

**Evidence the test sought:** Distinguish stopped electrical input from the persisting thermal state.

**Active rubric**

- Distinguishes ending electrical input from the existing thermal state of the unplugged kettle.
- Explains why removal of the input need not immediately remove the stored thermal energy.

| Initial generated follow-up | Exact question |
|---|---|
| Default | What makes you think stopping the current must also make the heat already in the metal disappear immediately? |
| Strategy | Why would stopping the current make the warmth already in the metal disappear immediately? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Predicting a state after a clamp is removed

Case: `coverage-remove-condition-apply`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A stretched elastic band is held by a removable clamp, with its other end fixed. It remains elastic and is free to shorten when released. Use elasticity to predict what happens immediately after removing the clamp.
>
> **Learner:** The clamp was holding the end still.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** With the clamp gone there is no elastic influence left, so the band should remain stretched and still.

**Evidence the test sought:** Use the remaining elastic interaction after the constraint is removed.

**Active rubric**

- Uses the remaining elastic influence and constraints to predict the initial response after clamp removal.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure why removing the clamp would eliminate the stretched band's elastic influence. What makes that influence disappear when the clamp is removed? |
| Strategy | If the clamp is removed without pushing or pulling the band, while the other end stays fixed and the band remains elastic, what will the released end do at first, and what about the band causes that response? |

Initial blind design scores: default 8/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing motion after propulsion stops

Case: `coverage-remove-condition-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A spacecraft coasts far from significant external forces after its engine shuts down. A report says removing thrust removes its motion. Analyze the reasoning.
>
> **Learner:** The engine accelerates it while firing.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Its speed must steadily decrease after shutdown because continuing speed requires continuing thrust.

**Evidence the test sought:** Separate the initiating acceleration from the state after thrust removal.

**Active rubric**

- Analyzes whether removing thrust alone implies decreasing velocity in the stated force-free spacecraft situation.
- Distinguishes the role of thrust in changing velocity from the continuing motion after shutdown.

| Initial generated follow-up | Exact question |
|---|---|
| Default | What would cause the steady decrease in speed you describe if no external forces act after shutdown? |
| Strategy | After shutdown, the engine supplies no thrust and no external forces act on the spacecraft. What would cause the steady decrease in speed you predict during that interval? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Separate a quantity from its change

#### Understand: Separating reservoir level from change in level

Case: `coverage-quantity-versus-change-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You described a reservoir with a high water level that is staying constant because inflow matches outflow. What do its level and change in level mean?
>
> **Learner:** It contains a lot of water.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** A high level means it must be filling rapidly, even though I also said the level stays constant.

**Evidence the test sought:** Distinguish a stored quantity from its net rate of change.

**Active rubric**

- Distinguishes the current reservoir level from its net rate of change.
- Explains how matched inflow and outflow can coexist with a high constant level.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does your claim that it is filling rapidly fit with your claim that its level stays constant? |
| Strategy | What do you mean by “filling rapidly,” and how does that fit with your statement that the water level stays constant? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Using a constant pressure record

Case: `coverage-quantity-versus-change-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** A pressure sensor reads 200 kPa at 0, 5, and 10 seconds. Use the readings to find the average pressure change per second over the interval.
>
> **Learner:** The pressure is high at every reading.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would report 200 kPa per second because the sensor reads 200 throughout.

**Evidence the test sought:** Apply a change-over-time procedure rather than report the pressure value.

**Active rubric**

- Calculates average pressure change per second from the supplied pressure-time readings.
- Distinguishes the pressure value and its units from the rate of pressure change and its units.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how the readings at 0 and 10 seconds give 200 kPa per second. How did you use those two readings to calculate that rate? |
| Strategy | With readings of 200 kPa at 0 seconds and 200 kPa at 10 seconds, what calculation would you use to find the average pressure change per second over those 10 seconds? Please show the numbers you use and your result. |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing constant bank balance with ongoing flows

Case: `coverage-quantity-versus-change-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A bank balance stays constant over a month while deposits and withdrawals both occur. A report says a constant balance proves no transactions occurred. Analyze that claim.
>
> **Learner:** The starting and ending balances match.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Matching balances prove the account had no activity; separate incoming and outgoing amounts cannot matter.

**Evidence the test sought:** Distinguish net balance change from gross transactions.

**Active rubric**

- Analyzes why equal starting and ending balances do not establish an absence of transactions.
- Relates net balance change to deposits and withdrawals rather than treating each flow as zero.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does your claim of no activity fit with the scenario’s stated deposits and withdrawals? |
| Strategy | How does your claim that matching balances prove no activity account for the stated deposits and withdrawals during the month? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Reconcile specific claims

#### Understand: Reconciling equal density and unequal mass statements

Case: `coverage-reconcile-claims-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** We are discussing two samples of the same pure material at the same temperature. Both have equal volume. How do your statements about their density and mass fit?
>
> **Learner:** The samples have the same density.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Their volumes are equal but one has twice the mass; I still say their densities are equal.

**Evidence the test sought:** Connect the two actual claims through density, mass, and volume.

**Active rubric**

- Explains whether equal density, equal volume, and unequal mass claims can describe the stated samples simultaneously.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does one sample having twice the mass fit with your claims that their volumes and densities are equal? |
| Strategy | What does “same density” mean for the masses of these two samples, given that their volumes are equal? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Checking two claims about resistance and current

Case: `coverage-reconcile-claims-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** You claim a resistor has 6 V across it and carries 3 A, while also claiming its resistance is 4 ohms. Use the familiar resistor relationship to check your claims.
>
> **Learner:** I claim that this resistor has 6 V across it and carries 3 A. I also claim that its resistance is 4 ohms.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** My claims of 6 V, 3 A, and 4 ohms all agree; I do not need to check one against the others.

**Evidence the test sought:** Use a relationship to check the consistency of the stated values.

**Active rubric**

- Uses the voltage-current-resistance relationship to test the consistency of the three supplied values.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how those values agree. What resistance do you get when you check the supplied $6\text{ V}$ and $3\text{ A}$ using the voltage-current-resistance relationship? |
| Strategy | With 6 V across the resistor and 3 A flowing through it, what resistance do you calculate, and how does that compare with your claim of 4 ohms? |

Initial blind design scores: default 9/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing two definitions of a geometric figure

Case: `coverage-reconcile-claims-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You say a particular four-sided figure is a parallelogram because both opposite-side pairs are parallel. You also say it has exactly one parallel side pair. Analyze how those statements fit.
>
> **Learner:** The figure is a parallelogram.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Both statements describe this same figure at the same time; exactly one pair and both pairs mean the same thing here.

**Evidence the test sought:** Analyze the relationship between the two actual classification claims.

**Active rubric**

- Analyzes the relation between the same figure having both parallel side pairs and having exactly one parallel side pair.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how those mean the same thing here. How many parallel side pairs does each statement assert for this figure? |
| Strategy | When you say “exactly one pair” and “both pairs,” how many parallel opposite-side pairs does each statement say the figure has, and how do those counts fit your claim that both statements hold at the same time? |

Initial blind design scores: default 8/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Change representation

#### Understand: Reading an existing distance table and graph

Case: `coverage-representation-change-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** The table and graph already discussed describe the same trip: time 0, 1, 2 seconds and distance from the start 3, 3, 3 meters. The graph is horizontal at 3 meters. Explain the match.
>
> **Learner:** The graph looks flat.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** A flat line means the object has no distance from the start; the three-meter table entries must mean movement each second.

**Evidence the test sought:** Relate graph height and repeated table values without changing the situation.

**Active rubric**

- Connects the repeated three-meter table values to the height of the existing horizontal graph.
- Distinguishes constant distance from zero distance without introducing a new trip.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure how the three-meter entries fit your claim of no distance from the start. How do those entries relate to the height of this flat graph? |
| Strategy | How does the line’s height at 3 meters relate to the table’s entries labeled “distance from the start,” which are 3 meters at 0, 1, and 2 seconds? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Plotting a supplied volume-time table

Case: `coverage-representation-change-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** A table gives liquid volume 1, 3, and 5 liters at times 0, 1, and 2 minutes. Use a volume-versus-time graph to represent these observations.
>
> **Learner:** Time will be on the horizontal axis.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would put the first point at zero liters because every graph has to start at the origin, even though the table starts at one liter.

**Evidence the test sought:** Apply representation rules while preserving the supplied nonzero initial value.

**Active rubric**

- Represents each supplied time-volume pair on appropriately labeled axes.
- Preserves the nonzero initial volume rather than forcing the graph through the origin.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does your first point at zero liters match the table’s volume at zero minutes? |
| Strategy | The table lists (0 minutes, 1 liter), (1 minute, 3 liters), and (2 minutes, 5 liters). On a graph with time marked 0, 1, 2 horizontally and volume marked 0 through 5 vertically, all at equal intervals, where would you place the first point, and which table entry supports that location? |

Initial blind design scores: default 9/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing equivalent circuit drawings

Case: `coverage-representation-change-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** Two circuit drawings show the same two resistors attached across the same two labeled nodes, but one drawing places them side by side and the other places them above each other. Analyze the claim that their connections differ.
>
> **Learner:** The drawings look different.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The vertical drawing must put them in series because one resistor is visually above the other, regardless of the node labels.

**Evidence the test sought:** Analyze connectivity invariant under a drawing rearrangement.

**Active rubric**

- Analyzes circuit equivalence using shared labeled nodes rather than visual placement of components.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How do the connections to the same two labeled nodes fit with your claim that the vertical drawing puts the resistors in series? |
| Strategy | Let’s call the resistors R1 and R2 and the labeled nodes A and B in both drawings. If you list which node connects to each end of each resistor in each drawing, how does that evidence support or challenge your claim that putting one resistor above the other makes them series? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Clarify a specific term

#### Remember: Identifying what a student means by load

Case: `coverage-clarify-specific-term-remember`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You used the word load while naming the parts of the circuit already drawn. Which part are you naming?
>
> **Learner:** The circuit includes a cell, wires, and a lamp.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I called something the load, but I have not said which component I mean.

**Evidence the test sought:** Identify the exact referent of the ambiguous word without asking for its mechanism.

**Active rubric**

- Identifies which already named circuit component the student means by load.

| Initial generated follow-up | Exact question |
|---|---|
| Default | When you say “load,” which component in the circuit do you mean? |
| Strategy | What is the name of the component you meant when you said “the load”? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Understand: Clarifying what stored means in a memory account

Case: `coverage-clarify-specific-term-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said a computer stores a variable, and used stored to refer both to its current value and a history of earlier values. What do you mean?
>
> **Learner:** The variable holds a value at a point in the program.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** When I say stored, I might mean the current value or every old value; I have not distinguished those meanings.

**Evidence the test sought:** Clarify the specific referent of stored in the existing explanation.

**Active rubric**

- Clarifies whether stored refers to a program variable’s current value or a history of earlier values.

| Initial generated follow-up | Exact question |
|---|---|
| Default | When you say the variable holds a value at a point in the program, what does “stored” mean in that claim? |
| Strategy | When you say “the variable holds a value at a point in the program,” how do earlier values fit into what you mean by “stored”? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Recall a specific element

#### Remember: Recalling a missing circuit component name

Case: `coverage-recall-specific-element-remember`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** Name the three components in our simple circuit: a cell, a connecting wire, and the component that opposes current.
>
> **Learner:** I can name the cell and wire.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I do not recall the name of the component that opposes current.

**Evidence the test sought:** Elicit the missing component name only.

**Active rubric**

- Names the resistor from its stated role of opposing current in the simple circuit.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Was a name given in your notes for the component that opposes current? |
| Strategy | What is the name of the component in our simple circuit whose role is to oppose current? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What name do your notes give the component that opposes current? |
| Strategy | What is the name of the component described as opposing current in our simple circuit? |

Initial blind design scores: default 7/10; strategy 10/10. Latest: default 9/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

### Check the reason behind an answer

#### Understand: Probing a reason for a dilution answer

Case: `coverage-answer-reason-consistency-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said adding pure water lowers a solution’s concentration. What supports that answer in the mixture we described?
>
> **Learner:** The concentration becomes lower.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I remember the phrase dilution lowers concentration, but I cannot connect that to the amount of dissolved material and water.

**Evidence the test sought:** Probe the missing link supporting the existing answer, without needing a second inconsistent claim.

**Active rubric**

- Explains the link between adding pure water and lower concentration using the existing mixture account.

| Initial generated follow-up | Exact question |
|---|---|
| Default | When pure water is added, what happens to the amount of dissolved material already in the mixture? |
| Strategy | How do the amount of dissolved material and the total volume of the solution relate to your statement that adding pure water lowers the concentration? |

Initial blind design scores: default 9/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Checking the procedure behind an arithmetic answer

Case: `coverage-answer-reason-consistency-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** For readings 4, 6, and 8, use an arithmetic mean and explain the operation you used.
>
> **Learner:** My answer is 6.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I got 6 by picking the middle entry; I would use that same procedure for any list when asked for its mean.

**Evidence the test sought:** Elicit actual mean procedure behind a coincidentally correct answer.

**Active rubric**

- Uses an arithmetic-mean procedure on the supplied readings rather than assuming that selecting the middle entry is a general mean procedure.

| Initial generated follow-up | Exact question |
|---|---|
| Default | For readings $4$, $6$, and $14$, how would you check whether picking the middle entry gives the arithmetic mean? |
| Strategy | You got 6 by picking the middle entry for 4, 6, and 8. For a new set of readings—4, 6, and 11, each counted once—what arithmetic mean do you get, and what calculation do you use? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing reasoning behind a correct heat-flow direction

Case: `coverage-answer-reason-consistency-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** Two blocks at different temperatures touch in an insulated enclosure. A student says energy transfers from the warmer to the cooler block because the warmer block always has greater total internal energy. Analyze the justification.
>
> **Learner:** The transfer direction is from warmer to cooler.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The reason must be that any hotter object contains more total energy than any colder one, regardless of size or material.

**Evidence the test sought:** Separate the transfer-direction answer from an unsupported total-energy reason.

**Active rubric**

- Analyzes whether the stated total-internal-energy justification supports the heat-flow direction claim.
- Distinguishes temperature from total internal energy in assessing that justification.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure about “regardless of size.” If the warmer block were a tiny chip and the cooler block were a large slab of the same material, how would you check your claim about their total internal energies? |
| Strategy | If the warmer block is small and the cooler block is much larger, both made of the same material, must the warmer block have more total internal energy—and how does that affect your reason for the transfer direction? |

Initial blind design scores: default 9/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Trace a causal mechanism

#### Understand: Connecting a drug target to a cellular effect

Case: `coverage-mechanism-tracing-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said a drug blocks a bacterial enzyme and therefore bacterial growth slows. Explain the connection in the process you described.
>
> **Learner:** The enzyme is involved in making a needed cell component.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I can name enzyme inhibition and slower growth, but I have not connected the missing cell component to growth.

**Evidence the test sought:** Elicit one causal link from component production to growth.

**Active rubric**

- Explains the missing causal link between reduced production of a needed cell component and reduced bacterial growth.

| Initial generated follow-up | Exact question |
|---|---|
| Default | What happens to bacterial growth when that needed cell component is in short supply? |
| Strategy | How does a shortage of that needed cell component interfere with what bacteria must do to grow? |

Initial blind design scores: default 8/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Tracing a supplied update dependency

Case: `coverage-mechanism-tracing-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** A program starts with a = 2, then executes b = a + 3, then a = b * 2. Use those steps to find the final value of a.
>
> **Learner:** The initial a is 2.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would use the original a in the final multiplication and ignore the intermediate b assignment.

**Evidence the test sought:** Trace the dependency of the final update on the intermediate assignment.

**Active rubric**

- Traces the intermediate b assignment into the final a update using the supplied initial value and update rules.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how ignoring the intermediate $b$ assignment fits with the final update $a = b \times 2$. How are you choosing the value to substitute for $b$ there? |
| Strategy | Starting with a = 2 and executing b = a + 3 followed by a = b * 2, what value does b have after the first assignment, and what final value does the second assignment give a? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing an incomplete infection explanation

Case: `coverage-mechanism-tracing-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** An explanation says a virus enters a cell and the cell immediately releases many new viral particles, with no account of events between entry and release. Analyze the causal gap.
>
> **Learner:** We already discussed that copying viral genetic material supplies copies for new particles, producing viral proteins supplies their components, and assembly joins those components before release. I know what each of those stages does.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Even with those stages in mind, I think entry itself fully explains the production of new particles; the replication, component-production, and assembly steps add nothing to the causal connection.

**Evidence the test sought:** Analyze how the already understood replication, component-production, and assembly stages connect entry to production and release, rather than treating entry alone as the causal explanation.

**Active rubric**

- Identifies and explains the missing causal production link between viral entry and release of newly made particles.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why do you consider entry sufficient to explain production if, as you said, the intermediate stages supply and join the components of new particles? |
| Strategy | You say entry itself fully explains production. What is the causal link from entry to the genetic material and joined components in the newly made particles, and how does that link support your claim? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | If entry occurred but those intervening stages could not occur, would entry alone still explain newly produced particles in your account? |
| Strategy | In your account that entry alone fully explains production, what accounts for where the new particles’ components come from and how those components become complete particles? |

Initial blind design scores: default 9/10; strategy 10/10. Latest: default 9/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

### Account for transfers and conservation

#### Understand: Accounting for water in drying clothes

Case: `coverage-conservation-accounting-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said water disappears from drying clothes in a closed room; your stated system includes the clothes and all the room air over that drying interval. Explain where the water goes.
>
> **Learner:** The clothes contain less liquid water afterward.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The water no longer exists anywhere in that closed room once the clothes dry.

**Evidence the test sought:** Track water across a state/location change within an explicit system.

**Active rubric**

- Accounts for the water lost by the clothes within the explicitly closed clothes-plus-room-air system.
- Distinguishes a change of location or state from destruction of water.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure how having less liquid water in the clothes shows that water no longer exists anywhere in the room. What supports that connection? |
| Strategy | What makes you conclude that the water no longer exists anywhere in the closed room, rather than just that there is less liquid water in the clothes? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What makes you think the water no longer exists anywhere in the closed room once the clothes dry? |
| Strategy | What makes you think the water no longer exists anywhere in the closed room when the clothes contain less liquid water? |

Initial blind design scores: default 9/10; strategy 9/10. Latest: default 10/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Balancing charge at a circuit junction

Case: `coverage-conservation-accounting-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** During one second, 8 coulombs enter a junction and 3 coulombs leave through one branch. No charge accumulates and only one other branch leaves. Use charge balance to find that branch’s transfer.
>
> **Learner:** Charge enters and leaves the junction.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The outgoing transfer could be any value because the junction can use up charge while having no accumulation.

**Evidence the test sought:** Apply charge accounting over the specified interval and boundary.

**Active rubric**

- Uses charge balance over the specified one-second interval to find the unknown outgoing branch transfer with no accumulation.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure about “use up charge.” How would that claim affect the charge balance for the 8 coulombs entering during that one second? |
| Strategy | With 8 C entering, 3 C leaving through one branch, and no charge accumulating during that second, what numerical amount leaves through the other branch, and how does your accounting account for all 8 C? |

Initial blind design scores: default 9/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing energy accounting in a sealed device

Case: `coverage-conservation-accounting-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A sealed, thermally insulated device slows an internal rotor through friction. A report says total device energy fell because rotational energy was destroyed. Analyze its energy account over that slowing interval.
>
> **Learner:** The rotor’s organized motion decreases.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Since the casing did not move and no energy crossed it, the lost rotational energy cannot exist inside afterward.

**Evidence the test sought:** Check internal transfers and storage under a defined closed boundary.

**Active rubric**

- Analyzes the energy account for a slowing rotor inside a sealed thermally insulated device.
- Distinguishes loss of organized rotor motion from loss of total device energy.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why does the casing staying still rule out the lost rotational energy remaining inside the device? |
| Strategy | For the whole device—including the rotor, casing, and everything inside—why would the casing staying still rule out the lost rotational energy remaining inside when no energy crosses the casing? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What makes you think the casing remaining stationary means the lost rotational energy cannot remain inside the device? |
| Strategy | For the whole device—the rotor, casing, and everything inside—what makes you think the casing staying still means the lost rotational energy cannot remain inside, given that no energy crossed the boundary? |

Initial blind design scores: default 6/10; strategy 10/10. Latest: default 10/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

### Classify using defining features

#### Understand: Classifying a chemical change by relevant features

Case: `coverage-classify-by-features-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You called melting ice a chemical reaction because its appearance changed. We already discussed that the substance remains water. Explain your classification.
>
> **Learner:** Its shape and appearance change.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** An appearance change is enough to call it a chemical reaction even if the substance is still water.

**Evidence the test sought:** Probe which defining feature distinguishes chemical from physical change.

**Active rubric**

- Explains whether appearance change alone justifies classifying melting water as a chemical reaction.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why do you consider the appearance change enough to classify melting as a chemical reaction when you say the substance is still water? |
| Strategy | Why does the change in appearance make melting ice a chemical reaction in your explanation, even though it remains water? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Classifying a supplied abstract-data behavior

Case: `coverage-classify-by-features-apply`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A structure adds an item at the back and removes the oldest remaining item from the front. Apply familiar data-structure categories to this behavior.
>
> **Learner:** It stores several items.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would call it a stack just because items can be drawn on top of one another; removal order is irrelevant.

**Evidence the test sought:** Use supplied behavior to classify a new case.

**Active rubric**

- Uses the supplied oldest-item-first removal behavior to classify the new data-structure case.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how removing the oldest remaining item fits your stack classification. How does that behavior support calling it a stack? |
| Strategy | A program displays print jobs one above another, adds each new job at the back, and always removes the oldest job still waiting. What data-structure category would you assign to it, and which feature of this case supports your choice? |

Initial blind design scores: default 8/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing an invalid grouping of functions

Case: `coverage-classify-by-features-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A proposed grouping calls every function with a smooth-looking graph linear, including curved graphs with changing slope. Analyze the grouping criterion.
>
> **Learner:** All these graphs look smooth.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Smooth appearance establishes linearity; constant slope and additivity cannot matter.

**Evidence the test sought:** Examine whether the grouping feature matches the defining concept.

**Active rubric**

- Analyzes whether smooth visual appearance is a valid defining feature for the proposed grouping of linear functions.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does your claim that smooth appearance establishes linearity account for the included graphs with changing slope? |
| Strategy | The grouping includes a smooth curved graph whose slope changes. What about that graph supports or challenges your claim that smooth appearance is enough to establish linearity? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Separate necessary from sufficient conditions

#### Understand: Interpreting a divisibility condition

Case: `coverage-necessary-sufficient-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said that because every multiple of six is even, being even proves a number is a multiple of six. Explain that implication.
>
> **Learner:** Multiples of six are even.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** If a number is even, that alone is enough to establish it is a multiple of six.

**Evidence the test sought:** Probe the reversed conditional rather than an extreme case.

**Active rubric**

- Explains the difference between every multiple of six being even and being even establishing a multiple of six.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure about the word “enough.” Why does being even alone establish that a number is a multiple of six? |
| Strategy | Does “multiples of six are even” also establish that every even number is a multiple of six? Why or why not? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What supports your claim that being even alone establishes that a number is a multiple of six? |
| Strategy | What makes you think that “multiples of six are even” establishes that every even number is a multiple of six? |

Initial blind design scores: default 7/10; strategy 10/10. Latest: default 10/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Testing sufficiency with a concrete integer

Case: `coverage-necessary-sufficient-apply`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A proposed test says any positive even integer is divisible by six. Apply the meanings of even and divisible by six to the number 10.
>
> **Learner:** Ten passes the even-number test.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Passing that test is sufficient, so 10 must also pass divisibility by six without a separate check.

**Evidence the test sought:** Use the supplied case to test the claimed sufficiency.

**Active rubric**

- Uses the supplied integer 10 to test whether being even suffices for divisibility by six.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How could we check your claim that $10$ is divisible by six against what divisibility means? |
| Strategy | Divisibility by six means division by 6 leaves no remainder. When you check 10 by dividing it by 6, does the result support your claim that passing the even-number test is enough? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | How would you check your claim that $10$ is divisible by six against the meaning of divisibility by six? |
| Strategy | If you check 10 directly for divisibility by six, what do you find, and what does that result tell you about the proposed even-number test? |

Initial blind design scores: default 10/10; strategy 8/10. Latest: default 9/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing reversed medical screening logic

Case: `coverage-necessary-sufficient-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A simplified model states that every person with condition C tests positive, but some people without C can also test positive. Analyze the argument that a positive result proves C in this model.
>
> **Learner:** The test never misses C in this simplified model.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** So any positive result logically proves C; the stated false positives do not affect that inference.

**Evidence the test sought:** Analyze the direction and sufficiency of the conditional within the supplied model.

**Active rubric**

- Analyzes the positive-test implication in the explicitly simplified model with possible false positives.
- Distinguishes the condition implying a positive result from a positive result establishing the condition.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure how the stated false positives fit with your claim that any positive result logically proves C. How do you reconcile those two parts of the model? |
| Strategy | What in the model supports your claim that a positive result establishes C in every allowed case, given the statement that some people without C can also test positive? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Separate levels of organization

#### Understand: Interpreting an average from a group

Case: `coverage-scale-level-distinction-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said the mean height of a group is 170 cm, so every member is exactly 170 cm tall. Explain what the mean refers to.
>
> **Learner:** The group has one reported mean.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** That group number must be the height of each person, not a summary across differing people.

**Evidence the test sought:** Distinguish an aggregate summary from every individual value.

**Active rubric**

- Explains why a group mean need not be the value for every member.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why do you think having one reported mean means each person's height must equal that number? |
| Strategy | What makes you think the group's reported mean of 170 cm must also be each person's height? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Predicting aggregate resistance from reproductive differences

Case: `coverage-scale-level-distinction-apply`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A bacterial population initially contains inherited resistant and susceptible variants. Under the stated antibiotic exposure, resistant cells leave more surviving descendants. Apply that information over generations.
>
> **Learner:** There are two inherited variants initially.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Each susceptible cell must individually change into a resistant cell; changes in relative descendant numbers cannot explain population resistance.

**Evidence the test sought:** Connect individual reproductive differences to the aggregate population pattern.

**Active rubric**

- Uses inherited variation and differential reproduction to predict an aggregate population pattern without requiring each susceptible individual to change type.

| Initial generated follow-up | Exact question |
|---|---|
| Default | If neither inherited variant changes type, how would resistant cells leaving more surviving descendants affect the population’s composition over generations? |
| Strategy | Suppose both resistant and susceptible cells are present, no cell changes type, and descendants inherit their parent's type. If resistant cells leave more surviving descendants per cell in every generation during continued antibiotic exposure, what happens to the fraction of resistant cells in the whole population over generations? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing a community-average claim

Case: `coverage-scale-level-distinction-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** Two towns have different average household electricity use. A report concludes every household in the town with the higher average uses more electricity than every household in the other town. Analyze the claim.
>
> **Learner:** The first town has the higher group average.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** That average orders every pair of individual households across the towns, regardless of within-town variation.

**Evidence the test sought:** Analyze an unsupported step from aggregate ordering to individual ordering.

**Active rubric**

- Analyzes whether an ordering of town averages warrants an ordering of every pair of individual households.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does within-town variation affect your claim that the average orders every pair of households? |
| Strategy | With no individual household values or ranges supplied, what evidence does the first town’s higher average give that even its lowest-use household uses more electricity than the second town’s highest-use household? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Separate observations from inferences

#### Understand: Interpreting an observational tutoring association

Case: `coverage-evidence-inference-understand`. Learning type: experimental.

**Fixed conversation**

> **Feynman:** In the observational study you described, volunteers who attended tutoring had higher grades; there was no random assignment. Explain your conclusion.
>
> **Learner:** Tutoring attendance and grades were associated.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** That association proves tutoring caused the entire grade difference; who volunteered cannot matter.

**Evidence the test sought:** Probe the warrant from association to a causal conclusion.

**Active rubric**

- Explains what the stated observational tutoring association does and does not establish about causation.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why do you think who volunteered cannot matter to your conclusion that tutoring caused the entire grade difference? |
| Strategy | What in this observational study supports your claim that who volunteered cannot matter to the grade difference attributed to tutoring? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Interpreting simulated measurements with uncertainty

Case: `coverage-evidence-inference-apply`. Learning type: experimental.

**Fixed conversation**

> **Feynman:** A simulated sensor study reports a change of 1 unit with an uncertainty range from minus 2 to plus 4 units. The student knows how to interpret a stated uncertainty interval. Apply that interpretation to the claim of a definite increase.
>
> **Learner:** The central reported change is positive.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The positive central value alone establishes an increase; I do not need to use the reported range.

**Evidence the test sought:** Use the supplied uncertainty information to interpret a direction claim.

**Active rubric**

- Uses the supplied uncertainty interval to assess the claim of a definite increase rather than relying only on its central value.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does the reported range from minus 2 to plus 4 units fit with your claim of a definite increase? |
| Strategy | For the simulated sensor’s reported change of +1 unit, how does the uncertainty range from −2 to +4 units affect your claim that there was definitely an increase? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing generalization from a convenience sample

Case: `coverage-evidence-inference-analyze`. Learning type: experimental.

**Fixed conversation**

> **Feynman:** A university survey recruits only students who visit the gym and concludes that most students exercise daily. Analyze what the recruitment supports.
>
> **Learner:** Most respondents reported daily exercise.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The percentage among gym visitors directly establishes the percentage among all students; recruitment cannot limit the conclusion.

**Evidence the test sought:** Analyze the sampling warrant for a population claim.

**Active rubric**

- Analyzes whether recruitment of gym visitors warrants generalizing the survey percentage to all university students.

| Initial generated follow-up | Exact question |
|---|---|
| Default | What supports your assumption that the daily-exercise percentage is the same among gym visitors and all students? |
| Strategy | The survey recruited only gym visitors. What evidence supports using their reported daily-exercise percentage as the percentage for all university students, including those who never visit the gym? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Distinguish chance from certainty

#### Understand: Interpreting an expected count for a die

Case: `coverage-stochastic-reasoning-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You say a fair six-sided die must show a six exactly once in every six independent rolls. Explain what fairness means in that account.
>
> **Learner:** Each face has the same probability on one roll.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** That probability guarantees one six in every block of six rolls, rather than allowing variation between blocks.

**Evidence the test sought:** Distinguish an expected count from a guarantee for a finite sequence.

**Active rubric**

- Explains how a fair die can have equal per-roll face probabilities without guaranteeing an exact count in each six-roll block.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does having the same probability on one roll lead to a guaranteed count across six rolls? |
| Strategy | How does each face having the same probability on one roll relate to whether exactly one six is guaranteed in every block of six independent rolls? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What makes you think equal probabilities on each roll guarantee exactly one six in each block? |
| Strategy | How do you think each face having the same probability on one roll relates to the number of sixes in a block of six independent rolls? |

Initial blind design scores: default 5/10; strategy 10/10. Latest: default 10/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Applying a sampling model to distinguish expected counts from guaranteed outcomes

Case: `coverage-stochastic-reasoning-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** In a model, each of ten independent draws is red with probability one fifth, with replacement. Use that model to assess the chance that a run has no red draws, rather than assuming its expected count is guaranteed.
>
> **Learner:** I know how to find a complementary event probability and how to multiply probabilities for a specified sequence of independent draws. The expected red count in ten draws is two.
>
> **Feynman:** How would you use that model to assess your claim about what can happen in one run?
>
> **Learner:** Because the expected count is two, a run with no reds is impossible and has probability zero. I would impose the expected count instead of using the stated model to check that outcome.

**Evidence the test sought:** Apply the specified independent-draw model to evaluate the chance of no reds, distinguishing an expected count from a guaranteed outcome.

**Active rubric**

- Uses the stated independent with-replacement model to calculate the probability of no red draws in ten trials.
- Interprets the calculated event probability without treating the expected red count as a guarantee for each run.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure how imposing the expected count fits the independent-draw model. What probability do you get for no reds in ten draws using your method of multiplying probabilities? |
| Strategy | For ten independent draws with replacement, each with a one-fifth chance of red, what probability do you calculate for no reds when you use the stated draw probabilities rather than impose the expected count of two? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | I'm unsure about that zero probability. What probability do you get for no reds in ten draws when you apply your method for a specified sequence of independent draws? |
| Strategy | For ten independent draws with replacement, each with a one-fifth chance of red, what probability do you calculate for getting no reds, and what does that value mean for your claim that no reds is impossible? |

Initial blind design scores: default 10/10; strategy 9/10. Latest: default 9/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing variation in a specified random simulation

Case: `coverage-stochastic-reasoning-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A simulation independently samples 20 observations from the same fixed random model on each run. Some run means differ. A report calls any such difference proof that the model changed. Analyze that reasoning.
>
> **Learner:** All runs use the same sampling model.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Different run means cannot occur under a fixed model, so any difference proves a change in the model.

**Evidence the test sought:** Analyze whether sampling variation alone distinguishes fixed from changed models.

**Active rubric**

- Analyzes whether differing run means alone establish a changed model under the stated fixed independent sampling process.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure why the fixed model would require identical means. What about the independent sampling of 20 observations makes the means match in every run? |
| Strategy | Why would using the same fixed random model force two independent samples of 20 observations to have exactly the same mean? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Match a method to its conditions

#### Understand: Explaining an assumption behind an average-speed shortcut

Case: `coverage-method-applicability-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said the arithmetic mean of two speeds always gives the average speed for a trip. We discussed that segment durations can differ. Explain when your shortcut is appropriate.
>
> **Learner:** The trip has two speed segments.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** The two speeds can always be weighted equally, even when the time spent at each speed differs.

**Evidence the test sought:** Probe the duration condition behind the shortcut without solving a new trip.

**Active rubric**

- Explains the duration condition under which an unweighted mean of two speeds gives trip average speed.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Why would the two speeds deserve equal weight if the trip spends more time at one speed than the other? |
| Strategy | When the two speeds are different, how does the time spent at each speed affect whether weighting them equally represents the trip’s total distance divided by its total time? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What makes you think the two speeds can be weighted equally when the time spent at each speed differs? |
| Strategy | What makes you think the two speeds should have equal weight in the trip’s average speed when the time spent at each speed differs? |

Initial blind design scores: default 10/10; strategy 10/10. Latest: default 10/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Selecting a method for unequal-time travel

Case: `coverage-method-applicability-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** A vehicle travels at 30 km/h for one hour and 60 km/h for two hours. Apply an appropriate method to find the whole-trip average speed.
>
> **Learner:** I can calculate distance from speed and time.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I will use the simple arithmetic mean of 30 and 60 because every two-speed trip uses that shortcut.

**Evidence the test sought:** Select and use a method compatible with unequal segment durations.

**Active rubric**

- Selects and uses a method accounting for unequal segment durations in the supplied trip-average-speed problem.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure why that shortcut applies here when the vehicle spends one hour at $30$ km/h and two hours at $60$ km/h. What makes the simple arithmetic mean appropriate for those durations? |
| Strategy | For this trip—30 km/h for one hour and 60 km/h for two hours—what whole-trip average speed do you get, and how does your calculation account for the time spent at each speed? |

| Latest post-fix follow-up | Exact question |
|---|---|
| Default | What supports your claim that the simple arithmetic mean applies to this trip with one hour at the first speed and two hours at the second? |
| Strategy | For this trip—30 km/h for one hour, then 60 km/h for two hours, with no other travel time—what whole-trip average speed do you calculate, and what calculations support your result? |

Initial blind design scores: default 7/10; strategy 10/10. Latest: default 8/10; strategy 10/10. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing an unjustified inverse calculation

Case: `coverage-method-applicability-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A solution attempts to solve a linear system by multiplying by an inverse of a coefficient matrix that is explicitly singular. Analyze the method choice.
>
> **Learner:** The inverse method works for some coefficient matrices.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** It works for every square matrix; the stated singularity does not affect using an inverse.

**Evidence the test sought:** Analyze the condition that makes the selected inverse method available.

**Active rubric**

- Analyzes the availability of an inverse-matrix method for the explicitly singular coefficient matrix.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I'm unsure about the claim that singularity has no effect. How does the stated singularity relate to whether the inverse used in that multiplication exists? |
| Strategy | The problem states that the square matrix A is singular. How does that condition affect whether the proposed step of multiplying by A’s inverse is justified, and why? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

### Specify the system or reference

#### Understand: Specifying the observer in a conveyor claim

Case: `coverage-scope-and-reference-understand`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** You said a parcel fixed on a moving conveyor is stationary. We discussed a worker standing beside the belt and a marker fixed on the belt. Explain your motion claim.
>
> **Learner:** The parcel stays beside the belt marker.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I called it stationary without saying whether I meant relative to the marker or the worker.

**Evidence the test sought:** Specify the reference for the existing motion claim.

**Active rubric**

- Specifies whether the parcel’s stationary claim is relative to the belt marker or the worker beside the conveyor.

| Initial generated follow-up | Exact question |
|---|---|
| Default | Who do you mean by the observer in your stationary claim, given that the parcel stays beside the belt marker? |
| Strategy | When you call the parcel stationary, what are you using as the reference, and how does the parcel staying beside the belt marker support that choice? |

Initial blind design scores: default 8/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Apply: Using classical relative velocity for a moving walkway

Case: `coverage-scope-and-reference-apply`. Learning type: quantitative.

**Fixed conversation**

> **Feynman:** A walkway moves east at 2 meters per second relative to the terminal. A person walks west at 1 meter per second relative to the walkway. Apply classical relative velocity to find the person’s terminal velocity.
>
> **Learner:** The two velocities use different references.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** I would subtract the directions without checking which frame each speed belongs to, and say the person is going west in the terminal.

**Evidence the test sought:** Apply an explicit reference transformation with opposite directions.

**Active rubric**

- Uses the stated walkway-relative and terminal-relative velocities with consistent east-west signs to find terminal velocity.

| Initial generated follow-up | Exact question |
|---|---|
| Default | I’m unsure how you got west. With east taken as positive, how would you combine the two stated velocities while keeping track of their reference frames? |
| Strategy | With the walkway moving east at 2 m/s relative to the terminal and the person walking west at 1 m/s relative to the walkway, what velocity do you calculate for the person relative to the terminal, labeling each given velocity’s reference and using a consistent east–west sign convention? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

#### Analyze: Analyzing interaction classification under a system boundary

Case: `coverage-scope-and-reference-analyze`. Learning type: theoretical.

**Fixed conversation**

> **Feynman:** A proposed energy account defines its system as a falling ball plus Earth, but calls their mutual gravitational interaction external to that system. Analyze the classification.
>
> **Learner:** The stated system includes both the ball and Earth.
>
> **Feynman:** Which part of your account are you least certain about?
>
> **Learner:** Gravity between them is external just because Earth is much bigger; the stated boundary cannot matter.

**Evidence the test sought:** Analyze interaction classification against the explicitly chosen boundary.

**Active rubric**

- Analyzes whether the mutual gravitational interaction is internal or external to the explicitly ball-plus-Earth system.

| Initial generated follow-up | Exact question |
|---|---|
| Default | How does your claim that Earth's size makes gravity external fit with your statement that the system includes both the ball and Earth? |
| Strategy | For the system that includes both the ball and Earth, why would Earth’s greater size make their mutual gravity external even though both objects are included? |

Initial blind design scores: default 10/10; strategy 10/10. Not rerun after the leakage fixes. Scores are same-model ratings, not measured learning outcomes.

## Evidence files

- [Frozen 51-case inputs](../evaluations/strategy-levels-v5-final/fixtures.json)
- [Original 51 results and trace references](../evaluations/strategy-levels-v5-final/results.json)
- [Latest 11 affected-case results](../evaluations/strategy-levels-v6-combined/results.json)
- [Fixes and testing summary](question-strategy-leakage-rerun.md)
