import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatText } from '../../frontend/src/components/ChatText.ts';

const render = source => renderToStaticMarkup(createElement(ChatText, null, source));

test('chat preserves Markdown punctuation and treats HTML as literal text', () => {
  const output = render('# Heading\n**literal** _text_\n- item\n<script>alert(1)</script>');
  assert.match(output, /# Heading/);
  assert.match(output, /\*\*literal\*\*/);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<h1|<strong|<em>|<ul|<script>/);
});

test('chat automatically renders signal notation, subscripts, numeric fractions and phasors', () => {
  for (const source of ['x[an+b]', 'V_rms', '1/2', '12∠30°']) assert.match(render(source), /class="katex"/);
});

test('chat supports inline and display math delimiters and preserves malformed math', () => {
  for (const source of ['$x[n]$', String.raw`\(x[n]\)`]) assert.match(render(source), /class="katex"/);
  for (const source of ['$$x[n]$$', String.raw`\[x[n]\]`]) assert.match(render(source), /katex-display/);
  assert.match(render(String.raw`$\frac{1}{2}$`), /<mfrac>/);
  assert.match(render(String.raw`$6\,\Omega}$`), /class="katex"/);
  assert.match(render(String.raw`$\unknown{1}$`), /\$\\unknown\{1\}\$/);
  assert.doesNotMatch(render('It costs $5 and $10.'), /class="katex"/);
});
