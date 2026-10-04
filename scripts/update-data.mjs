import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildIndex, contentHash, inferCourse, isCandidate } from './catalog.mjs';
import { isRecentEvidence } from './verification.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const catalog = JSON.parse(await readFile(path.join(root,'data/catalog.json'),'utf8'));
const reviewed = JSON.parse(await readFile(path.join(root,'data/reviewed-blobs.json'),'utf8'));
const discover = process.argv.includes('--discover');
const snapshotArg = process.argv.indexOf('--snapshots');
const snapshotsDir = snapshotArg >= 0 ? process.argv[snapshotArg+1] : null;
const evidenceArg = process.argv.indexOf('--evidence');
const evidencePath = evidenceArg >= 0 ? process.argv[evidenceArg+1] : null;
const checkedAt = new Date().toISOString();
const cache = path.join(root,'.cache');
await mkdir(cache,{recursive:true});
async function request(url, options = {}) {
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const response = await fetch(url,{...options,signal:AbortSignal.timeout(url.includes('/git/trees/') ? 90000 : 25000)});
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
      return response;
    } catch(error) { if(attempt===2)throw error; await new Promise(r=>setTimeout(r,500*(attempt+1))); }
  }
}
async function github(url) {
  const headers = {'User-Agent':'exam-archive-indexer','Accept':'application/vnd.github+json'};
  if(process.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  return (await request(url,{headers})).json();
}
try {
  const snapshots = new Map();
  for (const school of catalog.schools) {
    let tree;
    if (snapshotsDir) tree=JSON.parse(await readFile(path.resolve(snapshotsDir,`${school.id}.json`),'utf8'));
    else {
      const repo=await github(`https://api.github.com/repos/${school.repository}`);
      const commit=await github(`https://api.github.com/repos/${school.repository}/commits/${encodeURIComponent(repo.default_branch)}`);
      tree=await github(`https://api.github.com/repos/${school.repository}/git/trees/${commit.commit.tree.sha}?recursive=1`);
      tree.commit=commit.sha;
    }
    if(tree.truncated)throw new Error(`${school.name}目录被截断，已停止更新`);
    snapshots.set(school.repository,tree);
    await writeFile(path.join(cache,`${school.id}-tree.json`),JSON.stringify(tree));
    console.log(`已读取 ${school.name} 的公开目录`);
  }
  if(discover){
    const candidates=catalog.schools.flatMap(s=>snapshots.get(s.repository).tree.filter(f=>f.type==='blob'&&isCandidate(f.path)).map(f=>({school:s.id,course:inferCourse(s,f.path),path:f.path,blobSha:f.sha,reviewed:!!reviewed[s.repository+'/'+f.path]})));
    await writeFile(path.join(cache,'candidates.json'),JSON.stringify(candidates,null,2));
    console.log(`发现 ${candidates.length} 个候选文件，保存到 .cache/candidates.json；未发布任何新条目。`);
  } else {
    const indexes=buildIndex(catalog,snapshots,reviewed,checkedAt);
    const checks=[...new Map([...indexes.values()].flatMap(s=>s.papers.flatMap(p=>[...p.files,...p.answers].map(f=>[f.url,{file:f,repository:s.school.repository,commit:p.source.commit}])))).values()];
    let cursor=0,done=0;const verified=[];
    let previousAudit={verified:[]};
    try { previousAudit=JSON.parse(await readFile(path.join(cache,'link-audit.json'),'utf8')); } catch {}
    const supplied = evidencePath ? JSON.parse(await readFile(path.resolve(evidencePath),'utf8')).verified : [];
    if (!Array.isArray(supplied)) throw new Error('无效的外部核验记录');
    const recent=new Map([...(previousAudit.verified??[]),...supplied].map(v=>[v.url,v]));
    await Promise.all(Array.from({length:4},async()=>{while(cursor<checks.length){
      const item=checks[cursor++];
      const url=`https://raw.githubusercontent.com/${item.repository}/${item.commit}/${item.file.path.split('/').map(encodeURIComponent).join('/')}`;
      const prior=recent.get(item.file.url);
      if(isRecentEvidence(prior,item.file))verified.push(prior);
      else {const response=await request(url,{method:'HEAD'});verified.push({url:item.file.url,blobSha:item.file.blobSha,status:response.status,checkedAt});}
      done++; if(done%20===0 || done===checks.length)console.log(`已验证 ${done}/${checks.length} 个原始文件链接`);
    }}));
    const out=path.join(root,'dist/data');await mkdir(out,{recursive:true});
    const manifest={schemaVersion:1,updatedAt:checkedAt,paperCount:catalog.papers.length,schools:[]};
    // Versioned data files are immutable. Only the final manifest rename makes a new index visible.
    for(const school of catalog.schools){const data=indexes.get(school.id);const payload=JSON.stringify(data,null,2)+'\n';const filename=`${school.id}-${contentHash(payload)}.json`;
      await writeFile(path.join(out,filename),payload);
      manifest.schools.push({...school,paperCount:data.papers.length,courseCount:data.courses.length,dataUrl:`./data/${filename}`});
    }
    await writeFile(path.join(cache,'link-audit.json'),JSON.stringify({checkedAt,verified},null,2));
    const temporary=path.join(out,`manifest.${process.pid}.tmp`);
    await writeFile(temporary,JSON.stringify(manifest,null,2)+'\n');
    await rename(temporary,path.join(out,'manifest.json'));
    console.log(`完成：${manifest.schools.length} 所大学，${manifest.paperCount} 份试卷，${checks.length} 个文件链接。`);
  }
}catch(error){console.error(`更新失败，线上索引保持原样：${error.message}`);process.exitCode=1;}
