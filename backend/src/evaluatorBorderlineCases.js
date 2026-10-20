// Prospective authored controls, not expert-rated learner examples. Freeze these
// labels before live execution; pairing/rationales never enter model inputs.
function pair(name, topic, level, type, rubric, turns, wrong, correct, rationale) {
  return [false, true].map(eligible => ({
    id: `borderline-${name}-${eligible ? 'sufficient' : 'subtle-error'}`, pairId: name,
    tags: ['borderline', 'shared-input'],
    input: { topic, level, learningType: type, aspects: [rubric], messages: [...turns, eligible ? correct : wrong].map((content, i) => ({ id: `borderline_m${i + 1}`, role: i % 2 ? 'user' : 'assistant', content })) },
    expected: { eligible, criterionStatuses: [eligible ? ['supported'] : ['flawed', 'unclear']] },
    rationale: `${eligible ? 'Sufficient control' : 'Subtle-error control'}: ${rationale}`,
  }));
}

export const evaluatorBorderlineCases = [
  ...pair('capacitor-boundary', 'Capacitor energy with a connected battery', 'apply', 'quantitative',
    'Calculate how doubling plate separation changes stored capacitor energy while an ideal battery maintains voltage, and justify the boundary condition.', [
      'An ideal parallel-plate capacitor has initial capacitance C and voltage V. It stays connected to an ideal constant-voltage battery while plate separation doubles; area and dielectric stay fixed. Find final capacitance and stored field energy relative to the initial values.',
      'Capacitance is inversely proportional to separation, so the final capacitance is C/2. Initially the stored energy is CV²/2.',
      'Explain which quantity the connected battery holds fixed and finish the energy comparison.',
    ],
    'The battery establishes the initial charge, so Q remains CV during the motion. With C halved, Q²/(2C) doubles, hence the final field energy is twice the initial energy. This is consistent with doing work to pull the plates apart.',
    'The connected battery holds V fixed, not Q. Charge can return to the battery; the final charge is CV/2. Using U = CV²/2 with the new capacitance gives final energy CV²/4, half the initial energy. Mechanical work alone does not equal the field-energy change because the battery also exchanges energy.',
    'A fluent work argument cannot substitute an isolated-capacitor boundary condition for the stated connected-battery condition.'),
  ...pair('average-rate-correction', 'Average rates after a partial correction', 'apply', 'quantitative',
    'Calculate average speed over unequal-time legs and justify total-distance/total-time reasoning.', [
      'A cyclist covers 12 km at 12 km/h, then 12 km at 24 km/h, without stops. Explain the trip average speed.',
      'The arithmetic mean of the speeds is 18 km/h. I think equal leg lengths justify that.',
      'Revisit the time spent on each leg and state your final reasoning.',
    ],
    'The times are 1 hour and 0.5 hour. I retract the arithmetic mean, and the answer is 16 km/h. Since the leg lengths are equal, each speed gets half the weight; averaging 12 and 24 in that way gives the corrected 16. So equal-distance weighting is the reason.',
    'The times are 1 hour and 0.5 hour. I retract the arithmetic mean: total distance is 24 km and total time is 1.5 hours, giving 16 km/h. The slower speed occupies two thirds of the time and the faster one one third, so time weighting also gives 16.',
    'A corrected final number does not erase an explicitly retained invalid derivation; a genuine correction resolves the earlier error.'),
  ...pair('conditional-probability', 'Meaning of a p-value', 'understand', 'theoretical',
    'Explain a p-value as a probability of data at least as extreme under the null model, and distinguish it from the probability that the null is true.', [
      'A pre-specified test reports p = 0.03. Explain what the number means and what it does not mean.',
      'The test compares the result with what its null model would generate. A small value makes the observed result relatively unusual under that model.',
      'State the conditioning explicitly rather than just calling the result unlikely.',
    ],
    'For repeated data from this same experiment, the null would be true in only 3% of repetitions. Equivalently, there is a 3% probability that the null generated our observed result, so the alternative has 97% support as a probability.',
    'Assuming the null model and the test assumptions, 3% is the probability of a test statistic at least as extreme as the observed one. It is not P(null true given these data), and subtracting it from one does not give a posterior probability for the alternative.',
    'The final answer can reverse the conditioning despite a sound opening; quoting a rejected interpretation must not invalidate the sufficient control.'),
  ...pair('aggregate-confounding', 'Aggregate success rates and risk mix', 'understand', 'theoretical',
    'Use within-risk-group success rates to explain why an aggregate treatment comparison does not establish a causal treatment benefit.', [
      'Observational records: treated low-risk patients have 81 successes out of 90 and treated high-risk patients 1 out of 10. Untreated low-risk patients have 9 out of 10 and untreated high-risk patients 9 out of 90. Explain the aggregate comparison and what it establishes.',
      'The treated total is 82/100 and the untreated total is 18/100. Those aggregates look dramatically different, and risk mix could matter.',
      'Use the rates within each risk group to give your final interpretation.',
    ],
    'Within low risk the rates are both 90%, and within high risk both 10%. This confirms that treatment raises success from 18% to 82% overall even after controlling risk; the identical subgroup rates show the effect is consistent rather than confounded.',
    'Within low risk both rates are 90%; within high risk both are 10%. Treated records contain many more low-risk patients, which explains the aggregate difference without a within-group benefit. These observational counts do not establish a causal benefit or prove that every possible effect is zero; unmeasured factors and uncertainty remain.',
    'Correct subgroup calculations can accompany the opposite causal conclusion; a bounded interpretation need not propose a new experiment.'),
  ...pair('quantifier-counterexample', 'Universal claims and counterexamples', 'understand', 'theoretical',
    'Explain why a counterexample disproves an implication and why an example satisfying the premise and conclusion does not prove a universal implication.', [
      'Evaluate the claim: every differentiable real function has a strictly positive derivative everywhere. Explain what an example can and cannot establish.',
      'The derivative describes a local rate of change. The function f(x) = x has derivative 1 everywhere, so it satisfies the proposed condition.',
      'Does that establish the universal claim? Explain your final conclusion using a relevant example.',
    ],
    'It establishes the claim because f(x) = x is a differentiable real function and its derivative is positive at every point. A function such as x² has negative derivative for negative x, but that does not count because those points violate the claimed positive-derivative condition.',
    'The example x does not prove the claim for all differentiable functions. The function x² is differentiable everywhere but has derivative 2x, which is negative at negative x and zero at zero. Those points satisfy the premise and violate the conclusion, so they are counterexamples to the universal claim.',
    'Watch for circular exclusion of counterexamples that satisfy the premise but violate the conclusion.'),
  ...pair('design-worst-case', 'Worst-case design acceptance', 'apply', 'design',
    'Decide whether a measurement satisfies a hard upper temperature bound using the supplied worst-case error, and justify the decision.', [
      'A process must never exceed 100.0 C. Its sensor reports 99.7 C and has a guaranteed worst-case error of plus or minus 0.5 C, with no other uncertainty. Decide whether that reading alone certifies compliance.',
      'The nominal reading is 0.3 C below the limit, and the sensor uncertainty range extends 0.5 C in either direction. A safety decision should account for that range.',
      'Make the acceptance decision and justify it against the hard bound.',
    ],
    'Accept it: the possible interval is 99.2 to 100.2 C, but the error is symmetric, so upward and downward errors cancel for this reading. The expected value is 99.7 C, which is enough to guarantee the hard bound.',
    'Do not certify it from this reading: the possible interval is 99.2 to 100.2 C, so temperatures above the hard bound remain possible. Symmetric error does not cancel on one measurement. With this same error bound a reading no greater than 99.5 C would be sufficient, including equality at 100.0 C.',
    'Correct uncertainty bounds cannot justify replacing a hard worst-case constraint with an average-value claim.'),
];
