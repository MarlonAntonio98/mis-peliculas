'use strict';
(() => {
if (window.top !== window.self) { document.documentElement.classList.add('framed'); return; }

const $ = s => document.querySelector(s);
const main = $('#main'), ov = $('#overlay');
const APP_VERSION = 21, EXTRAS_V = 7, REGION = 'SV';
const API = 'https://api.themoviedb.org/3', IMG = 'https://image.tmdb.org/t/p/', OMDB = 'https://www.omdbapi.com/';
const RT_MAX_AGE = 7 * 864e5, PROV_MAX_AGE = 7 * 864e5;
const LATAM = new Set(['MX','AR','CO','CL','PE','VE','EC','GT','SV','CR','PA','UY','PY','BO','DO','HN','NI','PR','CU','US','419']);
const COUNTRY = {SV:'El Salvador', US:'Estados Unidos', MX:'México', ES:'España', GB:'Reino Unido', CA:'Canadá', AR:'Argentina', CO:'Colombia', CL:'Chile', BR:'Brasil', FR:'Francia', DE:'Alemania', IT:'Italia', JP:'Japón', KR:'Corea del Sur', AU:'Australia'};
const WORDS = ['', 'Horrible', 'Muy mala', 'Mala', 'Floja', 'Regular', 'Aceptable', 'Buena', 'Muy buena', 'Excelente', 'Obra maestra'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const I = {plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="m15 6-6 6 6 6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',film:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M16 3v18M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>',play:'<path d="M8 5v14l11-7z"/>',ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',pin:'<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',share:'<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
const NO_SPELL = 'autocomplete="off" autocorrect="off" spellcheck="false"';
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fmtD = s => { if (!s) return ''; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d).toLocaleDateString('es-SV', {day:'numeric', month:'long', year:'numeric'}); };
const daysTo = s => Math.round((new Date(s + 'T12:00') - new Date(todayKey() + 'T12:00')) / 864e5);
const hours = min => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };
const rc = r => Math.min(10, Math.max(1, Math.round(r)));
const fr = r => (Math.round(r * 10) / 10).toString();
const word = r => WORDS[rc(r)];
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

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
let movies = [], apiKey = '', omdbKey = '', view = {name:'seen'}, hist = [], tab = 'seen', kindFilter = 'all', installEvt = null, sheetRes = null, draft = null;
let query = '', searchKind = 'movie', results = null, searching = false, searchCtl = null, searchTimer = 0, wrapYear = new Date().getFullYear();
let rtBusy = false, rtPaint = 0, ordering = false, odrag = null, people = new Map(), personRole = 'cast';
const extrasTried = new Set();

/* ---------- Validación ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, ID_RE = /^[a-z0-9]{6,40}$/, PATH_RE = /^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|svg)$/, YT_RE = /^[A-Za-z0-9_-]{11}$/;
const ytId = u => { const s = String(u || '').trim(), m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : (YT_RE.test(s) ? s : ''); };
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const strList = (v, n) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 60)).slice(0, n) : [];
const pid = v => Number.isInteger(+v) && +v > 0 ? +v : null;
const provList = v => Array.isArray(v) ? v.filter(p => p && typeof p.n === 'string').map(p => ({n:p.n.slice(0,60), logo:PATH_RE.test(p.logo || '') ? p.logo : ''})).slice(0, 12) : [];
function clean(m){ if (!m || typeof m !== 'object' || !ID_RE.test(m.id)) return null; const title = str(m.title, 200).trim(); if (!title) return null;
  const rating = isFinite(+m.rating) && m.rating !== null && +m.rating >= 1 && +m.rating <= 10 ? Math.round(+m.rating * 10) / 10 : null;
  const prov = m.prov && typeof m.prov === 'object' ? {link:/^https:\/\/www\.themoviedb\.org\//.test(m.prov.link || '') ? m.prov.link : '', flat:provList(m.prov.flat), free:provList(m.prov.free), rent:provList(m.prov.rent), buy:provList(m.prov.buy)} : null;
  return {id:m.id, kind:m.kind === 'tv' ? 'tv' : 'movie', tmdb:pid(m.tmdb), title, original:str(m.original,200), year:/^\d{4}$/.test(String(m.year)) ? String(m.year) : '',
    poster:typeof m.poster === 'string' && IMG_RE.test(m.poster) ? m.poster : null, posterPath:typeof m.posterPath === 'string' && PATH_RE.test(m.posterPath) ? m.posterPath : '',
    runtime:Number.isInteger(+m.runtime) && +m.runtime > 0 && +m.runtime < 1000 ? +m.runtime : null, seasons:Number.isInteger(+m.seasons) && +m.seasons > 0 ? +m.seasons : null,
    genres:strList(m.genres, 8), directors:strList(m.directors, 4), dirs:Array.isArray(m.dirs) ? m.dirs.filter(d => d && typeof d.n === 'string').map(d => ({n:d.n.slice(0,80), id:pid(d.id)})).slice(0,4) : [],
    cast:Array.isArray(m.cast) ? m.cast.filter(c => c && typeof c.n === 'string' && c.n.trim()).map(c => ({n:c.n.trim().slice(0,80), c:str(c.c, 80).trim(), id:pid(c.id)})).slice(0, 6) : [],
    imdb:/^tt\d{5,10}$/.test(m.imdb || '') ? m.imdb : '', rt:/^\d{1,3}%$/.test(m.rt || '') ? m.rt : '', rtAt:+m.rtAt || 0,
    trailer:YT_RE.test(m.trailer || '') ? m.trailer : '', trailerEs:YT_RE.test(m.trailerEs || '') ? m.trailerEs : '',
    digital:m.digital && DATE_RE.test(m.digital.d) ? {d:m.digital.d, cc:/^[A-Z]{2}$/.test(m.digital.cc || '') ? m.digital.cc : '', fd:DATE_RE.test(m.digital.fd || '') ? m.digital.fd : '', fcc:/^[A-Z]{2}$/.test(m.digital.fcc || '') ? m.digital.fcc : ''} : null,
    prov, provAt:+m.provAt || 0, extrasV:+m.extrasV || 0,
    status:m.status === 'watch' ? 'watch' : 'seen', watched:DATE_RE.test(m.watched) ? m.watched : null, rating, ratedAt:+m.ratedAt || 0, note:str(m.note, 3000),
    order:isFinite(+m.order) ? +m.order : 0, pos:m.pos === null || m.pos === undefined || !isFinite(+m.pos) ? null : +m.pos, lastRank:Number.isInteger(+m.lastRank) && +m.lastRank > 0 ? +m.lastRank : null, pinned:!!m.pinned, top:+m.top > 0 ? +m.top : null, rtT:str(m.rtT, 200), overview:str(m.overview, 1500), release:DATE_RE.test(m.release || '') ? m.release : '', relStatus:str(m.relStatus, 30), rtY:Number.isInteger(+m.rtY) && +m.rtY > 0 ? +m.rtY : null, added:+m.added || Date.now(), updated:+m.updated || Date.now()}; }

/* ---------- TMDB ---------- */
async function tmdb(path, params = {}, signal){
  if (!apiKey) { const e = new Error('nokey'); e.nokey = true; throw e; }
  const u = new URL(API + path); Object.entries(Object.assign({language:'en-US'}, params)).forEach(([k,v]) => u.searchParams.set(k, v));
  const opts = {signal, headers:{accept:'application/json'}, referrerPolicy:'no-referrer', credentials:'omit'};
  if (apiKey.startsWith('eyJ')) opts.headers.Authorization = 'Bearer ' + apiKey; else u.searchParams.set('api_key', apiKey);
  const r = await fetch(u, opts); if (r.status === 401) { const e = new Error('badkey'); e.badkey = true; throw e; } if (!r.ok) throw new Error('http ' + r.status);
  return r.json(); }
async function posterData(path){ if (!PATH_RE.test(path || '')) return null;
  try { const r = await fetch(IMG + 'w342' + path, {referrerPolicy:'no-referrer', credentials:'omit'}); if (!r.ok) return null; const b = await r.blob(); if (b.size > 2e6) return null;
    const d = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); });
    return IMG_RE.test(d) ? d : null; } catch(e){ return null; } }
function pickTrailer(list, lang, loose){ const v = (list || []).filter(x => x.site === 'YouTube' && YT_RE.test(x.key || '') && x.iso_639_1 === lang && (lang !== 'es' || LATAM.has(x.iso_3166_1) || (loose && x.iso_3166_1 !== 'ES')));
  const score = x => (x.type === 'Trailer' ? 4 : x.type === 'Teaser' ? 1 : 0) + (x.official ? 2 : 0) + (lang === 'es' && x.iso_3166_1 === 'MX' ? 1 : 0);
  const best = v.filter(x => score(x) > 0).sort((a,b) => score(b) - score(a) || (a.published_at || '').localeCompare(b.published_at || ''))[0];
  return best ? best.key : ''; }
function pickDigital(rd){ const all = (rd && rd.results) || [], find = cc => { const c = all.find(x => x.iso_3166_1 === cc); const d = c && (c.release_dates || []).filter(r => r.type === 4 && r.release_date).sort((a,b) => a.release_date.localeCompare(b.release_date))[0]; return d ? {d:d.release_date.slice(0,10), cc} : null; };
  const us = find('US'), first = all.flatMap(c => (c.release_dates || []).filter(x => x.type === 4 && x.release_date).map(x => ({d:x.release_date.slice(0,10), cc:c.iso_3166_1}))).sort((a,b) => a.d.localeCompare(b.d))[0] || null;
  if (us) return first && first.d < us.d && first.cc !== 'US' ? {d:us.d, cc:'US', fd:first.d, fcc:first.cc} : us;
  return first; }
function pickProv(wp){ const r = wp && wp.results && wp.results[REGION]; if (!r) return {link:'', flat:[], free:[], rent:[], buy:[]};
  const map = l => (l || []).sort((a,b) => (a.display_priority ?? 99) - (b.display_priority ?? 99)).map(p => ({n:p.provider_name, logo:p.logo_path || ''}));
  return {link:r.link || '', flat:map(r.flatrate), free:map([...(r.free || []), ...(r.ads || [])]), rent:map(r.rent), buy:map(r.buy)}; }
async function overviewEs(kind, id, en){ try { const d = await tmdb(`/${kind}/${id}`, {language:'es-MX'}); if (d.overview && d.overview.trim()) return d.overview.trim().slice(0, 1500); } catch(e){}
  return String(en || '').trim().slice(0, 1500); }
