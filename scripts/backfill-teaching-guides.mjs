// One-time backfill: writes teaching checklists into topics that were published
// before checklists existed, so every student starts from the same one.
// Dry run by default; pass --write to save. Run from the repository root:
//   node --env-file=backend/.env scripts/backfill-teaching-guides.mjs [--write]
// Only missing or out-of-date levels are generated, so it is safe to run again.
import { createClient } from '@supabase/supabase-js';
import { createProviderRegistry } from '../backend/src/providers/registry.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { generateTeachingGuides, guideBatchSize } from '../backend/src/teachingGuide.js';
import { mergeGuide, missingGuideLevels } from '../frontend/src/teachingGuide.js';

const write = process.argv.includes('--write');
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY, for example with --env-file=backend/.env.');
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const query = createProviderQuery(createProviderRegistry().resolve('anthropic'));

const { data: modules, error } = await db.from('course_modules').select('id,title,document,revision').not('published_at', 'is', null).order('created_at');
if (error) throw new Error(`Could not load published topics: ${error.message}`);
let saved = 0, complete = 0, failed = 0;
for (const module of modules) {
  const session = module.document?.session;
  const concepts = Array.isArray(session?.concepts) ? session.concepts : [];
  const pending = concepts.filter(concept => missingGuideLevels(concept).length);
  if (!pending.length) { complete++; console.log(`ok       ${module.title}`); continue; }
  const levels = pending.reduce((sum, concept) => sum + missingGuideLevels(concept).length, 0);
  if (!write) { console.log(`missing  ${module.title}: ${levels} levels in ${pending.length} of ${concepts.length} concepts`); continue; }
  try {
    const generated = new Map();
    for (let offset = 0; offset < pending.length; offset += guideBatchSize) {
      const batch = pending.slice(offset, offset + guideBatchSize);
      const result = await generateTeachingGuides({ learningType: session.learningType, concepts: batch.map(concept => ({ name: concept.name, rubric: Object.fromEntries(missingGuideLevels(concept).map(level => [level, concept.rubric[level]])) })) }, query);
      batch.forEach((concept, index) => generated.set(concept.id, result[index]?.guide));
    }
    const next = concepts.map(concept => generated.has(concept.id) ? mergeGuide(concept, generated.get(concept.id)) : concept);
    const left = next.reduce((sum, concept) => sum + missingGuideLevels(concept).length, 0);
    // The revision guard skips a topic that changed while its checklists were being written.
    const update = await db.from('course_modules').update({ document: { ...module.document, session: { ...session, concepts: next } } }).eq('id', module.id).eq('revision', module.revision).not('published_at', 'is', null).select('id');
    if (update.error || !update.data?.length) throw new Error(update.error?.message || 'The topic changed; run again.');
    saved++;
    console.log(`saved    ${module.title}: ${levels - left} of ${levels} levels${left ? ` (${left} could not be written)` : ''}`);
  } catch (reason) { failed++; console.log(`FAILED   ${module.title}: ${reason.message}`); }
}
console.log(`\n${modules.length} published topics: ${complete} already complete, ${write ? `${saved} saved, ${failed} failed` : `${modules.length - complete} need checklists (dry run, nothing written)`}.`);
