import { readFileSync } from 'node:fs';
import { suggestConceptsFromFiles } from '../backend/src/chat.js';
import { createChatGPT } from '../backend/src/chatgpt.js';
import { ChatGPTProvider } from '../backend/src/providers/ChatGPTProvider.js';
import { createProviderQuery } from '../backend/src/providers/LanguageModelProvider.js';

const runtime = createChatGPT();
const account = runtime.accounts().find(item => item.connected);
if (!account) throw new Error('Connect ChatGPT in the local app first.');
const provider = new ChatGPTProvider({ runtime, accountId: account.id,
  fetcher: async (...args) => {
    const response = await fetch(...args);
    if (!response.ok) console.error('Provider rejected request:', response.status, (await response.clone().json()).error?.message);
    return response;
  },
});
const path = process.argv[2];
if (!path) throw new Error('Pass a PDF path.');
const concepts = await suggestConceptsFromFiles([{ name: path.split(/[\\/]/).pop(), type: 'application/pdf', data: readFileSync(path).toString('base64') }], createProviderQuery(provider), 'quantitative');
console.log(JSON.stringify({ concepts }, null, 2));
