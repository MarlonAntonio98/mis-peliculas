'use strict';
(() => {
if (window.top !== window.self) { document.documentElement.classList.add('framed'); return; }

const $ = s => document.querySelector(s);
const main = $('#main'), ov = $('#overlay');
const APP_VERSION = 2;
const API = 'https://api.themoviedb.org/3', IMG = 'https://image.tmdb.org/t/p/';
const WORDS = ['', 'Horrible', 'Muy mala', 'Mala', 'Floja', 'Regular', 'Aceptable', 'Buena', 'Muy buena', 'Excelente', 'Obra maestra'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const I = {plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="m15 6-6 6 6 6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',film:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M16 3v18M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
const NO_SPELL = 'autocomplete="off" autocorrect="off" spellcheck="false"';
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fmtD = s => { if (!s) return ''; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d).toLocaleDateString('es-SV', {day:'numeric', month:'long', year:'numeric'}); };
const hours = min => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };

/* ---------- Almacenamiento ---------- */
const DB = { db:null,
  open(){ return new Promise(res => { try { const r = indexedDB.open('mis-peliculas', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('movies', {keyPath:'id'}); d.createObjectStore('meta', {keyPath:'k'}); };
    r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false); } catch(e){ res(false); } }); },
  req(s, m, fn){ return new Promise((res, rej) => { try { const t = this.db.transaction(s, m), q = fn(t.objectStore(s)); let out;
    if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch(e){ rej(e); } }); },
  get(s,k){ return this.req(s,'readonly',o=>o.get(k)); },
  all(s){ return this.req(s,'readonly',o=>o.getAll()).then(r=>r||[]); },
  put(s,v){ return this.req(s,'readwrite',o=>o.put(v)); },
  del(s,k){ return this.req(s,'readwrite',o=>o.delete(k)); },
  clear(s){ return this.req(s,'readwrite',o=>o.clear()); } };

/* ---------- Estado ---------- */
let movies = [], apiKey = '', view = {name:'seen'}, hist = [], tab = 'seen', sort = 'recent', installEvt = null, sheetRes = null, draft = null, query = '', results = null, searching = false, searchCtl = null, searchTimer = 0, wrapYear = new Date().getFullYear();

/* ---------- Validación ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, ID_RE = /^[a-z0-9]{6,40}$/, PATH_RE = /^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png)$/;
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const strList = (v, n) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 60)).slice(0, n) : [];
function clean(m){ if (!m || typeof m !== 'object' || !ID_RE.test(m.id)) return null; const title = str(m.title, 200).trim(); if (!title) return null;
  const rating = Number.isInteger(+m.rating) && +m.rating >= 1 && +m.rating <= 10 ? +m.rating : null;
  return {id:m.id, tmdb:Number.isInteger(+m.tmdb) && +m.tmdb > 0 ? +m.tmdb : null, title, original:str(m.original,200), year:/^\d{4}$/.test(String(m.year)) ? String(m.year) : '',
    poster:typeof m.poster === 'string' && IMG_RE.test(m.poster) ? m.poster : null, posterPath:typeof m.posterPath === 'string' && PATH_RE.test(m.posterPath) ? m.posterPath : '',
    runtime:Number.isInteger(+m.runtime) && +m.runtime > 0 && +m.runtime < 1000 ? +m.runtime : null, genres:strList(m.genres, 8), directors:strList(m.directors, 4), cast:Array.isArray(m.cast) ? m.cast.filter(c => c && typeof c.n === 'string' && c.n.trim()).map(c => ({n:c.n.trim().slice(0,80), c:str(c.c, 80).trim()})).slice(0, 6) : [], castLoaded:!!m.castLoaded,
    status:m.status === 'watch' ? 'watch' : 'seen', watched:DATE_RE.test(m.watched) ? m.watched : null, rating, note:str(m.note, 3000),
    added:+m.added || Date.now(), updated:+m.updated || Date.now()}; }

/* ---------- TMDB ---------- */
async function tmdb(path, params = {}, signal){
  if (!apiKey) { const e = new Error('nokey'); e.nokey = true; throw e; }
  const u = new URL(API + path); Object.entries(Object.assign({language:'es-MX'}, params)).forEach(([k,v]) => u.searchParams.set(k, v));
  const opts = {signal, headers:{accept:'application/json'}, referrerPolicy:'no-referrer', credentials:'omit'};
  if (apiKey.startsWith('eyJ')) opts.headers.Authorization = 'Bearer ' + apiKey; else u.searchParams.set('api_key', apiKey);
  const r = await fetch(u, opts); if (r.status === 401) { const e = new Error('badkey'); e.badkey = true; throw e; } if (!r.ok) throw new Error('http ' + r.status);
  return r.json(); }
async function posterData(path){ if (!PATH_RE.test(path || '')) return null;
  try { const r = await fetch(IMG + 'w342' + path, {referrerPolicy:'no-referrer', credentials:'omit'}); if (!r.ok) return null; const b = await r.blob(); if (b.size > 2e6) return null;
    const d = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); });
    return IMG_RE.test(d) ? d : null; } catch(e){ return null; } }