async function esTrailer(kind, id){ try { const v = ((await tmdb(`/${kind}/${id}/videos`, {language:'es-MX'})).results) || []; return pickTrailer(v, 'es') || pickTrailer(v, 'es', true); } catch(e){ return ''; } }
const GENRES_ES = {28:'Acción',12:'Aventura',16:'Animación',35:'Comedia',80:'Crimen',99:'Documental',18:'Drama',10751:'Familia',14:'Fantasía',36:'Historia',27:'Terror',10402:'Música',9648:'Misterio',10749:'Romance',878:'Ciencia ficción',10770:'Película de TV',53:'Suspenso',10752:'Bélica',37:'Western',10759:'Acción y aventura',10762:'Infantil',10763:'Noticias',10764:'Reality',10765:'Ciencia ficción y fantasía',10766:'Telenovela',10767:'Programa de entrevistas',10768:'Guerra y política'};
const castFrom = cr => ((cr && cr.cast) || []).slice().sort((a,b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 6).map(c => ({n:c.name || '', c:c.character || (c.roles && c.roles[0] && c.roles[0].character) || '', id:c.id}));
async function fetchInfo(kind, id){
  const d = await tmdb(`/${kind}/${id}`, {append_to_response:`credits,videos,external_ids,watch/providers${kind === 'movie' ? ',release_dates' : ''}`, include_video_language:'en,es'});
  const vids = (d.videos && d.videos.results) || [];
  const base = {kind, tmdb:d.id, posterPath:d.poster_path || '', genres:(d.genres || []).map(g => GENRES_ES[g.id] || g.name), cast:castFrom(d.credits), imdb:(d.external_ids && d.external_ids.imdb_id) || d.imdb_id || '',
    trailer:pickTrailer(vids, 'en'), trailerEs:pickTrailer(vids, 'es') || await esTrailer(kind, id), prov:pickProv(d['watch/providers']), provAt:Date.now(), extrasV:EXTRAS_V, overview:await overviewEs(kind, id, d.overview)};
  if (kind === 'movie'){ const dirs = ((d.credits && d.credits.crew) || []).filter(c => c.job === 'Director').slice(0,4).map(c => ({n:c.name, id:c.id}));
    base.release = DATE_RE.test(d.release_date || '') ? d.release_date : ''; base.relStatus = d.status || '';
    return Object.assign(base, {title:d.title || d.original_title || '', original:d.original_title && d.original_title !== d.title ? d.original_title : '', year:(d.release_date || '').slice(0,4), runtime:d.runtime || null, dirs, directors:dirs.map(x => x.n), digital:pickDigital(d.release_dates)}); }
  const dirs = (d.created_by || []).slice(0,4).map(c => ({n:c.name, id:c.id}));
  base.release = DATE_RE.test(d.first_air_date || '') ? d.first_air_date : ''; base.relStatus = d.status || '';
  return Object.assign(base, {title:d.name || d.original_name || '', original:d.original_name && d.original_name !== d.name ? d.original_name : '', year:(d.first_air_date || '').slice(0,4), runtime:null, seasons:d.number_of_seasons || null, dirs, directors:dirs.map(x => x.n), digital:null}); }
async function loadExtras(m){ if (extrasTried.has(m.id) || !m.tmdb || !apiKey || !navigator.onLine) return; extrasTried.add(m.id);
  try { const x = await fetchInfo(m.kind, m.tmdb); const lang = m.extrasV < 5;
    if (lang && x.title){ m.title = x.title; m.original = x.original; if (x.year) m.year = x.year; if (x.posterPath && x.posterPath !== m.posterPath){ m.posterPath = x.posterPath; m.poster = await posterData(x.posterPath) || m.poster; } }
    ['overview','release','relStatus','genres','cast','imdb','trailer','trailerEs','prov','provAt','extrasV','runtime','seasons','dirs','directors','digital'].forEach(k => { if (x[k] !== undefined && x[k] !== null && !(Array.isArray(x[k]) && !x[k].length && m[k] && m[k].length)) m[k] = x[k]; });
    if (!m.posterPath && x.posterPath) m.posterPath = x.posterPath; if (!m.poster && m.posterPath) m.poster = await posterData(m.posterPath);
    await saveM(m); if (view.name === 'detail' && view.id === m.id) render(); } catch(e){} }
async function refreshAllExtras(){ if (!apiKey || !navigator.onLine) return;
  for (const m of movies.filter(x => x.tmdb && x.extrasV < EXTRAS_V)){ if (!navigator.onLine) break; await loadExtras(m); await new Promise(r => setTimeout(r, 120));
    if (['watch','seen'].includes(view.name) && !odrag && !tswipe && !ovState){ clearTimeout(refreshAllExtras.t); refreshAllExtras.t = setTimeout(() => { if (!odrag && !tswipe && !ovState && ['watch','seen'].includes(view.name)) { const y = window.scrollY; render(); window.scrollTo(0, y); } }, 600); } } }
const needsExtras = m => m.tmdb && (m.extrasV < EXTRAS_V || Date.now() - m.provAt > PROV_MAX_AGE);

/* ---------- Rotten Tomatoes (OMDb) ---------- */
async function omdb(imdb){ const u = new URL(OMDB); u.searchParams.set('i', imdb); u.searchParams.set('apikey', omdbKey);
  const r = await fetch(u, {referrerPolicy:'no-referrer', credentials:'omit'}); const d = await r.json().catch(() => ({}));
  if (r.status === 401 || /invalid api key|no api key/i.test(d.Error || '')) { const e = new Error('badkey'); e.badkey = true; throw e; }
  if (!r.ok) throw new Error('http ' + r.status); return d; }
async function fetchRT(m){
  if (!m.imdb && m.tmdb && apiKey){ try { const x = await tmdb(`/${m.kind}/${m.tmdb}/external_ids`); if (/^tt\d{5,10}$/.test(x.imdb_id || '')) m.imdb = x.imdb_id; } catch(e){} }
  if (!m.imdb) { m.rtAt = Date.now(); return; }
  const d = await omdb(m.imdb); const v = ((d.Ratings || []).find(x => x.Source === 'Rotten Tomatoes') || {}).Value || '';
  m.rt = /^\d{1,3}%$/.test(v) ? v : ''; m.rtAt = Date.now(); }
async function refreshRT(){ if (rtBusy || !omdbKey || !navigator.onLine) return;
  const todo = movies.filter(m => m.status === 'watch' && (m.tmdb || m.imdb) && Date.now() - m.rtAt > RT_MAX_AGE); if (!todo.length) return;
  rtBusy = true;
  for (const m of todo){ try { await fetchRT(m); await saveM(m); } catch(e){ if (e.badkey){ toast('Tu clave de OMDb no funciona. Revísala en Ajustes.'); break; } }
    clearTimeout(rtPaint); rtPaint = setTimeout(() => { if ((view.name === 'watch' && !odrag && !tswipe) || (view.name === 'detail' && view.id === m.id)) render(); }, 250); }
  rtBusy = false; }
const rtFresh = rt => parseInt(rt, 10) >= 60;

/* ---------- UI general ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
let ovState = false, closing = null, silentRes = null;
function openOverlay(html, cls){ ov.className = cls; ov.innerHTML = html; ov.hidden = false; document.body.style.overflow = 'hidden'; if (!ovState){ ovState = true; history.pushState({ov:1}, ''); } }
function hideOverlay(){ ov.hidden = true; ov.innerHTML = ''; ov.className = ''; document.body.style.overflow = ''; }
function finishSheet(v){ hideOverlay(); ovState = false; const r = sheetRes; sheetRes = null; if (r) r(v); }
function resolveSheet(v){ if (ovState && !closing){ closing = {v}; history.back(); } else if (!ovState) finishSheet(v); }
function silentBack(n = 1){ return new Promise(res => { if (n < 1) return res(); silentRes = res; history.go(-n); }); }
window.addEventListener('popstate', () => {
  if (silentRes){ const r = silentRes; silentRes = null; r(); return; }
  if (closing){ const c = closing; closing = null; finishSheet(c.v); return; }
  if (ovState){ finishSheet(null); return; }
  if (odrag) orderEnd();
  doBack(); });
function confirmBox(title, text, ok){ return new Promise(res => { sheetRes = v => res(!!v); openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn btn-danger" data-act="sheetOk">${esc(ok)}</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function pickBox(m){ const l = watchPositions(); return new Promise(res => { sheetRes = res;
  openOverlay(`<div class="picker" role="dialog" aria-modal="true"><header class="bar"><button class="icon-btn" data-act="sheetNo" aria-label="Cancelar">${ic('x')}</button><h1 class="title title-sm">Poner después de…</h1><span class="spacer"></span></header><input id="pickQ" type="search" placeholder="Busca la película" ${NO_SPELL}><div id="pickList">${l.map((x, i) => x.id === m.id ? '' : `<button class="pick-row" data-act="pickIt" data-pick="${esc(x.id)}" data-q="${esc(normT(x.title + ' ' + (x.original || '')))}"><span class="pick-n">${i + 1}</span><span class="top-thumb">${posterImg(x)}</span><b>${esc(x.title)}</b></button>`).join('')}</div></div>`, 'full'); }); }
function numberBox(title, text, max){ return new Promise(res => { sheetRes = res; openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><input id="numIn" class="num-in" type="number" inputmode="numeric" min="1" max="${max}" placeholder="1"><em class="err" id="numErr"></em><button class="btn btn-primary mt" data-act="numOk">Mover</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); setTimeout(() => { const i = $('#numIn'); if (i) i.focus(); }, 80); }); }
function chooseBox(m){ const tv = m.kind === 'tv'; return new Promise(res => { sheetRes = res; openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(m.title)}</h2><p>${esc([tv ? 'Serie' : 'Película', m.year, (m.directors || []).join(', ')].filter(Boolean).join(', '))}</p><div class="choose"><button class="btn btn-primary" data-act="pickSeen">Ya la vi</button><button class="btn btn-secondary" data-act="pickWatch">La quiero ver</button></div><button class="btn btn-ghost mt" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function rateBox(m){ return new Promise(res => { sheetRes = res; const r = m.rating || 7;
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(m.title)}</h2><div class="rate"><div class="rate-row"><button type="button" class="step" data-step="-0.1" aria-label="Bajar 0.1">−</button><p class="rate-num r${rc(r)}" id="rateNum">${fr(r)}</p><button type="button" class="step" data-step="0.1" aria-label="Subir 0.1">+</button></div><p class="rate-word" id="rateWord">${word(r)}</p><input type="range" id="rateIn" min="1" max="10" step="0.1" value="${r}" aria-label="Puntuación del 1 al 10"><div class="ticks">${[1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}</div></div>
  <label class="field"><span>${m.kind === 'tv' ? 'La terminaste el' : 'La viste el'}</span><input type="date" id="rateDate" value="${m.watched || todayKey()}" max="${todayKey()}"></label>
  <label class="field"><span>Comentario</span><textarea id="rateNote" rows="3" maxlength="3000" placeholder="Lo que te gustó, una frase que te quedó…" ${NO_SPELL}>${esc(m.note || '')}</textarea></label>
  <button class="btn btn-primary" data-act="rateSave">Guardar</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function go(v){ hist.push(Object.assign({}, view, {y:window.scrollY})); view = v; history.pushState({d:hist.length}, ''); render(); window.scrollTo(0,0); }
function back(){ if (hist.length) history.back(); }
function doBack(){ if (!hist.length) return; const v = hist.pop(), y = v.y || 0; delete v.y; ordering = false; view = v; render(); window.scrollTo(0, y); }
const TABS = ['seen','watch','stats'], tabY = {};
async function resetToRoot(t){ const n = hist.length; if (!n && TABS.includes(view.name)) tabY[tab] = window.scrollY; hist = []; ordering = false; tab = t; view = {name:t}; if (n) await silentBack(n); render(); window.scrollTo(0, n ? 0 : tabY[t] || 0); }
const curM = () => movies.find(m => m.id === view.id);
async function saveM(m){ m.updated = Date.now(); await DB.put('movies', m); const k = movies.findIndex(x => x.id === m.id); k < 0 ? movies.push(m) : movies[k] = m; }
const posterImg = m => m.poster ? `<img src="${m.poster}" alt="" loading="lazy">` : m.posterPath ? `<img src="${IMG}w342${m.posterPath}" alt="" loading="lazy">` : '';
const byKind = l => kindFilter === 'all' ? l : l.filter(m => m.kind === kindFilter);
const countLabel = l => { const mv = l.filter(m => m.kind === 'movie').length, tv = l.length - mv; return [mv ? plural(mv, 'película', 'películas') : '', tv ? plural(tv, 'serie', 'series') : ''].filter(Boolean).join(' y ') || '0 títulos'; };

/* ---------- Vistas ---------- */
function topBar(){ return `<header class="bar"><h1 class="title">Mis películas</h1><div class="bar-actions">${installEvt?'<button class="pill-btn" data-act="install">Instalar</button>':''}${(() => { const n = unreadAlerts(); return `<button class="icon-btn bell" data-act="alerts" aria-label="Avisos${n ? `, ${n} sin ver` : ''}">${ic('bell')}${n ? `<span class="dot-n">${n > 9 ? '9+' : n}</span>` : ''}</button>`; })()}<button class="icon-btn" data-act="settings" aria-label="Ajustes">${ic('gear')}</button><button class="icon-btn icon-btn-solid" data-act="add" aria-label="Agregar">${ic('plus')}</button></div></header>
  <div class="seg" role="tablist">${[['seen','Vistas'],['watch','Por ver'],['stats','Estadísticas']].map(([k,n]) => `<button role="tab" class="${tab===k?'on':''}" data-tab="${k}">${n}</button>`).join('')}</div><!--pane-->`; }
const kindChips = () => movies.some(m => m.kind === 'tv') ? `<div class="chips">${[['all','Todo'],['movie','Películas'],['tv','Series']].map(([k,n]) => `<button class="chip ${kindFilter===k?'on':''}" data-kind="${k}">${n}</button>`).join('')}</div>` : '';
const RELEASED = ['Released','Returning Series','Ended','Canceled'];
let alertsSeen = new Set();
function alertEvents(){ const ev = [], today = todayKey();
  for (const m of movies){ if (m.status !== 'watch') continue;
    if (m.release){ const n = daysTo(m.release); if (n >= -14 && n <= 30 && (m.relStatus !== 'Released' || n >= -14)) ev.push({key:`${m.id}:c:${m.release}`, m, kind:'cine', d:m.release, n}); }
    const dg = trustedDigital(m); if (dg){ const n = daysTo(dg.d); if (n >= -14 && n <= 30) ev.push({key:`${m.id}:d:${dg.d}`, m, kind:'digital', d:dg.d, n}); } }
  return ev.sort((a,b) => Math.abs(a.n) - Math.abs(b.n) || a.d.localeCompare(b.d)); }
const unreadAlerts = () => alertEvents().filter(e => e.n === 0 && !alertsSeen.has(e.key)).length;
const evText = e => e.kind === 'cine' ? (e.m.kind === 'tv' ? (e.n > 0 ? 'Se estrena' : 'Ya se estrenó') : (e.n > 0 ? 'Llega a cines' : e.n === 0 ? 'Llega hoy a cines' : 'Ya está en cines')) : (e.n > 0 ? 'Llega a digital' : e.n === 0 ? 'Hoy sale en digital' : 'Ya está en digital');
const evWhen = e => e.n === 0 ? 'Hoy' : e.n === 1 ? 'Mañana' : e.n === -1 ? 'Ayer' : e.n > 0 ? `En ${e.n} días` : `Hace ${-e.n} días`;
function viewAlerts(){ const ev = alertEvents().filter(e => e.n === 0);
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Hoy</h1><span class="spacer"></span></header>`;
  const row = e => `<button class="alert-row${!alertsSeen.has(e.key) ? ' new' : ''}" data-open="${esc(e.m.id)}"><span class="top-thumb">${posterImg(e.m)}</span><span class="al-main"><b>${esc(e.m.title)}</b><small>${evText(e)}</small></span></button>`;
  h += ev.length ? `<div class="box">${ev.map(row).join('')}</div>` : `<p class="hint">Hoy no se estrena ninguna película de tu lista «Por ver», ni en cines ni en digital. Cuando pase, aquí la verás y la campana tendrá un número.</p>`;
  h += notifCard();
  ev.forEach(e => alertsSeen.add(e.key)); DB.put('meta', {k:'alertsSeen', v:[...alertsSeen].slice(-500)}).catch(() => {});
  return h; }
function notifCard(){ if (!('Notification' in window)) return '';
  const on = Notification.permission === 'granted' && notifOn;
  return `<div class="box notif"><button class="set-row" data-act="toggleNotif" role="switch" aria-checked="${on}"><span>Avisos en el celular<small>${Notification.permission === 'denied' ? 'Los bloqueaste; actívalos en los permisos de la app en Chrome.' : 'Recibe una notificación cuando llegue el día, aunque la app esté cerrada'}</small></span><span class="sw ${on?'on':''}"></span></button></div>`; }
let notifOn = false;
async function setupPeriodic(){ try { const reg = await navigator.serviceWorker.ready; if (!('periodicSync' in reg)) return false;
  const st = await navigator.permissions.query({name:'periodic-background-sync'}).catch(() => ({state:'denied'})); if (st.state !== 'granted') return false;
  await reg.periodicSync.register('peliculas-avisos', {minInterval:12 * 3600e3}); return true; } catch(e){ return false; } }
const isUpcoming = m => (m.release && m.release > todayKey()) || (!m.release && m.relStatus && !RELEASED.includes(m.relStatus));
function shortSyn(t){ t = String(t || '').replace(/\s+/g, ' ').trim(); if (!t) return '';
  const parts = t.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || [t]; let out = '';
  let n = 0; for (const p of parts){ if (out && (n >= 2 || out.length >= 120 || (out + p).length > 240)) break; out += p; n++; }
  out = out.trim(); if (out.length > 240){ out = out.slice(0, 237).replace(/\s+\S*$/, '') + '…'; } return out; }
function trustedDigital(m){ const dg = m.digital; if (!dg || m.kind !== 'movie') return null;
  if (m.release && dg.d < m.release) return null;
  const ref = m.release || dg.d; if (!isUpcoming(m) && daysTo(ref) < -730 && daysTo(dg.d) < -730) return null;
  return dg; }
function badgeFor(m){
  if (m.status === 'seen') return m.rating ? `<span class="score r${rc(m.rating)}">${fr(m.rating)}</span>` : '';
  let b = m.rt ? `<span class="score rt"><i class="${rtFresh(m.rt)?'fresh':'rotten'}"></i>${m.rt}</span>` : '';
  const rk = rtRanks().get(m.id); if (rk) b += `<span class="rank">#${rk}</span>`;
  if (m.top) b += `<span class="pin-tag" aria-label="Fijada arriba">${ic('pin',13)}</span>`;
  if (isUpcoming(m)) b += `<span class="soon">Próximamente</span>`;
  else { const dg = trustedDigital(m); if (dg && daysTo(dg.d) > 0) b += `<span class="soon">Digital en ${daysTo(dg.d)} d</span>`; }
  return b; }
const card = (m, tag = 'button', fixed = false) => `<${tag} class="poster${fixed ? ' fixed' : ''}" ${tag==='button'?`data-open="${esc(m.id)}"`:`data-oid="${esc(m.id)}"`} aria-label="${esc(m.title)}${m.rating&&m.status==='seen'?`, ${fr(m.rating)} de 10`:''}">${posterImg(m) || `<span class="ph">${esc(m.title)}</span>`}${m.kind==='tv'?'<span class="kind">Serie</span>':''}${badgeFor(m)}</${tag}>`;
function viewSeen(){ let h = topBar(); const seen = movies.filter(m => m.status === 'seen');
  if (!seen.length) return h + `<div class="empty"><div class="empty-mark">${ic('film',30)}</div><h2>Tu primera película</h2><p>Busca una película o serie que hayas visto, dale tu puntuación y empieza tu colección.</p><button class="btn btn-primary" data-act="add">Agregar</button></div>`;
  const l = byKind(seen).sort((a,b) => (b.watched||'').localeCompare(a.watched||'') || (b.ratedAt||b.added) - (a.ratedAt||a.added));
  return h + kindChips() + `<p class="toolbar"><span>${countLabel(l)}</span></p><div class="grid">${l.map(m => card(m)).join('')}</div>`; }
let rtList = null;
const normT = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
let rankCache = {key:'', map:new Map()};
function rtRanks(){ if (!rtList) return new Map();
  const key = rtList.updated + ':' + movies.map(m => m.id + m.title + m.year + m.rtT).join('|'); if (rankCache.key === key) return rankCache.map;
  const map = new Map(), entries = rtList.items.map(e => ({...e, n:normT(e.t)}));
  for (const m of movies){ if (m.kind !== 'movie') continue; const ns = [normT(m.title), normT(m.original)].filter(Boolean), yr = +m.year || 0, yOk = (e, tol) => !yr || !e.y || Math.abs(e.y - yr) <= tol;
    let hit = m.rtT ? entries.find(e => e.n === normT(m.rtT) && (!m.rtY || !e.y || e.y === m.rtY)) : null;
    if (!hit) hit = entries.find(e => ns.includes(e.n) && yOk(e, 1));
    if (!hit) hit = entries.find(e => yOk(e, 0) && ns.some(n => n.length > 3 && e.n.length > 3 && (e.n.includes(n) || n.includes(e.n))));
    if (hit) map.set(m.id, hit.r); }
  rankCache = {key, map}; return map; }
async function loadRtList(){
  try { const c = await DB.get('meta', 'rtlist'); if (c && Array.isArray(c.items)) rtList = c; } catch(e){}
  if (!navigator.onLine) return;
  try { const r = await fetch('rt-top300.json', {cache:'no-cache', credentials:'omit'}); if (!r.ok) return; const d = await r.json();
    if (!d || !Array.isArray(d.items)) return;
    const items = d.items.filter(e => e && Number.isInteger(e.r) && typeof e.t === 'string').map(e => ({r:e.r, t:e.t.slice(0,200), y:Number.isInteger(e.y) ? e.y : null})).slice(0, 400);
    rtList = {k:'rtlist', updated:typeof d.updated === 'string' ? d.updated.slice(0,10) : '', items}; await DB.put('meta', rtList); syncLastRanks();
    if (view.name === 'watch' && !odrag && !tswipe) render(); } catch(e){} }
let rtSkip = new Set(), rtIgnore = new Set();
const skipKey = e => normT(e.t) + '|' + (e.y || '');
const missingRT = (all) => { if (!rtList) return []; const have = new Set(rtRanks().values()); return rtList.items.filter(e => !have.has(e.r) && !rtIgnore.has(skipKey(e)) && (all || !rtSkip.has(skipKey(e)))); };
let importing = null;
async function findTmdb(e){
  const pick = (list) => { const n = normT(e.t), ok = (list || []).filter(r => r && r.id);
    return ok.find(r => normT(r.title) === n || normT(r.original_title) === n) || ok.find(r => e.y && Math.abs(+(r.release_date || '').slice(0,4) - e.y) <= 1) || null; };
  const tries = e.y ? [{primary_release_year:e.y}, {year:e.y}, {}] : [{}];
  for (const extra of tries){ const d = await tmdb('/search/movie', Object.assign({query:e.t, include_adult:'false'}, extra)); const r = pick(d.results); if (r) return r.id; }
  return null; }
async function importRT(retry){ if (retry){ rtSkip = new Set(); await DB.put('meta', {k:'rtskip', v:[]}).catch(() => {}); } const todo = missingRT(); if (!todo.length) return toast('Ya tienes todas las películas de la lista.');
  if (!apiKey) return toast('Primero agrega tu clave de TMDB en Ajustes.');
  importing = {stop:false, done:0, added:0, fail:[], total:todo.length};
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>Agregando películas</h2><p id="impText">Preparando…</p><div class="imp-bar"><i id="impBar"></i></div><p class="fine">Deja la app abierta mientras termina. Puedes detenerlo cuando quieras; lo que ya se agregó se queda.</p><button class="btn btn-secondary" data-act="importStop" id="impBtn">Detener</button></div>`, 'dim');
  const paint = () => { const t = $('#impText'), b = $('#impBar'); if (t) t.textContent = `${importing.done} de ${importing.total}: ${plural(importing.added, 'agregada', 'agregadas')}`; if (b) b.style.width = Math.round(importing.done / importing.total * 100) + '%'; };
  for (const e of todo){ if (importing.stop || !ovState) break;
    try { const id = await findTmdb(e); if (!id) throw 0;
      if (!inLib('movie', id)){ const info = await fetchInfo('movie', id), m = clean(Object.assign({id:uid(), added:Date.now(), genres:[], directors:[], cast:[]}, info, {status:'watch', order:0, pos:null, rtT:e.t, rtY:e.y}));
        if (m){ if (m.posterPath) m.poster = await posterData(m.posterPath); await saveM(m); importing.added++; } }
      else { const ex = inLib('movie', id); if (!ex.rtT){ ex.rtT = e.t; ex.rtY = e.y; await saveM(ex); } } }
    catch(err){ if (err && err.badkey){ importing.fail.push(e); break; } importing.fail.push(e); }
    importing.done++; paint(); await new Promise(r => setTimeout(r, 80)); }
  const res = importing; importing = null; syncLastRanks();
  res.fail.forEach(e => rtSkip.add(skipKey(e))); DB.put('meta', {k:'rtskip', v:[...rtSkip]}).catch(() => {});
  if (ovState) resolveSheet(null);
  setTimeout(() => { render(); toast(`Listo: ${plural(res.added, 'película agregada', 'películas agregadas')}${res.fail.length ? `. ${res.fail.length} no se encontraron` : ''}.`);
    if (res.fail.length) openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>No se encontraron</h2><p>Estas no aparecieron en TMDB con su título y año. Puedes buscarlas a mano con «+».</p><div class="box imp-list">${res.fail.map(e => `<div class="row"><span>#${e.r}</span><b>${esc(e.t)}${e.y ? ` (${e.y})` : ''}</b></div>`).join('')}</div><button class="btn btn-primary" data-act="sheetNo">Entendido</button></div>`, 'dim'); }, 300); }
const fixedRank = (m, rk) => rk.has(m.id) && !m.pinned;
const sortKey = (m, rk) => fixedRank(m, rk) ? rk.get(m.id) : m.pos !== null ? m.pos : rk.has(m.id) ? rk.get(m.id) : m.lastRank ? m.lastRank + .5 : 1000 + m.order;
const watchList = () => { const rk = rtRanks(), all = movies.filter(m => m.status === 'watch'), tops = all.filter(m => m.top).sort((a,b) => b.top - a.top), l = all.filter(m => !m.top);
  const out = l.filter(m => !isUpcoming(m)).sort((a,b) => sortKey(a, rk) - sortKey(b, rk) || (fixedRank(b, rk) - fixedRank(a, rk)) || a.order - b.order || b.added - a.added);
  const soon = l.filter(isUpcoming).sort((a,b) => (a.release || '9999').localeCompare(b.release || '9999') || b.added - a.added);
  return [...tops, ...out, ...soon]; };
async function syncLastRanks(){ const rk = rtRanks(); for (const m of movies){ const r = rk.get(m.id); if (r && m.lastRank !== r){ m.lastRank = r; try { await DB.put('movies', m); } catch(e){} } } }
function viewWatch(){ let h = topBar(); const all = watchList(); setTimeout(refreshRT, 0);
  if (!all.length) return h + `<div class="empty"><div class="empty-mark">${ic('plus',30)}</div><h2>Nada pendiente</h2><p>Guarda aquí las películas y series que te recomienden o que quieras ver más adelante.</p>${missingRT().length ? `<button class="btn btn-primary" data-act="importRT">Agregar las ${missingRT().length} de la lista de RT</button><button class="btn btn-secondary" data-act="add">Agregar otra</button>` : '<button class="btn btn-primary" data-act="add">Agregar</button>'}</div>`;
  const rk = rtRanks();
  if (ordering) return h + `<div class="toolbar"><span>Mueve las que no son de la lista de RT</span><button class="pill-btn" data-act="orderDone">Listo</button></div><div class="grid ordering" id="orderGrid">${all.map(m => card(m, 'div', fixedRank(m, rk) || !!m.top)).join('')}</div>`;
  const free = all.filter(m => !fixedRank(m, rk) && !m.top).length, miss = missingRT().length;
  return h + (miss ? `<div class="note-rt"><span>${miss === 1 ? 'Hay 1 película de la lista de RT que no está' : `Hay ${miss} películas de la lista de RT que no están`} en tu app.</span><div class="note-actions"><button class="pill-btn" data-act="importRT">Agregar</button><button class="link-btn" data-act="ignoreRT">No me interesan</button></div></div>` : '') + `<div class="toolbar"><span>${all.length} por ver</span>${free ? '<button class="link-btn" data-act="orderStart">Ordenar</button>' : ''}</div><div class="grid">${all.map(m => card(m)).join('')}</div>`; }
function viewStats(){ let h = topBar(); const seen = movies.filter(m => m.status === 'seen' && m.watched);
  if (!seen.length) return h + `<div class="empty"><div class="empty-mark">${ic('film',30)}</div><h2>Aún no hay datos</h2><p>Cuando agregues películas o series vistas, aquí verás tus números.</p></div>`;
  const now = todayKey(), ym = now.slice(0,7), y = now.slice(0,4), month = seen.filter(m => m.watched.startsWith(ym)), year = seen.filter(m => m.watched.startsWith(y)), mins = l => l.reduce((s,m) => s + (m.kind === 'movie' ? m.runtime || 0 : 0), 0);
  const sub = l => [l.filter(m => m.kind === 'tv').length ? plural(l.filter(m => m.kind === 'tv').length, 'serie', 'series') : '', mins(l) ? hours(mins(l)) + ' de películas' : ''].filter(Boolean).join(', ');
  h += `<div class="stats-head"><div class="metric"><span>Este mes</span><b>${month.filter(m => m.kind === 'movie').length}</b><small>${month.length ? (sub(month) || 'películas') : 'películas'}</small></div><div class="metric"><span>Este año</span><b>${year.filter(m => m.kind === 'movie').length}</b><small>${year.length ? (sub(year) || 'películas') : 'películas'}</small></div></div>`;
  const rated = seen.filter(m => m.rating), counts = Array(11).fill(0); rated.forEach(m => counts[Math.min(10, Math.floor(m.rating))]++); const mx = Math.max(1, ...counts);
  if (rated.length) h += `<h2 class="section">Cómo puntúas</h2><div class="hist">${counts.slice(1).map((c,k) => `<div><small>${c||''}</small><i class="rb${k+1} h${c?Math.max(1,Math.round(c/mx*10)):0}"></i></div>`).join('')}</div><div class="hist-labels">${[1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}</div>`;
  const top = [...rated].sort((a,b) => b.rating - a.rating || (b.watched||'').localeCompare(a.watched||'')).slice(0,10);
  if (top.length) h += `<h2 class="section">Tu top 10</h2><div class="box top">${top.map((m,k) => `<button class="top-row" data-open="${esc(m.id)}"><span>${k+1}</span><span class="top-thumb">${posterImg(m)}</span><b>${esc(m.title)}</b><strong class="r${rc(m.rating)}">${fr(m.rating)}</strong></button>`).join('')}</div>`;
  const rank = (key, l = seen) => { const c = {}; l.forEach(m => m[key].forEach(v => { c[v] = (c[v] || 0) + 1; })); return Object.entries(c).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0,5); };
  const bars = list => { const t = list[0] ? list[0][1] : 1; return `<div class="box bars">${list.map(([n,c]) => `<div class="bar-row"><span>${esc(n)}</span><span>${c}</span><i><b class="w${Math.max(1,Math.round(c/t*10))}"></b></i></div>`).join('')}</div>`; };
  const g = rank('genres'), d = rank('directors', seen.filter(m => m.kind === 'movie'));
  if (g.length) h += `<h2 class="section">Tus géneros favoritos</h2>${bars(g)}`;
  if (d.length && d[0][1] > 1) h += `<h2 class="section">Directores que más has visto</h2>${bars(d.filter(x => x[1] > 1))}`;
  const years = [...new Set(seen.map(m => m.watched.slice(0,4)))].sort().reverse();
  return h + `<h2 class="section">Resumen del año</h2><div class="chips">${years.map(yy => `<button class="chip" data-wrap="${yy}">Tu ${yy}</button>`).join('')}</div>`; }
function viewWrap(){ const yy = String(wrapYear), l = movies.filter(m => m.status === 'seen' && m.watched && m.watched.startsWith(yy)), mv = l.filter(m => m.kind === 'movie'), tv = l.length - mv.length;
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Tu ${yy}</h1><span class="spacer"></span></header>`;
  if (!l.length) return h + `<p class="hint">No hay nada visto en ${yy}.</p>`;
  const mins = mv.reduce((s,m) => s + (m.runtime || 0), 0), rated = l.filter(m => m.rating);
  const best = [...rated].sort((a,b) => b.rating - a.rating || b.watched.localeCompare(a.watched))[0], worst = [...rated].sort((a,b) => a.rating - b.rating || b.watched.localeCompare(a.watched))[0];
  const byMonth = Array(12).fill(0); l.forEach(m => byMonth[+m.watched.slice(5,7) - 1]++); const bm = byMonth.indexOf(Math.max(...byMonth));
  const days = [...new Set(l.map(m => m.watched))].sort(); let streak = 1, run = 1;
  for (let k = 1; k < days.length; k++){ run = daysBetween(days[k-1], days[k]) === 1 ? run + 1 : 1; streak = Math.max(streak, run); }
  const g = {}; l.forEach(m => m.genres.forEach(x => { g[x] = (g[x] || 0) + 1; })); const fav = Object.entries(g).sort((a,b) => b[1] - a[1])[0];
  h += `<div class="wrap-hero"><b>${mv.length}</b><span>${mv.length === 1 ? 'película vista' : 'películas vistas'} en ${yy}${tv ? `, y ${plural(tv, 'serie', 'series')}` : ''}</span></div>`;
  if (mins) h += `<div class="wrap-card"><span>Tiempo viendo películas</span><b>${hours(mins)}</b></div>`;
  if (best) h += `<div class="wrap-card"><span>Tu favorita</span><p>${esc(best.title)}</p><small class="r${rc(best.rating)}">${fr(best.rating)} de 10</small></div>`;
  if (worst && worst !== best && worst.rating < best.rating) h += `<div class="wrap-card"><span>La que menos te gustó</span><p>${esc(worst.title)}</p><small class="r${rc(worst.rating)}">${fr(worst.rating)} de 10</small></div>`;
  h += `<div class="wrap-card"><span>El mes en que más viste</span><p>${MONTHS[bm].charAt(0).toUpperCase() + MONTHS[bm].slice(1)}</p><small>${plural(byMonth[bm], 'título', 'títulos')}</small></div>`;
  if (streak > 1) h += `<div class="wrap-card"><span>Tu racha más larga</span><p>${streak} días seguidos</p></div>`;
  if (fav) h += `<div class="wrap-card"><span>Tu género del año</span><p>${esc(fav[0])}</p><small>${plural(fav[1], 'título', 'títulos')}</small></div>`;
  return h; }
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const PROV_SEARCH = [[/netflix/i, 'https://www.netflix.com/search?q='], [/prime video|amazon/i, 'https://www.primevideo.com/search/?phrase='], [/disney/i, 'https://www.disneyplus.com/search?q='],
  [/hbo|\bmax\b/i, 'https://play.hbomax.com/search?q='], [/apple tv/i, 'https://tv.apple.com/search?term='], [/paramount/i, 'https://www.paramountplus.com/search/?q='], [/crunchyroll/i, 'https://www.crunchyroll.com/search?q='],
  [/mubi/i, 'https://mubi.com/search/films?query='], [/tubi/i, 'https://tubitv.com/search/'], [/pluto/i, 'https://pluto.tv/search/details?query='], [/youtube/i, 'https://www.youtube.com/results?search_query='], [/plex/i, 'https://watch.plex.tv/search?q=']];
const provUrl = (p, m) => { const t = encodeURIComponent(m.title), hit = PROV_SEARCH.find(([re]) => re.test(p.n)); return hit ? hit[1] + t : 'https://www.justwatch.com/sv/buscar?q=' + t; };
const provRow = (label, l, m) => l.length ? `<div class="prov-row"><span>${label}</span><div class="prov">${l.map(p => `<a href="${esc(provUrl(p, m))}" data-copy="${esc(m.title)}" target="_blank" rel="noopener noreferrer" aria-label="Buscar en ${esc(p.n)}">${p.logo ? `<img src="${IMG}w92${p.logo}" alt="${esc(p.n)}" title="${esc(p.n)}">` : `<em>${esc(p.n)}</em>`}</a>`).join('')}</div></div>` : '';
function viewDetail(){ const m = curM(); if (!m){ view = {name:tab}; return ({seen:viewSeen, watch:viewWatch, stats:viewStats}[tab] || viewSeen)(); }
  if (needsExtras(m) && apiKey) setTimeout(() => loadExtras(m), 0);
  const tv = m.kind === 'tv';
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><div class="bar-actions"><button class="icon-btn" data-act="editInfo" aria-label="Editar datos">${ic('edit')}</button></div></header>`;
  h += `<div class="d-top"><div class="d-poster">${posterImg(m)}</div><div>${tv?'<p class="d-kind">Serie</p>':''}<h1 class="d-title">${esc(m.title)}</h1><p class="d-meta">${esc([m.year, tv ? (m.seasons ? plural(m.seasons, 'temporada', 'temporadas') : '') : (m.runtime ? hours(m.runtime) : '')].filter(Boolean).join(', '))}</p>${m.original?`<p class="d-meta">${esc(m.original)}</p>`:''}</div></div>`;
  if (m.overview) h += `<button class="syn-btn" data-act="toggleSyn" aria-expanded="false">${ic('play',14)}<span>Ver sinopsis</span></button><p class="synopsis" id="syn" hidden>${esc(shortSyn(m.overview))}</p>`;
  if (isUpcoming(m)) h += `<div class="digital future"><span>${m.kind === 'tv' ? 'Se estrena' : 'Llega a cines'}</span><b>${m.release ? fmtD(m.release) : 'Fecha por confirmar'}</b>${m.release && daysTo(m.release) > 0 ? `<small>Faltan ${plural(daysTo(m.release), 'día', 'días')}</small>` : ''}</div>`;
  if (m.status === 'seen'){
    h += m.rating ? `<div class="d-score"><b class="r${rc(m.rating)}">${fr(m.rating)}</b><span>de 10, ${word(m.rating).toLowerCase()}</span></div>` : '';
    h += `<p class="d-sub">${m.watched ? `${tv ? 'La terminaste' : 'La viste'} el ${fmtD(m.watched)}.` : ''}</p>`;
    if (m.note) h += `<div class="box"><p class="quote">${esc(m.note)}</p></div>`;
    h += `${m.rating?`<button class="btn btn-primary" data-act="shareRating">${ic('share',18)} Compartir mi puntuación</button>`:''}<button class="btn btn-secondary" data-act="rate">Cambiar puntuación o comentario</button>`;
  } else h += `<button class="btn btn-primary" data-act="markSeen">Ya la vi</button>`;
  if (m.trailerEs) h += `<a class="btn btn-secondary" href="https://www.youtube.com/watch?v=${m.trailerEs}" target="_blank" rel="noopener noreferrer">${ic('play',18)} Tráiler en español latino</a>`;
  else h += `<a class="btn btn-ghost btn-sm" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${m.title} ${m.year} ${m.kind === 'tv' ? 'serie' : ''} tráiler español latino`.replace(/\s+/g, ' ').trim())}" target="_blank" rel="noopener noreferrer">${ic('ext',16)} Buscar tráiler en español latino en YouTube</a>`;
  if (m.trailer) h += `<a class="btn btn-secondary" href="https://www.youtube.com/watch?v=${m.trailer}" target="_blank" rel="noopener noreferrer">${ic('play',18)} Tráiler en inglés</a>`;
  if (m.prov){ const p = m.prov, any = p.flat.length || p.free.length;
    h += `<h2 class="section">Dónde verla en El Salvador</h2><div class="box">${any ? provRow('Suscripción', p.flat, m) + provRow('Gratis', p.free, m) : '<p class="fine">No está incluida en ninguna plataforma de suscripción en El Salvador.</p>'}</div>`; }
  if (!tv){ const dg = trustedDigital(m); if (dg){ const n = daysTo(dg.d), where = dg.cc ? ` en ${COUNTRY[dg.cc] || dg.cc}` : '';
    h += `<div class="digital${n > 0 ? ' future' : ''}"><span>${n > 0 ? 'Llega a digital' : 'Estreno en digital'}</span><b>${fmtD(dg.d)}${where}</b>${n > 0 ? `<small>Faltan ${plural(n, 'día', 'días')}</small>` : ''}${dg.fd ? `<em>Antes salió en ${COUNTRY[dg.fcc] || dg.fcc} el ${fmtD(dg.fd)}</em>` : ''}</div>`; } }
  const rank = rtRanks().get(m.id), info = [['Crítica en Rotten Tomatoes', m.rt], ['300 mejores de RT', rank ? `Puesto ${rank}` : ''], ['Géneros', m.genres.join(', ')]].filter(x => x[1]);
  const dirs = m.dirs.length ? m.dirs : m.directors.map(n => ({n, id:null}));
  if (info.length || dirs.length) h += `<div class="box">${dirs.length ? `<div class="row"><span>${tv ? 'Creada por' : 'Dirección'}</span><b class="names">${dirs.map(d => d.id ? `<button class="name" data-person="${d.id}">${esc(d.n)}</button>` : esc(d.n)).join(', ')}</b></div>` : ''}${info.map(([k,v]) => `<div class="row"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  if (m.cast.length) h += `<h2 class="section">Actores principales</h2><div class="box">${m.cast.map(c => c.id ? `<button class="row cast" data-person="${c.id}"><b>${esc(c.n)}</b>${c.c?`<span>${esc(c.c)}</span>`:''}</button>` : `<div class="row cast"><b>${esc(c.n)}</b>${c.c?`<span>${esc(c.c)}</span>`:''}</div>`).join('')}</div>`;
  return h + `<button class="btn btn-danger-text mt" data-act="delete">Eliminar</button>`; }
