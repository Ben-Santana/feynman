// Reusable diagnostic strategies and fixed comparison fixtures.
import { readFileSync } from 'node:fs';
import { checklistText } from '../../frontend/src/rubricChecklist.js';
const savedRubrics = JSON.parse(readFileSync(new URL('../comparison-rubrics.json', import.meta.url), 'utf8'));
const database = JSON.parse(readFileSync(new URL('../question-strategies.json', import.meta.url), 'utf8'));
export const corpusVersion = database.version;
export const strategies = database.strategies;

const fixture = (id, title, topic, question, answer, followup, finalAnswer) => {
  const record = savedRubrics.cases?.[id];
  if (record?.input?.topic !== topic || record.input.level !== 'understand' || record.input.learningType !== 'quantitative' || !Array.isArray(record.items) || !record.items.length || record.items.length > 8 || record.items.some(item => typeof item !== 'string' || !item.trim() || /[\r\n]/.test(item)) || checklistText(record.items).length > 1000) throw new Error(`Missing or stale generated rubric for comparison case ${id}. Regenerate it through scripts/generate-comparison-rubrics.mjs.`);
  const { items, input: _input, ...rubricGeneration } = record;
  return {
    id, title, topic, aspects: [...items], rubricGeneration, level: 'understand', learningType: 'quantitative',
    messages: [{ role: 'assistant', content: question }, { role: 'user', content: answer }, { role: 'assistant', content: followup }, { role: 'user', content: finalAnswer }],
  };
};
export const comparisonCases = [
  fixture('inertia', 'A push that wears off', 'Inertia and motion after contact', 'What keeps an object moving after a push?', 'The push gives it momentum, so it keeps moving.', 'What do you mean by momentum here?', 'It is the force stored from the push. Even without friction that force gets used up, so the object eventually slows.'),
  fixture('collision', 'Damage as evidence of force', 'Interaction forces in unequal-mass collisions', 'How would you compare the forces in a collision?', 'Both objects push on each other.', 'Would a truck and a small car push equally?', 'The truck pushes harder because it is heavier. The car gets more damaged, which shows it received more force.'),
  fixture('support', 'No motion means no forces', 'Force balance for a supported object', 'How do you describe a book resting on a table?', 'Gravity pulls things downward.', 'How does that fit with the book remaining still?', 'The table blocks gravity, so gravity cannot act on the book. Since it is not moving, there are no forces on it.'),
  fixture('apex', 'Gravity switches off at the top', 'Force and acceleration at a turning point', 'What happens when a ball is thrown upward?', 'It slows down, stops at the top, then falls.', 'How do you explain that change?', 'Gravity opposes its motion on the way up. At the top its velocity is zero, so gravity and acceleration are zero for that instant.'),
  fixture('projectile', 'Horizontal motion disappears', 'Independent components of projectile motion', 'What happens when something is released from a moving plane?', 'It falls because of gravity.', 'What happens to the forward motion?', 'Once it leaves the plane there is no forward push, so from the ground it drops straight down at the release point, ignoring air resistance.'),
  fixture('acceleration', 'Faster means more acceleration', 'Speed and acceleration from position observations', 'How can positions tell you about motion?', 'Larger distances covered in the same time mean higher speed.', 'How does that tell you about acceleration?', 'If one object covers 2 meters each second and another covers 4 meters each second, the second has twice the acceleration because it is faster.'),
].map(item => ({ ...item, group: 'FCI Direct Test' }));

// Adjacent mechanics fixtures test transfer of the reusable strategies.
comparisonCases.push(...[
  fixture('indirect-torque', 'A longer lever means a stronger force', 'Torque, lever arms, and rotational effects', 'How does a wrench turn a tight bolt?', 'A push on the handle turns the bolt.', 'Why might a longer handle help with the same push?', 'The same hand force becomes a larger force just because the handle is longer. Torque is another name for that stronger force, rather than a different effect of the same push.'),
  fixture('indirect-work', 'Motion always means positive work', 'Mechanical work and changes in kinetic energy', 'How would you tell whether net work is being done on a cart?', 'Work has something to do with force and distance.', 'What if it rolls horizontally at constant speed on an ideal frictionless track after the push ends?', 'It travels a longer distance, so positive net work keeps accumulating even though its speed is constant. Its kinetic energy must increase as it covers more distance.'),
  fixture('indirect-buoyancy', 'Floating means gravity has disappeared', 'Buoyancy and equilibrium of a floating object', 'Why does a sealed block float at rest in water?', 'Water provides an upward buoyant force.', 'How does gravity fit into your explanation?', 'Once the block floats, gravity no longer acts on it. The water switches gravity off, and being stationary means there is no downward force to balance.'),
  fixture('indirect-spring', 'No movement means no stored energy', 'Elastic potential energy and a constrained spring', 'What happens when a spring is compressed against a fixed wall?', 'It can push a cart when the cart is released.', 'What about while a latch holds the cart and spring still?', 'There is no force or stored energy then because nothing moves. The spring only gains elastic potential energy at the moment the cart starts moving.'),
  fixture('indirect-damping', 'A smaller swing needs weaker gravity', 'Damped oscillation and mechanical energy', 'Why does a pendulum in air swing less far over time?', 'Air resistance affects the motion.', 'How does that explain the smaller turning points?', 'Each swing uses up some of gravity, so the downward force becomes smaller. That weaker gravity is the reason the height gets smaller; energy transferred to the air is not involved.'),
  fixture('indirect-terminal', 'Falling faster means accelerating faster', 'Terminal velocity, drag, and net force', 'What changes as a falling object approaches terminal velocity in air?', 'The air pushes upward more as the object moves faster.', 'What happens once its downward speed stays constant?', 'It still has downward acceleration because it is falling quickly. Gravity must remain greater than drag, or there would be no downward motion.'),
].map(item => ({ ...item, group: 'FCI Indirect Test' })));

