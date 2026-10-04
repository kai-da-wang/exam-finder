export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
}
export function resolveSchool(schools, query) {
  const key = normalize(query);
  const matches = schools.filter(s => [s.name, s.shortName, s.id, ...s.aliases].some(v => normalize(v) === key));
  return matches.length === 1 ? matches[0] : null;
}
export function matchingSchools(schools, query) {
  const key = normalize(query);
  if (!key) return [];
  const exact = schools.filter(s => [s.name, s.shortName, s.id, ...s.aliases].some(v => normalize(v) === key));
  return exact.length ? exact : schools.filter(s => [s.name, s.shortName, ...s.aliases].some(v => normalize(v).includes(key)));
}
export function matchingCourses(courses, query) {
  const key = normalize(query);
  if (!key) return [];
  const exact = courses.filter(c => [c.name, ...c.aliases].some(v => normalize(v) === key));
  if (exact.length) return exact;
  return courses.filter(c => [c.name, ...c.aliases].some(v => normalize(v).includes(key)));
}
export function filterPapers(papers, course, { type = 'all', year = 'all' } = {}) {
  return papers.filter(p => p.course === course && (type === 'all' || p.type === type)
    && (year === 'all' || (year === 'unknown' ? p.year === null : p.yearLabel === year)))
    .sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || a.id.localeCompare(b.id));
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function sourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : '#'; } catch { return '#'; }
}