async function fromTmdb(id){
  const d = await tmdb(`/movie/${id}`, {append_to_response:'credits'});
  const poster = await posterData(d.poster_path);
  return {tmdb:d.id, title:d.title || d.original_title || '', original:d.original_title && d.original_title !== d.title ? d.original_title : '', year:(d.release_date || '').slice(0,4),
    posterPath:d.poster_path || '', poster, runtime:d.runtime || null, genres:(d.genres || []).map(g => g.name), directors:((d.credits && d.credits.crew) || []).filter(c => c.job === 'Director').map(c => c.name).slice(0,4), cast:castFrom(d.credits), castLoaded:true}; }
const castFrom = cr => ((cr && cr.cast) || []).slice().sort((a,b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 6).map(c => ({n:c.name || '', c:c.character || ''}));
const castTried = new Set();
async function loadCast(m){ if (castTried.has(m.id) || !m.tmdb || !apiKey || m.castLoaded) return; castTried.add(m.id);
  try { const cr = await tmdb(`/movie/${m.tmdb}/credits`); m.cast = castFrom(cr); m.castLoaded = true; await saveM(m); if (view.name === 'detail' && view.id === m.id) render(); } catch(e){} }

/* ---------- UI general ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function openOverlay(html, cls){ ov.className = cls; ov.innerHTML = html; ov.hidden = false; document.body.style.overflow = 'hidden'; }
function closeOverlay(){ ov.hidden = true; ov.innerHTML = ''; ov.className = ''; document.body.style.overflow = ''; }
function resolveSheet(v){ closeOverlay(); if (sheetRes){ const r = sheetRes; sheetRes = null; r(v); } }
function confirmBox(title, text, ok){ return new Promise(res => { sheetRes = v => res(!!v); openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn btn-danger" data-act="sheetOk">${esc(ok)}</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function chooseBox(m){ return new Promise(res => { sheetRes = res; openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(m.title)}</h2><p>${esc([m.year, m.directors.join(', ')].filter(Boolean).join(', '))}</p><div class="choose"><button class="btn btn-primary" data-act="pickSeen">Ya la vi</button><button class="btn btn-secondary" data-act="pickWatch">La quiero ver</button></div><button class="btn btn-ghost mt" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function rateBox(m){ return new Promise(res => { sheetRes = res; const r = m.rating || 7;
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(m.title)}</h2><div class="rate"><p class="rate-num r${r}" id="rateNum">${r}</p><p class="rate-word" id="rateWord">${WORDS[r]}</p><input type="range" id="rateIn" min="1" max="10" step="1" value="${r}" aria-label="Puntuación del 1 al 10"><div class="ticks">${[1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}</div></div>
  <label class="field"><span>La viste el</span><input type="date" id="rateDate" value="${m.watched || todayKey()}" max="${todayKey()}"></label>
  <label class="field"><span>Comentario</span><textarea id="rateNote" rows="3" maxlength="3000" placeholder="Lo que te gustó, una frase que te quedó…" ${NO_SPELL}>${esc(m.note || '')}</textarea></label>
  <button class="btn btn-primary" data-act="rateSave">Guardar</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function go(v){ hist.push(view); view = v; render(); window.scrollTo(0,0); }
function back(){ view = hist.pop() || {name:tab}; render(); window.scrollTo(0,0); }
const curM = () => movies.find(m => m.id === view.id);
async function saveM(m){ m.updated = Date.now(); await DB.put('movies', m); const k = movies.findIndex(x => x.id === m.id); k < 0 ? movies.push(m) : movies[k] = m; }
const posterImg = m => m.poster ? `<img src="${m.poster}" alt="" loading="lazy">` : m.posterPath ? `<img src="${IMG}w342${m.posterPath}" alt="" loading="lazy">` : '';

/* ---------- Vistas ---------- */
function topBar(){ return `<header class="bar"><h1 class="title">Mis películas</h1><div class="bar-actions">${installEvt?'<button class="pill-btn" data-act="install">Instalar</button>':''}<button class="icon-btn" data-act="settings" aria-label="Ajustes">${ic('gear')}</button><button class="icon-btn icon-btn-solid" data-act="add" aria-label="Agregar película">${ic('plus')}</button></div></header>
  <div class="seg" role="tablist">${[['seen','Vistas'],['watch','Por ver'],['stats','Estadísticas']].map(([k,n]) => `<button role="tab" class="${tab===k?'on':''}" data-tab="${k}">${n}</button>`).join('')}</div>`; }
const card = m => `<button class="poster" data-open="${esc(m.id)}" aria-label="${esc(m.title)}${m.rating?`, ${m.rating} de 10`:''}">${posterImg(m) || `<span class="ph">${esc(m.title)}</span>`}${m.status==='seen'&&m.rating?`<span class="score r${m.rating}">${m.rating}</span>`:''}</button>`;
function viewSeen(){ let h = topBar(); const seen = movies.filter(m => m.status === 'seen');
  if (!seen.length) return h + `<div class="empty"><div class="empty-mark">${ic('film',30)}</div><h2>Tu primera película</h2><p>Busca una película que hayas visto, dale tu puntuación y empieza tu colección.</p><button class="btn btn-primary" data-act="add">Agregar película</button></div>`;
  const l = [...seen].sort(sort === 'best' ? (a,b) => (b.rating||0) - (a.rating||0) || (b.watched||'').localeCompare(a.watched||'') : (a,b) => (b.watched||'').localeCompare(a.watched||'') || b.added - a.added);
  h += `<div class="toolbar"><span>${seen.length} película${seen.length>1?'s':''}</span><div class="chips">${[['recent','Recientes'],['best','Mejor puntuadas']].map(([k,n]) => `<button class="chip ${sort===k?'on':''}" data-sort="${k}">${n}</button>`).join('')}</div></div>`;
  return h + `<div class="grid">${l.map(card).join('')}</div>`; }
function viewWatch(){ let h = topBar(); const l = movies.filter(m => m.status === 'watch').sort((a,b) => b.added - a.added);
  if (!l.length) return h + `<div class="empty"><div class="empty-mark">${ic('plus',30)}</div><h2>Nada pendiente</h2><p>Guarda aquí las películas que te recomienden o que quieras ver más adelante.</p><button class="btn btn-primary" data-act="add">Agregar película</button></div>`;
  return h + `<p class="toolbar"><span>${l.length} por ver</span></p><div class="grid">${l.map(card).join('')}</div>`; }
function viewStats(){ let h = topBar(); const seen = movies.filter(m => m.status === 'seen' && m.watched);
  if (!seen.length) return h + `<div class="empty"><div class="empty-mark">${ic('film',30)}</div><h2>Aún no hay datos</h2><p>Cuando agregues películas vistas, aquí verás tus números.</p></div>`;
  const now = todayKey(), ym = now.slice(0,7), y = now.slice(0,4), month = seen.filter(m => m.watched.startsWith(ym)), year = seen.filter(m => m.watched.startsWith(y)), mins = l => l.reduce((s,m) => s + (m.runtime || 0), 0);
  h += `<div class="stats-head"><div class="metric"><span>Este mes</span><b>${month.length}</b><small>${hours(mins(month))}</small></div><div class="metric"><span>Este año</span><b>${year.length}</b><small>${hours(mins(year))}</small></div></div>`;
  const rated = seen.filter(m => m.rating), counts = Array(11).fill(0); rated.forEach(m => counts[m.rating]++); const mx = Math.max(1, ...counts);
  if (rated.length) h += `<h2 class="section">Cómo puntúas</h2><div class="hist">${counts.slice(1).map((c,k) => `<div><small>${c||''}</small><i class="rb${k+1} h${c?Math.max(1,Math.round(c/mx*10)):0}"></i></div>`).join('')}</div><div class="hist-labels">${[1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}</div>`;
  const top = [...rated].sort((a,b) => b.rating - a.rating || (b.watched||'').localeCompare(a.watched||'')).slice(0,10);
  if (top.length) h += `<h2 class="section">Tu top 10</h2><div class="box top">${top.map((m,k) => `<button class="top-row" data-open="${esc(m.id)}"><span>${k+1}</span><span class="top-thumb">${posterImg(m)}</span><b>${esc(m.title)}</b><strong class="r${m.rating}">${m.rating}</strong></button>`).join('')}</div>`;
  const rank = key => { const c = {}; seen.forEach(m => m[key].forEach(v => { c[v] = (c[v] || 0) + 1; })); return Object.entries(c).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0,5); };
  const bars = list => { const t = list[0] ? list[0][1] : 1; return `<div class="box bars">${list.map(([n,c]) => `<div class="bar-row"><span>${esc(n)}</span><span>${c}</span><i><b class="w${Math.max(1,Math.round(c/t*10))}"></b></i></div>`).join('')}</div>`; };
  const g = rank('genres'), d = rank('directors');
  if (g.length) h += `<h2 class="section">Tus géneros favoritos</h2>${bars(g)}`;
  if (d.length && d[0][1] > 1) h += `<h2 class="section">Directores que más has visto</h2>${bars(d.filter(x => x[1] > 1))}`;
  const years = [...new Set(seen.map(m => m.watched.slice(0,4)))].sort().reverse();
  return h + `<h2 class="section">Resumen del año</h2><div class="chips">${years.map(yy => `<button class="chip" data-wrap="${yy}">Tu ${yy} en películas</button>`).join('')}</div>`; }
