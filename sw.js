'use strict';
// Cuando cambies cualquier archivo de la app, sube este número para que el celular descargue la versión nueva.
const VERSION = 'peliculas-v24';
const PREFIX = 'peliculas-';
const FILES = ['./', 'index.html', 'app.js', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

// Guarda cada archivo por separado: si alguno falla, los demás igual quedan guardados y la app abre sin internet.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f =>
    fetch(new Request(f, {cache: 'reload'})).then(r => { if (r.ok) return c.put(f, r); }).catch(() => {})
  ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const STATIC = /\.(js|css|png|svg|jpg|jpeg|webp|woff2?|webmanifest|ico)$/i;
async function fromNetwork(req, key){ const r = await fetch(req); if (r && r.ok){ const c = await caches.open(VERSION); c.put(key || req, r.clone()); } return r; }

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  // La app misma: primero la copia guardada (abre al instante y sin internet).
  if (r.mode === 'navigate'){
    if (url.pathname === scope || url.pathname === scope + 'index.html')
      e.respondWith(caches.match('index.html', {cacheName: VERSION}).then(c => c || fromNetwork(r, 'index.html')).catch(() => caches.match('index.html')));
    return;
  }
  // Datos que cambian (como listas .json): primero internet, y si no hay, la última copia guardada.
  if (/\.json$/i.test(url.pathname)){
    e.respondWith(fromNetwork(r).catch(() => caches.match(r, {ignoreSearch: true})));
    return;
  }
  // Archivos de la app (código, estilos, íconos, fuentes): copia guardada, y si falta, se descarga y se guarda.
  if (STATIC.test(url.pathname)){
    e.respondWith(caches.match(r, {ignoreSearch: true}).then(c => c || fromNetwork(r)));
  }
});

/* ---------- Avisos de estrenos (sin servidor: se revisan los datos guardados en el celular) ---------- */
const idb = (name) => new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const getAll = (db, s) => new Promise(res => { try { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch(e){ res([]); } });
const getOne = (db, s, k) => new Promise(res => { try { const q = db.transaction(s).objectStore(s).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch(e){ res(null); } });
const putOne = (db, s, v) => new Promise(res => { try { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = () => res(); t.onerror = () => res(); } catch(e){ res(); } });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const daysTo = s => Math.round((new Date(s + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
async function checkReleases(){
  let db; try { db = await idb('mis-peliculas'); } catch(e){ return; }
  const on = await getOne(db, 'meta', 'notif'); if (!on || !on.v) return;
  const sent = await getOne(db, 'meta', 'notified'), done = new Set((sent && sent.v) || []), movies = await getAll(db, 'movies'), t = today(), out = [];
  for (const m of movies){ if (m.status !== 'watch') continue;
    if (m.release && m.release === t) out.push({key:`${m.id}:c:${m.release}`, title:m.title, body:m.kind === 'tv' ? 'Ya se estrenó.' : 'Hoy llega a cines.'});
    const dg = m.digital; if (m.kind === 'movie' && dg && dg.d && dg.d === t && (!m.release || dg.d >= m.release)) out.push({key:`${m.id}:d:${dg.d}`, title:m.title, body:'Ya está disponible en digital.'}); }
  for (const e of out){ if (done.has(e.key)) continue; done.add(e.key);
    await self.registration.showNotification(e.title, {body:e.body, icon:'icon-192.png', badge:'icon-192.png', tag:e.key, data:{url:self.registration.scope}}); }
  await putOne(db, 'meta', {k:'notified', v:[...done].slice(-500)}); }
self.addEventListener('periodicsync', e => { if (e.tag === 'peliculas-avisos') e.waitUntil(checkReleases()); });
self.addEventListener('message', e => { if (e.data === 'check') e.waitUntil ? e.waitUntil(checkReleases()) : checkReleases(); });
self.addEventListener('notificationclick', e => { e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(l => { const c = l.find(x => x.url.startsWith(self.registration.scope)); return c ? c.focus() : self.clients.openWindow(self.registration.scope); })); });
