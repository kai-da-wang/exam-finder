import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex,inferCourse,isCandidate,fileRecord,isReviewedExamPath} from '../scripts/catalog.mjs';
const sha='a'.repeat(40),commit='b'.repeat(40),p='课程/exams/2020期末.pdf';
function fixture(){return {catalog:{schools:[{id:'zju',name:'浙江大学',repository:'o/r'}],papers:[{id:'1',school:'zju',course:'课程',aliases:[],type:'original',year:2020,yearLabel:'2020',files:[p],answers:[],answerIncluded:false}]},snapshots:new Map([['o/r',{sha,commit,truncated:false,tree:[{path:p,type:'blob',sha}]}]]),reviewed:{['o/r/'+p]:sha}};}
test('各校目录层级不同，但课程正确提取',()=>{assert.equal(inferCourse('zju','数据结构基础/考试/a.pdf'),'数据结构基础');assert.equal(inferCourse('pku','专业课/几何学/a.pdf'),'几何学');assert.equal(inferCourse('thu','大一上/微积分A(1)/exam/a.pdf'),'微积分A(1)');});
test('候选扫描排除模拟题、期中卷、样卷、课件和大作业',()=>{
  for(const p of ['期末/模拟试卷.pdf','期中/试卷.pdf','2020期末样题.pdf','期末复习课件.pdf','final-project.pdf','期末大作业.pdf','期末/考试说明.pdf'])assert.equal(isCandidate(p),false,p);
  assert.equal(isCandidate('课程/2019期末.pdf'),true);
});
test('链接使用提交编号，逐段编码中文、空格、括号与井号',()=>{
  const file=fileRecord('o/r',commit,'课程/试卷 A#1.pdf',{sha});
  assert.ok(file.url.includes('/blob/'+commit+'/'));assert.ok(file.url.endsWith('/%E8%AF%95%E5%8D%B7%20A%231.pdf'));
});
test('完整已审核快照可以生成索引',()=>{const f=fixture();const data=buildIndex(f.catalog,f.snapshots,f.reviewed,'2026-09-22T00:00:00Z').get('zju');assert.equal(data.papers.length,1);assert.equal(data.papers[0].source.commit,commit);});
test('来源丢失、内容变化、目录截断或空记录均拒绝替换索引',()=>{
  for(const mutate of [f=>f.snapshots.get('o/r').tree=[],f=>f.snapshots.get('o/r').truncated=true,f=>f.reviewed={},f=>f.catalog.papers=[],f=>f.snapshots.get('o/r').commit=undefined]){
    const f=fixture();mutate(f);assert.throws(()=>buildIndex(f.catalog,f.snapshots,f.reviewed,'2026-09-22T00:00:00Z'));
  }
});
test('跨学校记录、重复 ID 与伪造年份不会发布',()=>{
  for(const mutate of [f=>f.catalog.papers[0].school='thu',f=>f.catalog.papers.push({...f.catalog.papers[0]}),f=>f.catalog.papers[0].year=2099]){const f=fixture();mutate(f);assert.throws(()=>buildIndex(f.catalog,f.snapshots,f.reviewed,'2026-09-22T00:00:00Z'));}
});
test('复习目录中的真实试卷仅允许按路径、哈希和题面说明逐项放行',()=>{
  const path='操作系统/操作系统复习资料/2016-2017-1/试卷A.docx';
  const paper={reviewedPaths:[{path,blobSha:sha,reason:'卷头已核对学校、课程、学年及学期，正文为完整试卷。'}]};
  assert.equal(isCandidate(path),false);
  assert.equal(isReviewedExamPath(path,paper,sha),true);
  assert.equal(isReviewedExamPath(path,paper,'c'.repeat(40)),false);
  assert.equal(isReviewedExamPath(path,{},sha),false);
  for(const blocked of ['操作系统/复习资料/期末模拟卷.pdf','操作系统/期中/试卷A.pdf','操作系统/复习资料/期末复习.docx']){
    assert.equal(isReviewedExamPath(blocked,{reviewedPaths:[{path:blocked,blobSha:sha,reason:paper.reviewedPaths[0].reason}]},sha),false);
  }
});
