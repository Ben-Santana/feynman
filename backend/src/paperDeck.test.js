import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPaperGrades, nextUngradedDeck, rotatePaperDeck } from '../../frontend/src/components/paperDeck.ts';

const papers = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
const pass = paperId => ({ paperId, grade: 'pass', selectedSteps: [] });

test('browsing wraps both ways and returns to the original stack without losing a paper', () => {
  const original = [0, 1, 2];
  const previous = rotatePaperDeck(original, -1);
  assert.deepEqual(previous, [2, 0, 1]);
  assert.deepEqual(rotatePaperDeck(previous, 1), original);
  let deck = original;
  for (let turn = 0; turn < papers.length; turn++) deck = rotatePaperDeck(deck, 1);
  assert.deepEqual(deck, original);
  assert.deepEqual(original, [0, 1, 2]);
  assert.deepEqual(rotatePaperDeck([0], 1), [0]);
});

test('grading out of order advances to ungraded work and submits grades in original paper order', () => {
  let deck = [2, 0, 1];
  let grades = collectPaperGrades(papers, [], pass('three'));
  deck = nextUngradedDeck(deck, papers, grades);
  assert.deepEqual(deck, [0, 1, 2]);
  grades = collectPaperGrades(papers, grades, pass('one'));
  deck = nextUngradedDeck(deck, papers, grades);
  assert.equal(deck[0], 1);
  grades = collectPaperGrades(papers, grades, { paperId: 'two', grade: 'fail', selectedSteps: [2] });
  assert.deepEqual(grades.map(grade => grade.paperId), ['one', 'two', 'three']);
  assert.deepEqual(grades[1].selectedSteps, [2]);
});

test('regrading replaces a previous grade and skips already graded papers', () => {
  const grades = [pass('one'), { paperId: 'two', grade: 'fail', selectedSteps: [1, 3] }];
  const updated = collectPaperGrades(papers, grades, pass('two'));
  assert.equal(updated.length, 2);
  assert.deepEqual(updated[1], pass('two'));
  assert.deepEqual(grades[1].selectedSteps, [1, 3]);
  assert.equal(nextUngradedDeck([1, 0, 2], papers, updated)[0], 2);
  const complete = collectPaperGrades(papers, updated, pass('three'));
  assert.deepEqual(nextUngradedDeck([2, 1, 0], papers, complete), [2, 1, 0]);
});