function viewWrap(){ const yy = String(wrapYear), l = movies.filter(m => m.status === 'seen' && m.watched && m.watched.startsWith(yy));
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Tu ${yy}</h1><span class="spacer"></span></header>`;
  if (!l.length) return h + `<p class="hint">No hay películas vistas en ${yy}.</p>`;
  const mins = l.reduce((s,m) => s + (m.runtime || 0), 0), rated = l.filter(m => m.rating);
  const best = [...rated].sort((a,b) => b.rating - a.rating || b.watched.localeCompare(a.watched))[0], worst = [...rated].sort((a,b) => a.rating - b.rating || b.watched.localeCompare(a.watched))[0];
  const byMonth = Array(12).fill(0); l.forEach(m => byMonth[+m.watched.slice(5,7) - 1]++); const bm = byMonth.indexOf(Math.max(...byMonth));
  const days = [...new Set(l.map(m => m.watched))].sort(); let streak = 1, run = 1;
  for (let k = 1; k < days.length; k++){ const a = new Date(days[k-1] + 'T12:00'), b = new Date(days[k] + 'T12:00'); run = Math.round((b - a) / 864e5) === 1 ? run + 1 : 1; streak = Math.max(streak, run); }
  const g = {}; l.forEach(m => m.genres.forEach(x => { g[x] = (g[x] || 0) + 1; })); const fav = Object.entries(g).sort((a,b) => b[1] - a[1])[0];
  h += `<div class="wrap-hero"><b>${l.length}</b><span>película${l.length>1?'s':''} vista${l.length>1?'s':''} en ${yy}</span></div>`;
  if (mins) h += `<div class="wrap-card"><span>Tiempo frente a la pantalla</span><b>${hours(mins)}</b></div>`;
  if (best) h += `<div class="wrap-card"><span>Tu favorita</span><p>${esc(best.title)}</p><small class="r${best.rating}">${best.rating} de 10</small></div>`;
  if (worst && worst !== best && worst.rating < best.rating) h += `<div class="wrap-card"><span>La que menos te gustó</span><p>${esc(worst.title)}</p><small class="r${worst.rating}">${worst.rating} de 10</small></div>`;
  h += `<div class="wrap-card"><span>El mes en que más viste</span><p>${MONTHS[bm].charAt(0).toUpperCase() + MONTHS[bm].slice(1)}</p><small>${byMonth[bm]} película${byMonth[bm]>1?'s':''}</small></div>`;
  if (streak > 1) h += `<div class="wrap-card"><span>Tu racha más larga</span><p>${streak} días seguidos</p></div>`;
  if (fav) h += `<div class="wrap-card"><span>Tu género del año</span><p>${esc(fav[0])}</p><small>${fav[1]} película${fav[1]>1?'s':''}</small></div>`;
  return h; }
function viewDetail(){ const m = curM(); if (!m){ view = {name:tab}; return ({seen:viewSeen, watch:viewWatch, stats:viewStats}[tab] || viewSeen)(); }
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><div class="bar-actions"><button class="icon-btn" data-act="editInfo" aria-label="Editar datos">${ic('edit')}</button></div></header>`;
  h += `<div class="d-top"><div class="d-poster">${posterImg(m)}</div><div><h1 class="d-title">${esc(m.title)}</h1><p class="d-meta">${esc([m.year, m.runtime ? hours(m.runtime) : ''].filter(Boolean).join(', '))}</p>${m.original?`<p class="d-meta">${esc(m.original)}</p>`:''}</div></div>`;
  if (m.status === 'seen'){
    h += m.rating ? `<div class="d-score"><b class="r${m.rating}">${m.rating}</b><span>de 10, ${WORDS[m.rating].toLowerCase()}</span></div>` : '';
    h += `<p class="d-sub">${m.watched ? `La viste el ${fmtD(m.watched)}.` : ''}</p>`;
    if (m.note) h += `<div class="box"><p class="quote">${esc(m.note)}</p></div>`;
    h += `<button class="btn btn-secondary" data-act="rate">Cambiar puntuación o comentario</button>`;
  } else h += `<button class="btn btn-primary" data-act="markSeen">Ya la vi</button>`;
  const info = [['Dirección', m.directors.join(', ')], ['Géneros', m.genres.join(', ')]].filter(x => x[1]);
  if (info.length) h += `<div class="box">${info.map(([k,v]) => `<div class="row"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  if (m.cast.length) h += `<h2 class="section">Actores principales</h2><div class="box">${m.cast.map(c => `<div class="row cast"><b>${esc(c.n)}</b>${c.c?`<span>${esc(c.c)}</span>`:''}</div>`).join('')}</div>`;
  else if (m.tmdb && !m.castLoaded && apiKey) setTimeout(() => loadCast(m), 0);
  return h + `<button class="btn btn-danger-text mt" data-act="delete">Eliminar</button>`; }
