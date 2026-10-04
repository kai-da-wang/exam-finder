import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const file of ['dist/app.js','dist/search.js','scripts/update-data.mjs','scripts/catalog.mjs','scripts/serve.mjs'])execFileSync(process.execPath,['--check',file],{cwd:root});
const html=await readFile(path.join(root,'dist/index.html'),'utf8');
for(const file of ['favicon.svg','styles.css','app.js']){assert.ok(html.includes(file));await access(path.join(root,'dist',file));}
const manifest=JSON.parse(await readFile(path.join(root,'dist/data/manifest.json'),'utf8'));
const catalog=JSON.parse(await readFile(path.join(root,'data/catalog.json'),'utf8'));
assert.deepEqual(manifest.schools.map(s=>s.id).sort(),catalog.schools.map(s=>s.id).sort());
assert.equal(new Set(manifest.schools.map(s=>s.id)).size,manifest.schools.length);
let count=0;const ids=new Set();let multipleYears=false,recalled=false,unknown=false,multipage=false,answers=false;
for(const school of manifest.schools){
  const data=JSON.parse(await readFile(path.join(root,'dist',school.dataUrl),'utf8'));
  assert.equal(data.school.id,school.id);assert.ok(data.papers.length);assert.equal(data.papers.length,school.paperCount);
  for(const c of data.courses)if(new Set(data.papers.filter(p=>p.course===c.name).map(p=>p.year).filter(y=>y!==null)).size>1)multipleYears=true;
  for(const p of data.papers){
    assert.equal(p.school,school.id);assert.ok(!ids.has(p.id));ids.add(p.id);count++;
    recalled ||=p.type==='recalled';unknown ||=p.year===null;multipage ||=p.files.length>1;answers ||=p.answers.length>0;
    for(const f of [...p.files,...p.answers]){const url=new URL(f.url);assert.equal(url.hostname,'github.com');assert.ok(url.pathname.startsWith('/'+school.repository+'/blob/'+p.source.commit+'/'));assert.ok(f.blobSha);}
  }
}
assert.equal(count,manifest.paperCount);assert.ok(multipleYears&&recalled&&unknown&&multipage&&answers);
console.log(`检查通过：${manifest.schools.length} 所高校及校区，${count} 份试卷；多年份、回忆版、参考答案、未知年份及多页资料均已覆盖。`);
