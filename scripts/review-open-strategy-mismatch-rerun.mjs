import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='backend/evaluations/open-strategy-selection-v2-mismatches';
const run=JSON.parse(readFileSync(root+'/results.json','utf8'));
const criteria=JSON.parse(readFileSync(root+'/pre-rerun-adjudication.json','utf8'));
const reasons={
'coverage-controlled-comparison-understand':'The reconciliation plan retains matched volume versus extra-water claims and asks how they fit the observed result. Valid first probe; other control relationships remain unassessed.',
'coverage-boundary-case-understand':'The plan explicitly probes zero motion in the existing work claim without a new exercise or supplied work rule.',
'coverage-boundary-case-apply':'The plan requires the relationship, numerical application at zero voltage, and validity of the chosen operation, without supplying the formula.',
'coverage-remove-condition-analyze':'The construction analyzes the shutdown-to-deceleration claim under the remaining force-free conditions.',
'coverage-quantity-versus-change-understand':'The exact phrase remains plausibly ambiguous. The clarification asks what happens to the water while level stays constant without supplying alternatives.',
'coverage-quantity-versus-change-analyze':'The newly selected quantity-accounting strategy directly relates deposits and withdrawals to equal endpoint balances and the no-activity claim. Its explicit no-other-adjustments assumption defines a usable balance scope.',
'coverage-reconcile-claims-apply':'The construction requires a numerical check connecting all three claims and a supported consistency judgment.',
'coverage-representation-change-understand':'Repaired: the plan explicitly maps the repeated table entries to the existing graph height and asks what that correspondence means for distance.',
'coverage-representation-change-analyze':'The construction requires terminal-to-node mappings in both diagrams and uses that comparison to examine the visual-layout claim. Actual drawing generation was not tested.',
'coverage-answer-reason-consistency-apply':'The controlled contrast changes one reading while holding the others fixed and asks for a calculation; this validly distinguishes the stated shortcut from a mean procedure.',
'coverage-conservation-accounting-understand':'Repaired: the plan requests an account of water no longer in the clothes across the clothes-plus-room-air system during drying, without supplying a destination or state change.',
'coverage-classify-by-features-understand':'The sufficiency probe asks why appearance alone warrants the classification in the existing melting event, retaining the identity condition.',
'coverage-classify-by-features-analyze':'The sufficiency probe tests the proposed feature against supplied changing-slope curved cases and requires analysis of their relevance.',
'coverage-scale-level-distinction-understand':'The construction directly probes the group-summary-to-individual inference. The inherited leading opening remains a fixture limitation.',
'coverage-method-applicability-understand':'The construction elicits how duration affects the equal-weight shortcut’s applicability within the established trip, without a new numerical exercise.',
'coverage-scope-and-reference-apply':'The plan requires a numerical terminal-velocity calculation with consistent signs and explicit references for the inputs.',
'coverage-scope-and-reference-analyze':'The plan asks what system the external classification refers to and relates that to the stated ball-plus-Earth membership, without giving a classification rule.',
};
if(run.summary.completed!==17||run.results.some(x=>x.status!=='selected')||run.results.some(x=>!reasons[x.caseId]))throw Error('Review expects the complete selected 17-case run.');
const artifact={version:1,reviewedAt:new Date().toISOString(),reviewer:'Coding assistant manual review; not an independent expert rating',criteriaHash:createHash('sha256').update(readFileSync(root+'/pre-rerun-adjudication.json')).digest('hex'),method:'Inspected each actual selected plan against the pre-rerun required-evidence criterion. Did not use exact-label agreement as automatic proof of validity; did not generate a question or call a model reviewer.',summary:{valid:17,errors:0,repairedOriginalErrors:2,exactIntendedLabels:run.summary.exactMatches,validAlternativeLabels:17-run.summary.exactMatches},cases:run.results.map(row=>({caseId:row.caseId,selectedStrategyId:row.selectedStrategyId,exactIntendedLabel:row.exactMatch,valid:true,originalClassification:criteria.cases.find(x=>x.caseId===row.caseId).classification,reason:reasons[row.caseId]}))};
writeFileSync(root+'/post-rerun-adjudication.json',JSON.stringify(artifact,null,2)+'\n');
console.log(artifact.summary);