// Electrical-engineering fixtures; no electrical inventory or answer bank is added.
comparisonCases.push(...[
  fixture('ece-linearity', 'Zero in, zero out means linear', 'Linearity and superposition in signals and systems', 'What does it mean for a system to be linear?', 'If the input is zero, the output is zero.', 'Is that enough to tell whether a system is linear?', 'Yes. If nothing comes out when nothing goes in, the system is linear. Combining two inputs does not need to give the same result as combining their separate outputs.'),
  fixture('ece-series-current', 'A resistor uses up current', 'Current continuity and energy dissipation in a series circuit', 'What happens in a closed circuit with an ideal DC voltage source and two resistors in series?', 'Charge flows around the circuit, and both resistors dissipate energy.', 'How does the current just before the first resistor compare with the current just after it, once the circuit is in steady state?', 'The first resistor uses up some current as heat, so less current reaches the second resistor. That is why the current decreases as you go around the circuit.'),
  fixture('ece-parallel-voltage', 'The source divides voltage between branches', 'Voltage and current in parallel resistive branches', 'Two unequal resistors are connected in parallel directly across an ideal DC voltage source. What does parallel mean here?', 'Both resistors connect to the same pair of nodes.', 'How would you describe the voltage and current in those branches?', 'The source splits its voltage between the two branches, so each gets only part of the source voltage. The current is the same in both branches even though their resistances are different.'),
  fixture('ece-capacitor-energy', 'No capacitor current means no stored energy', 'Capacitor voltage, stored charge, and stored energy', 'An ideal capacitor is charged by a DC source through a resistor. What happens after it has settled?', 'The capacitor has a voltage across its terminals, and the charging current has fallen to zero.', 'Now the charged capacitor is disconnected from the source and left isolated, with no leakage. What can you say about its energy?', 'With no current flowing, it has no stored energy anymore, even though the voltage remains. Electrical energy can only exist while current flows.'),
].map(item => ({ ...item, group: 'ECE Indirect Test' })));

// Authored coverage transcripts are independent of the illustrative questions
// sent to the generator. Expected IDs and review guides are evaluation metadata.
const coverageDefinitions = JSON.parse(readFileSync(new URL('../strategy-comparison-cases.json', import.meta.url), 'utf8')).cases;
const requiredPairs = new Set(strategies.flatMap(strategy => strategy.levels.map(level => `${strategy.id}:${level}`)));
const coveredPairs = new Set();
for (const definition of coverageDefinitions) {
  const pair = `${definition.expectedStrategyId}:${definition.level}`;
  if (!requiredPairs.has(pair) || coveredPairs.has(pair) || definition.comparisonMode !== 'targeted') throw new Error(`Invalid or duplicate strategy coverage pair ${pair}.`);
  const record = savedRubrics.cases?.[definition.id];
  if (record?.input?.topic !== definition.topic || record.input.level !== definition.level || record.input.learningType !== definition.learningType || !Array.isArray(record.items) || !record.items.length || record.items.length > 8 || record.items.some(item => typeof item !== 'string' || !item.trim() || /[\r\n]/.test(item)) || checklistText(record.items).length > 1000) throw new Error(`Missing or stale generated rubric for comparison case ${definition.id}. Run scripts/generate-comparison-rubrics.mjs --suite coverage.`);
  const { items, input: _input, ...rubricGeneration } = record;
  const reviewed = definition.reviewedRubricItems;
  if (!Array.isArray(reviewed) || !reviewed.length || reviewed.some(item => typeof item !== 'string' || !item.trim()) || checklistText(reviewed).length > 1000 || definition.rubricReview?.method !== 'authored_fixture_scope_review') throw new Error(`Missing scope review for ${definition.id}.`);
  comparisonCases.push({ ...definition, aspects: [...reviewed], rubricGeneration: { ...rubricGeneration, generatedItems: items }, rubricReview: definition.rubricReview });
  coveredPairs.add(pair);
}
if (coveredPairs.size !== requiredPairs.size) throw new Error('The strategy coverage suite must cover every supported strategy-level pair.');
if (new Set(comparisonCases.map(item => item.id)).size !== comparisonCases.length) throw new Error('Comparison case IDs must be unique.');

// The small catalog is retrieved by review status and level compatibility.
// Topic-word overlap is not evidence that a diagnostic strategy applies.
export function retrieveStrategies(_state, input, catalog = strategies) {
  return catalog.filter(strategy => strategy.reviewStatus === 'design_reviewed' && strategy.levels.includes(input.level))
    .map(strategy => ({ strategy, eligibility: 'Design reviewed and compatible with the active level' }));
}