function viewAdd(){ let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Buscar</h1><span class="spacer"></span></header>`;
  if (!apiKey) return h + `<div class="hint">Para buscar películas y series con su cartel y sus datos, agrega tu clave de TMDB en Ajustes.<button class="btn btn-primary" data-act="settings">Ir a Ajustes</button><button class="btn btn-secondary" data-act="manual">Agregar a mano</button></div>`;
  return h + `<div class="search"><div class="seg">${[['movie','Películas'],['tv','Series'],['person','Actores y directores']].map(([k,n]) => `<button class="${searchKind===k?'on':''}" data-skind="${k}">${n}</button>`).join('')}</div><input id="q" type="search" placeholder="${searchKind==='person'?'Nombre del actor o director':'Busca por título'}" value="${esc(query)}" aria-label="Buscar" enterkeyhint="search" ${NO_SPELL}></div><div id="results">${resultsHTML()}</div>`; }
const inLib = (kind, id) => movies.find(m => m.kind === kind && m.tmdb === id);
function libTag(kind, id){ const m = inLib(kind, id); return !m ? '' : m.status === 'seen' ? (m.rating ? `<span class="lib r${rc(m.rating)}">${fr(m.rating)}</span>` : '<span class="lib">Vista</span>') : '<span class="lib">Por ver</span>'; }
function resultsHTML(){
  if (searching) return '<div class="spin" aria-label="Buscando"></div>';
  if (!query.trim()) return `<p class="hint">${searchKind==='person' ? 'Busca a un actor, actriz o director para ver sus películas y series.' : 'Escribe el título, en español o en su idioma original.'}</p>`;
  if (results === null) return '';
  if (results.error) return `<p class="hint">${esc(results.error)}</p>`;
  if (!results.length) return `<div class="hint">No encontré resultados.${searchKind!=='person'?'<button class="btn btn-secondary" data-act="manual">Agregar a mano</button>':''}</div>`;
  if (searchKind === 'person') return `<div class="results">${results.map(r => `<button class="res" data-person="${r.id}"><span class="res-thumb round">${PATH_RE.test(r.profile_path||'')?`<img src="${IMG}w185${r.profile_path}" alt="" loading="lazy">`:ic('user',20)}</span><span><b>${esc(r.name)}</b><small>${esc([dept(r.known_for_department), (r.known_for || []).map(k => k.title || k.name).filter(Boolean).slice(0,2).join(', ')].filter(Boolean).join('. '))}</small></span></button>`).join('')}</div>`;
  return `<div class="results">${results.map(r => { const t = r.title || r.name, o = r.original_title || r.original_name, d = r.release_date || r.first_air_date || '';
    return `<button class="res" data-add="${searchKind}:${r.id}"><span class="res-thumb">${PATH_RE.test(r.poster_path||'')?`<img src="${IMG}w92${r.poster_path}" alt="" loading="lazy">`:''}</span><span><b>${esc(t)}</b><small>${esc([d.slice(0,4), o && o !== t ? o : ''].filter(Boolean).join(', '))}</small></span>${libTag(searchKind, r.id)}</button>`; }).join('')}</div><div class="hint"><button class="btn btn-ghost" data-act="manual">¿No está? Agregar a mano</button></div>`; }
const dept = d => ({Acting:'Actuación', Directing:'Dirección', Writing:'Guion', Production:'Producción'})[d] || '';
function viewPerson(){ const p = people.get(view.pid);
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">${p ? esc(p.name) : ''}</h1><span class="spacer"></span></header>`;
  if (!p) { loadPerson(view.pid); return h + '<div class="spin" aria-label="Cargando"></div>'; }
  if (p.error) return h + `<p class="hint">${esc(p.error)}</p>`;
  const roles = [['cast', 'Actuación', p.cast], ['crew', 'Dirección', p.crew]].filter(r => r[2].length); if (!roles.find(r => r[0] === personRole)) personRole = roles.length ? roles[0][0] : 'cast';
  const list = (roles.find(r => r[0] === personRole) || [0,0,[]])[2], seen = list.filter(c => { const m = inLib(c.kind, c.id); return m && m.status === 'seen'; }).length;
  h += `<div class="person"><span class="person-photo">${PATH_RE.test(p.photo||'')?`<img src="${IMG}w185${p.photo}" alt="">`:ic('user',34)}</span><div><h1 class="d-title">${esc(p.name)}</h1><p class="d-meta">${esc(dept(p.dept))}</p>${seen?`<p class="d-meta">Has visto ${plural(seen, 'título', 'títulos')}</p>`:''}</div></div>`;
  if (roles.length > 1) h += `<div class="chips">${roles.map(([k,n]) => `<button class="chip ${personRole===k?'on':''}" data-role="${k}">${n}</button>`).join('')}</div>`;
  if (!list.length) return h + '<p class="hint">No hay títulos para mostrar.</p>';
  return h + `<div class="grid">${list.map(c => { const m = inLib(c.kind, c.id); return `<button class="poster" ${m ? `data-open="${esc(m.id)}"` : `data-add="${c.kind}:${c.id}"`} aria-label="${esc(c.title)}">${PATH_RE.test(c.poster||'')?`<img src="${IMG}w342${c.poster}" alt="" loading="lazy">`:`<span class="ph">${esc(c.title)}</span>`}${c.kind==='tv'?'<span class="kind">Serie</span>':''}${m ? (m.status === 'seen' && m.rating ? `<span class="score r${rc(m.rating)}">${fr(m.rating)}</span>` : `<span class="score">${m.status === 'seen' ? 'Vista' : 'Por ver'}</span>`) : (c.year ? `<span class="year">${c.year}</span>` : '')}</button>`; }).join('')}</div>`; }
