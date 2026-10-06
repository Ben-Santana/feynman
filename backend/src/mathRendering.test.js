import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { mathProps } from '../../frontend/src/components/mathRendering.ts';

const render = source => renderToStaticMarkup(createElement(Markdown, mathProps, source));
const renderOriginal = source => renderToStaticMarkup(createElement(Markdown, { ...mathProps, rehypePlugins: mathProps.rehypePlugins.slice(1) }, source));

test('the reported resistance renders as math despite a stray closing brace', () => {
  const output = render(String.raw`The proposed resistance of $6\,\Omega}$ matches this calculation.`);
  assert.ok(!output.includes('katex-error'));
  assert.match(output, /class="katex"/);
  assert.match(output, /Ω/);
  assert.match(output, /matches this calculation/);
});

test('display equations recover extra trailing braces while preserving fraction groups', () => {
  const output = render('$$\n' + String.raw`R = \frac{12}{2}\,\Omega}}` + '\n$$');
  assert.ok(!output.includes('katex-error'));
  assert.match(output, /katex-display/);
  assert.match(output, /<mfrac>/);
  assert.match(output, /Ω/);
});

test('valid groups and escaped literal braces render identically to ordinary KaTeX', () => {
  for (const expression of [String.raw`\frac{1}{2}`, String.raw`\{x\}`, String.raw`\text{a closing brace: \}}`]) {
    const source = `$${expression}$`;
    const output = render(source);
    assert.ok(!output.includes('katex-error'));
    assert.equal(output, renderOriginal(source));
  }
});

test('repairs do not touch prose or ordinary code', () => {
  const source = String.raw`Text 6\,\Omega} and code: ` + '`$6\\,\\Omega}$`';
  const output = render(source);
  assert.ok(!output.includes('class="katex"'));
  assert.equal(output, renderOriginal(source));
  assert.match(output, /<code>\$6\\,\\Omega}\$<\/code>/);
});

test('other errors and nontrailing extra braces are not silently rewritten', () => {
  for (const expression of [String.raw`\unknown{6}`, String.raw`\frac{1}{`, String.raw`6} + 2`, String.raw`\frac{1}}`]) {
    const source = `$${expression}$`;
    assert.equal(render(source), renderOriginal(source));
  }
});
