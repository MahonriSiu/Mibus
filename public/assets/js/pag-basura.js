(function () {
    'use strict';
    var MB = window.MB;
    var ctx = window.MBP.iniciar({ modulo: 'camion', alUbicar: function () { pintarEta(); } });
    var camiones = [];
    var seleccionado = null;
    var etas = {};
    var primera = true;
    var rutas = {};

    function ajustar() {
        if (!ctx.mapa) { return; }
        var pts = camiones.filter(function (c) { return c.lat !== null; }).map(function (c) { return [c.lat, c.lng]; });
        if (ctx.ubicacion) { pts.push(ctx.ubicacion); }
        ctx.mapa.ajustar(pts, [70, 70]);
    }

    function pintarEta() {
        if (!ctx.ubicacion) { return; }
        camiones.filter(function (c) { return c.conectado; }).forEach(function (c) {
            MB.get('publico/camion-eta', { camion_id: c.id, lat: ctx.ubicacion[0], lng: ctx.ubicacion[1] }, { silencioso: true }).then(function (r) { etas[c.id] = r; if (ctx.activa === 'camiones') { lista(); } }).catch(function () {});
        });
    }

    function cargar() {
        return MB.get('publico/camiones').then(function (r) {
            camiones = r.camiones;
            if (ctx.mapa) { ctx.mapa.sincronizarVehiculos(camiones.filter(function (c) { return c.activo_hoy || c.conectado; }), { tipo: 'camion', alPulsar: function (c) { elegir(c.id); } }); }
            if (ctx.activa === 'camiones') { lista(); }
            if (primera) { primera = false; ajustar(); }
        });
    }

    function elegir(id) {
        seleccionado = seleccionado === id ? null : id;
        var c = camiones.filter(function (x) { return x.id === id; })[0];
        if (ctx.mapa) { ctx.mapa.limpiar('rutaCamion'); }
        if (seleccionado && c) {
            if (c.lat !== null && ctx.mapa) { ctx.mapa.mapa.flyTo([c.lat, c.lng], 16, { duration: 0.8 }); }
            MB.get('publico/camion-ruta', { camion_id: id }).then(function (r) {
                if (seleccionado !== id || !r.hay_ruta || !ctx.mapa) { return; }
                rutas[id] = r;
                var pts = r.puntos.map(function (p) { return Array.isArray(p) ? p : [p.lat, p.lng]; });
                if (pts.length > 1) { ctx.mapa.linea('rutaCamion', pts, { color: r.color || '#22c3d8', weight: 5, opacity: 0.85, dashArray: '10 8' }); }
                lista();
            }).catch(function () {});
        }
        lista();
    }

    function lista(cuerpo) {
        cuerpo = cuerpo || ctx.cuerpo;
        if (!camiones.length) { cuerpo.innerHTML = '<div class="vacio">' + MB.ico('camion') + '<p>No hay camiones registrados.</p></div>'; return; }
        cuerpo.innerHTML = '';
        camiones.forEach(function (c, i) {
            var eta = etas[c.id];
            var etiqueta = !c.activo_hoy ? '<span class="pastilla">No sale hoy</span>' : !c.conectado ? '<span class="pastilla aviso">Sin señal</span>' : eta ? (eta.llegando ? '<span class="pastilla ok">Frente a ti</span>' : '<span class="pastilla info">' + eta.minutos + ' min · ' + MB.dist(eta.distancia_m) + '</span>') : '<span class="pastilla ok">En ruta</span>';
            var ruta = rutas[c.id] && seleccionado === c.id ? '<div class="meta">Ruta de hoy: ' + MB.esc(rutas[c.id].nombre || '') + '</div>' : '';
            var el = MB.h('div', { clase: 'item-bus' + (c.conectado ? '' : ' apagado') + (seleccionado === c.id ? ' activo' : ''), style: 'animation-delay:' + Math.min(i, 8) * 30 + 'ms', role: 'button', tabindex: '0', html:
                '<div class="insignia">' + MB.ico('camion') + '</div><div class="crece"><h4>' + MB.esc(c.nombre) + '</h4><div class="meta">' + MB.esc(c.zona || 'Zona general') + '</div><div class="meta">' + (c.conectado ? Math.round(c.vel) + ' km/h · ' + MB.hace(c.seg) : 'Última señal ' + MB.hace(c.seg)) + '</div>' + ruta + '</div>' + etiqueta });
            el.addEventListener('click', function () { elegir(c.id); });
            cuerpo.appendChild(el);
        });
    }

    ctx.registrar('camiones', function (c) { lista(c); });
    ctx.registrar('opinar', ctx.formOpinion);
    ctx.activar('camiones');
    MB.sondeo(cargar, 5000, { segundoPlano: 25000 });
    MB.sondeo(function () { pintarEta(); return Promise.resolve(); }, 25000, { pausarOculto: true });
})();
