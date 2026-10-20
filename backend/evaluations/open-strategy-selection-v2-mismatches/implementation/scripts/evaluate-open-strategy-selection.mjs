// Open selection only, conditional on frozen diagnostics from the full coverage run.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';
import { retrieveStrategies, corpusVersion } from '../backend/src/questionStrategies.js';
import { strategySelectionPrompt, strategyExampleContext, selectionTool, validateSelection } from '../backend/src/strategyPlanning.js';
import { retryStructuredOutput, repairQuery } from '../backend/src/structuredOutput.js';
const arg = name => { const i=process.argv.indexOf(name); return i<0?undefined:process.argv[i+1]; };
const root=resolve(arg('--output') || 'backend/evaluations/open-strategy-selection-v1');
const sourceRoot=resolve('backend/evaluations/strategy-levels-v5-final');
const source=JSON.parse(readFileSync(join(sourceRoot,'results.json'),'utf8'));
const allFixtures=JSON.parse(readFileSync(join(sourceRoot,'fixtures.json'),'utf8'));
const mismatchSource=arg('--mismatches-from');
const prior=mismatchSource?JSON.parse(readFileSync(mismatchSource,'utf8')):null;
const selectedIds=prior?prior.results.filter(x=>x.status==='selected'&&!x.exactMatch).map(x=>x.caseId):arg('--case-ids')?.split(',');
if(selectedIds && (!selectedIds.length || selectedIds.some(id=>!allFixtures.some(f=>f.id===id))))throw Error('Invalid or empty case subset.');
const fixtures=selectedIds?allFixtures.filter(f=>selectedIds.includes(f.id)):allFixtures;
const adjudicationPath=arg('--adjudication');
const model=arg('--model') || source.model;
const concurrency=Number(arg('--concurrency') || 3);
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw Error('Concurrency must be 1–3.');
mkdirSync(join(root,'cases'),{recursive:true});
const hash=x=>createHash('sha256').update(x).digest('hex');
const files=['backend/src/strategyPlanning.js','backend/src/questionTargeting.js','backend/src/questionStrategies.js','backend/question-strategies.json','scripts/evaluate-open-strategy-selection.mjs'];
const sourceHashes=Object.fromEntries(files.map(f=>[f,hash(readFileSync(f))]));
const identity={version:2,scope:selectedIds?'selected prior mismatches only':'full supported strategy-level coverage',selectedCaseIds:fixtures.map(f=>f.id),mismatchSourceHash:mismatchSource?hash(readFileSync(mismatchSource)):null,adjudicationHash:adjudicationPath?hash(readFileSync(adjudicationPath)):null,mode:'open-selection-only',model,provider:'chatgpt',corpusVersion,sourceDiagnosticRun:'../strategy-levels-v5-final/results.json',sourceDiagnosticHash:hash(readFileSync(join(sourceRoot,'results.json'))),fixturesHash:hash(readFileSync(join(sourceRoot,'fixtures.json'))),sourceHashes};
const fingerprint=hash(JSON.stringify(identity));
const path=join(root,'results.json');
let saved=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
if(saved&&saved.fingerprint!==fingerprint)throw Error('Inputs changed; choose a new output directory.');
saved ||= {...identity,fingerprint,total:fixtures.length,startedAt:new Date().toISOString(),results:[],method:'Frozen diagnostic states were generated before targeted candidate filtering. Only select_strategy calls are permitted. All level-eligible reviewed strategies are offered. Expected strategy IDs, case IDs, titles, review guides, previous selections, questions, and scores are excluded from model requests. Production selection includes a structured plan, retained here; no question generation, assessment, diagnostic generation, suitability check, or model review is run.'};
for(const f of files){const dst=join(root,'implementation',f);mkdirSync(dirname(dst),{recursive:true});copyFileSync(f,dst);}
writeFileSync(join(root,'fixtures.json'),JSON.stringify(fixtures,null,2)+'\n');
if(adjudicationPath)copyFileSync(adjudicationPath,join(root,'pre-rerun-adjudication.json'));
const runtime=createChatGPT();
const accountId=runtime.accounts().find(x=>x.connected)?.id;
if(!accountId)throw Error('No connected ChatGPT account.');
const query=createProviderQuery(new ChatGPTProvider({runtime,accountId,model}));
const atomic=(file,value)=>{writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n');renameSync(file+'.tmp',file);};
function checkpoint(){const done=saved.results.filter(x=>x.status==='selected'||x.status==='abstained');saved.updatedAt=new Date().toISOString();saved.summary={completed:done.length,total:fixtures.length,exactMatches:done.filter(x=>x.exactMatch).length,mismatches:done.filter(x=>!x.exactMatch&&x.status==='selected').length,abstentions:done.filter(x=>x.status==='abstained').length,errors:saved.results.filter(x=>x.status==='error').length,modelCalls:saved.results.reduce((s,x)=>s+x.callCount,0),byLevel:Object.fromEntries(['remember','understand','apply','analyze'].map(level=>{const rows=done.filter(x=>x.level===level);return[level,{completed:rows.length,total:fixtures.filter(x=>x.level===level).length,exactMatches:rows.filter(x=>x.exactMatch).length}];}))};atomic(path,saved);}
async function run(fixture){
 const previous=saved.results.find(x=>x.caseId===fixture.id);
 if(previous&&previous.status!=='error')return;
 if(previous&&!process.argv.includes('--retry-errors'))return;
 const historical=JSON.parse(readFileSync(join(sourceRoot,'cases',fixture.id+'.json'),'utf8'));
 const input={topic:fixture.topic,level:fixture.level,learningType:fixture.learningType,aspects:fixture.aspects,messages:fixture.messages};
 const state=historical.state;
 if(!state||!historical.calls.some(x=>x.name==='diagnose_understanding'))throw Error('Missing frozen diagnostic state.');
 const candidates=retrieveStrategies(state,input);
 const request={instructions:strategySelectionPrompt(input.level),messages:[{role:'user',content:JSON.stringify({state,candidates,exampleContext:strategyExampleContext(candidates,input.level),input})}],response:selectionTool(candidates,input)};
 const trace={caseId:fixture.id,mode:'open-selection-only',candidateIds:candidates.map(x=>x.strategy.id),request,calls:[]};
 const record=previous||{caseId:fixture.id,expectedStrategyId:fixture.expectedStrategyId,level:fixture.level,topic:fixture.topic,attempts:[],callCount:0};
 if(!previous)saved.results.push(record);
 console.log('Selecting '+fixture.id+' ('+candidates.length+' candidates)...');
 const start=Date.now();
 try{
  const result=await retryStructuredOutput(async(attempt,signal)=>{
   const traced=async(instructions,messages,response,options)=>{if(response.name!=='select_strategy')throw Error('Selection-only runner forbids non-selection calls.');const call={name:response.name,attempt,startedAt:new Date().toISOString()};trace.calls.push(call);record.callCount++;try{const result=await query(instructions,messages,response,options);call.result=result;return result;}catch(error){call.error=error.message;throw error;}};
   const result=await repairQuery(traced,attempt,signal)(request.instructions,request.messages,request.response);validateSelection(result,candidates,input);return result;
  });
  Object.assign(record,{status:result.strategyId==='none'?'abstained':'selected',selectedStrategyId:result.strategyId,exactMatch:result.strategyId===fixture.expectedStrategyId,rationale:result.rationale,traceFile:'cases/'+fixture.id+'.json'});delete record.error;trace.selection=result;
 }catch(error){record.status='error';record.error=error.message;trace.error=error.message;}
 record.attempts.push({status:record.status,finishedAt:new Date().toISOString(),durationMs:Date.now()-start});
 atomic(join(root,'cases',fixture.id+'.json'),trace);checkpoint();
 console.log(record.status+': '+fixture.id+' -> '+(record.selectedStrategyId||record.error)+(record.exactMatch?' [match]':''));
}
let next=0;
try{await Promise.all(Array.from({length:concurrency},async()=>{while(next<fixtures.length)await run(fixtures[next++]);}));checkpoint();console.log(JSON.stringify(saved.summary));}finally{runtime.close();}
