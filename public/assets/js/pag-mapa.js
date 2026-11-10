(function () {
    'use strict';
    var MB = window.MB;
    var ctx = window.MBP.iniciar({ modulo: 'bus', alAjustar: ajustar, alUbicar: function () { if (ctx && (ctx.activa === 'buses' || ctx.activa === 'universidad')) { pintarEta(); } } });
    var uni = MB.cfg.universidad || null;
    var buses = [];
    var universitarios = [];
    var paradas = [];
    var cierres = [];
    var seleccionado = null;
    var seguir = false;
    var etas = {};
    var evento = null;
    var busquedaParada = '';
    var favoritas = [];
    var avisados = {};
    var plan = { origen: null, destino: null, opciones: [] };
    var infoUni = { horarios: [], avisos: [] };
    var claveParadas = 'mb-paradas-' + (MB.cfg.ciudadId || 0);
    var NOMBRE_OC = ['', 'Vacío', 'Medio', 'Lleno'];

    function todos() { return buses.concat(universitarios); }

    function ajustar() {
        if (!ctx.mapa) { return; }
        var pts = todos().filter(function (b) { return b.lat !== null; }).map(function (b) { return [b.lat, b.lng]; });
        if (!pts.length && paradas.length) { pts = paradas.slice(0, 400).map(function (p) { return [p.lat, p.lng]; }); }
        if (ctx.ubicacion) { pts.push(ctx.ubicacion); }
        ctx.mapa.ajustar(pts, [70, 70]);
    }

    function pintarVehiculos() {
        if (!ctx.mapa) { return; }
        ctx.mapa.sincronizarVehiculos(buses, { tipo: 'bus', alPulsar: function (b) { elegir(b.id, true); } });
        ctx.mapa.sincronizarVehiculos(universitarios, { tipo: 'universitario', alPulsar: function (b) { elegir(b.id, true); } });
        if (seguir && seleccionado) {
            var b = todos().filter(function (x) { return x.id === seleccionado; })[0];
            if (b && b.lat !== null) { ctx.mapa.mapa.panTo([b.lat, b.lng], { animate: true, duration: 1.2 }); }
        }
    }

    function pintarEta() {
        if (!ctx.ubicacion) { return; }
        todos().filter(function (b) { return b.conectado; }).slice(0, 14).forEach(function (b) {
            MB.get('publico/eta', { bus_id: b.id, lat: ctx.ubicacion[0], lng: ctx.ubicacion[1] }, { silencioso: true }).then(function (r) { etas[b.id] = r; refrescarLista(); }).catch(function () {});
        });
    }

    function refrescarLista() {
        if (ctx.activa === 'buses') { listaBuses(); }
        else if (ctx.activa === 'universidad') { listaUniversidad(); }
    }

    var primera = true;
    function cargar() {
        var tareas = [MB.get('publico/flota').then(function (r) { buses = r.buses; ctx.enServicio = r.en_servicio; })];
        if (uni) { tareas.push(MB.get('publico/universitarios', {}, { silencioso: true }).then(function (r) { universitarios = r.buses || []; }).catch(function () {})); }
        return Promise.all(tareas).then(function () {
            pintarVehiculos();
            refrescarLista();
            if (primera) { primera = false; ajustar(); }
        });
    }

    function usarParadas(lista) {
        paradas = lista;
        if (ctx.mapa) { ctx.mapa.paradas(paradas, fichaParada); }
        if (ctx.activa === 'paradas') { listaParadas(ctx.cuerpo); }
        if (primera && !buses.length && !universitarios.length) { ajustar(); }
    }

    function cargarParadas() {
        return MB.get('publico/paradas', {}, { silencioso: true }).then(function (r) {
            try { localStorage.setItem(claveParadas, JSON.stringify(r.paradas || [])); } catch (e) {}
            usarParadas(r.paradas || []);
        }).catch(function () {
            try {
                var guardadas = JSON.parse(localStorage.getItem(claveParadas) || 'null');
                if (guardadas && guardadas.length) { usarParadas(guardadas); MB.toast('Sin conexión: usando las paradas guardadas en tu teléfono', 'info', 5000); }
            } catch (e) {}
        });
    }

    function cargarFavoritas(conEta) {
        return MB.get('publico/favoritas', { eta: conEta ? 1 : 0 }, { silencioso: true }).then(function (r) {
            favoritas = r.favoritas || [];
            if (conEta) { revisarAvisos(); }
            if (ctx.activa === 'paradas') { listaParadas(ctx.cuerpo); }
        }).catch(function () {});
    }

    function pedirPermisoAvisos() {
        if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    }

    function revisarAvisos() {
        favoritas.forEach(function (f) {
            var m = f.mejor;
            if (!m || (!m.llegando && m.minutos > 3)) { return; }
            var clave = f.id + ':' + m.bus_id;
            if (avisados[clave] && Date.now() - avisados[clave] < 600000) { return; }
            avisados[clave] = Date.now();
            var msg = m.bus + (m.llegando ? ' está llegando a ' : ' llega en ' + m.minutos + ' min a ') + (f.numero ? '#' + f.numero + ' ' : '') + f.nombre;
            MB.toast(msg, 'ok', 9000);
            if (navigator.vibrate) { navigator.vibrate([200, 100, 200]); }
            if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('MiBus', { body: msg }); } catch (e) {} }
        });
    }

    function cargarInfoUni() {
        if (!uni) { return; }
        MB.get('publico/universidad-info', {}, { silencioso: true }).then(function (r) {
            infoUni = r;
            if (ctx.activa === 'universidad') { listaUniversidad(); }
            var urgentes = (r.avisos || []).filter(function (a) { return a.gravedad !== 'info'; });
            if (urgentes.length) { MB.toast(uni.siglas + ': ' + urgentes[0].titulo, 'info', 7000); }
        }).catch(function () {});
    }

    function cargarCierres() {
        return MB.get('publico/cierres', {}, { silencioso: true }).then(function (r) {
            cierres = r.cierres || [];
            if (ctx.mapa) { ctx.mapa.cierres(cierres); }
            refrescarLista();
        }).catch(function () {});
    }

    function elegir(id, desdeMapa) {
        seleccionado = seleccionado === id && !desdeMapa ? null : id;
        seguir = !!seleccionado;
        var b = todos().filter(function (x) { return x.id === id; })[0];
        if (seleccionado && b && b.lat !== null && ctx.mapa) {
            ctx.mapa.mapa.flyTo([b.lat, b.lng], Math.max(ctx.mapa.mapa.getZoom(), 16), { duration: 0.8 });
            mostrarRuta(id);
        } else if (ctx.mapa) { ctx.mapa.limpiar('rutaBus'); }
        var destino = universitarios.some(function (x) { return x.id === id; }) ? 'universidad' : 'buses';
        if (ctx.activa !== destino) { ctx.activar(destino); } else { refrescarLista(); }
    }

    function mostrarRuta(id) {
        MB.get('publico/bus', { id: id }).then(function (r) {
            if (!ctx.mapa || seleccionado !== id) { return; }
            ctx.mapa.limpiar('rutaBus');
            var b = r.bus;
            if (b.ruta && b.ruta.length > 1) { ctx.mapa.linea('rutaBus', b.ruta, { color: b.color || '#22c3d8', weight: 6, opacity: 0.85 }); }
            if (b.rastro && b.rastro.length > 1) { ctx.mapa.linea('rutaBus', b.rastro, { color: '#ff8a3d', weight: 4, opacity: 0.8, dashArray: '2 9' }); }
        }).catch(function () {});
    }

    function bannerCierres(cuerpo) {
        if (!cierres.length) { return; }
        var caja = MB.h('div', { clase: 'lista-cierres-mapa' });
        cierres.slice(0, 3).forEach(function (c) {
            var el = MB.h('div', { clase: 'aviso-cierre', role: 'button', tabindex: '0', html: MB.ico('alerta') + '<div class="crece"><b>Calle cerrada</b><div>' + MB.esc(c.nombre) + (c.motivo ? ' · ' + MB.esc(c.motivo) : '') + '</div></div>' });
            el.addEventListener('click', function () { if (ctx.mapa) { ctx.hoja('baja'); ctx.mapa.ajustar(c.puntos, [80, 80]); } });
            caja.appendChild(el);
        });
        if (cierres.length > 3) { caja.appendChild(MB.h('p', { clase: 'suave pequeno', texto: 'Y ' + (cierres.length - 3) + ' cierres más en el mapa.' })); }
        cuerpo.appendChild(caja);
    }

    function itemBus(b, i, cuerpo) {
        var eta = etas[b.id];
        var etaTxt = '';
        if (b.conectado && eta) { etaTxt = eta.llegando ? '<span class="pastilla ok">Llegando</span>' : '<span class="pastilla info">' + eta.minutos + ' min · ' + MB.dist(eta.distancia_m) + '</span>'; }
        else if (!b.conectado) { etaTxt = '<span class="pastilla">Sin señal</span>'; }
        var extras = (b.ocupacion ? '<span class="pastilla oc' + b.ocupacion + '">' + NOMBRE_OC[b.ocupacion] + '</span>' : '') + (b.desvio ? '<span class="pastilla aviso">Desvío</span>' : '');
        var el = MB.h('div', { clase: 'item-bus' + (b.conectado ? '' : ' apagado') + (seleccionado === b.id ? ' activo' : ''), style: 'animation-delay:' + Math.min(i, 8) * 30 + 'ms', role: 'button', tabindex: '0', html:
            '<div class="insignia" style="' + (b.conectado && b.color ? 'background:' + MB.esc(b.color) : '') + '">' + MB.ico('bus') + '</div>' +
            '<div class="crece"><h4>' + MB.esc(b.nombre) + '</h4><div class="meta">' + MB.esc(b.origen) + ' → ' + MB.esc(b.destino) + '</div><div class="meta">' + (b.conectado ? Math.round(b.vel) + ' km/h · ' + MB.hace(b.seg) : 'Última señal ' + MB.hace(b.seg)) + '</div>' + (extras ? '<div class="fila" style="gap:6px;margin-top:4px;flex-wrap:wrap">' + extras + '</div>' : '') + '</div>' + etaTxt });
        el.addEventListener('click', function () { elegir(b.id, false); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { elegir(b.id, false); } });
        cuerpo.appendChild(el);
    }

    function listaBuses(cuerpo) {
        cuerpo = cuerpo || ctx.cuerpo;
        cuerpo.innerHTML = '';
        bannerCierres(cuerpo);
        if (!buses.length) { cuerpo.insertAdjacentHTML('beforeend', '<div class="vacio">' + MB.ico('bus') + '<p>Aún no hay buses con seguimiento en ' + MB.esc(MB.cfg.ciudad || 'tu ciudad') + '. Mientras tanto puedes ver las paradas.</p></div>'); return; }
        var orden = buses.slice().sort(function (a, b) { return (b.conectado ? 1 : 0) - (a.conectado ? 1 : 0) || a.nombre.localeCompare(b.nombre); });
        var activos = orden.filter(function (b) { return b.conectado; }).length;
        cuerpo.appendChild(MB.h('p', { clase: 'suave pequeno', style: 'margin-bottom:10px', texto: activos + ' de ' + buses.length + ' buses en línea' }));
        orden.forEach(function (b, i) { itemBus(b, i, cuerpo); });
    }

    function listaUniversidad(cuerpo) {
        cuerpo = cuerpo || ctx.cuerpo;
        cuerpo.innerHTML = '';
        if (!uni) { return; }
        bannerCierres(cuerpo);
        cuerpo.appendChild(MB.h('div', { clase: 'fila', style: 'margin-bottom:10px;flex-wrap:wrap', html: '<span class="pastilla info">' + MB.esc(uni.siglas) + '</span><span class="suave pequeno">' + MB.esc(uni.nombre) + '</span>' }));
        (infoUni.avisos || []).forEach(function (a) {
            cuerpo.appendChild(MB.h('div', { clase: 'aviso-uni ' + MB.esc(a.gravedad), html: '<b>' + MB.esc(a.titulo) + '</b><div class="suave pequeno" style="margin-top:4px">' + MB.esc(a.mensaje) + '</div>' }));
        });
        var hoy = (infoUni.horarios || []).filter(function (h) { return h.hoy; });
        if (hoy.length) {
            cuerpo.appendChild(MB.h('h4', { texto: 'Salidas de hoy', style: 'margin:10px 0 6px' }));
            var ahoraTxt = new Date().toTimeString().slice(0, 5);
            hoy.forEach(function (h) {
                cuerpo.appendChild(MB.h('div', { clase: 'fila-bus-parada' + (h.hora < ahoraTxt ? ' apagado' : ''), html: '<b style="min-width:52px">' + MB.esc(h.hora) + '</b><div class="crece"><div>' + MB.esc((h.origen || '') + (h.destino ? ' → ' + h.destino : '')) + '</div><div class="suave pequeno">' + MB.esc((h.bus || '') + (h.nota ? ' · ' + h.nota : '')) + '</div></div>' }));
            });
        }
        if (!universitarios.length) { cuerpo.insertAdjacentHTML('beforeend', '<div class="vacio">' + MB.ico('bus') + '<p>Tu universidad aún no tiene buses registrados.</p></div>'); return; }
        var orden = universitarios.slice().sort(function (a, b) { return (b.conectado ? 1 : 0) - (a.conectado ? 1 : 0) || a.nombre.localeCompare(b.nombre); });
        var activos = orden.filter(function (b) { return b.conectado; }).length;
        cuerpo.appendChild(MB.h('p', { clase: 'suave pequeno', style: 'margin-bottom:10px', texto: activos + ' de ' + universitarios.length + ' buses universitarios en línea' }));
        orden.forEach(function (b, i) { itemBus(b, i, cuerpo); });
    }

    function textoPaso(b) {
        if (!b.conectado) { return '<span class="pastilla">Sin señal</span>'; }
        if (b.paso === 'llegando') { return '<span class="pastilla ok">Llegando</span>'; }
        if (b.paso === 'viene') { return '<span class="pastilla info">' + b.minutos + ' min · ' + MB.dist(b.distancia_m) + '</span>'; }
        if (b.paso === 'ya_paso') { return '<span class="pastilla">Ya pasó</span>'; }
        return '<span class="pastilla aviso">Fuera de ruta</span>';
    }

    function fichaParada(p) {
        var cuerpo = MB.h('div', null, MB.h('div', { clase: 'esqueleto', style: 'height:90px' }));
        MB.modal({ titulo: (p.numero ? 'Parada ' + p.numero : 'Parada') + ' · ' + p.nombre, sub: p.codigo || '', cuerpo: cuerpo, ancho: true, botones: [{ texto: 'Cerrar', clase: 'primario', valor: true }] });
        function cargar() {
            MB.get('publico/parada-buses', { id: p.id }).then(function (r) { pintarFicha(cuerpo, r, cargar); }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio"><p>' + MB.esc(e.message) + '</p></div>'; });
        }
        cargar();
    }

    function pintarFicha(cuerpo, r, recargar) {
        cuerpo.innerHTML = '';
        var p = r.parada;
        var dist = ctx.ubicacion ? MB.dist(MB.distanciaM(ctx.ubicacion, [p.lat, p.lng])) + ' de ti' : 'Activa tu ubicación para ver la distancia';
        var fav = MB.h('button', { type: 'button', clase: 'boton fantasma favorita-btn' + (r.favorita ? ' on' : ''), html: MB.ico('estrella') + '<span>' + (r.favorita ? 'En favoritas' : 'Guardar parada') + '</span>' });
        fav.addEventListener('click', function () {
            MB.post('publico/favorita', { parada_id: p.id }).then(function (x) {
                r.favorita = x.favorita;
                if (x.favorita) { pedirPermisoAvisos(); MB.toast('Te avisaremos cuando un bus se acerque, mientras la app esté abierta', 'ok', 5000); }
                cargarFavoritas(true);
                pintarFicha(cuerpo, r, recargar);
            }).catch(function (e) { MB.toast(e.message, 'mal'); });
        });
        cuerpo.appendChild(MB.h('div', { clase: 'fila-entre', style: 'flex-wrap:wrap;gap:8px;margin-bottom:6px' }, MB.h('span', { clase: 'suave pequeno', texto: dist }), fav));
        if (!r.buses.length) {
            cuerpo.appendChild(MB.h('div', { clase: 'vacio', html: MB.ico('bus') + '<p>Ningún bus con ruta registrada pasa por esta parada.</p>' }));
        } else {
            r.buses.forEach(function (b) {
                var extras = (b.ocupacion ? '<span class="pastilla oc' + b.ocupacion + '">' + NOMBRE_OC[b.ocupacion] + '</span> ' : '') + (b.desvio ? '<span class="pastilla aviso">Desvío</span>' : '');
                cuerpo.appendChild(MB.h('div', { clase: 'fila-bus-parada', html: '<div class="insignia" style="' + (b.color ? 'background:' + MB.esc(b.color) : '') + '">' + MB.ico('bus') + '</div><div class="crece"><b>' + MB.esc(b.nombre) + '</b><div class="suave pequeno">' + MB.esc(b.origen) + ' → ' + MB.esc(b.destino) + '</div>' + (extras ? '<div style="margin-top:4px">' + extras + '</div>' : '') + '</div>' + textoPaso(b) }));
            });
        }
        var acciones = MB.h('div', { clase: 'fila', style: 'gap:8px;margin-top:12px;flex-wrap:wrap' });
        var act = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('actualizar') + '<span>Actualizar</span>' });
        act.addEventListener('click', recargar);
        var rep = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('alerta') + '<span>Reportar un problema aquí</span>' });
        rep.addEventListener('click', function () { abrirReporte({ lat: p.lat, lng: p.lng, tipo: 'parada_mal', texto: 'Parada ' + (p.numero || '') + ' ' + p.nombre + ': ' }); });
        acciones.appendChild(act);
        acciones.appendChild(rep);
        cuerpo.appendChild(acciones);
    }

    function elegirEnMapa(mensaje, alElegir) {
        if (!ctx.mapa) { return; }
        ctx.hoja('baja');
        MB.toast(mensaje, 'info', 5000);
        ctx.mapa.mapa.once('click', function (e) { alElegir(e.latlng.lat, e.latlng.lng); ctx.hoja('media'); });
    }

    function formReporte(cont, pre) {
        pre = pre || {};
        var punto = pre.lat ? { lat: pre.lat, lng: pre.lng } : null;
        var tipo = MB.h('select');
        tipo.innerHTML = '<option value="parada_falta">Falta una parada aquí</option><option value="parada_mal">Una parada está mal ubicada o no existe</option><option value="calle_cerrada">Calle cerrada o con obras</option><option value="bus_problema">Problema con un bus</option><option value="otro">Otro</option>';
        tipo.value = pre.tipo || 'parada_falta';
        var texto = MB.h('textarea', { maxlength: '500', rows: '3', placeholder: 'Describe lo que pasa (opcional, pero ayuda mucho)' });
        texto.value = pre.texto || '';
        var estado = MB.h('div', { clase: 'suave pequeno' });
        function pintarEstado() { estado.textContent = punto ? 'Ubicación lista (' + punto.lat.toFixed(5) + ', ' + punto.lng.toFixed(5) + ')' : 'Aún no marcas el lugar del reporte'; }
        pintarEstado();
        var gps = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('mira') + '<span>Estoy aquí</span>' });
        gps.addEventListener('click', function () {
            if (ctx.ubicacion) { punto = { lat: ctx.ubicacion[0], lng: ctx.ubicacion[1] }; pintarEstado(); }
            else { MB.toast('Activa tu ubicación con el botón del mapa', 'mal'); }
        });
        var mapaBtn = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('pin') + '<span>Elegir en el mapa</span>' });
        mapaBtn.addEventListener('click', function () {
            if (pre.enModal) { MB.toast('Cierra esta ventana para elegir en el mapa', 'info'); return; }
            elegirEnMapa('Toca en el mapa el lugar del reporte', function (la, lo) { punto = { lat: la, lng: lo }; pintarEstado(); });
        });
        var enviar = MB.h('button', { type: 'button', clase: 'boton primario bloque', texto: 'Enviar reporte' });
        enviar.addEventListener('click', function () {
            if (!punto) { MB.toast('Marca el lugar del reporte', 'mal'); return; }
            MB.conPromesa(enviar, function () {
                return MB.post('publico/reporte', { tipo: tipo.value, lat: punto.lat, lng: punto.lng, texto: texto.value.trim() }).then(function (r) { MB.toast(r.mensaje, 'ok', 5000); texto.value = ''; if (pre.alEnviar) { pre.alEnviar(); } });
            }).catch(function (e) { MB.toast(e.message, 'mal'); });
        });
        if (!pre.enModal) { cont.appendChild(MB.h('h3', { texto: 'Reportar un problema', style: 'margin-top:22px' })); }
        cont.appendChild(MB.h('div', { clase: 'campo' }, tipo));
        cont.appendChild(MB.h('div', { clase: 'campo' }, texto));
        cont.appendChild(MB.h('div', { clase: 'fila', style: 'gap:8px;flex-wrap:wrap;margin-bottom:6px' }, gps, mapaBtn));
        cont.appendChild(estado);
        cont.appendChild(MB.h('div', { style: 'margin-top:10px' }, enviar));
    }

    function abrirReporte(pre) {
        var cuerpo = MB.h('div');
        pre.enModal = true;
        pre.alEnviar = function () { var f = cuerpo.closest('.fondo-modal'); if (f) { f.dispatchEvent(new MouseEvent('mousedown')); } };
        formReporte(cuerpo, pre);
        MB.modal({ titulo: 'Reportar un problema', cuerpo: cuerpo, ancho: true, botones: [{ texto: 'Cancelar', valor: null }] });
    }

    function guardarFrecuente(d) {
        try {
            var l = JSON.parse(localStorage.getItem('mb-frecuentes') || '[]');
            var nombre = d.nombre.split(',').slice(0, 2).join(',');
            var e = l.filter(function (x) { return Math.abs(x.lat - d.lat) < 0.0008 && Math.abs(x.lng - d.lng) < 0.0008; })[0];
            if (e) { e.n++; } else { l.push({ nombre: nombre, lat: d.lat, lng: d.lng, n: 1 }); }
            l.sort(function (a, b) { return b.n - a.n; });
            localStorage.setItem('mb-frecuentes', JSON.stringify(l.slice(0, 12)));
        } catch (e) {}
    }

    function leerFrecuentes() {
        try { return JSON.parse(localStorage.getItem('mb-frecuentes') || '[]').slice(0, 5); } catch (e) { return []; }
    }

    function dibujarOpcion(o) {
        if (!ctx.mapa) { return; }
        ctx.mapa.limpiar('plan');
        var origen = plan.origen || (ctx.ubicacion ? { lat: ctx.ubicacion[0], lng: ctx.ubicacion[1] } : null);
        if (o.tramo && o.tramo.length > 1) { ctx.mapa.linea('plan', o.tramo, { color: o.color || '#22c3d8', weight: 7, opacity: 0.9 }); }
        if (origen) { ctx.mapa.linea('plan', [[origen.lat, origen.lng], o.sube], { color: '#94a3b8', weight: 4, dashArray: '3 8' }); }
        if (plan.destino) { ctx.mapa.linea('plan', [o.baja, [plan.destino.lat, plan.destino.lng]], { color: '#94a3b8', weight: 4, dashArray: '3 8' }); ctx.mapa.pin('plan', plan.destino, '#e11d48', null, 'Destino'); }
        ctx.mapa.pin('plan', { lat: o.sube[0], lng: o.sube[1] }, '#22c55e', null, 'Sube aquí');
        ctx.mapa.pin('plan', { lat: o.baja[0], lng: o.baja[1] }, '#f59e0b', null, 'Baja aquí');
        var pts = (o.tramo || []).concat([o.sube, o.baja]);
        if (origen) { pts.push([origen.lat, origen.lng]); }
        if (plan.destino) { pts.push([plan.destino.lat, plan.destino.lng]); }
        ctx.hoja('baja');
        ctx.mapa.ajustar(pts, [80, 80]);
    }

    function listaPlanificar(cuerpo) {
        cuerpo.innerHTML = '';
        var origenTxt = MB.h('div', { clase: 'suave pequeno', style: 'margin-bottom:8px' });
        var destinoTxt = MB.h('div', { clase: 'suave pequeno', style: 'margin:8px 0' });
        var resultados = MB.h('div');
        var sugerencias = MB.h('div');

        function pintarTextos() {
            origenTxt.textContent = plan.origen ? 'Origen: ' + plan.origen.nombre : (ctx.ubicacion ? 'Origen: mi ubicación' : 'Origen: activa tu ubicación o elige un punto en el mapa');
            destinoTxt.textContent = plan.destino ? 'Destino: ' + plan.destino.nombre : 'Aún no eliges destino';
        }

        var botGps = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('mira') + '<span>Salir de mi ubicación</span>' });
        botGps.addEventListener('click', function () { plan.origen = null; pintarTextos(); });
        var botOrigen = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('pin') + '<span>Origen en el mapa</span>' });
        botOrigen.addEventListener('click', function () {
            elegirEnMapa('Toca en el mapa donde empiezas el viaje', function (la, lo) { plan.origen = { lat: la, lng: lo, nombre: 'punto marcado en el mapa' }; pintarTextos(); });
        });
        var botDestino = MB.h('button', { type: 'button', clase: 'boton fantasma pequeno', html: MB.ico('pin') + '<span>Destino en el mapa</span>' });
        botDestino.addEventListener('click', function () {
            elegirEnMapa('Toca en el mapa tu destino', function (la, lo) { plan.destino = { lat: la, lng: lo, nombre: 'punto marcado en el mapa' }; pintarTextos(); });
        });

        var caja = MB.h('div', { clase: 'buscador buscador-hoja', html: MB.ico('buscar') });
        var campo = MB.h('input', { type: 'search', placeholder: '¿A dónde vas? Busca un lugar', 'aria-label': 'Buscar destino' });
        caja.appendChild(campo);
        campo.addEventListener('input', MB.debounce(function () {
            var q = campo.value.trim();
            sugerencias.innerHTML = '';
            if (q.length < 3) { return; }
            window.MBMapa.buscarLugar(q + (MB.cfg.ciudad ? ', ' + MB.cfg.ciudad : '')).then(function (lista) {
                sugerencias.innerHTML = '';
                lista.slice(0, 5).forEach(function (l) {
                    var corto = l.nombre.split(',').slice(0, 3).join(',');
                    var b = MB.h('div', { clase: 'item-bus', role: 'button', tabindex: '0', html: '<div class="insignia">' + MB.ico('pin') + '</div><div class="crece"><h4>' + MB.esc(corto) + '</h4></div>' });
                    b.addEventListener('click', function () { plan.destino = { lat: l.lat, lng: l.lng, nombre: corto }; sugerencias.innerHTML = ''; campo.value = ''; pintarTextos(); });
                    sugerencias.appendChild(b);
                });
            }).catch(function () {});
        }, 450));

        var frecuentes = leerFrecuentes();
        var chips = MB.h('div', { clase: 'chips-frecuentes' });
        frecuentes.forEach(function (f) {
            var b = MB.h('button', { type: 'button', texto: f.nombre.slice(0, 28) });
            b.addEventListener('click', function () { plan.destino = { lat: f.lat, lng: f.lng, nombre: f.nombre }; pintarTextos(); });
            chips.appendChild(b);
        });

        var buscar = MB.h('button', { type: 'button', clase: 'boton primario bloque', html: MB.ico('navegar') + '<span>Buscar mi bus</span>' });
        buscar.addEventListener('click', function () {
            var o = plan.origen || (ctx.ubicacion ? { lat: ctx.ubicacion[0], lng: ctx.ubicacion[1] } : null);
            if (!o) { MB.toast('Indica dónde empiezas el viaje', 'mal'); return; }
            if (!plan.destino) { MB.toast('Elige tu destino', 'mal'); return; }
            guardarFrecuente(plan.destino);
            resultados.innerHTML = '<div class="esqueleto" style="height:90px"></div>';
            MB.get('publico/planificar', { olat: o.lat, olng: o.lng, dlat: plan.destino.lat, dlng: plan.destino.lng }).then(function (r) {
                plan.opciones = r.opciones;
                resultados.innerHTML = '';
                if (!r.opciones.length) { resultados.innerHTML = '<div class="vacio">' + MB.ico('bus') + '<p>' + MB.esc(r.mensaje || 'Sin resultados') + '</p></div>'; return; }
                r.opciones.forEach(function (op, i) {
                    var espera = op.espera_min !== null ? 'Llega a tu subida en ' + op.espera_min + ' min' : (op.conectado ? 'Sin cálculo de llegada' : 'Sin señal ahora; espera estimada 10 min');
                    var sube = op.parada_sube ? 'parada #' + op.parada_sube.numero + ' ' + op.parada_sube.nombre : 'la ruta del bus';
                    var baja = op.parada_baja ? 'parada #' + op.parada_baja.numero + ' ' + op.parada_baja.nombre : 'la ruta del bus';
                    var el = MB.h('div', { clase: 'tarjeta-plan', role: 'button', tabindex: '0', html:
                        '<div class="fila-entre"><b>' + (i === 0 ? 'Mejor opción · ' : '') + MB.esc(op.nombre) + '</b><span class="pastilla info">≈ ' + op.total_min + ' min</span></div>' +
                        '<div class="suave pequeno" style="margin-top:6px">Camina ' + op.caminata_origen_m + ' m hasta ' + MB.esc(sube) + '</div>' +
                        '<div class="suave pequeno">' + MB.esc(espera) + '</div>' +
                        '<div class="suave pequeno">Viaje de ' + op.minutos_viaje + ' min (' + MB.dist(op.viaje_m) + ') y bajas en ' + MB.esc(baja) + '</div>' +
                        '<div class="suave pequeno">Luego camina ' + op.caminata_destino_m + ' m hasta tu destino</div>' });
                    el.addEventListener('click', function () { Array.prototype.forEach.call(resultados.children, function (x) { x.classList.remove('activo'); }); el.classList.add('activo'); dibujarOpcion(op); });
                    resultados.appendChild(el);
                });
            }).catch(function (e) { resultados.innerHTML = '<div class="vacio"><p>' + MB.esc(e.message) + '</p></div>'; });
        });

        cuerpo.appendChild(origenTxt);
        cuerpo.appendChild(MB.h('div', { clase: 'fila', style: 'gap:8px;flex-wrap:wrap;margin-bottom:10px' }, botGps, botOrigen, botDestino));
        cuerpo.appendChild(caja);
        cuerpo.appendChild(sugerencias);
        cuerpo.appendChild(destinoTxt);
        if (frecuentes.length) { cuerpo.appendChild(MB.h('div', { clase: 'suave pequeno', texto: 'Tus destinos frecuentes' })); cuerpo.appendChild(chips); }
        cuerpo.appendChild(buscar);
        cuerpo.appendChild(MB.h('div', { style: 'margin-top:12px' }, resultados));
        pintarTextos();
    }

    function pintarFavoritas(zona) {
        if (!favoritas.length) { return; }
        zona.appendChild(MB.h('h4', { texto: 'Mis paradas', style: 'margin:4px 0 8px' }));
        favoritas.forEach(function (f) {
            var m = f.mejor;
            var pill = m ? (m.llegando ? '<span class="pastilla ok">Llegando</span>' : '<span class="pastilla info">' + MB.esc(m.bus) + ' · ' + m.minutos + ' min</span>') : '';
            var el = MB.h('div', { clase: 'item-bus', role: 'button', tabindex: '0', html: '<div class="num-parada">' + (f.numero || '·') + '</div><div class="crece"><h4>' + MB.esc(f.nombre) + '</h4><div class="meta"><span class="codigo-parada">' + MB.esc(f.codigo || '') + '</span></div></div>' + pill });
            el.addEventListener('click', function () { fichaParada(f); });
            zona.appendChild(el);
        });
        zona.appendChild(MB.h('div', { style: 'height:8px' }));
    }

    function listaParadas(cuerpo) {
        cuerpo.innerHTML = '';
        var caja = MB.h('div', { clase: 'buscador buscador-hoja', html: MB.ico('buscar') });
        var campo = MB.h('input', { type: 'search', placeholder: 'Buscar por número, nombre o código', 'aria-label': 'Buscar parada', value: busquedaParada });
        caja.appendChild(campo);
        cuerpo.appendChild(caja);
        var zonaFav = MB.h('div');
        cuerpo.appendChild(zonaFav);
        pintarFavoritas(zonaFav);
        var resultado = MB.h('div');
        cuerpo.appendChild(resultado);

        function pintar() {
            resultado.innerHTML = '';
            if (!paradas.length) { resultado.innerHTML = '<div class="vacio">' + MB.ico('pin') + '<p>Aún no hay paradas cargadas para ' + MB.esc(MB.cfg.ciudad || 'tu ciudad') + '.</p></div>'; return; }
            var q = busquedaParada.trim().toLowerCase();
            var lista = paradas.filter(function (p) { return !q || String(p.numero) === q || p.nombre.toLowerCase().indexOf(q) >= 0 || (p.codigo || '').toLowerCase().indexOf(q) >= 0; }).map(function (p) { return { p: p, d: ctx.ubicacion ? MB.distanciaM(ctx.ubicacion, [p.lat, p.lng]) : null }; });
            if (ctx.ubicacion) { lista.sort(function (a, b) { return a.d - b.d; }); }
            resultado.appendChild(MB.h('p', { clase: 'suave pequeno', style: 'margin-bottom:10px', texto: lista.length + ' de ' + paradas.length + ' paradas' + (ctx.ubicacion ? ' · ordenadas por cercanía' : '') }));
            lista.slice(0, 80).forEach(function (x, i) {
                var p = x.p;
                var el = MB.h('div', { clase: 'item-bus', style: 'animation-delay:' + Math.min(i, 8) * 25 + 'ms', role: 'button', tabindex: '0', html: '<div class="num-parada">' + (p.numero || '·') + '</div><div class="crece"><h4>' + MB.esc(p.nombre) + '</h4><div class="meta"><span class="codigo-parada">' + MB.esc(p.codigo || '') + '</span>' + (x.d !== null ? ' · A ' + MB.dist(x.d) + ' de ti' : '') + '</div></div>' });
                el.addEventListener('click', function () { if (ctx.mapa) { ctx.hoja('baja'); ctx.mapa.mapa.flyTo([p.lat, p.lng], 17, { duration: 0.8 }); } });
                resultado.appendChild(el);
            });
            if (lista.length > 80) { resultado.appendChild(MB.h('p', { clase: 'suave pequeno centro', texto: 'Mostrando las primeras 80. Usa el buscador para encontrar una parada.' })); }
        }

        campo.addEventListener('input', MB.debounce(function () { busquedaParada = campo.value; pintar(); }, 160));
        pintar();
    }

    function listaCircuitos(cuerpo) {
        cuerpo.innerHTML = '<div class="esqueleto" style="height:60px"></div>';
        MB.get('publico/eventos').then(function (r) {
            cuerpo.innerHTML = '';
            if (!r.eventos.length) { cuerpo.innerHTML = '<div class="vacio">' + MB.ico('destello') + '<p>No hay circuitos creativos activos hoy.</p></div>'; return; }
            r.eventos.forEach(function (ev) {
                var el = MB.h('div', { clase: 'item-bus' + (evento === ev.id ? ' activo' : ''), role: 'button', tabindex: '0', html: '<div class="insignia" style="background:' + MB.esc(ev.color || '#ff8a3d') + '">' + MB.ico('destello') + '</div><div class="crece"><h4>' + MB.esc(ev.nombre) + '</h4><div class="meta">' + (ev.siempre_activo ? 'Disponible siempre' : 'Evento de temporada') + '</div></div>' });
                el.addEventListener('click', function () { evento = ev.id; cargarCircuito(ev); listaCircuitos(cuerpo); });
                cuerpo.appendChild(el);
            });
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio"><p>' + MB.esc(e.message) + '</p></div>'; });
    }

    function cargarCircuito(ev) {
        if (!ctx.mapa) { return; }
        MB.get('publico/ruta-creativa', { evento_id: ev.id }).then(function (r) {
            ctx.mapa.limpiar('circuito');
            var visibles = r.puntos.filter(function (p) { return p.visible; });
            if (!visibles.length) { MB.toast('Este circuito aún no tiene puntos', 'info'); return; }
            visibles.forEach(function (p, i) {
                ctx.mapa.pin('circuito', p, ev.color, function () { location.href = MB.url('/punto/' + p.id); }, (i + 1) + '. ' + p.nombre);
            });
            var coords = visibles.map(function (p) { return [p.lat, p.lng]; });
            window.MBMapa.osrm(coords).then(function (trazo) {
                ctx.mapa.linea('circuito', trazo, { color: ev.color || '#ff8a3d', weight: 5, opacity: 0.85 });
            }).catch(function () {
                ctx.mapa.linea('circuito', coords, { color: ev.color || '#ff8a3d', weight: 4, dashArray: '6 8' });
            });
            ctx.hoja('baja');
            ctx.mapa.ajustar(coords, [60, 60]);
        }).catch(function (e) { MB.toast(e.message, 'mal'); });
    }

    var tabUni = MB.$('#pestana-universidad');
    if (tabUni) {
        if (uni) { tabUni.classList.remove('oculto'); tabUni.textContent = uni.siglas; } else { tabUni.remove(); }
    }

    ctx.registrar('buses', function (c) { listaBuses(c); });
    ctx.registrar('universidad', function (c) { listaUniversidad(c); });
    ctx.registrar('paradas', listaParadas);
    ctx.registrar('planificar', listaPlanificar);
    ctx.registrar('circuitos', listaCircuitos);
    ctx.registrar('opinar', function (c) { ctx.formOpinion(c); formReporte(c); });
    ctx.busesOpinion = function () { return buses.concat(universitarios).map(function (b) { return { id: b.id, nombre: b.nombre }; }); };
    ctx.activar('buses');

    cargarParadas();
    cargarCierres();
    cargarInfoUni();
    cargarFavoritas(true);
    MB.sondeo(function () { return favoritas.length ? cargarFavoritas(true) : Promise.resolve(); }, 25000, { pausarOculto: true });
    setInterval(cargarCierres, 60000);
    MB.sondeo(cargar, 4000, { segundoPlano: 20000 });
    MB.sondeo(function () { pintarEta(); return Promise.resolve(); }, 20000, { pausarOculto: true });
})();
