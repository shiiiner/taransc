'use strict';
const $ = id => document.getElementById(id);
const state = {words: [], cues: [], warnings: [], media: null, url: null, selected: 0, stopAt: null};
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f = n => Number.isFinite(n) ? n.toFixed(3) : '—';
const clock = n => { if (!Number.isFinite(n)) return '00:00.000'; let m = Math.floor(n / 60); return `${String(m).padStart(2,'0')}:${(n-m*60).toFixed(3).padStart(6,'0')}`; };
function message(text, error = false, target = 'message') { const el = $(target); el.textContent = text; el.className = `message ${error ? 'error' : 'success'}`; }
async function post(path, data) {
  const response = await fetch(path, {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'خطا در پردازش درخواست');
  return result;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], {type})); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function baseName() { return ($('media-file').files[0]?.name || 'captions').replace(/\.[^.]+$/, ''); }
function activeMedia() { return state.media; }
function seek(time, end = null) {
  const media = activeMedia(); if (!media) return;
  state.stopAt = end; media.currentTime = Math.max(0, time); media.play().catch(() => message('پخش رسانه ممکن نیست؛ فرمت فایل را بررسی کنید.', true));
}
function applyMetadata(file) {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name);
  const video = $('video'), audio = $('audio');
  video.pause(); audio.pause(); video.removeAttribute('src'); audio.removeAttribute('src');
  $('video').classList.toggle('hidden', !isVideo); $('audio-art').classList.toggle('hidden', isVideo);
  state.media = isVideo ? video : audio;
  state.media.src = state.url; state.media.load();
  $('media-name').textContent = file.name;
}
$('import').onclick = async () => {
  const media = $('media-file').files[0], wordFile = $('words-file').files[0], sentenceFile = $('sentences-file').files[0];
  if (!media || !wordFile) return message('فایل رسانه و SRT کلمه‌ای را انتخاب کنید.', true, 'setup-message');
  $('import').disabled = true;
  try {
    const result = await post('/api/import', {wordSrt: await wordFile.text(), sentenceSrt: sentenceFile ? await sentenceFile.text() : ''});
    Object.assign(state, {words: result.words, cues: result.cues, warnings: result.warnings, selected:0, stopAt:null});
    applyMetadata(media);
    $('setup').classList.add('hidden'); $('workspace').classList.remove('hidden');
    $('message').className = 'message hidden';
    render();
  } catch (err) { message(err.message, true, 'setup-message'); }
  finally { $('import').disabled = false; }
};
$('new-project').onclick = () => {
  if (!confirm('پروژه فعلی بسته شود؟ ابتدا خروجی‌های خود را ذخیره کنید.')) return;
  state.media?.pause(); if (state.url) URL.revokeObjectURL(state.url); state.url = null;
  $('workspace').classList.add('hidden'); $('setup').classList.remove('hidden');
};
function getText(cue) { return cue.map(i => state.words[i].text).join(' '); }
function render() {
  $('warnings').innerHTML = state.warnings.map(w => `<div class="warning">⚠ ${escapeHtml(w)}</div>`).join('');
  $('count').textContent = `${state.cues.length} جمله · ${state.words.length} کلمه`;
  const limitWords = Number($('max-words').value) || 7, limitChars = Number($('max-chars').value) || 42;
  $('cues').innerHTML = state.cues.map((cue, ci) => {
    const text = getText(cue), long = cue.length > limitWords || [...text].length > limitChars;
    const first = state.words[cue[0]], last = state.words[cue[cue.length-1]];
    return `<article class="cue ${state.selected === ci ? 'active' : ''} ${long ? 'long' : ''}" data-cue="${ci}">
      <div class="cue-head"><span class="cue-number">جمله ${ci+1}</span><span class="cue-time">${f(first.start)} → ${f(last.end)} s</span><span class="spacer"></span>
      <button class="mini" data-action="play-cue" data-ci="${ci}">▶ پخش</button><button class="mini" data-action="merge" data-ci="${ci}" ${ci === state.cues.length-1 ? 'disabled' : ''}>ادغام با بعدی</button></div>
      <div class="cue-text">${escapeHtml(text)}</div><div class="metrics ${long ? 'long' : ''}">${cue.length} کلمه · ${[...text].length} نویسه${long ? ' · طولانی‌تر از حد پیشنهادی' : ''}</div>
      <div class="word-list">${cue.map((id, pos) => {
        const w = state.words[id];
        return `<div class="word-row ${escapeHtml(w.status || '')}">
        <input class="word-text" data-field="text" data-id="${id}" value="${escapeHtml(w.text)}" aria-label="متن کلمه ${id+1}">
        <input type="number" step="0.001" min="0" data-field="start" data-id="${id}" value="${f(w.start)}" title="شروع به ثانیه" aria-label="زمان شروع">
        <input type="number" step="0.001" min="0" data-field="end" data-id="${id}" value="${f(w.end)}" title="پایان به ثانیه" aria-label="زمان پایان">
        <button class="mini" data-action="play-word" data-id="${id}" title="پخش کلمه">▶</button>
        <button class="mini" data-action="split" data-ci="${ci}" data-pos="${pos}" ${pos === cue.length-1 ? 'disabled' : ''} title="تقسیم بعد از این کلمه">✂</button>
        <button class="mini" data-action="delete" data-id="${id}" title="حذف کلمه">×</button>
        ${w.status === 'different' && w.suggestion ? `<div class="suggestion">متن جمله‌ای: ${escapeHtml(w.suggestion)} <button class="mini" data-action="suggestion" data-id="${id}">اعمال پیشنهاد</button></div>` : w.status === 'extra' ? '<div class="suggestion">این کلمه در متن جمله‌ای تطبیق داده نشد؛ بررسی کنید.</div>' : ''}</div>`;
      }).join('')}</div><button class="mini" data-action="add" data-ci="${ci}" style="margin-top:10px">＋ افزودن کلمه با زمان دستی</button></article>`;
  }).join('');
  updatePreview();
}
$('cues').addEventListener('change', e => {
  const input = e.target, id = Number(input.dataset.id), field = input.dataset.field;
  if (!field || !state.words[id]) return;
  state.words[id][field] = field === 'text' ? input.value.trim() : (input.value === '' ? null : Number(input.value));
  if (field === 'text') state.words[id].status = 'normal';
  render();
});
$('cues').addEventListener('click', e => {
  const article = e.target.closest('[data-cue]'); if (article) { state.selected = Number(article.dataset.cue); document.querySelectorAll('.cue').forEach(el => el.classList.toggle('active', el === article)); }
  const b = e.target.closest('button[data-action]'); if (!b) { updatePreview(); return; }
  const action = b.dataset.action, id = Number(b.dataset.id), ci = Number(b.dataset.ci), pos = Number(b.dataset.pos);
  if (action === 'play-word') { const w = state.words[id]; seek(w.start, w.end); }
  if (action === 'play-cue') { const cue = state.cues[ci]; seek(state.words[cue[0]].start, $('loop').checked ? null : state.words[cue.at(-1)].end); }
  if (action === 'split') { const cue = state.cues[ci]; state.cues.splice(ci, 1, cue.slice(0,pos+1), cue.slice(pos+1)); }
  if (action === 'merge' && state.cues[ci+1]) { state.cues.splice(ci, 2, state.cues[ci].concat(state.cues[ci+1])); }
  if (action === 'suggestion') { state.words[id].text = state.words[id].suggestion; state.words[id].status = 'normal'; }
  if (action === 'delete' && confirm(`کلمه «${state.words[id].text}» حذف شود؟`)) {
    state.words.splice(id,1); state.words.forEach((w,i)=>w.id=i);
    state.cues = state.cues.map(c=>c.filter(x=>x!==id).map(x=>x>id?x-1:x)).filter(c=>c.length);
    state.selected = Math.max(0,Math.min(state.selected,state.cues.length-1));
  }
  if (action === 'add') {
    const text = prompt('کلمه جدید (فقط یک کلمه):'); if (text === null) return;
    const start = prompt('زمان شروع به ثانیه، بر اساس صدا:'); if (start === null) return;
    const end = prompt('زمان پایان به ثانیه، بر اساس صدا:'); if (end === null) return;
    const s = Number(start), e = Number(end);
    if (text.trim().split(/\s+/).length !== 1 || !text.trim() || !start.trim() || !end.trim() || !Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e <= s) { message('کلمه و زمان‌های معتبر وارد کنید.', true); return; }
    const insert = state.cues[ci].at(-1)+1;
    state.words.splice(insert, 0, {id:insert, text:text.trim(), start:s, end:e, status:'normal', suggestion:''});
    state.words.forEach((w,i)=>w.id=i);
    state.cues = state.cues.map((c,i) => { const out = c.map(x=>x>=insert?x+1:x); if(i===ci) out.push(insert); return out; });
    message('کلمه اضافه شد. ترتیب و زمان آن را بررسی کنید.');
  }
  render();
});
function updatePreview() {
  const media = activeMedia(); if (!media) return;
  const time = media.currentTime || 0;
  if (state.stopAt !== null && time >= state.stopAt) { media.pause(); state.stopAt = null; }
  if ($('loop').checked && state.cues[state.selected] && !media.paused) {
    const cue = state.cues[state.selected], start = state.words[cue[0]].start, end = state.words[cue.at(-1)].end;
    if (time >= end) { media.currentTime = start; state.stopAt = null; }
  }
  const index = state.cues.findIndex(cue => time >= state.words[cue[0]].start && time < Math.max(...cue.map(i=>state.words[i].end)));
  $('overlay').innerHTML = index < 0 ? '' : state.cues[index].map(i => { const w = state.words[i]; const active = time >= w.start && time < w.end; return `<span class="${active ? 'current-word' : ''}">${escapeHtml(w.text)}</span>`; }).join(' ');
  $('overlay').style.fontSize = `${$('font-size').value}px`;
  $('clock').textContent = `${clock(time)} / ${clock(media.duration)}`;
}
for (const id of ['video','audio']) {
  $(id).addEventListener('timeupdate', updatePreview);
  $(id).addEventListener('loadedmetadata', updatePreview);
  $(id).addEventListener('error', () => { if (state.media === $(id) && state.url) message('مرورگر نمی‌تواند این رسانه را باز کند. فایل را به MP4/H.264/AAC یا WAV تبدیل کنید.', true); });
}
for (const id of ['max-words','max-chars','font-size']) $(id).addEventListener('input', () => { $('font-label').textContent = `${$('font-size').value}px`; render(); });
async function doExport(format) {
  try {
    const duration = activeMedia()?.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw Error('مدت رسانه مشخص نیست؛ ابتدا مطمئن شوید فایل قابل پخش است.');
    const out = await post('/api/export', {words:state.words, cues:state.cues, duration});
    if (format === 'json') download(`${baseName()}_caption_studio.json`, JSON.stringify(out.json,null,2), 'application/json;charset=utf-8');
    else if (format === 'sentence') download(`${baseName()}_sentences.srt`, out.sentenceSrt, 'text/plain;charset=utf-8');
    else download(`${baseName()}_words.srt`, out.wordSrt, 'text/plain;charset=utf-8');
    message(out.warnings.length ? `فایل ذخیره شد. هشدار: ${out.warnings.join(' ')}` : 'فایل خروجی آماده شد.');
  } catch (err) { message(err.message, true); window.scrollTo({top:0,behavior:'smooth'}); }
}
$('export-json').onclick = () => doExport('json');
$('export-srt').onclick = () => doExport('sentence');
$('export-word-srt').onclick = () => doExport('word');
window.addEventListener('beforeunload', () => { if (state.url) URL.revokeObjectURL(state.url); });