function viewAdd(){ let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Agregar película</h1><span class="spacer"></span></header>`;
  if (!apiKey) return h + `<div class="hint">Para buscar películas con su cartel y sus datos, agrega tu clave de TMDB en Ajustes.<button class="btn btn-primary" data-act="settings">Ir a Ajustes</button><button class="btn btn-secondary" data-act="manual">Agregar a mano</button></div>`;
  return h + `<div class="search"><input id="q" type="search" placeholder="Busca por título" value="${esc(query)}" aria-label="Buscar película" enterkeyhint="search" ${NO_SPELL}></div><div id="results">${resultsHTML()}</div>`; }
function resultsHTML(){
  if (searching) return '<div class="spin" aria-label="Buscando"></div>';
  if (!query.trim()) return '<p class="hint">Escribe el título de la película, en español o en su idioma original.</p>';
  if (results === null) return '';
  if (results.error) return `<p class="hint">${esc(results.error)}</p>`;
  if (!results.length) return `<div class="hint">No encontré esa película.<button class="btn btn-secondary" data-act="manual">Agregar a mano</button></div>`;
  return `<div class="results">${results.map(r => `<button class="res" data-tmdb="${r.id}"><span class="res-thumb">${PATH_RE.test(r.poster_path||'')?`<img src="${IMG}w92${r.poster_path}" alt="" loading="lazy">`:''}</span><span><b>${esc(r.title)}</b><small>${esc([(r.release_date||'').slice(0,4), r.original_title && r.original_title !== r.title ? r.original_title : ''].filter(Boolean).join(', '))}</small></span></button>`).join('')}</div><div class="hint"><button class="btn btn-ghost" data-act="manual">¿No está? Agregar a mano</button></div>`; }
function photoSlot(){ const src = draft.poster || (draft.posterPath ? IMG + 'w342' + draft.posterPath : ''); return `<div class="photo-slot" id="photoSlot">${src?`<img src="${src}" alt=""><button type="button" class="photo-x" data-act="rmPoster" aria-label="Quitar cartel">${ic('x',16)}</button>`:`<label class="photo-pick">${ic('camera')}<span>Cartel</span><input type="file" accept="image/*" id="f_poster" hidden></label>`}</div>`; }
function viewForm(){ const d = draft;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Cancelar">${ic('x')}</button><h1 class="title title-sm">${d._new?'Agregar a mano':'Editar datos'}</h1><button class="btn-save" data-act="saveForm">${d._new?'Siguiente':'Guardar'}</button></header>
  <label class="field"><span>Título</span><input id="f_title" value="${esc(d.title)}" maxlength="200" ${NO_SPELL}><em class="err" id="e_title"></em></label>
  <div class="two"><label class="field"><span>Año</span><input id="f_year" inputmode="numeric" maxlength="4" value="${esc(d.year)}" placeholder="2024" ${NO_SPELL}></label><label class="field"><span>Duración (minutos)</span><input id="f_runtime" inputmode="numeric" value="${d.runtime||''}" placeholder="120" ${NO_SPELL}></label></div>
  <label class="field"><span>Dirección</span><input id="f_dir" value="${esc(d.directors.join(', '))}" ${NO_SPELL}></label>
  <label class="field"><span>Actores principales</span><input id="f_cast" value="${esc(d.cast.map(c => c.n).join(', '))}" ${NO_SPELL}><small>Sepáralos con comas.</small></label>
  <label class="field"><span>Géneros</span><input id="f_genres" value="${esc(d.genres.join(', '))}" placeholder="Drama, Comedia" ${NO_SPELL}><small>Sepáralos con comas.</small></label>
  <div class="field"><span>Cartel</span>${photoSlot()}</div>`; }
