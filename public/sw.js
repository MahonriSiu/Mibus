var VERSION = 'mibus-v3-4';
var ESTATICO = VERSION + '-estatico';
var TESELAS = VERSION + '-teselas';
var MAX_TESELAS = 400;

self.addEventListener('install', function (e) { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k.indexOf(VERSION) !== 0; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
});

function recortar(nombre, max) {
    return caches.open(nombre).then(function (c) {
        return c.keys().then(function (ks) { if (ks.length > max) { return c.delete(ks[0]).then(function () { return recortar(nombre, max); }); } });
    });
}

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') { return; }
    var u = new URL(req.url);

    if (u.hostname.indexOf('tile.openstreetmap.org') >= 0 || u.hostname.indexOf('arcgisonline.com') >= 0) {
        e.respondWith(caches.open(TESELAS).then(function (c) {
            return c.match(req).then(function (hit) {
                var red = fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); recortar(TESELAS, MAX_TESELAS); } return r; }).catch(function () { return hit; });
                return hit || red;
            });
        }));
        return;
    }

    if (u.origin !== self.location.origin) { return; }
    if (u.pathname.indexOf('/api/') >= 0) { return; }

    if (req.mode === 'navigate' && /\/mapa\/?$/.test(u.pathname)) {
        e.respondWith(fetch(req).then(function (r) {
            if (r && r.ok) { var copia = r.clone(); caches.open(ESTATICO).then(function (c) { c.put(req, copia); }); }
            return r;
        }).catch(function () {
            return caches.match(req).then(function (hit) { return hit || new Response('Sin conexión. Abre MiBus cuando vuelvas a tener internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); });
        }));
        return;
    }

    if (/\/assets\/(css|js|img)\//.test(u.pathname) && u.pathname.indexOf('/anuncios/') < 0 && u.pathname.indexOf('/perfiles/') < 0) {
        e.respondWith(caches.open(ESTATICO).then(function (c) {
            return c.match(req).then(function (hit) {
                var red = fetch(req).then(function (r) { if (r && r.ok) { c.put(req, r.clone()); } return r; }).catch(function () { return hit; });
                return hit || red;
            });
        }));
    }
});