async function loadPerson(id){ if (people.has(id) || loadPerson.busy === id) return; loadPerson.busy = id;
  try { const d = await tmdb(`/person/${id}`, {append_to_response:'combined_credits'}); const cc = d.combined_credits || {};
    const norm = (l, crew) => { const seen = new Set(); return (l || []).filter(c => (c.media_type === 'movie' || c.media_type === 'tv') && (!crew || c.job === 'Director' || c.job === 'Creator') && !(c.genre_ids || []).some(g => g === 10767 || g === 10763) && !/^(self|himself|herself|narrator)\b/i.test(c.character || ''))
      .map(c => ({kind:c.media_type, id:c.id, title:c.title || c.name || '', poster:c.poster_path || '', year:(c.release_date || c.first_air_date || '').slice(0,4), pop:c.popularity || 0}))
      .filter(c => { const k = c.kind + c.id; if (seen.has(k) || !c.title) return false; seen.add(k); return true; })
      .sort((a,b) => (b.year || '0').localeCompare(a.year || '0') || b.pop - a.pop).slice(0, 120); };
    people.set(id, {name:d.name || '', photo:d.profile_path || '', dept:d.known_for_department || '', cast:norm(cc.cast, false), crew:norm(cc.crew, true)});
    personRole = (d.known_for_department === 'Directing' && people.get(id).crew.length) ? 'crew' : 'cast'; }
  catch(e){ people.set(id, {name:'', error:e.badkey ? 'Tu clave de TMDB no funciona.' : 'No se pudo cargar. Revisa tu conexión.', cast:[], crew:[]}); }
  loadPerson.busy = null; if (view.name === 'person' && view.pid === id) render(); }