function viewSettings(){ const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Ajustes</h1><span class="spacer"></span></header>
  <h2 class="section">Clave de TMDB</h2><div class="box"><label class="field"><span>Clave de API o token de lectura</span><input id="k_key" type="password" value="${esc(apiKey)}" placeholder="Pega aquí tu clave" ${NO_SPELL}><em class="err" id="e_key"></em><small>Se guarda solo en este celular. La consigues gratis en themoviedb.org, en tu perfil → Ajustes → API.</small></label><button class="btn btn-primary" data-act="saveKey">Guardar y probar</button></div>
  <h2 class="section">Instalación</h2><div class="box">${standalone?'<p class="fine">Ya estás usando la app instalada.</p>':installEvt?`<button class="set-row" data-act="install"><span>Instalar Mis películas en el celular<small>Queda como una app con su propio ícono</small></span><span class="chev">${ic('down',18)}</span></button>`:'<p class="fine">Chrome todavía no ofrece instalarla. Abre la app en Chrome con internet, espera unos segundos y vuelve a entrar aquí.</p>'}</div>
  <h2 class="section">Copia de seguridad</h2><div class="box">
  <button class="set-row" data-act="exportBk"><span>Descargar copia<small>Tus películas, puntuaciones y carteles</small></span><span class="chev">${ic('down',18)}</span></button>
  <label class="set-row"><span>Restaurar una copia<small>Agrega lo que tenga el archivo</small></span><span class="chev">${ic('up',18)}</span><input type="file" accept="application/json,.json" id="f_import" hidden></label></div>
  <button class="btn btn-danger-text mt" data-act="wipe">Borrar todas las películas</button>
  <p class="fine">Los datos y carteles de las películas vienen de TMDB. Esta app usa la API de TMDB, pero no está respaldada ni certificada por TMDB.</p><p class="ver">Versión ${APP_VERSION}</p>`; }
function render(){ const f = {seen:viewSeen, watch:viewWatch, stats:viewStats, wrap:viewWrap, detail:viewDetail, add:viewAdd, form:viewForm, settings:viewSettings}[view.name] || viewSeen; main.innerHTML = f(); }

/* ---------- Búsqueda ---------- */
function runSearch(){ clearTimeout(searchTimer); if (searchCtl) searchCtl.abort(); const q = query.trim();
  if (!q){ searching = false; results = null; paintResults(); return; }
  searching = true; paintResults();
  searchTimer = setTimeout(async () => { const ctl = searchCtl = new AbortController();
    try { const d = await tmdb('/search/movie', {query:q, include_adult:'false'}, ctl.signal); if (ctl !== searchCtl) return; results = (d.results || []).slice(0, 20); }
    catch(e){ if (e.name === 'AbortError') return; results = {error: e.badkey ? 'Tu clave de TMDB no funciona. Revísala en Ajustes.' : 'No se pudo buscar. Revisa tu conexión a internet.'}; }
    searching = false; paintResults(); }, 380); }
function paintResults(){ const r = $('#results'); if (r) r.innerHTML = resultsHTML(); }

/* ---------- Flujos ---------- */
async function addFlow(info){
  if (info.tmdb){ const ex = movies.find(m => m.tmdb === info.tmdb); if (ex){ toast('Ya está en tu colección'); view = {name:'detail', id:ex.id}; hist = [{name:tab}]; render(); return; } }
  const choice = await chooseBox(info); if (!choice) return;
  const m = clean(Object.assign({id:uid(), added:Date.now(), genres:[], directors:[], cast:[]}, info, {status:choice}));
  if (choice === 'seen'){ const r = await rateBox(m); if (!r) return; Object.assign(m, r); }
  await saveM(m); tab = choice === 'seen' ? 'seen' : 'watch'; hist = [{name:tab}]; view = {name:'detail', id:m.id}; query = ''; results = null; render(); window.scrollTo(0,0);
  toast(choice === 'seen' ? 'Agregada a tus vistas' : 'Agregada a por ver'); }
function readRate(){ const d = $('#rateDate').value; return {rating:+$('#rateIn').value, watched:/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayKey(), note:$('#rateNote').value.trim()}; }
function compress(file){ return new Promise((res, rej) => { if (file.size > 40e6) return rej(); const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const w = Math.min(500, img.width), s = w / img.width, c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(); }; img.src = url; }); }

const A = {
  settings(){ go({name:'settings'}); },
  add(){ query = ''; results = null; go({name:'add'}); setTimeout(() => { const q = $('#q'); if (q) q.focus(); }, 60); },
  back(){ back(); },
  manual(){ draft = {_new:true, title:query.trim(), year:'', runtime:null, directors:[], genres:[], cast:[], poster:null, posterPath:''}; go({name:'form'}); },
  editInfo(){ const m = curM(); if (!m) return; draft = {_new:false, id:m.id, title:m.title, year:m.year, runtime:m.runtime, directors:[...m.directors], genres:[...m.genres], cast:m.cast.map(c => ({...c})), poster:m.poster, posterPath:m.posterPath}; go({name:'form'}); },
  rmPoster(){ draft.poster = null; draft.posterPath = ''; $('#photoSlot').outerHTML = photoSlot(); },
  async saveForm(){ const title = $('#f_title').value.trim(); if (!title){ $('#e_title').textContent = 'Escribe el título.'; $('#f_title').focus(); return; }
    const split = v => v.split(',').map(x => x.trim()).filter(Boolean);
    const info = {title, year:$('#f_year').value.trim(), runtime:parseInt($('#f_runtime').value, 10) || null, directors:split($('#f_dir').value), genres:split($('#f_genres').value), cast:split($('#f_cast').value).map(n => ({n, c:(draft.cast.find(c => c.n === n) || {}).c || ''})), castLoaded:true, poster:draft.poster};
    if (draft._new){ draft = null; hist.pop(); view = {name:'add'}; await addFlow(Object.assign({tmdb:null, original:'', posterPath:''}, info)); if (view.name === 'add') render(); return; }
    const m = curMById(draft.id); if (!m) return; Object.assign(m, clean(Object.assign({}, m, info, {posterPath:draft.posterPath}))); draft = null;
    await saveM(m); toast('Guardado'); back(); },
  async rate(){ const m = curM(); if (!m) return; const r = await rateBox(m); if (!r) return; Object.assign(m, r); await saveM(m); render(); toast('Guardado'); },
  async markSeen(){ const m = curM(); if (!m) return; const r = await rateBox(m); if (!r) return; Object.assign(m, r, {status:'seen'}); await saveM(m); tab = 'seen'; hist = [{name:'seen'}]; render(); toast('Agregada a tus vistas'); },
  async delete(){ const m = curM(); if (!m) return; if (!await confirmBox(`¿Eliminar ${m.title}?`, 'Se borra de tu colección junto con tu puntuación y comentario.', 'Eliminar')) return;
    await DB.del('movies', m.id); movies = movies.filter(x => x.id !== m.id); hist = hist.filter(v => v.id !== m.id); toast('Eliminada'); back(); },
  sheetOk(){ resolveSheet(true); }, sheetNo(){ resolveSheet(null); },
  pickSeen(){ resolveSheet('seen'); }, pickWatch(){ resolveSheet('watch'); },
  rateSave(){ resolveSheet(readRate()); },
  async saveKey(){ const k = $('#k_key').value.trim(), e = $('#e_key'); e.textContent = '';
    if (!k){ apiKey = ''; await DB.put('meta', {k:'key', v:''}); toast('Clave borrada'); return; }
    const old = apiKey; apiKey = k;
    try { await tmdb('/configuration', {}); await DB.put('meta', {k:'key', v:k}); toast('Clave guardada. Ya puedes buscar películas.'); }
    catch(err){ apiKey = old; e.textContent = err.badkey ? 'TMDB no aceptó esa clave. Revisa que la copiaste completa.' : 'No se pudo comprobar. Revisa tu conexión a internet.'; } },
  async install(){ if (!installEvt) return; const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch(err){} render(); },
  async exportBk(){ const data = {app:'mis-peliculas', v:1, created:new Date().toISOString(), movies};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'})), a = document.createElement('a');
    a.href = url; a.download = `mis-peliculas-copia-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Copia descargada'); },
  async wipe(){ if (!await confirmBox('¿Borrar todas las películas?', 'Se eliminan tus vistas, por ver, puntuaciones y comentarios de este celular. No se puede deshacer.', 'Borrar todo')) return;
    await DB.clear('movies'); movies = []; hist = []; view = {name:tab}; toast('Películas borradas'); render(); }
};
const curMById = id => movies.find(m => m.id === id);
async function importBk(file){
  let data; try { if (file.size > 300e6) throw 0; data = JSON.parse(await file.text()); } catch(e){ return toast('Ese archivo no es una copia válida.'); }
  if (!data || data.app !== 'mis-peliculas' || !Array.isArray(data.movies)) return toast('Ese archivo no es una copia válida.');
  let n = 0; for (const r of data.movies){ const m = clean(r); if (!m) continue; try { await DB.put('movies', m); const k = movies.findIndex(x => x.id === m.id); k < 0 ? movies.push(m) : movies[k] = m; n++; } catch(e){} }
  render(); toast(n ? `${n} película${n>1?'s':''} restaurada${n>1?'s':''}` : 'No se pudo restaurar nada.'); }

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-open],[data-tab],[data-sort],[data-tmdb],[data-wrap]'); if (!t) return;
  const ds = t.dataset;
  if (ds.tab){ tab = ds.tab; view = {name:tab}; hist = []; render(); window.scrollTo(0,0); return; }
  if (ds.open) return go({name:'detail', id:ds.open});
  if (ds.sort){ sort = ds.sort; return render(); }
  if (ds.wrap){ wrapYear = +ds.wrap; return go({name:'wrap'}); }
  if (ds.tmdb){ if (t.disabled) return; t.disabled = true; toast('Cargando datos…');
    try { const info = await fromTmdb(+ds.tmdb); await addFlow(info); } catch(err){ toast(err.badkey ? 'Tu clave de TMDB no funciona.' : 'No se pudieron cargar los datos. Revisa tu conexión.'); }
    t.disabled = false; return; }
  if (ds.act && A[ds.act]) A[ds.act](t);
});
document.addEventListener('input', e => { const t = e.target;
  if (t.id === 'q'){ query = t.value; runSearch(); }
  if (t.id === 'rateIn'){ const v = +t.value, n = $('#rateNum'); n.textContent = v; n.className = 'rate-num r' + v; $('#rateWord').textContent = WORDS[v]; try { if (navigator.vibrate) navigator.vibrate(4); } catch(err){} }
  if (t.id === 'f_title') $('#e_title').textContent = ''; });
