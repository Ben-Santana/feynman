import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { defaultDisplayPreferences, displayStorageKey, getDisplayPreferences, initializeDisplayPreferences, parseDisplayPreferences, subscribeDisplayPreferences, updateDisplayPreferences } from '../../frontend/src/displayPreferences.ts';
import { readingParts, emphasizeReadingTree } from '../../frontend/src/readingText.ts';
import { ChatText } from '../../frontend/src/components/ChatText.ts';
import { mathProps } from '../../frontend/src/components/mathRendering.ts';
import { jsx, jsxs } from '../../frontend/src/reading-runtime/jsx-runtime.ts';
import { jsxDEV } from '../../frontend/src/reading-runtime/jsx-dev-runtime.ts';

test('display preferences recover safely from missing, malformed, and unsupported values', () => {
  for (const value of [null, 'invalid', 'null', '[]', '{"theme":"auto","fontSize":"huge","fontFamily":"unknown","boldWordStarts":"true"}']) {
    assert.deepEqual(parseDisplayPreferences(value), defaultDisplayPreferences);
  }
  const saved = { theme: 'dark', fontSize: 'extra-large', fontFamily: 'sans', boldWordStarts: true };
  assert.deepEqual(parseDisplayPreferences(JSON.stringify(saved)), saved);
});

test('word emphasis preserves text, punctuation, Unicode and combining marks', () => {
  for (const text of ['A question: why?\nTry 123 examples.', 'naïve café e\u0301clair — 中文 🙂', '<script>alert(1)</script>', '']) {
    assert.equal(readingParts(text).map(part => part.text).join(''), text);
  }
  assert.deepEqual(readingParts('Learning'), [{ text: 'Lear', bold: true }, { text: 'ning' }]);
  assert.deepEqual(readingParts('a'), [{ text: 'a' }]);
  assert.equal(readingParts('e\u0301clair')[0].text, 'e\u0301cl');
});

test('Markdown emphasis leaves equations, code, and existing bold text intact', () => {
  const source = 'Learning **already bold** with `some_code` and $\\frac{1}{2}$.';
  const normal = renderToStaticMarkup(createElement(Markdown, mathProps, source));
  const emphasized = renderToStaticMarkup(createElement(Markdown, {
    ...mathProps, rehypePlugins: [...mathProps.rehypePlugins, () => emphasizeReadingTree],
  }, source));
  assert.match(emphasized, /<b class="reading-word-start">Lear<\/b>ning/);
  assert.match(emphasized, /<strong>already bold<\/strong>/);
  assert.match(emphasized, /<code>some_code<\/code>/);
  const math = html => html.slice(html.indexOf('<span class="katex"'), html.lastIndexOf('</span>') + 7);
  assert.equal(math(emphasized), math(normal));
});

test('the reading runtime preserves static JSX lists inside literal scopes', () => {
  const errors = [], original = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const tree = jsxDEV('svg', { children: [
      jsxDEV('text', { children: 'First label' }, undefined, false),
      jsxDEV('text', { children: 'Second label' }, undefined, false),
    ] }, undefined, true);
    assert.equal(renderToStaticMarkup(tree), '<svg><text>First label</text><text>Second label</text></svg>');
    assert.deepEqual(errors, []);
  } finally { console.error = original; }
});

test('preferences apply immediately, restore on reload, sync tabs, and tolerate blocked storage', () => {
  const root = { dataset: {}, style: {} }, rows = new Map(), handlers = [];
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) };
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldStorage = globalThis.localStorage;
  globalThis.document = { documentElement: root };
  globalThis.window = { addEventListener: (_name, fn) => handlers.push(fn), localStorage: storage };
  globalThis.localStorage = storage;
  let notifications = 0;
  const unsubscribe = subscribeDisplayPreferences(() => notifications++);
  try {
    initializeDisplayPreferences();
    assert.equal(updateDisplayPreferences({ theme: 'dark', fontSize: 'large', fontFamily: 'sans', boldWordStarts: true }), true);
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(root.style.colorScheme, 'dark');
    assert.equal(root.style.fontSize, '115%');
    assert.equal(root.dataset.fontFamily, 'sans');
    const saved = getDisplayPreferences();
    assert.deepEqual(JSON.parse(rows.get(displayStorageKey)), saved);
    initializeDisplayPreferences();
    assert.deepEqual(getDisplayPreferences(), saved);
    const output = renderToStaticMarkup(createElement(ChatText, null, 'Learning $x_1$ <script>'));
    assert.match(output, /<b class="reading-word-start">Lear<\/b>ning/);
    assert.match(output, /class="katex"/);
    assert.doesNotMatch(output, /<script>/);
    const interfaceText = renderToStaticMarkup(jsxs('main', { children: [
      jsx('nav', { children: jsx('button', { children: 'Dashboard' }) }),
      jsx('h1', { children: 'Settings' }),
      jsx('label', { children: 'Display name' }),
      jsx('p', { children: ['Progress updated: ', 3] }),
      jsxDEV('span', { children: 'Development' }, undefined, false),
      jsx('code', { children: jsx('span', { children: 'literal_code' }) }),
      jsx('svg', { children: jsx('text', { children: 'Diagram' }) }),
      jsx('div', { contentEditable: true, suppressContentEditableWarning: true, children: jsx('span', { children: 'Editable text' }) }),
      jsx('textarea', { defaultValue: 'Draft text' }),
      jsx('select', { children: jsx('option', { children: 'Native option' }) }),
    ] }));
    for (const prefix of ['Dashb', 'Sett', 'Disp', 'Prog', 'Develo']) {
      assert.ok(interfaceText.includes(`class="reading-word-start">${prefix}</b>`), prefix);
    }
    assert.match(interfaceText, /<button><span class="reading-text">/);
    assert.match(interfaceText, /<code><span>literal_code<\/span><\/code>/);
    assert.match(interfaceText, /<svg><text>Diagram<\/text><\/svg>/);
    assert.match(interfaceText, /contentEditable="true"><span>Editable text<\/span>/);
    assert.match(interfaceText, /<textarea>Draft text<\/textarea>/);
    assert.match(interfaceText, /<option>Native option<\/option>/);
    handlers[0]({ key: displayStorageKey, newValue: null, storageArea: storage });
    assert.deepEqual(getDisplayPreferences(), defaultDisplayPreferences);
    assert.equal(renderToStaticMarkup(jsx('button', { children: 'Dashboard' })), '<button>Dashboard</button>');
    storage.setItem = () => { throw new Error('Storage blocked'); };
    assert.equal(updateDisplayPreferences({ theme: 'dark' }), false);
    assert.equal(root.dataset.theme, 'dark');
    assert.ok(notifications >= 5);
  } finally {
    unsubscribe();
    globalThis.document = oldDocument; globalThis.window = oldWindow; globalThis.localStorage = oldStorage;
  }
});
