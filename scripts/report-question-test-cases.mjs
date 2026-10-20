import { readFileSync, writeFileSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const fixtures = read('backend/evaluations/strategy-levels-v5-final/fixtures.json');
const original = read('backend/evaluations/strategy-levels-v5-final/results.json');
const rerun = read('backend/evaluations/strategy-levels-v6-combined/results.json');
const catalog = read('backend/question-strategies.json');
const strategies = Array.isArray(catalog) ? catalog : catalog.strategies;
const title = id => strategies.find(x=>x.id===id)?.title || id;
const cap = s => s[0].toUpperCase()+s.slice(1);
const cell = s => s.replaceAll('|','/').replaceAll('\n',' ');
let out = '# Test cases and exact default-versus-strategy questions\n\n';
out += 'This catalog displays all 51 cases actually run for the 18-strategy evaluation, plus the newer question pairs from the 11 affected-case reruns. The developer tool also contains 16 older fixtures; those are not part of the 51-case coverage benchmark shown here.\n\n';
out += '**How the pairs were tested:** the two branches shared the fixed conversation, active rubric, and rubric assessment. Default generation received no expected-strategy label or review guide. The strategy branch was offered the intended supported strategy and could abstain. This tests targeted strategy application, not open strategy selection. No student answered the generated follow-ups: these are next-question design comparisons using authored synthetic cases, not copied or validated concept-inventory items.\n\n';
out += '**Levels:** Remember 2; Understand 17; Apply 16; Analyze 16. Clarification supports Remember/Understand; recall supports Remember only; the other 16 strategies support Understand/Apply/Analyze. This does not cover every learning-type/task combination or quantitative Analyze paper workflows.\n\n';
out += '**Reading the questions:** Initial pairs are quoted exactly from the complete 51-case run. Eleven cases additionally show their latest post-fix pair, clearly labeled. Latest results combine ten cases from the first leakage-fix revision and the divisibility Apply case from the subsequent planning fix; the rejected intermediate plan remains in the run archives. The remaining 40 questions are historical pre-fix outputs.\n\n';
out += '## Coverage at a glance\n\n| Strategy | Remember | Understand | Apply | Analyze |\n|---|---|---|---|---|\n';
for(const id of [...new Set(fixtures.map(x=>x.expectedStrategyId))]) {
 out += `| ${title(id)} | ${['remember','understand','apply','analyze'].map(level=>cell(fixtures.find(x=>x.expectedStrategyId===id&&x.level===level)?.topic || 'Not supported')).join(' | ')} |\n`;
}
out += '\n## All fixed inputs and generated pairs\n\n';
for(const id of [...new Set(fixtures.map(x=>x.expectedStrategyId))]) {
 out += `### ${title(id)}\n\n`;
 for(const f of fixtures.filter(x=>x.expectedStrategyId===id)) {
  const first=original.results.find(x=>x.caseId===f.id), latest=rerun.results.find(x=>x.caseId===f.id);
  out += `#### ${cap(f.level)}: ${f.topic}\n\nCase: \`${f.id}\`. Learning type: ${f.learningType}.\n\n`;
  out += '**Fixed conversation**\n\n'+f.messages.map(m=>`> **${m.role==='user'?'Learner':'Feynman'}:** ${m.content.replaceAll('\n','\n> ')}\n`).join('>\n')+'\n';
  out += `**Evidence the test sought:** ${f.reviewGuide.target}\n\n**Active rubric**\n\n${f.aspects.map(a=>'- '+a).join('\n')}\n\n`;
  out += `| Initial generated follow-up | Exact question |\n|---|---|\n| Default | ${cell(first.baseline)} |\n| Strategy | ${cell(first.enhanced)} |\n\n`;
  if(latest)out += `| Latest post-fix follow-up | Exact question |\n|---|---|\n| Default | ${cell(latest.baseline)} |\n| Strategy | ${cell(latest.enhanced)} |\n\n`;
  out += `Initial blind design scores: default ${first.review.questions.baseline.total}/10; strategy ${first.review.questions.enhanced.total}/10.`+(latest?` Latest: default ${latest.review.questions.baseline.total}/10; strategy ${latest.review.questions.enhanced.total}/10.`:' Not rerun after the leakage fixes.')+' Scores are same-model ratings, not measured learning outcomes.\n\n';
 }
}
out += '## Evidence files\n\n- [Frozen 51-case inputs](../evaluations/strategy-levels-v5-final/fixtures.json)\n- [Original 51 results and trace references](../evaluations/strategy-levels-v5-final/results.json)\n- [Latest 11 affected-case results](../evaluations/strategy-levels-v6-combined/results.json)\n- [Fixes and testing summary](question-strategy-leakage-rerun.md)\n';
writeFileSync('backend/docs/question-strategy-test-case-catalog.md',out);
console.log(`Wrote ${fixtures.length} fixed cases, ${original.results.length} initial pairs and ${rerun.results.length} post-fix pairs.`);
for(const id of ['coverage-recall-specific-element-remember','coverage-stochastic-reasoning-understand','coverage-necessary-sufficient-apply','coverage-conservation-accounting-analyze']){const f=fixtures.find(x=>x.id===id),r=rerun.results.find(x=>x.caseId===id);console.log(JSON.stringify({id,student:f.messages.at(-1).content,default:r.baseline,strategy:r.enhanced}));}
