import test from 'node:test';
import assert from 'node:assert/strict';
import {gitBlobSha,isRecentEvidence} from '../scripts/verification.mjs';
test('正文哈希包含 Git blob 头，不能用普通文件SHA代替',()=>{assert.equal(gitBlobSha('test\n'),'9daeafb9864cf43055ae93beb0afd6c7d144bfa4');});
test('链接检查只对相同地址、相同内容、24小时以内有效',()=>{
 const now=Date.parse('2026-09-23T00:00:00Z'),file={url:'https://github.com/o/r/blob/commit/a.md',blobSha:'a'.repeat(40)};
 const record={...file,status:200,checkedAt:'2026-09-22T23:00:00Z'};
 assert.equal(isRecentEvidence(record,file,now),true);
 for(const patch of [{blobSha:'b'.repeat(40)},{url:'https://example.com'},{checkedAt:'2026-09-21T00:00:00Z'},{checkedAt:'2026-09-24T00:00:00Z'},{status:404},{checkedAt:'invalid'}])assert.equal(isRecentEvidence({...record,...patch},file,now),false);
});
test('GitHub正文验证必须匹配目录的Git blob SHA',()=>{
 const now=Date.parse('2026-09-23T00:00:00Z'),file={url:'https://github.com/o/r/blob/commit/a.md',blobSha:gitBlobSha('exam')};
 const proof={...file,checkedAt:'2026-09-22T23:00:00Z',method:'github-contents',contentSha:file.blobSha};
 assert.equal(isRecentEvidence(proof,file,now),true);assert.equal(isRecentEvidence({...proof,contentSha:gitBlobSha('different')},file,now),false);
});
