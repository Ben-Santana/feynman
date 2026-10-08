import test from 'node:test';
import assert from 'node:assert/strict';
import { draftEquationLine, equationDraftIssue, equationLine, equationText, replaceDraft, splitComposerDraft, splitMathDraft } from '../../frontend/src/mathDraft.ts';

test('mixed drafts round-trip text and multiple inline/display equations exactly', () => {
  const draft = String.raw`The ratio is $\frac{1}{2}$ because x changed. $$V_{rms}=12\angle30^{\circ}$$ Done.`;
  const parts = splitMathDraft(draft);
  assert.equal(parts.map(part => part.text).join(''), draft);
  assert.equal(parts.filter(part => part.latex !== undefined).length, 2);
  for (const part of parts) assert.equal(draft.slice(part.start, part.end), part.text);
  assert.equal(parts.find(part => part.display).latex, String.raw`V_{rms}=12\angle30^{\circ}`);
});

test('composer equations insert on their own line at the cursor and keep following text', () => {
  const draft = 'Before after.';
  const inserted = replaceDraft(draft, 7, 7, equationLine(draft, 7, 7, 'x^2'));
  assert.equal(inserted, 'Before \n$$x^2$$\nafter.');
  const parts = splitComposerDraft(inserted);
  assert.deepEqual(parts.map(part => part.text), ['Before ', '\n$$x^2$$\n', 'after.']);
  const equation = parts[1];
  const edited = replaceDraft(inserted, equation.start, equation.end, equationLine(inserted, equation.start, equation.end, 'y'));
  assert.equal(edited, 'Before \n$$y$$\nafter.');
  assert.equal(replaceDraft(inserted, equation.start, equation.end, ''), draft);
  assert.equal(equationLine('', 0, 0, 'x'), '$$x$$\n');
  for (const source of [inserted, '$$x$$\n$$y$$\n', 'A\n\n$$x$$\n\nB', 'A $x$ B']) {
    const layout = splitComposerDraft(source);
    assert.equal(layout.map(part => part.text).join(''), source);
    for (const part of layout) assert.equal(source.slice(part.start, part.end), part.text);
  }
});

test('equations insert at the caret and edits/removal preserve surrounding explanations', () => {
  const inserted = replaceDraft('The ratio is  because.', 13, 13, equationText(String.raw`\frac{1}{2}`));
  const equation = splitMathDraft(inserted).find(part => part.latex);
  assert.equal(replaceDraft(inserted, equation.start, equation.end, equationText('x^2')), 'The ratio is $x^2$ because.');
  assert.equal(replaceDraft(inserted, equation.start, equation.end, ''), 'The ratio is  because.');
});

test('empty inline equation rows persist at the cursor and cannot be sent unfinished', () => {
  const draft = 'Before after.';
  const inserted = replaceDraft(draft, 7, 7, draftEquationLine(draft, 7, 7, ''));
  assert.equal(inserted, 'Before \n$$ $$\nafter.');
  const equation = splitComposerDraft(inserted)[1];
  assert.equal(equation.latex, ' ');
  assert.equal(replaceDraft(inserted, equation.start, equation.end, ''), draft);
  assert.match(equationDraftIssue(inserted), /Backspace/);
  assert.match(equationDraftIssue(String.raw`$$\frac{1}{\placeholder{}}$$`), /empty equation boxes/);
  assert.equal(equationDraftIssue('Before\n$$x^2$$\nafter.'), '');
  assert.equal(equationDraftIssue('Ordinary text.'), '');
});

test('currency and incomplete delimiters stay editable text and size limits cover equations', () => {
  for (const draft of ['It costs $5 and $10.', '$unfinished', String.raw`\$5`]) {
    assert.equal(splitMathDraft(draft).length, 1);
    assert.equal(splitMathDraft(draft)[0].text, draft);
  }
  assert.throws(() => replaceDraft('x'.repeat(12000), 0, 0, equationText('x')), /too long/);
  assert.throws(() => equationText(''), /Enter an equation/);
  assert.throws(() => equationText('$x$'), /delimiters/);
  assert.throws(() => equationText(String.raw`\frac{1}{\placeholder{}}`), /empty boxes/);
});
