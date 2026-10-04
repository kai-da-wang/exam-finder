import {createHash} from 'node:crypto';
export function gitBlobSha(content) {
  const bytes = Buffer.from(content);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
export function isRecentEvidence(evidence, file, now = Date.now()) {
  const age = now - Date.parse(evidence?.checkedAt);
  if (!evidence || evidence.url !== file.url || evidence.blobSha !== file.blobSha || !Number.isFinite(age) || age < 0 || age >= 24*60*60*1000) return false;
  if (evidence.method === 'github-contents') return evidence.contentSha === file.blobSha;
  return evidence.status === 200;
}