function photoSlot(){ const src = draft.poster || (draft.posterPath ? IMG + 'w342' + draft.posterPath : ''); return `<div class="photo-slot" id="photoSlot">${src?`<img src="${src}" alt=""><button type="button" class="photo-x" data-act="rmPoster" aria-label="Quitar cartel">${ic('x',16)}</button>`:`<label class="photo-pick">${ic('camera')}<span>Cartel</span><input type="file" accept="image/*" id="f_poster" hidden></label>`}</div>`; }
function viewForm(){ const d = draft, tv = d.kind === 'tv';
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Cancelar">${ic('x')}</button><h1 class="title title-sm">${d._new?'Agregar a mano':'Editar datos'}</h1><button class="btn-save" data-act="saveForm">${d._new?'Siguiente':'Guardar'}</button></header>
  ${d._new?`<div class="field"><span>Tipo</span><div class="seg">${[['movie','Película'],['tv','Serie']].map(([k,n]) => `<button type="button" class="${d.kind===k?'on':''}" data-fkind="${k}">${n}</button>`).join('')}</div></div>`:''}
  <label class="field"><span>Título</span><input id="f_title" value="${esc(d.title)}" maxlength="200" ${NO_SPELL}><em class="err" id="e_title"></em></label>
  <div class="two"><label class="field"><span>Año</span><input id="f_year" inputmode="numeric" maxlength="4" value="${esc(d.year)}" placeholder="2024" ${NO_SPELL}></label>${tv?`<label class="field"><span>Temporadas</span><input id="f_seasons" inputmode="numeric" value="${d.seasons||''}" placeholder="3" ${NO_SPELL}></label>`:`<label class="field"><span>Duración (minutos)</span><input id="f_runtime" inputmode="numeric" value="${d.runtime||''}" placeholder="120" ${NO_SPELL}></label>`}</div>
  <label class="field"><span>${tv?'Creada por':'Dirección'}</span><input id="f_dir" value="${esc(d.directors.join(', '))}" ${NO_SPELL}></label>
  <label class="field"><span>Actores principales</span><input id="f_cast" value="${esc(d.cast.map(c => c.n).join(', '))}" ${NO_SPELL}><small>Sepáralos con comas.</small></label>
  <label class="field"><span>Tráiler en español latino (YouTube)</span><input id="f_trailerEs" type="url" inputmode="url" value="${d.trailerEs?'https://www.youtube.com/watch?v='+d.trailerEs:''}" placeholder="https://youtu.be/..." ${NO_SPELL}><em class="err" id="e_trailerEs"></em></label>
  <label class="field"><span>Tráiler en inglés (YouTube)</span><input id="f_trailer" type="url" inputmode="url" value="${d.trailer?'https://www.youtube.com/watch?v='+d.trailer:''}" placeholder="https://youtu.be/..." ${NO_SPELL}><em class="err" id="e_trailer"></em></label>
  <label class="field"><span>Géneros</span><input id="f_genres" value="${esc(d.genres.join(', '))}" placeholder="Drama, Comedia" ${NO_SPELL}><small>Sepáralos con comas.</small></label>
  <div class="field"><span>Cartel</span>${photoSlot()}</div>`; }
function viewSettings(){ const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Ajustes</h1><span class="spacer"></span></header>
  <h2 class="section">Clave de TMDB</h2><div class="box"><label class="field"><span>Clave de API o token de lectura</span><input id="k_key" type="password" value="${esc(apiKey)}" placeholder="Pega aquí tu clave" ${NO_SPELL}><em class="err" id="e_key"></em><small>Se guarda solo en este celular. La consigues gratis en themoviedb.org, en tu perfil → Ajustes → API.</small></label><button class="btn btn-primary" data-act="saveKey">Guardar y probar</button></div>
  <h2 class="section">Rotten Tomatoes</h2><div class="box"><label class="field"><span>Clave de OMDb</span><input id="o_key" type="password" value="${esc(omdbKey)}" placeholder="Opcional" ${NO_SPELL}><em class="err" id="e_okey"></em><small>Con esta clave, en «Por ver» aparece el porcentaje de la crítica en Rotten Tomatoes. La consigues gratis en omdbapi.com.</small></label><button class="btn btn-primary" data-act="saveOmdb">Guardar y probar</button></div>
  ${rtList ? `<h2 class="section">Lista de las 300 mejores de RT</h2><div class="box">${missingRT().length ? `<button class="set-row" data-act="importRT"><span>Agregar las que me faltan<small>${plural(missingRT().length, 'película de la lista no está', 'películas de la lista no están')} en tu app</small></span><span class="chev">${ic('plus',18)}</span></button>` : '<p class="fine">Ya tienes todas las películas de la lista.</p>'}${missingRT(true).length > missingRT().length ? `<button class="set-row" data-act="importRetry"><span>Reintentar las que no se encontraron<small>${plural(missingRT(true).length - missingRT().length, 'película', 'películas')}</small></span><span class="chev">${ic('chev',18)}</span></button>` : ''}${rtIgnore.size ? `<button class="set-row" data-act="unignoreRT"><span>Volver a mostrar las que ignoraste<small>${plural(rtIgnore.size, 'película ignorada', 'películas ignoradas')}</small></span><span class="chev">${ic('chev',18)}</span></button>` : ''}<p class="fine">Lista actualizada el ${fmtD(rtList.updated)}.</p></div>` : ''}
  <h2 class="section">Instalación</h2><div class="box">${standalone?'<p class="fine">Ya estás usando la app instalada.</p>':installEvt?`<button class="set-row" data-act="install"><span>Instalar Mis películas en el celular<small>Queda como una app con su propio ícono</small></span><span class="chev">${ic('down',18)}</span></button>`:'<p class="fine">Chrome todavía no ofrece instalarla. Abre la app en Chrome con internet, espera unos segundos y vuelve a entrar aquí.</p>'}</div>
  <h2 class="section">Copia de seguridad</h2><div class="box">
  <button class="set-row" data-act="exportBk"><span>Descargar copia<small>Tus películas, series, puntuaciones y carteles</small></span><span class="chev">${ic('down',18)}</span></button>
  <label class="set-row"><span>Restaurar una copia<small>Agrega lo que tenga el archivo</small></span><span class="chev">${ic('up',18)}</span><input type="file" accept="application/json,.json" id="f_import" hidden></label></div>
  <button class="btn btn-danger-text mt" data-act="wipe">Borrar todo</button>
  <p class="fine">Los datos, carteles y tráileres vienen de TMDB; las plataformas, de JustWatch; y las calificaciones de Rotten Tomatoes, de OMDb. Esta app usa la API de TMDB, pero no está respaldada ni certificada por TMDB.</p><p class="ver">Versión ${APP_VERSION}</p>`; }
