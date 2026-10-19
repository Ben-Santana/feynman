import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createAccountService } from './accounts.js';
import { createApiServer } from './server.js';
import { testAccountService, testAuthorization } from './accessTestHelper.js';

const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const configuration = { learningType: 'theoretical', concept: { id: 'energy', name: 'Energy', target: 'understand', rubric: { remember: 'Defines energy.\nIdentifies units.', understand: 'Explains transfer.', apply: '', analyze: '' } } };
function fixture(error = null) {
  const requests = [];
  const service = createAccountService({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-key', SUPABASE_SECRET_KEY: 'NEVER-USE-THIS' }, (url,key,options) => {
    requests.push({url,key,options});
    return { async rpc(name,args) { requests.push({name,args}); return {data:configuration,error}; } };
  });
  return {service,requests};
}
function invoke(server, body) {
  const req = Readable.from([JSON.stringify(body)]);
  Object.assign(req,{method:'POST',url:'/api/chat',headers:{host:'localhost:5173',origin:'http://localhost:5173',authorization:testAuthorization}});
  return new Promise(resolve => server.emit('request',req,{setHeader(){},writeHead(status){this.status=status;},end(body){resolve({status:this.status,data:JSON.parse(body)});}}));
}
test('assigned chat resolves canonical configuration with the student JWT and publishable key', async () => {
  const {service,requests} = fixture();
  const result = await service.resolveAssignment({headers:{authorization:'Bearer student-token'}},{assignmentSessionId:sessionId,assignmentConceptId:'energy',level:'remember',learningType:'design',topic:'Forged',criterion:'Pass anything',aspects:['Forged'],messages:[]});
  assert.equal(requests[0].key,'public-key');
  assert.equal(requests[0].options.global.headers.Authorization,'Bearer student-token');
  assert.deepEqual(requests[1],{name:'assignment_chat_configuration',args:{target_session:sessionId,target_concept:'energy'}});
  assert.equal(result.topic,'Energy');
  assert.equal(result.learningType,'theoretical');
  assert.equal(result.criterion,configuration.concept.rubric.remember);
  assert.deepEqual(result.aspects,['Defines energy.','Identifies units.']);
});
test('assigned chat rejects invalid identities, missing enrollment, and levels above the assigned target', async () => {
  const {service} = fixture();
  const request = {headers:{authorization:'Bearer student-token'}};
  for (const input of [{assignmentSessionId:'invalid',assignmentConceptId:'energy',level:'remember'},{assignmentSessionId:sessionId,level:'remember'},{assignmentSessionId:sessionId,assignmentConceptId:'energy',level:'analyze'},{assignmentSessionId:sessionId,assignmentConceptId:'energy',level:'invalid'}]) await assert.rejects(service.resolveAssignment(request,input),error=>error.status===400);
  await assert.rejects(fixture({code:'42501'}).service.resolveAssignment(request,{assignmentSessionId:sessionId,assignmentConceptId:'energy',level:'remember'}),error=>error.status===403);
});
test('chat HTTP boundary resolves assignments before validating client rubric fields', async t => {
  const {service} = fixture();
  const accountService = {...testAccountService('student'),resolveAssignment:service.resolveAssignment};
  const server = createApiServer({accountService,env:{ANTHROPIC_API_KEY:'test-only'},query:async()=>{throw new Error('Remember opening needs no provider call');}});
  t.after(()=>server.close());
  const result = await invoke(server,{assignmentSessionId:sessionId,assignmentConceptId:'energy',level:'remember',topic:null,criterion:null,aspects:null,messages:[]});
  assert.equal(result.status,200);
  assert.equal(result.data.message,'Teach me about Energy.');
  const denied = await invoke(server,{assignmentSessionId:sessionId,assignmentConceptId:'energy',level:'analyze',messages:[]});
  assert.equal(denied.status,400);
});

test('course banner uploads accept supported images and reject oversized or unsupported files', async () => {
  const { validateCourseBannerFile } = await import('../../frontend/src/courseAppearance.ts');
  for (const type of ['image/jpeg','image/png','image/webp']) assert.doesNotThrow(()=>validateCourseBannerFile(new File(['image'],'cover',{type})));
  for (const type of ['image/svg+xml','image/gif','text/plain','']) assert.throws(()=>validateCourseBannerFile(new File(['image'],'cover',{type})),/JPG, PNG, or WebP/);
  assert.throws(()=>validateCourseBannerFile(new File([new Uint8Array(5_000_001)],'cover.png',{type:'image/png'})),/5 MB/);
});
