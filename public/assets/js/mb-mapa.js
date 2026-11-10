(function () {
    'use strict';

    var MB = window.MB;
    var TILES = {
        claro: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        oscuro: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        satelite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };
    var ATRIBUCION = '&copy; OpenStreetMap';

    function disponible() { return typeof window.L !== 'undefined'; }

    function iconoDiv(html, tam, ancla) {
        return window.L.divIcon({ html: html, className: 'sin-fondo', iconSize: tam, iconAnchor: ancla || [tam[0] / 2, tam[1] / 2] });
    }

    function htmlBus(color, rotulo, apagado, rumbo, tipo) {
        var flecha = rumbo !== null && rumbo !== undefined && !apagado ? '<span class="flecha" style="transform:rotate(' + rumbo + 'deg)"></span>' : '';
        return '<div class="marcador-bus' + (apagado ? ' apagado' : '') + '" style="--color:' + MB.esc(color || '#22c3d8') + '">' + '<span class="halo"></span>' + flecha + '<span class="cuerpo-m">' + MB.ico(tipo === 'camion' ? 'camion' : 'bus') + '</span>' + (rotulo ? '<span class="rotulo">' + MB.esc(rotulo) + '</span>' : '') + '</div>';
    }

    function crear(idEl, opc) {
        opc = opc || {};
        if (!disponible()) { return null; }
        var L = window.L;
        var centro = opc.centro || MB.cfg.centro || [11.9986, -83.7574];
        var mapa = L.map(idEl, { zoomControl: false, attributionControl: false, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, preferCanvas: true, maxZoom: 19, minZoom: 9, tap: true });
        mapa.setView(centro, opc.zoom || 14);
        L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution(ATRIBUCION).addTo(mapa);
        if (MB.cfg.limites) { mapa.setMaxBounds(L.latLngBounds([MB.cfg.limites[0], MB.cfg.limites[1]], [MB.cfg.limites[2], MB.cfg.limites[3]]).pad(0.6)); }

        var modoSatelite = false;
        var capa = null;
        function temaActual() { return document.documentElement.getAttribute('data-tema') === 'claro' ? 'claro' : 'oscuro'; }
        function pintarCapa() {
            if (capa) { mapa.removeLayer(capa); }
            var clave = modoSatelite ? 'satelite' : temaActual();
            capa = L.tileLayer(TILES[clave], { maxZoom: 19, keepBuffer: 4, updateWhenIdle: false, crossOrigin: true, className: clave === 'oscuro' ? 'teselas-oscuras' : '' });
            capa.addTo(mapa);
            capa.bringToBack();
        }
        pintarCapa();
        document.addEventListener('mb-tema', pintarCapa);

        var api = {
            mapa: mapa,
            alternarSatelite: function () { modoSatelite = !modoSatelite; pintarCapa(); return modoSatelite; },
            marcadores: {},
            capas: {}
        };

        function deslizar(marcador, destino, duracion) {
            var origen = marcador.getLatLng();
            if (origen.lat === destino[0] && origen.lng === destino[1]) { return; }
            if (marcador._anim) { cancelAnimationFrame(marcador._anim); }
            var t0 = performance.now();
            if (MB.distanciaM([origen.lat, origen.lng], destino) > 2500 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                marcador.setLatLng(destino);
                return;
            }
            function paso(t) {
                var p = Math.min(1, (t - t0) / duracion);
                var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
                marcador.setLatLng([origen.lat + (destino[0] - origen.lat) * e, origen.lng + (destino[1] - origen.lng) * e]);
                if (p < 1) { marcador._anim = requestAnimationFrame(paso); }
            }
            marcador._anim = requestAnimationFrame(paso);
        }

        api.sincronizarVehiculos = function (lista, opciones) {
            opciones = opciones || {};
            var vistos = {};
            var tipo = opciones.tipo || 'bus';
            var grupo = (api.marcadores[tipo] = api.marcadores[tipo] || {});
            lista.forEach(function (b) {
                if (b.lat === null || b.lat === undefined) { return; }
                vistos[b.id] = true;
                var apagado = !b.conectado;
                var html = htmlBus(b.color, opciones.rotulos === false ? '' : b.nombre, apagado, b.rumbo, tipo);
                var m = grupo[b.id];
                if (!m) {
                    m = L.marker([b.lat, b.lng], { icon: iconoDiv(html, [46, 46]), zIndexOffset: apagado ? 0 : 500, keyboard: false, riseOnHover: true });
                    m._html = html;
                    m.addTo(mapa);
                    m.on('click', function () { if (opciones.alPulsar) { opciones.alPulsar(m._datos); } });
                    grupo[b.id] = m;
                } else {
                    if (m._html !== html) { m.setIcon(iconoDiv(html, [46, 46])); m._html = html; }
                    m.setZIndexOffset(apagado ? 0 : 500);
                    deslizar(m, [b.lat, b.lng], opciones.duracion || 3200);
                }
                m._datos = b;
            });
            Object.keys(grupo).forEach(function (id) { if (!vistos[id]) { mapa.removeLayer(grupo[id]); delete grupo[id]; } });
        };

        api.ajustar = function (puntos, relleno) {
            var v = puntos.filter(function (p) { return p && p[0] !== null && p[0] !== undefined; });
            if (!v.length) { return; }
            if (v.length === 1) { mapa.flyTo(v[0], Math.max(mapa.getZoom(), 15), { duration: 0.8 }); return; }
            mapa.flyToBounds(L.latLngBounds(v), { padding: relleno || [60, 60], maxZoom: 16, duration: 0.9 });
        };

        api.capa = function (nombre) {
            if (!api.capas[nombre]) { api.capas[nombre] = L.layerGroup().addTo(mapa); }
            return api.capas[nombre];
        };

        api.limpiar = function (nombre) { if (api.capas[nombre]) { api.capas[nombre].clearLayers(); } };

        api.linea = function (nombre, puntos, estilo) {
            var l = L.polyline(puntos, Object.assign({ color: '#22c3d8', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }, estilo || {}));
            l.addTo(api.capa(nombre));
            return l;
        };

        api.parada = function (nombre, p, alPulsar) {
            var m = L.marker([p.lat, p.lng], { icon: iconoDiv('<div class="marcador-parada">' + MB.ico('pin') + '</div>', [30, 30]), keyboard: false });
            m.bindTooltip(p.nombre, { direction: 'top', offset: [0, -14], className: 'tip-mapa' });
            if (alPulsar) { m.on('click', function () { alPulsar(p); }); }
            m.addTo(api.capa(nombre));
            return m;
        };

        api.pin = function (nombre, p, color, alPulsar, etiqueta) {
            var svg = '<svg viewBox="0 0 30 38"><path d="M15 1C7.8 1 2 6.8 2 14c0 9.6 13 23 13 23s13-13.400 13-23C28 6.800 22.200 1 15 1z" fill="' + MB.esc(color || '#ff8a3d') + '" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#fff"/></svg>';
            var m = L.marker([p.lat, p.lng], { icon: iconoDiv('<div class="marcador-pin">' + svg + '</div>', [30, 38], [15, 38]), keyboard: false });
            if (etiqueta) { m.bindTooltip(etiqueta, { direction: 'top', offset: [0, -34], className: 'tip-mapa' }); }
            if (alPulsar) { m.on('click', function () { alPulsar(p); }); }
            m.addTo(api.capa(nombre));
            return m;
        };

        api.paradas = function (lista, alPulsar) {
            var cap = api.capa('paradas');
            if (api._repintarParadas) { mapa.off('moveend', api._repintarParadas); }

            function pintar() {
                cap.clearLayers();
                if (!lista || !lista.length) { return; }
                var z = mapa.getZoom();
                var limites = mapa.getBounds().pad(0.2);
                var visibles = lista.filter(function (p) { return limites.contains([p.lat, p.lng]); });
                var detalle = z >= 15.5 && visibles.length <= 260;
                visibles.slice(0, 1200).forEach(function (p) {
                    var m;
                    var etiqueta = (p.numero ? '#' + p.numero + ' · ' : '') + p.nombre + (p.codigo ? ' (' + p.codigo + ')' : '');
                    if (detalle) {
                        m = L.marker([p.lat, p.lng], { icon: iconoDiv('<div class="marcador-parada num">' + (p.numero || '') + '</div>', [30, 30]), keyboard: false });
                    } else {
                        m = L.circleMarker([p.lat, p.lng], { radius: z >= 14 ? 6 : 4, color: '#ffffff', weight: 1.5, fillColor: '#ff8a3d', fillOpacity: 1 });
                    }
                    m.bindTooltip(MB.esc(etiqueta), { direction: 'top', offset: detalle ? [0, -14] : [0, -4], className: 'tip-mapa' });
                    if (alPulsar) { m.on('click', function () { alPulsar(p); }); }
                    m.addTo(cap);
                });
            }

            api._repintarParadas = pintar;
            mapa.on('moveend', pintar);
            pintar();
            return { repintar: pintar };
        };

        api.cierres = function (lista) {
            var cap = api.capa('cierres');
            cap.clearLayers();
            (lista || []).forEach(function (c) {
                var pts = c.puntos;
                if (!pts || pts.length < 2) { return; }
                var texto = '<b>Calle cerrada</b><br>' + MB.esc(c.nombre) + (c.motivo ? '<br>' + MB.esc(c.motivo) : '');
                var base = L.polyline(pts, { color: '#ffffff', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(cap);
                var rojo = L.polyline(pts, { color: '#e11d48', weight: 6, opacity: 1, dashArray: '10 8', lineJoin: 'round' }).addTo(cap);
                var medio = pts[Math.floor(pts.length / 2)];
                var marca = L.marker(medio, { icon: iconoDiv('<div class="marcador-cierre">' + MB.ico('x') + '</div>', [28, 28]), keyboard: false, zIndexOffset: 700 }).addTo(cap);
                [base, rojo, marca].forEach(function (x) { x.bindTooltip(texto, { className: 'tip-mapa', sticky: true }); });
            });
        };

        var usuario = null, precision = null;
        api.usuario = function (lat, lng, prec) {
            if (!usuario) {
                usuario = L.marker([lat, lng], { icon: iconoDiv('<div class="marcador-usuario"></div>', [22, 22]), interactive: false, zIndexOffset: 900 }).addTo(mapa);
                precision = L.circle([lat, lng], { radius: prec || 30, color: '#3b82f6', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(mapa);
            } else {
                usuario.setLatLng([lat, lng]);
                precision.setLatLng([lat, lng]).setRadius(prec || 30);
            }
        };

        api.invalidar = function () { setTimeout(function () { mapa.invalidateSize(); }, 80); };
        window.addEventListener('resize', MB.debounce(function () { mapa.invalidateSize(); }, 200));

        return api;
    }

    function osrm(puntos) {
        if (puntos.length < 2) { return Promise.resolve(puntos); }
        var coords = puntos.map(function (p) { return p[1].toFixed(6) + ',' + p[0].toFixed(6); }).join(';');
        return fetch('https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&geometries=geojson').then(function (r) {
            if (!r.ok) { throw new Error('Ruteo no disponible'); }
            return r.json();
        }).then(function (d) {
            if (!d.routes || !d.routes[0]) { throw new Error('Sin ruta'); }
            return d.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        });
    }

    function buscarLugar(texto) {
        var u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ni&accept-language=es&q=' + encodeURIComponent(texto);
        return fetch(u).then(function (r) { if (!r.ok) { throw new Error('Búsqueda no disponible'); } return r.json(); }).then(function (l) {
            return l.map(function (x) { return { nombre: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }; });
        });
    }

    window.MBMapa = { crear: crear, disponible: disponible, osrm: osrm, buscarLugar: buscarLugar, htmlBus: htmlBus, iconoDiv: iconoDiv };
})();