function render(){ const r = renderHTML(); main.innerHTML = r.includes('<!--pane-->') ? r.replace('<!--pane-->', '<div class="pane" id="pane">') + '</div>' : r; }
function renderHTML(){ const f = {alerts:viewAlerts, seen:viewSeen, watch:viewWatch, stats:viewStats, wrap:viewWrap, detail:viewDetail, add:viewAdd, form:viewForm, settings:viewSettings, person:viewPerson}[view.name] || viewSeen; return f(); }

/* ---------- Búsqueda ---------- */
function runSearch(){ clearTimeout(searchTimer); if (searchCtl) searchCtl.abort(); const q = query.trim();
  if (!q){ searching = false; results = null; paintResults(); return; }
  searching = true; paintResults();
  searchTimer = setTimeout(async () => { const ctl = searchCtl = new AbortController();
    try { const d = await tmdb(`/search/${searchKind}`, {query:q, include_adult:'false'}, ctl.signal); if (ctl !== searchCtl) return; results = (d.results || []).slice(0, 20); }
    catch(e){ if (e.name === 'AbortError') return; results = {error: e.badkey ? 'Tu clave de TMDB no funciona. Revísala en Ajustes.' : 'No se pudo buscar. Revisa tu conexión a internet.'}; }
    searching = false; paintResults(); }, 380); }
function paintResults(){ const r = $('#results'); if (r) r.innerHTML = resultsHTML(); }

/* ---------- Flujos ---------- */
async function addFlow(info){
  if (info.tmdb){ const ex = inLib(info.kind, info.tmdb); if (ex){ toast('Ya está en tu colección'); go({name:'detail', id:ex.id}); return; } }
  const choice = await chooseBox(info); if (!choice) return;
  const m = clean(Object.assign({id:uid(), added:Date.now(), genres:[], directors:[], cast:[]}, info, {status:choice, order:0, pos:choice === 'watch' ? -Date.now() / 1e13 : null}));
  if (choice === 'seen'){ const r = await rateBox(m); if (!r) return; Object.assign(m, r); }
  if (!m.poster && m.posterPath) m.poster = await posterData(m.posterPath);
  await saveM(m); go({name:'detail', id:m.id});
  if (choice === 'seen') offerShare(m, true); else toast('Agregada a por ver');
  if (choice === 'watch' && omdbKey) fetchRT(m).then(() => saveM(m)).then(() => { if (view.name === 'detail' && view.id === m.id) render(); }).catch(() => {}); }
function paintRate(v, buzz = true){ const n = $('#rateNum'); if (!n) return; n.textContent = fr(v); n.className = 'rate-num r' + rc(v); $('#rateWord').textContent = word(v); if (buzz && Number.isInteger(Math.round(v * 10) / 10)) { try { if (navigator.vibrate) navigator.vibrate(6); } catch(err){} } }
function readRate(){ const d = $('#rateDate').value; return {ratedAt:Date.now(), rating:Math.round(+$('#rateIn').value * 10) / 10, watched:/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayKey(), note:$('#rateNote').value.trim()}; }
function compress(file){ return new Promise((res, rej) => { if (file.size > 40e6) return rej(); const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const w = Math.min(500, img.width), s = w / img.width, c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(); }; img.src = url; }); }

/* ---------- Mantener presionado en «Por ver» ---------- */
let lp = null, lpFired = 0;
document.addEventListener('pointerdown', e => { const p = !ordering && view.name === 'watch' && e.target.closest('#pane .grid .poster[data-open]'); if (!p || !e.isPrimary) return;
  lp = {x:e.clientX, y:e.clientY, id:p.dataset.open, el:p, t:setTimeout(() => { if (!lp) return; lpFired = Date.now(); p.classList.add('pressed'); try { if (navigator.vibrate) navigator.vibrate(15); } catch(err){} const id = lp.id; lp = null; tswipe = null; setTimeout(() => p.classList.remove('pressed'), 250); posterMenu(id); }, 480)}; }, {passive:true});
document.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10){ clearTimeout(lp.t); lp = null; } }, {passive:true});
['pointerup','pointercancel'].forEach(ev => document.addEventListener(ev, () => { if (lp){ clearTimeout(lp.t); lp = null; } }));
document.addEventListener('contextmenu', e => { if (e.target.closest('.grid .poster')) e.preventDefault(); });
function watchPositions(){ return watchList().filter(m => m.top || !isUpcoming(m)); }
function posterMenu(id){ const m = movies.find(x => x.id === id); if (!m) return; const l = watchPositions(), idx = l.findIndex(x => x.id === id), rk = rtRanks();
  const opts = [];
  opts.push(m.top ? ['mUnpin', 'Quitar de arriba'] : ['mPin', 'Fijar arriba']);
  if (idx >= 0){ opts.push(['mvNext', 'Mover junto a otra…']); if (idx > l.filter(x => x.top).length && !m.top) opts.push(['mvTop', 'Mover al inicio']); if (idx < l.length - 1) opts.push(['mvEnd', 'Mover al final']); opts.push(['mvPos', 'Mover a la posición…']);
    if (rk.has(m.id) && m.pinned) opts.push(['mvRank', `Regresar a su puesto de RT (#${rk.get(m.id)})`]); }
  opts.push(['mSeen', 'Ya la vi']); if (m.trailerEs || m.trailer) opts.push(['mTrailer', m.trailerEs ? 'Ver tráiler en español' : 'Ver tráiler']); opts.push(['mOpen', 'Abrir ficha'], ['mDel', 'Quitar de mi lista']);
  sheetRes = null; menuFor = id;
  openOverlay(`<div class="sheet menu" role="dialog" aria-modal="true"><div class="menu-head"><span class="top-thumb">${posterImg(m)}</span><div><h2>${esc(m.title)}</h2><p>${idx >= 0 ? `Posición ${idx + 1} de ${l.length}` : 'Aún no se estrena'}</p></div></div>${opts.map(([a, t]) => `<button class="menu-item${a === 'mDel' ? ' danger' : ''}" data-act="${a}">${t}</button>`).join('')}<button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }
let menuFor = null;
async function placeAt(m, index){ m.top = null; const rk = rtRanks(), all = watchPositions().filter(x => x.id !== m.id), nTop = all.filter(x => x.top).length, l = all.filter(x => !x.top), i = Math.max(0, Math.min(l.length, index - nTop));
  const key = x => sortKey(x, rk), prev = i > 0 ? key(l[i-1]) : null, next = i < l.length ? key(l[i]) : null;
  m.pos = prev === null && next === null ? 0 : prev === null ? next - 1 : next === null ? prev + 1 : (prev + next) / 2; m.pinned = rk.has(m.id);
  await saveM(m); render(); toast(`Ahora está en la posición ${watchPositions().findIndex(x => x.id === m.id) + 1}`); }
function closeMenu(then){ const id = menuFor; menuFor = null; closing = {v:null}; history.back(); const wait = () => closing ? setTimeout(wait, 20) : then(movies.find(x => x.id === id)); setTimeout(wait, 20); }

/* ---------- Deslizar entre pestañas ---------- */
let tswipe = null, swipedAt = 0;
document.addEventListener('pointerdown', e => { tswipe = null;
  if (!e.isPrimary || !TABS.includes(view.name) || ordering || ovState || odrag) return;
  if (e.target.closest('.chips, input, textarea, select, #orderGrid, .bar-actions')) return;
  tswipe = {x0:e.clientX, y0:e.clientY, lx:e.clientX, lt:performance.now(), v:0, dx:0, active:false}; }, {passive:true});
document.addEventListener('pointermove', e => { const s = tswipe; if (!s || !e.isPrimary) return; const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
  if (!s.active){ if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; if (Math.abs(dx) < Math.abs(dy) * 1.15){ tswipe = null; return; } s.active = true; s.pane = $('#pane'); if (s.pane) s.pane.style.transition = 'none'; }
  const t = performance.now(); if (t > s.lt) s.v = s.v * .4 + (e.clientX - s.lx) / (t - s.lt) * .6; s.lx = e.clientX; s.lt = t; s.dx = dx;
  const i = TABS.indexOf(tab), edge = (i === 0 && dx > 0) || (i === TABS.length - 1 && dx < 0), d = edge ? dx * .22 : dx;
  if (s.pane){ s.pane.style.transform = `translateX(${d.toFixed(1)}px)`; s.pane.style.opacity = String(1 - Math.min(.45, Math.abs(d) / 900)); } }, {passive:true});
function endTabSwipe(cancel){ const s = tswipe; tswipe = null; if (!s || !s.active) return; swipedAt = Date.now();
  const i = TABS.indexOf(tab), next = !cancel && (s.dx < -60 || (s.v < -.35 && s.dx < -18)) && i < TABS.length - 1 ? i + 1 : !cancel && (s.dx > 60 || (s.v > .35 && s.dx > 18)) && i > 0 ? i - 1 : -1, p = s.pane;
  if (!p) return;
  if (next < 0){ p.style.transition = 'transform .32s cubic-bezier(.2,1.1,.3,1), opacity .25s'; p.style.transform = ''; p.style.opacity = ''; return; }
  const dir = next > i ? -1 : 1, W = window.innerWidth;
  p.style.transition = 'transform .17s ease-in, opacity .17s ease-in'; p.style.transform = `translateX(${dir * W * .6}px)`; p.style.opacity = '0';
  try { if (navigator.vibrate) navigator.vibrate(6); } catch(e){}
  setTimeout(async () => { await resetToRoot(TABS[next]); const n = $('#pane'); if (!n) return;
    n.style.transition = 'none'; n.style.transform = `translateX(${-dir * W * .35}px)`; n.style.opacity = '0'; void n.offsetWidth;
    n.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1), opacity .25s ease-out'; n.style.transform = ''; n.style.opacity = ''; }, 170); }
document.addEventListener('pointerup', () => endTabSwipe(false));
document.addEventListener('pointercancel', () => endTabSwipe(true));

/* ---------- Compartir puntuación ---------- */
let shareCache = null;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
function rateColor(r){ const t = (r - 1) / 9, g = [142,142,150], o = [240,196,90]; return `rgb(${g.map((v,i) => Math.round(v + (o[i] - v) * t)).join(',')})`; }
function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function posterForCanvas(m){
  if (m.poster) { try { return await loadImg(m.poster); } catch(e){} }
  if (m.posterPath) { try { const r = await fetch(IMG + 'w500' + m.posterPath, {referrerPolicy:'no-referrer', credentials:'omit'}); if (r.ok){ const u = URL.createObjectURL(await r.blob()); const i = await loadImg(u); setTimeout(() => URL.revokeObjectURL(u), 5000); return i; } } catch(e){} }
  return null; }
function rrect(x, a, b, w, h, r){ x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else { x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); } }
function wrapText(x, text, max, lines){ const words = text.split(/\s+/), out = []; let cur = '';
  for (const w of words){ const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width <= max) cur = t; else { if (cur) out.push(cur); cur = w; } if (out.length === lines) break; }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(' ') !== out.join(' ')){ let l = out[lines-1]; while (l && x.measureText(l + '…').width > max) l = l.slice(0, -1); out[lines-1] = l.trimEnd() + '…'; }
  return out; }
async function makeCard(m){
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  const img = await posterForCanvas(m), pw = 640, ph = 960, px = (W - pw) / 2, py = 70;
  if (img){ x.save(); x.filter = 'blur(60px)'; x.globalAlpha = .35; const s = Math.max(W / img.width, 700 / img.height); x.drawImage(img, (W - img.width * s) / 2, -60, img.width * s, img.height * s); x.restore();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, 'rgba(0,0,0,.85)'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 50; x.shadowOffsetY = 20; rrect(x, px, py, pw, ph, 30); x.fillStyle = '#16161A'; x.fill(); x.restore();
  x.save(); rrect(x, px, py, pw, ph, 30); x.clip();
  if (img){ const s = Math.max(pw / img.width, ph / img.height), w = img.width * s, h = img.height * s; x.drawImage(img, px + (pw - w) / 2, py + (ph - h) / 2, w, h); }
  x.restore();
  const num = fr(m.rating), col = rateColor(m.rating); x.textAlign = 'left';
  x.font = `800 190px ${FONT}`; const wn = x.measureText(num).width; x.font = `600 72px ${FONT}`; const w10 = x.measureText('/10').width;
  const gap = 14, x0 = (W - (wn + gap + w10)) / 2, base = H - 95;
  x.fillStyle = col; x.font = `800 190px ${FONT}`; x.fillText(num, x0, base);
  x.fillStyle = '#F2F2F4'; x.font = `600 72px ${FONT}`; x.fillText('/10', x0 + wn + gap, base);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  const name = (m.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'pelicula') + `-${fr(m.rating).replace('.', '-')}.png`;
  return {key:`${m.id}:${m.rating}:${m.updated}`, file:new File([blob], name, {type:'image/png'}), url:URL.createObjectURL(blob)}; }
async function offerShare(m, ask){ if (!m.rating) return; toast('Preparando imagen…');
  let card; try { card = await makeCard(m); } catch(e){ toast('No se pudo crear la imagen.'); return; }
  if (shareCache && shareCache.url) URL.revokeObjectURL(shareCache.url); shareCache = card;
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${ask ? '¿Compartir tu puntuación?' : 'Compartir tu puntuación'}</h2><img class="share-prev" src="${card.url}" alt="Vista previa de la imagen para compartir"><button class="btn btn-primary" data-act="doShare">${ic('share',18)} Compartir</button><button class="btn btn-ghost" data-act="sheetNo">${ask ? 'Ahora no' : 'Cancelar'}</button></div>`, 'dim');
  $('#toast').classList.remove('show'); }
