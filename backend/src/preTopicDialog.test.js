import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('course pages render the pre-topic questions that Teach topic opens', () => {
  const source = readFileSync(new URL('../../frontend/src/components/CoursesPage.tsx', import.meta.url), 'utf8');
  const dialog = source.indexOf('{preTopic && <PreTopicDialog');
  const libraryOnly = source.indexOf('{!courseId ? <>');
  assert.ok(dialog > 0 && libraryOnly > 0);
  // Rendering it inside the library branch hid it on course pages, so the button did nothing.
  assert.ok(dialog < libraryOnly);
});
