import test from 'node:test';
import assert from 'node:assert/strict';
import { equationText, replaceDraft, splitMathDraft } from '../../frontend/src/mathDraft.ts';

test('mixed drafts round-trip text and multiple inline/display equations exactly', () => {
  const draft = String.raw`The ratio is $\frac{1}{2}$ because x changed. $$V_{rms}=12\angle30^{\circ}$$ Done.`;
  const parts = splitMathDraft(draft);
  assert.equal(parts.map(part => part.text).join(''), draft);
  assert.equal(parts.filter(part => part.latex !== undefined).length, 2);
  for (const part of parts) assert.equal(draft.slice(part.start, part.end), part.text);
  assert.equal(parts.find(part => part.display).latex, String.raw`V_{rms}=12\angle30^{\circ}`);
});

test('equations insert at the caret and edits/removal preserve surrounding explanations', () => {
  const inserted = replaceDraft('The ratio is  because.', 13, 13, equationText(String.raw`\frac{1}{2}`));
  const equation = splitMathDraft(inserted).find(part => part.latex);
  assert.equal(replaceDraft(inserted, equation.start, equation.end, equationText('x^2')), 'The ratio is $x^2$ because.');
  assert.equal(replaceDraft(inserted, equation.start, equation.end, ''), 'The ratio is  because.');
});

test('currency and incomplete delimiters stay editable text and size limits cover equations', () => {
  for (const draft of ['It costs $5 and $10.', '$unfinished', String.raw`\$5`]) {
    assert.equal(splitMathDraft(draft).length, 1);
    assert.equal(splitMathDraft(draft)[0].text, draft);
  }
  assert.throws(() => replaceDraft('x'.repeat(12000), 0, 0, equationText('x')), /too long/);
  assert.throws(() => equationText(''), /Enter an equation/);
  assert.throws(() => equationText('$x$'), /delimiters/);
});
