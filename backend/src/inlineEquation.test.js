import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';

test('equation creation defers keybinding changes until MathLive mounts', () => {
  class Mathfield extends EventTarget {
    mounted = false;
    bindings = [
      { key: 'alt+shift+[Space]', command: 'toggleVirtualKeyboard' },
      { key: 'ctrl+z', command: 'undo' },
    ];
    setAttribute() {}
    get keybindings() {
      if (!this.mounted) throw new Error('Mathfield not mounted');
      return this.bindings;
    }
    set keybindings(value) {
      if (!this.mounted) throw new Error('Mathfield not mounted');
      this.bindings = value;
    }
  }
  const source = readFileSync(new URL('../../frontend/src/components/inlineEquation.ts', import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const module = { exports: {} };
  runInNewContext(outputText, {
    module,
    exports: module.exports,
    document: { createElement: () => new Mathfield() },
    require(name) {
      if (name === 'mathlive') return { MathfieldElement: Mathfield };
      if (name === 'mathlive/fonts.css') return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const field = module.exports.createEquationField(' x^2 ');
  assert.equal(field.value, 'x^2');
  assert.equal(field.mathVirtualKeyboardPolicy, 'manual');
  assert.equal(field.bindings.length, 2);
  field.mounted = true;
  field.dispatchEvent(new Event('mount'));
  assert.deepEqual(field.bindings, [{ key: 'ctrl+z', command: 'undo' }]);
  field.dispatchEvent(new Event('mount'));
  assert.deepEqual(field.bindings, [{ key: 'ctrl+z', command: 'undo' }]);
});
