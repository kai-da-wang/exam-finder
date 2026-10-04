import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,resolveSchool,matchingSchools,matchingCourses,filterPapers,sourceUrl,escapeHtml} from '../dist/search.js';
const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
test('学校全称、中文简称与英文缩写一致',()=>{
  for(const s of catalog.schools)for(const alias of [s.name,s.shortName,...s.aliases])assert.equal(resolveSchool(catalog.schools,alias)?.id,s.id);
  assert.equal(resolveSchool(catalog.schools,'某未知大学'),null);
});
test('全半角与空格归一化不删除课程版本',()=>{
  assert.equal(normalize('微积分Ａ（１）'),normalize(' 微积分A(1) '));
  assert.notEqual(normalize('微积分A(1)'),normalize('微积分A(2)'));
  assert.notEqual(normalize('物理化学（甲）'),normalize('物理化学（乙）'));
});
test('优先精确课程名；多个版本要求选择，不直接合并',()=>{
  const courses=[{name:'物理化学',aliases:[]},{name:'物理化学（甲）',aliases:[]},{name:'微积分A(1)',aliases:[]},{name:'微积分A(2)',aliases:[]}];
  assert.deepEqual(matchingCourses(courses,'物理化学').map(c=>c.name),['物理化学']);
  assert.equal(matchingCourses(courses,'微积分').length,2);
  assert.equal(matchingCourses(courses,'微积分A（1）').length,1);
  assert.equal(matchingCourses(courses,'不存在').length,0);
});
test('课程、年份和资料类型组合筛选，未知年份排在最后',()=>{
  const papers=[{id:'1',course:'A',year:2020,yearLabel:'2020',type:'original'},{id:'2',course:'A',year:2022,yearLabel:'2021–2022 学年',type:'recalled'},{id:'3',course:'A',year:null,yearLabel:'年份未注明',type:'original'},{id:'4',course:'B',year:2025,yearLabel:'2025',type:'original'}];
  assert.deepEqual(filterPapers(papers,'A').map(p=>p.id),['2','1','3']);
  assert.deepEqual(filterPapers(papers,'A',{type:'recalled',year:'2021–2022 学年'}).map(p=>p.id),['2']);
  assert.deepEqual(filterPapers(papers,'A',{year:'unknown'}).map(p=>p.id),['3']);
  assert.equal(filterPapers(papers,'A',{type:'original',year:'2021–2022 学年'}).length,0);
});
test('外部标题转义，链接仅允许 HTTPS GitHub',()=>{
  assert.equal(sourceUrl('javascript:alert(1)'),'#');assert.equal(sourceUrl('https://example.com'),'#');
  assert.equal(sourceUrl('https://github.com/lib-pku/libpku'),'https://github.com/lib-pku/libpku');
  assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});
test('学校或校区名称不完整时提供候选，重名简称不自动选第一项',()=>{
 const schools=[{id:'a',name:'甲大学（深圳）',shortName:'甲大深圳',aliases:['甲大']},{id:'b',name:'甲大学（本部）',shortName:'甲大本部',aliases:['甲大']}];
 assert.equal(resolveSchool(schools,'甲大'),null);assert.equal(matchingSchools(schools,'甲大').length,2);
 assert.equal(resolveSchool(schools,'甲大学'),null);assert.equal(matchingSchools(schools,'甲大学').length,2);
 assert.equal(resolveSchool(schools,'甲大学(深圳)').id,'a');
});