async function doShare(){ const c = shareCache; if (!c) return;
  try {
    if (navigator.canShare && navigator.canShare({files:[c.file]})) { await navigator.share({files:[c.file]}); resolveSheet(null); return; }
    const a = document.createElement('a'); a.href = c.url; a.download = c.file.name; document.body.appendChild(a); a.click(); a.remove(); toast('Imagen descargada. Compártela desde tu galería.'); resolveSheet(null);
  } catch(e){ if (e && e.name === 'AbortError') return; toast('No se pudo compartir. Inténtalo otra vez.'); } }

/* ---------- Ordenar «Por ver» ---------- */
function orderMove(){ const d = odrag; if (!d) return; const grid = $('#orderGrid'); if (!grid) return;
  const g = grid.getBoundingClientRect(), slot = i => ({left:g.left + i.offsetLeft, top:g.top + i.offsetTop, w:i.offsetWidth, h:i.offsetHeight});
  const items = [...grid.children], target = items.find(i => { if (i === d.el) return false; const r = slot(i); return d.x >= r.left && d.x <= r.left + r.w && d.y >= r.top && d.y <= r.top + r.h; });
  if (target){ const before = new Map(items.filter(i => i !== d.el).map(i => [i, i.getBoundingClientRect()]));
    const ti = items.indexOf(target), ei = items.indexOf(d.el); grid.insertBefore(d.el, ti < ei ? target : target.nextSibling);
    before.forEach((b, i) => { i.style.transition = 'none'; i.style.transform = ''; const a = i.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top; if (!dx && !dy) return;
      i.style.transform = `translate(${dx}px,${dy}px)`; void i.offsetWidth; i.style.transition = 'transform .26s cubic-bezier(.2,.8,.2,1)'; i.style.transform = ''; });
    try { if (navigator.vibrate) navigator.vibrate(5); } catch(e){} }
  const r = slot(d.el); d.el.style.transform = `translate(${(d.x - d.ox - r.left).toFixed(1)}px,${(d.y - d.oy - r.top).toFixed(1)}px) scale(1.06)`; }
function orderLoop(){ const d = odrag; if (!d) return; const edge = 110; let v = 0;
  if (d.y < edge) v = -Math.ceil((edge - d.y) / 8); else if (d.y > innerHeight - edge) v = Math.ceil((d.y - (innerHeight - edge)) / 8);
  if (v){ window.scrollBy(0, v); orderMove(); } d.raf = requestAnimationFrame(orderLoop); }
async function orderEnd(){ const d = odrag; if (!d) return; odrag = null; cancelAnimationFrame(d.raf);
  d.el.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; d.el.style.transform = ''; setTimeout(() => { d.el.classList.remove('dragging'); d.el.style.transition = ''; }, 230);
  const rk = rtRanks(), list = [...$('#orderGrid').children].map(e => movies.find(x => x.id === e.dataset.oid)).filter(Boolean), changed = new Set();
  let k = 0;
  const fx = m => fixedRank(m, rk) || !!m.top;
  while (k < list.length){ if (fx(list[k])){ k++; continue; }
    let j = k; while (j < list.length && !fx(list[j])) j++;
    const prev = k > 0 ? rk.get(list[k-1].id) : 0, next = j < list.length ? rk.get(list[j].id) : prev + 1, run = list.slice(k, j);
    run.forEach((m, i) => { const p = prev + (i + 1) / (run.length + 1) * (next - prev); if (m.pos !== p){ m.pos = p; changed.add(m); } });
    k = j; }
  list.forEach((m, i) => { if (m.order !== i){ m.order = i; changed.add(m); } });
  for (const m of changed){ try { await DB.put('movies', m); } catch(e){} } }
document.addEventListener('pointerdown', e => { const el = ordering && e.target.closest('#orderGrid .poster'); if (!el || !e.isPrimary || el.classList.contains('fixed')) return; e.preventDefault();
  const r = el.getBoundingClientRect(); odrag = {el, x:e.clientX, y:e.clientY, ox:e.clientX - r.left, oy:e.clientY - r.top, pid:e.pointerId};
  try { el.setPointerCapture(e.pointerId); } catch(err){} el.classList.add('dragging'); orderMove(); odrag.raf = requestAnimationFrame(orderLoop);
  try { if (navigator.vibrate) navigator.vibrate(10); } catch(err){} });
document.addEventListener('pointermove', e => { if (!odrag || e.pointerId !== odrag.pid) return; odrag.x = e.clientX; odrag.y = e.clientY; orderMove(); });
document.addEventListener('pointerup', e => { if (odrag && e.pointerId === odrag.pid) orderEnd(); });
document.addEventListener('pointercancel', e => { if (odrag && e.pointerId === odrag.pid) orderEnd(); });

