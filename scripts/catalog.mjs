import { createHash } from 'node:crypto';
export const excluded = /期中|模拟|样题|样卷|练习|习题|复习|作业|课件|讲义|题库|考前|考试说明|midterm|mock|practice|project/i;
export function inferCourse(school, filePath) {
  const parts = filePath.split('/');
  const id = typeof school === 'string' ? school : school.id;
  const index = typeof school === 'object' && Number.isInteger(school.coursePathIndex) ? school.coursePathIndex : ['pku','thu','hitsz'].includes(id) ? 1 : 0;
  return parts[index] ?? '';
}
export function isCandidate(filePath) {
  return /\.(pdf|docx?|png|jpe?g|md|txt)$/i.test(filePath) && /期末|final|回忆版/i.test(filePath) && !excluded.test(filePath);
}
export function contentHash(value) { return createHash('sha256').update(value).digest('hex').slice(0,16); }
// Some genuine past papers are stored inside a revision folder. Permit only
// individually reviewed, unchanged files; never waive a mock/midterm filename.
export function isReviewedExamPath(filePath, paper, blobSha) {
  if (!excluded.test(filePath)) return true;
  const parts = filePath.split('/');
  const withoutRevisionFolder = parts.map((part, i) => i < parts.length - 1 ? part.replace(/复习/g, '') : part).join('/');
  if (excluded.test(withoutRevisionFolder)) return false;
  return (paper.reviewedPaths ?? []).some(r => r.path === filePath && r.blobSha === blobSha && typeof r.reason === 'string' && r.reason.trim().length >= 12);
}
export function fileRecord(repository, commit, filePath, blob) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');
  return { name: filePath.split('/').at(-1), path: filePath, format: filePath.split('.').at(-1).toUpperCase(),
    url: `https://github.com/${repository}/blob/${commit}/${encoded}`, blobSha: blob.sha };
}
export function buildIndex(catalog, snapshots, reviewed, checkedAt) {
  const ids = new Set();
  const indexes = new Map();
  if (!catalog.schools.length || !catalog.papers.length) throw new Error('拒绝发布空索引');
  for (const school of catalog.schools) {
    const snapshot = snapshots.get(school.repository);
    if (!snapshot?.tree?.length || snapshot.truncated || !/^[a-f0-9]{40}$/.test(snapshot.commit ?? '')) throw new Error(`${school.name}：目录快照不完整或缺少提交编号`);
    const files = new Map(snapshot.tree.filter(f => f.type === 'blob').map(f => [f.path, f]));
    const papers = catalog.papers.filter(p => p.school === school.id).map(p => {
      if (ids.has(p.id)) throw new Error(`重复记录：${p.id}`); ids.add(p.id);
      if (!p.course || !p.files.length || !['original','recalled'].includes(p.type)) throw new Error(`无效记录：${p.id}`);
      if (p.year !== null && (!Number.isInteger(p.year) || p.year < 1900 || p.year > new Date(checkedAt).getFullYear() + 1)) throw new Error(`无效年份：${p.id}`);
      if (p.year === null && p.yearLabel !== '年份未注明') throw new Error(`未知年份标注错误：${p.id}`);
      for (const path of [...p.files, ...p.answers]) {
        if (!isReviewedExamPath(path, p, files.get(path)?.sha)) throw new Error(`发现非目标资料：${path}`);
        if (!files.has(path)) throw new Error(`来源文件已移除，需审核目录后再更新：${path}`);
        if (files.get(path).size !== undefined && files.get(path).size < 32) throw new Error(`来源文件为空或损坏：${path}`);
        if (files.get(path).sha !== reviewed[school.repository + '/' + path]) throw new Error(`内容发生变化或尚未审核：${path}`);
      }
      const convert = path => fileRecord(school.repository, snapshot.commit, path, files.get(path));
      const title = p.files.every(f => /\.(png|jpe?g)$/i.test(f)) && p.files.length > 1 ? `${p.course} ${p.yearLabel}期末试卷（${p.files.length}页）` : p.files[0].split('/').at(-1).replace(/\.[^.]+$/, '');
      return { id:p.id, school:school.id, course:p.course, aliases:p.aliases, originalTitle:title,
        year:p.year, yearLabel:p.yearLabel, term:p.term ?? '', type:p.type, files:p.files.map(convert), answers:p.answers.map(convert),
        answerIncluded:p.answerIncluded, answerNote:p.answerNote ?? '', note:p.note ?? '', verifiedAt:checkedAt,
        source:{repository:school.repository, repositoryUrl:`https://github.com/${school.repository}`, title:school.sourceTitle, commit:snapshot.commit} };
    });
    if (!papers.length) throw new Error(`${school.name}无有效试卷，保留旧索引`);
    const courses = [...new Set(papers.map(p => p.course))].map(name => ({name, aliases:[...new Set(papers.filter(p=>p.course===name).flatMap(p=>p.aliases))], paperCount:papers.filter(p=>p.course===name).length})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
    indexes.set(school.id,{schemaVersion:1,updatedAt:checkedAt,school,courses,papers});
  }
  if (ids.size !== catalog.papers.length) throw new Error('存在未配置学校的记录');
  return indexes;
}
