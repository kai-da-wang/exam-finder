import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {escapeHtml as e} from '../dist/search.js';
const root=new URL('../',import.meta.url);
const report=JSON.parse(await readFile(new URL('data/jiangsu-requested-review.json',root),'utf8'));
const catalog=JSON.parse(await readFile(new URL('data/catalog.json',root),'utf8'));
const added=report.schools.filter(s=>s.status==='added');
assert.equal(new Set(report.schools.map(s=>s.name)).size,report.schools.length);
for(const s of added)assert(catalog.schools.some(c=>c.id===s.schoolId&&c.name===s.name));
const records=catalog.papers.filter(p=>added.some(s=>s.schoolId===p.school));
const date=new Date(report.checkedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});
const cities=[...new Set(report.schools.map(s=>s.city))];
const body=cities.map(city=>`<section class="coverage-city" aria-labelledby="city-${e(city)}"><h2 id="city-${e(city)}">${e(city)}</h2><div class="coverage-grid">${report.schools.filter(s=>s.city===city).map(s=>{
 const courses=[...new Set(records.filter(p=>p.school===s.schoolId).map(p=>p.course))];
 return `<article class="coverage-card"><div class="coverage-card-title"><h3>${e(s.name)}</h3><span class="badge ${s.status==='added'?'answer':'recalled'}">${s.status==='added'?'已收录':'待核实'}</span></div><p>${e(s.note)}</p>${courses.map(c=>`<a class="coverage-course" href="./?${e(new URLSearchParams({school:s.schoolId,course:c}).toString())}">查看 ${e(c)} ↗</a>`).join('')}</article>`;
 }).join('')}</div></section>`).join('');
const html=`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#185adb"><title>江苏高校收录进度 · 期末档案</title><link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./styles.css"></head>
<body><a class="skip-link" href="#coverage-title">跳转到收录进度</a><header class="site-header"><div class="header-inner"><a class="brand" href="./"><img src="./favicon.svg" alt="" width="36" height="36"><span>期末档案<small>UNIVERSITY EXAM ARCHIVE</small></span></a><a class="source-nav" href="./">返回搜索 ↗</a></div></header>
<main class="coverage-main"><section class="search-section"><div class="eyebrow"><span class="eyebrow-line"></span> 江苏高校资料整理</div><h1 id="coverage-title">每一所学校，<span>都有查找记录。</span></h1><p class="intro">本批指定 ${report.schools.length} 所学校，已收录 ${added.length} 所、${records.length} 条试卷资料；其余 ${report.schools.length-added.length} 所仍待核实。</p><p class="muted">检索日期：${e(date)}。未收录不代表没有试卷；以下仅说明本轮找到并核验的范围。</p><p class="coverage-method">只有能核对学校、课程和期末性质，并确认可公开访问的资料才加入搜索。模板、模拟题、考研试卷、仅有标题或无法打开核验的线索暂不收录。A/B卷合并在同一文件时计为一条资料。</p></section>${body}</main><footer><span>仅保存资料索引与来源链接，试卷文件由原始来源提供。</span><a href="./">返回试卷搜索</a></footer></body></html>
`;
await writeFile(new URL('dist/coverage.html',root),html);
console.log(`收录进度页：${report.schools.length} 校，已收录 ${added.length} 校、${records.length} 条资料。`);
