import test from 'node:test';
import assert from 'node:assert/strict';
import { rubricMath } from '../../frontend/src/rubricMath.ts';

test('formats equations in existing generated rubric prose', () => {
  assert.equal(rubricMath('States that f(x)=0 is equivalent to x=g(x) for a suitably chosen g.'), 'States that $f(x)=0$ is equivalent to $x=g(x)$ for a suitably chosen g.');
  assert.equal(rubricMath('Use g(x)=x−f(x) and g(x)=x±αf(x).'), 'Use $g(x)=x-f(x)$ and $g(x)=x±\\alpha f(x)$.');
  assert.equal(rubricMath('State V = IR.'), 'State $V = IR$.');
  assert.equal(rubricMath('Use f(x)=0 ⇔ x=g(x).'), 'Use $f(x)=0 \\iff x=g(x)$.');
});
test('preserves prose, explicit math, and code', () => {
  for (const text of ['Explain fixed-point iteration and linear-correction methods.', 'Use $a = \\frac{F}{m}$ and $$F = ma$$.', 'Keep `f(x)=0` as code.']) assert.equal(rubricMath(text), text);
});
test('accepts alternate LaTeX delimiters', () => {
 assert.equal(rubricMath(String.raw`Use \(f(x)=0\) or \[F=ma\].`), 'Use $f(x)=0$ or $$F=ma$$.');
});
