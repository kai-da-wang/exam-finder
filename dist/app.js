import { resolveSchool, matchingSchools, matchingCourses, filterPapers, escapeHtml as e, sourceUrl } from './search.js';
const $ = id => document.getElementById(id);
const state = { manifest: null, school: null, data: null, course: null, type: 'all', year: 'all', request: 0, cache: new Map() };
const icon = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M4 2h10l6 6v18H4zM14 2v7h6M8 15h8M8 19h6"/></svg>';
const link = (url, title, label) => `<a href="${e(sourceUrl(url))}" target="_blank" rel="noopener noreferrer" title="${e(title)}">${e(label)}</a>`;

async function getJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function status(message, error = false) { $('input-status').textContent = message; $('input-status').classList.toggle('error', error); }
function empty(title, description, retry = false) {
  $('results').innerHTML = `<div class="empty-state"><div class="empty-mark" aria-hidden="true">⌕</div><h3>${e(title)}</h3><p>${e(description)}</p>${retry ? '<button class="retry" type="button" id="retry-data">重新加载</button>' : ''}</div>`;
  if (retry) $('retry-data').addEventListener('click', () => state.manifest ? chooseSchool($('school').value) : initialize());
}
function resetResults() {
  state.course = null; state.type = 'all'; state.year = 'all';
  $('filters').hidden = true; $('sort-label').hidden = true;
  $('results-heading').textContent = '从一门课开始';
  $('result-summary').textContent = '选择左侧课程，或在上方输入课程名称。';
  document.querySelectorAll('[data-type]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === 'all')));
}
async function chooseSchool(query) {
  const request = ++state.request;
  const school = resolveSchool(state.manifest?.schools ?? [], query);
  state.school = school; state.data = null;
  resetResults();
  $('course').value = ''; $('course').disabled = true; $('search-button').disabled = true;
  $('course-options').replaceChildren(); $('course-chips').replaceChildren();
  document.querySelectorAll('.shortcut').forEach(b => { const active = b.dataset.school === school?.id; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
  $('selected-school').textContent = school?.name ?? '选择一所大学';
  $('course-count').textContent = school ? '正在读取课程…' : '查看已收录的课程与年份';
  document.querySelector('.results-section').setAttribute('aria-busy', String(!!school));
  if (!school) {
    const suggestions = matchingSchools(state.manifest?.schools ?? [], query);
    const count = state.manifest?.schools.length ?? 0;
    status(suggestions.length ? '请确认具体学校或校区，再选择课程。' : query.trim() ? '这所学校暂未收录。请选择已收录的学校。' : '先输入大学名称，或点击上方学校快捷入口。', !!query.trim() && !suggestions.length);
    empty(suggestions.length ? '选择具体学校或校区' : query.trim() ? '这所大学暂未收录' : '先选一所大学', suggestions.length ? '试卷按学校与校区分别整理，不自动混用。' : `当前收录 ${count} 所高校及校区的部分课程，可从上方学校入口选择。`);
    if (suggestions.length) {
      const choices = document.createElement('div'); choices.className = 'school-suggestions';
      for (const s of suggestions) { const button = document.createElement('button'); button.type = 'button'; button.className = 'shortcut'; button.textContent = s.name; button.addEventListener('click', async () => { $('school').value = s.name; if (await chooseSchool(s.name)) $('course').focus(); }); choices.append(button); }
      $('results').append(choices);
    }
    return false;
  }
  status(`正在加载${school.name}的课程资料…`);
  $('results').innerHTML = '<div class="skeleton" aria-label="正在加载"></div><div class="skeleton"></div>';
  try {
    let data = state.cache.get(school.id);
    if (!data) {
      data = await getJSON(school.dataUrl);
      if (data.school.id !== school.id || !Array.isArray(data.papers) || !Array.isArray(data.courses)) throw new Error('索引内容不匹配');
      state.cache.set(school.id, data);
    }
    if (request !== state.request) return false;
    state.data = data;
    $('course').disabled = false; $('search-button').disabled = false;
    $('course').placeholder = `例如：${data.courses[0]?.name ?? '课程名称'}`;
    $('course-options').innerHTML = data.courses.map(c => `<option value="${e(c.name)}"></option>`).join('');
    $('course-count').textContent = `${data.courses.length} 门课程 · ${data.papers.length} 份试卷`;
    $('course-chips').innerHTML = data.courses.map(c => `<button class="course-chip" type="button" data-course="${e(c.name)}"><span>${e(c.name)}</span><small>${c.paperCount}</small></button>`).join('');
    $('course-chips').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('course').value = b.dataset.course; runSearch(); }));
    status(`已加载${school.name}。输入课程名，或直接选择下方已收录课程。`);
    empty('选一门课，看看往年的考题。', '课程版本分别收录，原卷与回忆版会明确标注。');
    return true;
  } catch {
    if (request !== state.request) return false;
    status('课程资料加载失败，请检查网络后重新加载。', true);
    $('course-count').textContent = '资料加载失败';
    empty('资料暂时加载不出来', '请稍后重试；这不代表该校没有收录试卷。', true);
    return false;
  } finally { if (request === state.request) document.querySelector('.results-section').setAttribute('aria-busy', 'false'); }
}
function runSearch() {
  if (!state.data || !state.school) return { ok: false, error: '请先选择已收录的学校。' };
  resetResults();
  const query = $('course').value.trim();
  const courses = matchingCourses(state.data.courses, query);
  if (courses.length !== 1) {
    $('results-heading').textContent = query || '输入课程名称';
    $('result-summary').textContent = `${state.school.name} · ${courses.length ? '请选择具体课程版本' : '暂无匹配课程'}`;
    empty(courses.length ? '找到多个课程版本' : '这门课暂未收录', courses.length ? '请选择下方的具体课程，试卷不会跨课程版本合并。' : '试试左侧已收录课程，或检查课程全称。暂未收录不代表不存在试卷。');
    if (courses.length) {
      const choices = document.createElement('div'); choices.className = 'school-shortcuts';
      for (const c of courses) { const button = document.createElement('button'); button.type = 'button'; button.className = 'shortcut'; button.textContent = c.name; button.addEventListener('click', () => { $('course').value = c.name; runSearch(); }); choices.append(button); }
      $('results').append(choices);
    }
    document.querySelectorAll('.course-chip').forEach(b => b.classList.remove('active'));
    status(courses.length ? '请区分课程的上下册、A/B 或甲乙版本。' : '没有找到这门课的索引，可以从已收录课程中选择。');
    return { ok: false, error: courses.length ? '需要选择课程版本。' : '课程未收录。', candidates: courses.map(c => c.name) };
  }
  state.course = courses[0].name; $('course').value = state.course;
  const papers = filterPapers(state.data.papers, state.course);
  const years = [...new Set(papers.filter(p => p.year !== null).map(p => p.yearLabel))];
  $('year').innerHTML = '<option value="all">全部年份</option>' + years.map(y => `<option value="${e(y)}">${e(y)}</option>`).join('') + (papers.some(p => p.year === null) ? '<option value="unknown">年份未注明</option>' : '');
  $('filters').hidden = false; $('sort-label').hidden = false;
  document.querySelectorAll('.course-chip').forEach(b => b.classList.toggle('active', b.dataset.course === state.course));
  const url = new URL(location.href); url.search = new URLSearchParams({ school: state.school.id, course: state.course }).toString(); history.replaceState(null, '', url);
  status('资料按来源标注整理；原始文件在来源网站打开，参考答案请自行核对。');
  renderPapers();
  return { ok: true, school: state.school.name, course: state.course, count: papers.length };
}
function renderPapers() {
  if (!state.course) return;
  const all = filterPapers(state.data.papers, state.course);
  const papers = filterPapers(state.data.papers, state.course, state);
  $('results-heading').textContent = state.course;
  $('result-summary').textContent = `${state.school.name} · 找到 ${papers.length} 份试卷${papers.length !== all.length ? `，该课程共收录 ${all.length} 份` : ''}`;
  if (!papers.length) { empty('当前筛选条件下没有试卷', '可以切换资料类型，或将年份改为“全部年份”。'); return; }
  $('results').innerHTML = papers.map(p => {
    const formats = [...new Set(p.files.map(f => f.format))].join(' / ');
    const hasAnswer = p.answerIncluded || p.answers.length > 0;
    const fileLinks = p.files.length > 1 ? `<details class="files-details"><summary>${p.files.every(f => /JPG|PNG|JPEG/.test(f.format)) ? `查看全部 ${p.files.length} 页` : `查看 ${p.files.length} 个文件版本`}</summary><div class="files-list">${p.files.map((f, i) => link(f.url, f.name, `文件 ${i + 1} · ${f.format}`)).join('')}</div></details>` : '';
    return `<article class="paper-card"><div class="paper-icon">${icon}</div><div class="paper-body"><div class="paper-top"><span class="paper-year">${e(p.yearLabel)}${p.term ? ' · ' + e(p.term) : ''}</span><span class="badge ${p.type === 'recalled' ? 'recalled' : ''}">${p.type === 'recalled' ? '回忆版' : '原卷'}</span>${hasAnswer ? '<span class="badge answer">附参考答案</span>' : ''}</div><h3>${e(p.course)} · 期末${p.type === 'recalled' ? '回忆卷' : '试卷'}</h3><p class="paper-original">${e(p.originalTitle)}</p><div class="paper-bottom"><span class="paper-meta">${e(formats)} · 来源：${link(p.source.repositoryUrl, p.source.title, state.school.shortName + '课程资料')}</span><div class="paper-actions">${p.answers.map(f => link(f.url, f.name, '参考答案')).join('')}${link(p.files[0].url, p.files[0].name, '查看试卷 ↗')}</div></div>${p.note ? `<p class="paper-note">${e(p.note)}</p>` : ''}${p.answerNote ? `<p class="answer-note">${e(p.answerNote)}</p>` : ''}${fileLinks}</div></article>`;
  }).join('');
}
async function searchFromInput(schoolName, courseName) {
  $('school').value = schoolName;
  if (!await chooseSchool(schoolName)) throw new Error('学校未收录或资料加载失败。');
  $('course').value = courseName;
  return runSearch();
}
async function initialize() {
  try {
    const manifest = await getJSON('./data/manifest.json');
    if (!Array.isArray(manifest.schools) || !manifest.schools.length) throw new Error('无效索引');
    state.manifest = manifest;
    $('school-count').textContent = manifest.schools.length;
    $('paper-count').textContent = manifest.paperCount;
    $('updated-at').textContent = `索引更新于 ${new Date(manifest.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    $('school-options').innerHTML = manifest.schools.map(s => `<option value="${e(s.name)}">${e(s.shortName)}</option>`).join('');
    $('school-shortcuts').innerHTML = manifest.schools.map(s => `<button type="button" class="shortcut" data-school="${e(s.id)}" aria-pressed="false">${e(s.name)}</button>`).join('');
    $('school-shortcuts').querySelectorAll('button').forEach(b => b.addEventListener('click', async () => { const s = manifest.schools.find(s => s.id === b.dataset.school); $('school').value = s.name; if (await chooseSchool(s.name)) $('course').focus(); }));
    $('source-links').innerHTML = manifest.schools.map(s => `<a href="https://github.com/${e(s.repository)}" target="_blank" rel="noopener noreferrer">${e(s.sourceTitle)} ↗<small>${e(s.repository)}</small></a>`).join('');
    const params = new URLSearchParams(location.search);
    if (params.has('school')) {
      const school = resolveSchool(manifest.schools, params.get('school'));
      await searchFromInput(school?.name ?? params.get('school'), params.get('course') ?? '');
    } else await searchFromInput('浙江大学', '电磁场与电磁波');
  } catch (error) {
    if (state.manifest) return;
    status('学校索引加载失败，请检查网络后重新加载。', true);
    $('updated-at').textContent = '索引暂不可用';
    empty('学校列表暂时加载不出来', '请检查网络连接后重试。', true);
  }
}
$('school').addEventListener('input', () => chooseSchool($('school').value));
$('search-form').addEventListener('submit', event => { event.preventDefault(); runSearch(); });
$('year').addEventListener('change', () => { state.year = $('year').value; renderPapers(); });
document.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { state.type = b.dataset.type; document.querySelectorAll('[data-type]').forEach(el => el.setAttribute('aria-pressed', String(el === b))); renderPapers(); }));
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  try { Promise.resolve(context.registerTool({
    name: 'search_exam_archive', title: '查找高校期末试卷',
    description: '在页面中选择学校和具体课程并显示已收录的试卷；不会下载文件。',
    inputSchema: { type: 'object', properties: { school: { type: 'string' }, course: { type: 'string' } }, required: ['school', 'course'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute(input) {
      if (!input || typeof input.school !== 'string' || typeof input.course !== 'string' || !input.school.trim() || !input.course.trim() || Object.keys(input).some(k => !['school', 'course'].includes(k))) throw new Error('需要非空的学校和课程名称。');
      if (!state.manifest) throw new Error('学校索引尚未加载，请稍后重试。');
      return searchFromInput(input.school, input.course);
    }
  }, { signal: lifecycle.signal })).catch(() => {}); } catch {}
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
initialize();