document.addEventListener('change', async e => { const t = e.target;
  if (t.id === 'f_poster'){ const f = t.files && t.files[0]; if (!f || !draft) return; try { draft.poster = await compress(f); draft.posterPath = ''; $('#photoSlot').outerHTML = photoSlot(); } catch(err){ toast('No se pudo cargar la imagen.'); } }
  if (t.id === 'f_import'){ const f = t.files && t.files[0]; t.value = ''; if (f) importBk(f); } });
document.addEventListener('keydown', e => { if (!ov.hidden && e.key === 'Escape') resolveSheet(null); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (['seen','watch','stats','settings'].includes(view.name)) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Mis películas instalada'); if (['seen','watch','stats','settings'].includes(view.name)) render(); });

/* ---------- Inicio ---------- */
(async () => {
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(() => {});
  if (!window.indexedDB || !await DB.open()){ main.innerHTML = `<div class="empty"><h2>No se puede guardar</h2><p>Este navegador no permite guardar datos. Si estás en modo incógnito, abre la app en una pestaña normal.</p></div>`; return; }
  try { const k = await DB.get('meta', 'key'); apiKey = k && typeof k.v === 'string' ? k.v : ''; } catch(e){}
  try { movies = (await DB.all('movies')).map(clean).filter(Boolean); } catch(e){ movies = []; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  render();
})();
})();