/* ---------- Acciones ---------- */
const A = {
  settings(){ go({name:'settings'}); },
  add(){ query = ''; results = null; go({name:'add'}); setTimeout(() => { const q = $('#q'); if (q) q.focus(); }, 60); },
  back(){ back(); },
  alerts(){ go({name:'alerts'}); },
  mvTop(){ closeMenu(m => m && placeAt(m, 0)); },
  mPin(){ closeMenu(async m => { if (!m) return; m.top = Date.now(); await saveM(m); render(); window.scrollTo(0, 0); toast('Fijada arriba'); }); },
  mUnpin(){ closeMenu(async m => { if (!m) return; m.top = null; await saveM(m); render(); toast('Ya no está fijada'); }); },
  mvNext(){ closeMenu(async m => { if (!m) return; const id = await pickBox(m); if (!id) return; const l = watchPositions().filter(x => x.id !== m.id), t = l.find(x => x.id === id); if (!t) return;
    if (t.top){ m.top = t.top - 1; await saveM(m); render(); return toast(`Ahora está después de ${t.title}`); }
    await placeAt(m, l.indexOf(t) + 1); toast(`Ahora está después de ${t.title}`); }); },
  pickIt(t){ resolveSheet(t.dataset.pick); },
  mvEnd(){ closeMenu(m => m && placeAt(m, watchPositions().length)); },
  mvRank(){ closeMenu(async m => { if (!m) return; m.pinned = false; m.pos = null; await saveM(m); render(); toast('Regresó a su puesto de la lista'); }); },
  mvPos(){ closeMenu(async m => { if (!m) return; const n = watchPositions().length, cur = watchPositions().findIndex(x => x.id === m.id) + 1;
    const v = await numberBox('Mover a la posición', `Escribe un número del 1 al ${n}. Ahora está en la ${cur}.`, n); if (!v) return; placeAt(m, v - 1); }); },
  mSeen(){ closeMenu(async m => { if (!m) return; const r = await rateBox(m); if (!r) return; Object.assign(m, r, {status:'seen'}); await saveM(m); render(); offerShare(m, true); }); },
  mTrailer(){ const m = movies.find(x => x.id === menuFor); const k = m && (m.trailerEs || m.trailer); closeMenu(() => { if (k) window.open('https://www.youtube.com/watch?v=' + k, '_blank', 'noopener'); }); },
  mOpen(){ closeMenu(m => m && go({name:'detail', id:m.id})); },
  mDel(){ closeMenu(async m => { if (!m) return; if (!await confirmBox(`¿Quitar ${m.title}?`, 'Se borra de tu lista «Por ver».', 'Quitar')) return;
    const rank = rtRanks().get(m.id), entry = rank && rtList ? rtList.items.find(e => e.r === rank) : null;
    if (entry){ rtIgnore.add(skipKey(entry)); DB.put('meta', {k:'rtignore', v:[...rtIgnore]}).catch(() => {}); }
    await DB.del('movies', m.id); movies = movies.filter(x => x.id !== m.id); render(); toast('Quitada de tu lista'); }); },
  numOk(){ const v = parseInt($('#numIn').value, 10), max = +$('#numIn').max; if (!(v >= 1 && v <= max)) return void ($('#numErr').textContent = `Escribe un número del 1 al ${max}.`); resolveSheet(v); },
  async toggleNotif(){
    if (notifOn && Notification.permission === 'granted'){ notifOn = false; await DB.put('meta', {k:'notif', v:false}); try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.unregister('peliculas-avisos'); } catch(e){} toast('Avisos desactivados'); return render(); }
    let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted'){ toast('Sin permiso para notificaciones.'); return render(); }
    notifOn = true; await DB.put('meta', {k:'notif', v:true});
    const ok = await setupPeriodic(); toast(ok ? 'Avisos activados' : 'Avisos activados. Funcionan mejor con la app instalada.');
    try { const reg = await navigator.serviceWorker.ready; reg.active && reg.active.postMessage('check'); } catch(e){}
    render(); },
  toggleSyn(t){ const p = $('#syn'); if (!p) return; const open = p.hidden; p.hidden = !open; t.setAttribute('aria-expanded', String(open)); t.querySelector('span').textContent = open ? 'Ocultar sinopsis' : 'Ver sinopsis'; t.classList.toggle('open', open); },
  orderStart(){ hist.push(Object.assign({}, view, {y:window.scrollY})); history.pushState({d:hist.length}, ''); ordering = true; render(); window.scrollTo(0,0); }, orderDone(){ back(); },
  manual(){ draft = {_new:true, kind:searchKind === 'tv' ? 'tv' : 'movie', title:searchKind === 'person' ? '' : query.trim(), year:'', runtime:null, seasons:null, directors:[], genres:[], cast:[], trailer:'', trailerEs:'', poster:null, posterPath:''}; go({name:'form'}); },
  editInfo(){ const m = curM(); if (!m) return; draft = {_new:false, id:m.id, kind:m.kind, title:m.title, year:m.year, runtime:m.runtime, seasons:m.seasons, directors:[...m.directors], genres:[...m.genres], cast:m.cast.map(c => ({...c})), trailer:m.trailer, trailerEs:m.trailerEs, poster:m.poster, posterPath:m.posterPath}; go({name:'form'}); },
  rmPoster(){ draft.poster = null; draft.posterPath = ''; $('#photoSlot').outerHTML = photoSlot(); },
  async saveForm(){ const title = $('#f_title').value.trim(); if (!title){ $('#e_title').textContent = 'Escribe el título.'; $('#f_title').focus(); return; }
    const split = v => v.split(',').map(x => x.trim()).filter(Boolean), trs = {};
    for (const k of ['trailer','trailerEs']){ const v = $('#f_' + k).value.trim(), id = ytId(v); if (v && !id){ $('#e_' + k).textContent = 'Ese no parece un enlace de YouTube.'; $('#f_' + k).focus(); return; } trs[k] = id; }
    const tv = draft.kind === 'tv', dirs = split($('#f_dir').value);
    const info = {kind:draft.kind, title, year:$('#f_year').value.trim(), runtime:tv ? null : parseInt(($('#f_runtime') || {}).value, 10) || null, seasons:tv ? parseInt(($('#f_seasons') || {}).value, 10) || null : null,
      directors:dirs, genres:split($('#f_genres').value), cast:split($('#f_cast').value).map(n => { const o = draft.cast.find(c => c.n === n) || {}; return {n, c:o.c || '', id:o.id || null}; }), trailer:trs.trailer, trailerEs:trs.trailerEs, poster:draft.poster};
    if (draft._new){ draft = null; const pv = hist.pop() || {name:'add'}; delete pv.y; view = pv; await silentBack(1); render(); await addFlow(Object.assign({tmdb:null, original:'', posterPath:'', extrasV:EXTRAS_V}, info)); if (view.name === 'add') render(); return; }
    const m = movies.find(x => x.id === draft.id); if (!m) return;
    const keepDirs = m.dirs.filter(d => dirs.includes(d.n)); Object.assign(m, clean(Object.assign({}, m, info, {posterPath:draft.posterPath, dirs:dirs.map(n => keepDirs.find(d => d.n === n) || {n, id:null})}))); draft = null;
    await saveM(m); toast('Guardado'); back(); },
  async rate(){ const m = curM(); if (!m) return; const old = m.rating, r = await rateBox(m); if (!r) return; Object.assign(m, r); await saveM(m); render(); if (m.rating !== old) offerShare(m, true); else toast('Guardado'); },
  async markSeen(){ const m = curM(); if (!m) return; const r = await rateBox(m); if (!r) return; Object.assign(m, r, {status:'seen'}); await saveM(m); render(); offerShare(m, true); },
  shareRating(){ const m = curM(); if (m) offerShare(m, false); },
  doShare(){ doShare(); },
  async delete(){ const m = curM(); if (!m) return; if (!await confirmBox(`¿Eliminar ${m.title}?`, 'Se borra de tu colección junto con tu puntuación y comentario.', 'Eliminar')) return;
    const rank = rtRanks().get(m.id), entry = rank && rtList ? rtList.items.find(e => e.r === rank) : null;
    if (entry){ rtIgnore.add(skipKey(entry)); DB.put('meta', {k:'rtignore', v:[...rtIgnore]}).catch(() => {}); }
    await DB.del('movies', m.id); movies = movies.filter(x => x.id !== m.id); toast('Eliminada'); back(); },
  sheetOk(){ resolveSheet(true); }, sheetNo(){ resolveSheet(null); },
  pickSeen(){ resolveSheet('seen'); }, pickWatch(){ resolveSheet('watch'); },
  rateSave(){ resolveSheet(readRate()); },
  async saveKey(){ const k = $('#k_key').value.trim(), e = $('#e_key'); e.textContent = '';
    if (!k){ apiKey = ''; await DB.put('meta', {k:'key', v:''}); toast('Clave borrada'); return; }
    const old = apiKey; apiKey = k;
    try { await tmdb('/configuration', {}); await DB.put('meta', {k:'key', v:k}); extrasTried.clear(); toast('Clave guardada. Ya puedes buscar.'); }
    catch(err){ apiKey = old; e.textContent = err.badkey ? 'TMDB no aceptó esa clave. Revisa que la copiaste completa.' : 'No se pudo comprobar. Revisa tu conexión a internet.'; } },
  async saveOmdb(){ const k = $('#o_key').value.trim(), e = $('#e_okey'); e.textContent = '';
    if (!k){ omdbKey = ''; await DB.put('meta', {k:'omdb', v:''}); toast('Clave borrada'); return; }
    const old = omdbKey; omdbKey = k;
    try { await omdb('tt0111161'); await DB.put('meta', {k:'omdb', v:k}); movies.forEach(m => { m.rtAt = 0; }); toast('Clave guardada. Las calificaciones aparecerán en Por ver.'); }
    catch(err){ omdbKey = old; e.textContent = err.badkey ? 'OMDb no aceptó esa clave. Revisa que la activaste desde el correo.' : 'No se pudo comprobar. Revisa tu conexión a internet.'; } },
  importRT(){ importRT(false); },
  async ignoreRT(){ const l = missingRT(); if (!l.length) return;
    if (!await confirmBox(l.length === 1 ? '¿Ignorar esta película?' : `¿Ignorar estas ${l.length} películas?`, 'No se agregarán ni volverán a aparecer en el aviso, aunque cambien de puesto. Si Rotten Tomatoes agrega películas nuevas a la lista, sí te avisaré.', 'Ignorar')) return;
    l.forEach(e => rtIgnore.add(skipKey(e))); await DB.put('meta', {k:'rtignore', v:[...rtIgnore]}).catch(() => {}); render(); toast('Listo, no volverán a aparecer'); },
  async unignoreRT(){ rtIgnore = new Set(); await DB.put('meta', {k:'rtignore', v:[]}).catch(() => {}); render(); toast('Las ignoradas vuelven a contar'); }, importRetry(){ importRT(true); },
  importStop(){ if (importing){ importing.stop = true; const b = $('#impBtn'); if (b){ b.textContent = 'Deteniendo…'; b.disabled = true; } } },
  async install(){ if (!installEvt) return; const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch(err){} render(); },
  async exportBk(){ const data = {app:'mis-peliculas', v:2, created:new Date().toISOString(), movies};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'})), a = document.createElement('a');
    a.href = url; a.download = `mis-peliculas-copia-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Copia descargada'); },
  async wipe(){ if (!await confirmBox('¿Borrar todo?', 'Se eliminan tus películas y series, vistas y por ver, con sus puntuaciones y comentarios. No se puede deshacer.', 'Borrar todo')) return;
    await DB.clear('movies'); movies = []; await resetToRoot(tab); toast('Todo borrado'); }
};
async function importBk(file){
  let data; try { if (file.size > 300e6) throw 0; data = JSON.parse(await file.text()); } catch(e){ return toast('Ese archivo no es una copia válida.'); }
  if (!data || data.app !== 'mis-peliculas' || !Array.isArray(data.movies)) return toast('Ese archivo no es una copia válida.');
  let n = 0; for (const r of data.movies){ const m = clean(r); if (!m) continue; try { await DB.put('movies', m); const k = movies.findIndex(x => x.id === m.id); k < 0 ? movies.push(m) : movies[k] = m; n++; } catch(e){} }
  render(); toast(n ? `${plural(n, 'título restaurado', 'títulos restaurados')}` : 'No se pudo restaurar nada.'); }

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const st = e.target.closest('[data-step]');
  if (st){ const i = $('#rateIn'); if (!i) return; const v = Math.min(10, Math.max(1, Math.round((+i.value + +st.dataset.step) * 10) / 10)); i.value = v; paintRate(v); return; }
  const cp = e.target.closest('a[data-copy]');
  if (cp){ e.preventDefault(); const url = cp.href, title = cp.dataset.copy; let ok = false;
    try { await navigator.clipboard.writeText(title); ok = true; } catch(err){}
    toast(ok ? `Título copiado: pégalo en el buscador si no aparece` : 'Abriendo la plataforma…');
    setTimeout(() => window.open(url, '_blank', 'noopener'), ok ? 450 : 0); return; }
  if (ordering && e.target.closest('#orderGrid')) return;
  if (Date.now() - swipedAt < 400) return;
  if (Date.now() - lpFired < 600 && e.target.closest('.grid .poster')) return;
  const t = e.target.closest('[data-act],[data-open],[data-tab],[data-add],[data-wrap],[data-kind],[data-worder],[data-skind],[data-person],[data-role],[data-fkind]'); if (!t) return;
  const ds = t.dataset;
  if (ds.tab){ resetToRoot(ds.tab); return; }
  if (ds.open) return go({name:'detail', id:ds.open});
  if (ds.kind){ kindFilter = ds.kind; return render(); }
  if (ds.skind){ if (searchKind === ds.skind) return; searchKind = ds.skind; results = null; render(); const q = $('#q'); if (q){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); } runSearch(); return; }
  if (ds.person){ return go({name:'person', pid:+ds.person}); }
  if (ds.role){ personRole = ds.role; return render(); }
  if (ds.fkind){ draft.kind = ds.fkind; ['title','year','dir','cast','trailer','trailerEs','genres'].forEach(k => { const el = $('#f_' + k); if (!el) return; const v = el.value; if (k === 'title') draft.title = v; if (k === 'year') draft.year = v; if (k === 'dir') draft.directors = v.split(',').map(x => x.trim()).filter(Boolean); if (k === 'cast') draft.cast = v.split(',').map(x => x.trim()).filter(Boolean).map(n => ({n, c:'', id:null})); if (k === 'genres') draft.genres = v.split(',').map(x => x.trim()).filter(Boolean); if (k === 'trailer') draft.trailer = ytId(v); if (k === 'trailerEs') draft.trailerEs = ytId(v); }); return render(); }
  if (ds.wrap){ wrapYear = +ds.wrap; return go({name:'wrap'}); }
  if (ds.add){ if (t.disabled) return; const [kind, id] = ds.add.split(':'); const ex = inLib(kind, +id); if (ex) return go({name:'detail', id:ex.id});
    t.disabled = true; toast('Cargando datos…');
    try { const info = await fetchInfo(kind === 'tv' ? 'tv' : 'movie', +id); await addFlow(info); } catch(err){ toast(err.badkey ? 'Tu clave de TMDB no funciona.' : 'No se pudieron cargar los datos. Revisa tu conexión.'); }
    t.disabled = false; return; }
  if (ds.act && A[ds.act]) A[ds.act](t);
});
document.addEventListener('input', e => { const t = e.target;
  if (t.id === 'pickQ'){ const q = normT(t.value); document.querySelectorAll('#pickList .pick-row').forEach(r => { r.hidden = !!q && !r.dataset.q.includes(q); }); return; }
  if (t.id === 'q'){ query = t.value; runSearch(); }
  if (t.id === 'rateIn') paintRate(+t.value);
  if (t.id === 'f_title') $('#e_title').textContent = '';
  if (t.id === 'f_trailer' || t.id === 'f_trailerEs') $('#e_' + t.id.slice(2)).textContent = ''; });
document.addEventListener('change', async e => { const t = e.target;
  if (t.id === 'f_poster'){ const f = t.files && t.files[0]; if (!f || !draft) return; try { draft.poster = await compress(f); draft.posterPath = ''; $('#photoSlot').outerHTML = photoSlot(); } catch(err){ toast('No se pudo cargar la imagen.'); } }
  if (t.id === 'f_import'){ const f = t.files && t.files[0]; t.value = ''; if (f) importBk(f); } });
document.addEventListener('keydown', e => { if (!ov.hidden && e.key === 'Escape') resolveSheet(null); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (['seen','watch','stats','settings'].includes(view.name) && !odrag) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Mis películas instalada'); if (['seen','watch','stats','settings'].includes(view.name) && !odrag) render(); });

/* ---------- Inicio ---------- */
(async () => {
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(() => {});
  if (!window.indexedDB || !await DB.open()){ main.innerHTML = `<div class="empty"><h2>No se puede guardar</h2><p>Este navegador no permite guardar datos. Si estás en modo incógnito, abre la app en una pestaña normal.</p></div>`; return; }
  try { const k = await DB.get('meta', 'key'); apiKey = k && typeof k.v === 'string' ? k.v : ''; } catch(e){}
  try { const k = await DB.get('meta', 'rtignore'); if (k && Array.isArray(k.v)) rtIgnore = new Set(k.v.filter(x => typeof x === 'string')); } catch(e){}
  try { const k = await DB.get('meta', 'rtskip'); if (k && Array.isArray(k.v)) rtSkip = new Set(k.v.filter(x => typeof x === 'string')); } catch(e){}
  try { const k = await DB.get('meta', 'alertsSeen'); if (k && Array.isArray(k.v)) alertsSeen = new Set(k.v.filter(x => typeof x === 'string')); } catch(e){}
  try { const k = await DB.get('meta', 'notif'); notifOn = !!(k && k.v); if (notifOn && 'Notification' in window && Notification.permission === 'granted') setupPeriodic(); } catch(e){}
  try { const k = await DB.get('meta', 'omdb'); omdbKey = k && typeof k.v === 'string' ? k.v : ''; } catch(e){}
  try { movies = (await DB.all('movies')).map(clean).filter(Boolean); } catch(e){ movies = []; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  loadRtList(); setTimeout(refreshAllExtras, 1500);
  history.replaceState({root:1}, ''); render();
})();
})();
