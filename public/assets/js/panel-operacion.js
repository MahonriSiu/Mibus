(function () {
    'use strict';
    var MB = window.MB, P = window.PNL, K = window.PNLK, G = window.MBG;
    if (!P) { return; }
    var rol = P.rol;
    var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function interruptor(valor, alCambiar) {
        var i = MB.h('input', { type: 'checkbox' });
        i.checked = !!valor;
        i.addEventListener('change', function () { i.disabled = true; Promise.resolve(alCambiar(i.checked)).catch(function (e) { i.checked = !i.checked; MB.toast(e.message, 'mal'); }).then(function () { i.disabled = false; }); });
        return MB.h('label', { clase: 'conmutador' }, i, MB.h('span'));
    }

    function iconoAccion(icono, titulo, fn, clase) {
        var b = MB.h('button', { type: 'button', clase: 'boton icono fantasma ' + (clase || ''), title: titulo, 'aria-label': titulo, html: MB.ico(icono) });
        b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
        return b;
    }

    function celdaAcciones() {
        var d = MB.h('div', { clase: 'fila', style: 'gap:2px;justify-content:flex-end' });
        Array.prototype.slice.call(arguments).forEach(function (b) { d.appendChild(b); });
        return d;
    }

    function metricas(lista) {
        return '<div class="metricas" style="margin:12px 0">' + lista.map(function (m) { return '<div class="metrica"><b>' + m[0] + '</b><span>' + MB.esc(m[1]) + '</span></div>'; }).join('') + '</div>';
    }

    function falla(cont, e) { cont.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; }

    function diasHtml(marcados) {
        return '<div class="campo"><label>Días</label><div class="fila" style="flex-wrap:wrap;gap:6px">' + DIAS.map(function (d, i) {
            return '<label style="display:flex;gap:4px;align-items:center;font-weight:500;color:var(--texto)"><input type="checkbox" name="dia" value="' + i + '"' + (marcados.indexOf(i) >= 0 ? ' checked' : '') + '> ' + d + '</label>';
        }).join('') + '</div></div>';
    }

    function diasLeidos(f) {
        return Array.prototype.slice.call(f.querySelectorAll('[name=dia]:checked')).map(function (x) { return x.value; }).join(',');
    }

    function etiquetaDias(csv) {
        var l = String(csv).split(',').filter(function (x) { return x !== ''; }).map(Number);
        if (l.length === 7) { return 'Todos los días'; }
        if (l.join(',') === '1,2,3,4,5') { return 'Lun a Vie'; }
        return l.map(function (d) { return DIAS[d]; }).join(', ');
    }

    P.registrar('desempeno', function (cont) {
        var sel = MB.h('select', { 'aria-label': 'Período' });
        sel.innerHTML = '<option value="7">Últimos 7 días</option><option value="14">Últimos 14 días</option><option value="3">Últimos 3 días</option>';
        var titulo = rol === 'propietario' ? 'Reporte semanal' : 'Desempeño de buses';
        cont.appendChild(P.encabezado(titulo, 'Kilómetros, horas en servicio, paradas atendidas y calidad de cada bus.', P.boton('Descargar PDF', 'descargar', 'fantasma', function () { window.open(MB.url('/api/panel/desempeno/pdf?dias=' + sel.value), '_blank'); return Promise.resolve(); })));
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, sel));
        var cuerpo = MB.h('div');
        cont.appendChild(cuerpo);

        function cargar() {
            cuerpo.innerHTML = '<div class="esqueleto" style="height:120px"></div>';
            MB.get('panel/desempeno', { dias: sel.value }, { timeout: 40000 }).then(function (r) {
                cuerpo.innerHTML = metricas([[MB.num(r.buses.length), 'buses'], [MB.num(r.total_km), 'kilómetros'], [MB.num(r.total_horas), 'horas en servicio']]);
                var cols = [
                    { etq: 'Bus', campo: 'bus', orden: true, render: function (b) { return '<b>' + MB.esc(b.bus) + '</b><div class="suave pequeno">' + MB.esc(b.ruta) + '</div>'; } }
                ];
                if (rol !== 'propietario') { cols.push({ etq: 'Propietario', render: function (b) { return MB.esc(b.propietario || '—'); } }); }
                cols.push(
                    { etq: 'Km', campo: 'km', valor: function (b) { return b.km; }, orden: true },
                    { etq: 'Horas', campo: 'horas', valor: function (b) { return b.horas; }, orden: true },
                    { etq: 'Días activo', campo: 'dias_activo', valor: function (b) { return b.dias_activo; }, orden: true },
                    { etq: 'Paradas', campo: 'llegadas', valor: function (b) { return b.llegadas; }, orden: true },
                    { etq: 'Nota', campo: 'nota', valor: function (b) { return b.nota === null ? -1 : b.nota; }, orden: true, render: function (b) { return b.nota === null ? '—' : b.nota + ' (' + b.resenas + ')'; } },
                    { etq: 'SOS', campo: 'sos', valor: function (b) { return b.sos; }, orden: true },
                    { etq: 'Cortes', campo: 'desconexiones', valor: function (b) { return b.desconexiones; }, orden: true },
                    { etq: 'Fuera de ruta', campo: 'fuera_ruta', valor: function (b) { return b.fuera_ruta; }, orden: true }
                );
                cuerpo.appendChild(P.tabla(cols, r.buses, { vacio: 'No hay buses para mostrar' }).el);
            }).catch(function (e) { falla(cuerpo, e); });
        }

        sel.addEventListener('change', cargar);
        cargar();
        return null;
    });

    P.registrar('misresenas', function (cont) {
        cont.appendChild(P.encabezado('Reseñas de mis buses', 'Lo que opinan los pasajeros cuando eligen un bus específico.'));
        var cuerpo = MB.h('div');
        cont.appendChild(cuerpo);
        MB.get('panel/resenas-bus').then(function (r) {
            if (r.resumen.length) {
                cuerpo.appendChild(MB.h('div', { clase: 'cuadricula auto', style: 'margin-bottom:14px', html: r.resumen.map(function (x) { return '<div class="tarjeta"><b>' + MB.esc(x.bus) + '</b><div style="font-size:26px;font-weight:800;margin-top:6px">' + (x.prom !== null ? x.prom + ' / 5' : '—') + '</div><div class="suave pequeno">' + MB.num(x.n) + ' reseñas</div></div>'; }).join('') }));
            }
            cuerpo.appendChild(P.tabla([
                { etq: 'Bus', render: function (x) { return MB.esc(x.bus); } },
                { etq: 'Nota', render: function (x) { return x.calificacion ? x.calificacion + ' / 5' : '—'; } },
                { etq: 'Comentario', render: function (x) { return MB.esc(x.comentario || ''); } },
                { etq: 'Pasajero', campo: 'nombre' },
                { etq: 'Fecha', render: function (x) { return MB.esc(x.fecha_hora); } }
            ], r.resenas, { vacio: 'Aún no hay reseñas de tus buses. Aparecen cuando el pasajero elige el bus al opinar.' }).el);
        }).catch(function (e) { falla(cuerpo, e); });
        return null;
    });

    P.registrar('turnos', function (cont) {
        var cuerpo = MB.h('div');
        var buses = [];

        function editar(t) {
            if (!buses.length) { MB.toast('No hay buses disponibles', 'mal'); return; }
            var f = MB.h('form', { novalidate: true });
            f.innerHTML = '<div class="campo"><label>Bus</label><select name="bus_id">' + buses.map(function (b) { return '<option value="' + b.id + '"' + (t && String(t.bus_id) === String(b.id) ? ' selected' : '') + '>' + MB.esc(b.nombre) + '</option>'; }).join('') + '</select></div>' +
                diasHtml(t ? String(t.dias).split(',').map(Number) : [1, 2, 3, 4, 5]) +
                '<div class="dos-col"><div class="campo"><label>Hora de salida</label><input name="hora_salida" type="time" value="' + MB.esc(t ? t.hora_salida : '') + '"></div><div class="campo"><label>Hora de fin (opcional)</label><input name="hora_fin" type="time" value="' + MB.esc(t && t.hora_fin ? t.hora_fin : '') + '"></div></div>' +
                '<div class="campo"><label>Nota</label><input name="nota" maxlength="150" value="' + MB.esc(t ? t.nota || '' : '') + '"></div>';
            MB.modal({ titulo: t ? 'Editar turno' : 'Nuevo turno', cuerpo: f, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', clase: 'primario', alPulsar: function () {
                var d = { id: t ? t.id : 0, bus_id: f.querySelector('[name=bus_id]').value, dias: diasLeidos(f), hora_salida: f.querySelector('[name=hora_salida]').value, hora_fin: f.querySelector('[name=hora_fin]').value, nota: f.querySelector('[name=nota]').value };
                return MB.post('panel/turno/guardar', d).then(function () { MB.toast('Turno guardado', 'ok'); cargar(); });
            } }] });
        }

        cont.appendChild(P.encabezado('Turnos', 'Qué bus sale a qué hora y en qué días.', P.boton('Nuevo turno', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })));
        cont.appendChild(cuerpo);

        function cargar() {
            MB.get('panel/turnos').then(function (r) {
                buses = r.buses;
                cuerpo.innerHTML = '';
                cuerpo.appendChild(P.tabla([
                    { etq: 'Bus', campo: 'bus', orden: true },
                    { etq: 'Días', render: function (t) { return MB.esc(etiquetaDias(t.dias)); } },
                    { etq: 'Salida', campo: 'hora_salida', orden: true },
                    { etq: 'Fin', render: function (t) { return t.hora_fin || '—'; } },
                    { etq: 'Nota', render: function (t) { return MB.esc(t.nota || ''); } },
                    { etq: '', render: function (t) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editar(t); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar turno', t.bus + ' · ' + t.hora_salida, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('panel/turno/eliminar', { id: t.id }).then(cargar).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); } }
                ], r.turnos, { vacio: 'No hay turnos registrados' }).el);
            }).catch(function (e) { falla(cuerpo, e); });
        }

        cargar();
        return null;
    });

    P.registrar('bitacora', function (cont) {
        var f = { tipo: '', rol: '', desde: '', hasta: '', exito: '', q: '', pagina: 1 };
        var selTipo = MB.h('select', { 'aria-label': 'Tipo' });
        var selRol = MB.h('select', { 'aria-label': 'Rol' });
        selRol.innerHTML = '<option value="">Todos los roles</option><option value="admin">Admin</option><option value="auditor">Auditor</option><option value="propietario">Propietario</option><option value="cooperativa">Cooperativa</option><option value="usuario">Pasajero</option><option value="emisor">Chofer</option><option value="anonimo">Anónimo</option>';
        var selRes = MB.h('select', { 'aria-label': 'Resultado' });
        selRes.innerHTML = '<option value="">Todos los resultados</option><option value="1">Correctos</option><option value="0">Con fallo</option>';
        var desde = MB.h('input', { type: 'date', 'aria-label': 'Desde' });
        var hasta = MB.h('input', { type: 'date', 'aria-label': 'Hasta' });
        var q = MB.h('input', { type: 'search', placeholder: 'Buscar en detalle, endpoint o IP…', 'aria-label': 'Buscar' });
        var cuerpo = MB.h('div');
        var pie = MB.h('div', { clase: 'fila-entre', style: 'margin-top:12px' });

        function consulta() {
            return 'tipo=' + encodeURIComponent(f.tipo) + '&rol=' + encodeURIComponent(f.rol) + '&desde=' + f.desde + '&hasta=' + f.hasta + '&exito=' + f.exito + '&q=' + encodeURIComponent(f.q);
        }

        cont.appendChild(P.encabezado('Bitácora', 'Registro de seguridad con filtros. Se puede exportar a PDF.', P.boton('Exportar PDF', 'descargar', 'fantasma', function () { window.open(MB.url('/api/panel/bitacora/pdf?' + consulta()), '_blank'); return Promise.resolve(); })));
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas', style: 'flex-wrap:wrap;gap:8px' }, selTipo, selRol, selRes, desde, hasta, q));
        cont.appendChild(cuerpo);
        cont.appendChild(pie);

        function cargar() {
            cuerpo.innerHTML = '<div class="esqueleto" style="height:120px"></div>';
            MB.get('panel/bitacora', { tipo: f.tipo, rol: f.rol, desde: f.desde, hasta: f.hasta, exito: f.exito, q: f.q, pagina: f.pagina }).then(function (r) {
                if (selTipo.options.length <= 1) { selTipo.innerHTML = '<option value="">Todos los tipos</option>' + r.tipos.map(function (t) { return '<option value="' + MB.esc(t) + '">' + MB.esc(t) + '</option>'; }).join(''); selTipo.value = f.tipo; }
                cuerpo.innerHTML = '';
                cuerpo.appendChild(P.tabla([
                    { etq: 'Fecha', render: function (x) { return MB.esc(x.momento); } },
                    { etq: 'Rol', render: function (x) { return MB.esc(x.rol) + (x.usuario_id ? ' #' + x.usuario_id : ''); } },
                    { etq: 'Tipo', render: function (x) { return P.pastilla(x.tipo, Number(x.exito) === 1 ? 'info' : 'mal'); } },
                    { etq: 'Detalle', render: function (x) { return MB.esc(x.detalle || x.endpoint || ''); } },
                    { etq: 'IP', render: function (x) { return '<span class="codigo-parada">' + MB.esc(x.ip) + '</span>'; } },
                    { etq: 'Resultado', render: function (x) { return Number(x.exito) === 1 ? P.pastilla('OK', 'ok') : P.pastilla('Fallo', 'mal'); } }
                ], r.registros, { vacio: 'Sin registros con esos filtros' }).el);
                var paginas = Math.max(1, Math.ceil(r.total / r.por_pagina));
                pie.innerHTML = '';
                var ant = P.boton('Anterior', 'izq', 'fantasma pequeno', function () { if (f.pagina > 1) { f.pagina--; cargar(); } return Promise.resolve(); });
                var sig = P.boton('Siguiente', 'der', 'fantasma pequeno', function () { if (f.pagina < paginas) { f.pagina++; cargar(); } return Promise.resolve(); });
                pie.appendChild(ant);
                pie.appendChild(MB.h('span', { clase: 'suave pequeno', texto: 'Página ' + r.pagina + ' de ' + paginas + ' · ' + MB.num(r.total) + ' registros' }));
                pie.appendChild(sig);
            }).catch(function (e) { falla(cuerpo, e); });
        }

        function filtrar() { f.tipo = selTipo.value; f.rol = selRol.value; f.exito = selRes.value; f.desde = desde.value; f.hasta = hasta.value; f.q = q.value.trim(); f.pagina = 1; cargar(); }
        [selTipo, selRol, selRes, desde, hasta].forEach(function (x) { x.addEventListener('change', filtrar); });
        q.addEventListener('input', MB.debounce(filtrar, 350));
        cargar();
        return null;
    });

    P.registrar('reportes', function (cont) {
        var estado = 'pendiente';
        var NOMBRES = { parada_falta: 'Falta una parada', parada_mal: 'Parada mal ubicada', calle_cerrada: 'Calle cerrada', bus_problema: 'Problema con un bus', otro: 'Otro' };
        var cuerpo = MB.h('div', { clase: 'cuadricula auto' });
        var tabs = MB.h('div', { clase: 'fila', style: 'gap:8px;margin-bottom:12px;flex-wrap:wrap' });
        cont.appendChild(P.encabezado('Reportes de usuarios', 'Revisa lo que reportan los pasajeros: paradas que faltan, calles cerradas y problemas con buses.'));
        cont.appendChild(tabs);
        cont.appendChild(cuerpo);

        function resolver(r, accion) {
            var caja = MB.h('div');
            var nota = MB.h('input', { type: 'text', maxlength: '255', placeholder: 'Nota interna (opcional)' });
            caja.appendChild(MB.h('div', { clase: 'campo' }, nota));
            var chk = null;
            if (r.similares > 0) {
                chk = MB.h('input', { type: 'checkbox' });
                chk.checked = true;
                caja.appendChild(MB.h('label', { style: 'display:flex;gap:8px;align-items:center;font-weight:500;color:var(--texto)' }, chk, MB.h('span', { texto: 'Resolver también ' + r.similares + ' reporte(s) parecido(s) en el mismo lugar' })));
            }
            var etiqueta = accion === 'aprobar' ? (r.tipo === 'parada_falta' ? 'Aprobar y crear la parada' : 'Aprobar') : 'Rechazar';
            MB.modal({ titulo: etiqueta, sub: NOMBRES[r.tipo] + (r.texto ? ': ' + r.texto : ''), cuerpo: caja, botones: [{ texto: 'Cancelar', valor: null }, { texto: etiqueta, clase: accion === 'aprobar' ? 'primario' : 'peligro', alPulsar: function () {
                return MB.post('admin/reporte/resolver', { id: r.id, accion: accion, nota: nota.value.trim(), similares: chk && chk.checked ? 1 : 0 }).then(function (x) {
                    MB.toast(x.resueltos + ' reporte(s) resueltos', 'ok');
                    if (x.cerrar) { window.PNL_CIERRE_PRE = x.cerrar; P.irA('cierres'); } else { cargar(); }
                });
            } }] });
        }

        function pintarTabs(pendientes) {
            tabs.innerHTML = '';
            [['pendiente', 'Pendientes' + (pendientes ? ' (' + pendientes + ')' : '')], ['aprobado', 'Aprobados'], ['rechazado', 'Rechazados']].forEach(function (x) {
                var b = MB.h('button', { type: 'button', clase: 'boton pequeno ' + (estado === x[0] ? 'primario' : 'fantasma'), texto: x[1] });
                b.addEventListener('click', function () { estado = x[0]; cargar(); });
                tabs.appendChild(b);
            });
        }

        function cargar() {
            cuerpo.innerHTML = '<div class="esqueleto" style="height:100px"></div>';
            MB.get('admin/reportes', { estado: estado }).then(function (r) {
                pintarTabs(r.pendientes);
                cuerpo.innerHTML = '';
                if (!r.reportes.length) { cuerpo.innerHTML = '<div class="vacio">' + MB.ico('ok') + '<p>No hay reportes ' + (estado === 'pendiente' ? 'pendientes' : estado + 's') + '.</p></div>'; return; }
                r.reportes.forEach(function (x) {
                    var mapaUrl = x.lat !== null ? 'https://www.openstreetmap.org/?mlat=' + x.lat + '&mlon=' + x.lng + '#map=19/' + x.lat + '/' + x.lng : null;
                    var t = MB.h('div', { clase: 'tarjeta', html:
                        '<div class="fila-entre"><b>' + MB.esc(NOMBRES[x.tipo] || x.tipo) + '</b><span class="suave pequeno">#' + x.id + '</span></div>' +
                        '<p style="margin:8px 0">' + MB.esc(x.texto || 'Sin descripción') + '</p>' +
                        '<div class="fila" style="flex-wrap:wrap;gap:6px;margin-bottom:6px">' + (x.ciudad ? P.pastilla(x.ciudad) : '') + (x.bus ? P.pastilla(x.bus, 'info') : '') + (x.similares ? P.pastilla(x.similares + ' parecidos', 'aviso') : '') + '</div>' +
                        '<div class="suave pequeno">' + MB.esc(x.usuario || 'Anónimo') + (x.telefono ? ' · ' + MB.esc(x.telefono) : '') + ' · ' + MB.esc(x.fecha_hora) + '</div>' +
                        (x.nota_admin ? '<div class="suave pequeno">Nota: ' + MB.esc(x.nota_admin) + '</div>' : '') +
                        (mapaUrl ? '<div style="margin-top:6px"><a href="' + mapaUrl + '" target="_blank" rel="noopener">Ver el lugar en el mapa</a></div>' : '') });
                    if (estado === 'pendiente') {
                        t.appendChild(MB.h('div', { clase: 'fila', style: 'gap:8px;margin-top:10px' }, P.boton('Aprobar', 'ok', 'primario pequeno', function () { resolver(x, 'aprobar'); return Promise.resolve(); }), P.boton('Rechazar', 'x', 'fantasma pequeno', function () { resolver(x, 'rechazar'); return Promise.resolve(); })));
                    }
                    cuerpo.appendChild(t);
                });
            }).catch(function (e) { falla(cuerpo, e); });
        }

        cargar();
        return null;
    });

    P.registrar('demanda', function (cont) {
        var selDias = MB.h('select', { 'aria-label': 'Período' });
        selDias.innerHTML = '<option value="7">7 días</option><option value="14" selected>14 días</option><option value="30">30 días</option><option value="60">60 días</option>';
        var selCiudad = MB.h('select', { 'aria-label': 'Ciudad' });
        selCiudad.innerHTML = '<option value="">Todas las ciudades</option>';
        cont.appendChild(P.encabezado('Demanda de paradas', 'Las paradas que más consultan los pasajeros. Los círculos más grandes y rojos son las más pedidas.'));
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, selDias, selCiudad));
        var m = K.crearMapa('420px');
        cont.appendChild(MB.h('div', { clase: 'tarjeta mapa-t' }, m.caja));
        var detalle = MB.h('div', { style: 'margin-top:16px' });
        cont.appendChild(detalle);

        if (!window.MBMapa.disponible()) { m.caja.innerHTML = '<div class="vacio">Mapa no disponible</div>'; return null; }
        var mapa = window.MBMapa.crear(m.id, { zoom: 13 });
        var L = window.L;
        setTimeout(function () { mapa.invalidar(); }, 150);

        function color(r) { var rojo = Math.round(80 + 175 * r), verde = Math.round(200 - 150 * r); return 'rgb(' + rojo + ',' + verde + ',60)'; }

        function cargar() {
            MB.get('panel/demanda', { dias: selDias.value, ciudad_id: selCiudad.value || 0 }).then(function (r) {
                mapa.limpiar('calor');
                var max = r.paradas.length ? r.paradas[0].n : 1;
                var pts = [];
                r.paradas.forEach(function (p) {
                    var ratio = p.n / max;
                    var c = L.circle([p.lat, p.lng], { radius: 45 + 220 * ratio, stroke: false, fillColor: color(ratio), fillOpacity: 0.3 }).addTo(mapa.capa('calor'));
                    c.bindTooltip('#' + p.numero + ' ' + MB.esc(p.nombre) + ' · ' + p.n + ' consultas', { className: 'tip-mapa' });
                    pts.push([p.lat, p.lng]);
                });
                if (pts.length) { mapa.ajustar(pts, [50, 50]); }
                detalle.innerHTML = metricas([[MB.num(r.total), 'consultas'], [MB.num(r.paradas.length), 'paradas consultadas']]);
                var g = MB.h('div');
                detalle.appendChild(MB.h('h3', { texto: 'Consultas por hora del día', style: 'margin-bottom:8px' }));
                detalle.appendChild(g);
                setTimeout(function () { G.barras(g, { alto: 150, etiquetas: r.por_hora.map(function (v, i) { return String(i); }), titulos: r.por_hora.map(function (v, i) { return i + ':00'; }), datos: r.por_hora, unidad: 'consultas', color: 'acento' }); }, 60);
                detalle.appendChild(MB.h('h3', { texto: 'Paradas más consultadas', style: 'margin:16px 0 8px' }));
                detalle.appendChild(P.tabla([
                    { etq: 'N.º', render: function (p) { return '<span class="num-parada" style="min-width:38px;height:34px;font-size:13px">' + (p.numero || '·') + '</span>'; } },
                    { etq: 'Parada', render: function (p) { return '<b>' + MB.esc(p.nombre) + '</b><div class="codigo-parada">' + MB.esc(p.codigo || '') + '</div>'; } },
                    { etq: 'Ciudad', render: function (p) { return MB.esc(p.ciudad || '—'); } },
                    { etq: 'Consultas', campo: 'n', valor: function (p) { return p.n; }, orden: true }
                ], r.paradas.slice(0, 20), { vacio: 'Aún no hay consultas de paradas en este período' }).el);
            }).catch(function (e) { falla(detalle, e); });
        }

        MB.get('admin/ciudades').then(function (r) {
            r.ciudades.forEach(function (c) { selCiudad.appendChild(MB.h('option', { value: String(c.id), texto: c.nombre })); });
            var bf = r.ciudades.filter(function (c) { return c.nombre === 'Bluefields'; })[0];
            if (bf) { selCiudad.value = String(bf.id); }
            cargar();
        }).catch(function () { cargar(); });

        selDias.addEventListener('change', cargar);
        selCiudad.addEventListener('change', cargar);
        return null;
    });

    P.registrar('respaldos', function (cont) {
        var cuerpo = MB.h('div');
        function tamano(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
        cont.appendChild(P.encabezado('Respaldos', 'Se crea un respaldo automático de la base de datos cada día y se conservan los últimos 10.', P.boton('Crear respaldo ahora', 'descargar', 'primario', function () {
            return MB.post('admin/respaldo/crear', {}, { timeout: 120000 }).then(function (r) { MB.toast('Respaldo creado (' + tamano(r.bytes) + ')', 'ok'); cargar(); });
        })));
        cont.appendChild(MB.h('p', { clase: 'suave pequeno', style: 'margin-bottom:12px', texto: 'Los respaldos no incluyen el historial de posiciones GPS, accesos ni la bitácora, solo la estructura de esas tablas. Descarga uno de vez en cuando y guárdalo fuera del hosting.' }));
        cont.appendChild(cuerpo);

        function cargar() {
            MB.get('admin/respaldos').then(function (r) {
                cuerpo.innerHTML = '';
                cuerpo.appendChild(P.tabla([
                    { etq: 'Archivo', render: function (x) { return '<span class="codigo-parada">' + MB.esc(x.archivo) + '</span>'; } },
                    { etq: 'Fecha', render: function (x) { return MB.esc(x.fecha); } },
                    { etq: 'Tamaño', render: function (x) { return tamano(x.bytes); } },
                    { etq: '', render: function (x) { return celdaAcciones(iconoAccion('descargar', 'Descargar', function () { window.open(MB.url('/api/admin/respaldo/descargar?archivo=' + encodeURIComponent(x.archivo)), '_blank'); })); } }
                ], r.respaldos, { vacio: 'Aún no hay respaldos. El primero se crea solo en las próximas horas o puedes crearlo ahora.' }).el);
            }).catch(function (e) { falla(cuerpo, e); });
        }

        cargar();
        return null;
    });

    P.registrar('avisosuni', function (cont) {
        var selUni = MB.h('select', { 'aria-label': 'Universidad' });
        var zona = MB.h('div');
        var buses = [];
        cont.appendChild(P.encabezado('Avisos y horarios', 'Mensajes y salidas que ven los estudiantes de cada universidad.'));
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, selUni));
        cont.appendChild(zona);

        function editarHorario(h) {
            var f = MB.h('form', { novalidate: true });
            f.innerHTML = '<div class="campo"><label>Bus (opcional)</label><select name="bus_id"><option value="">Sin bus específico</option>' + buses.map(function (b) { return '<option value="' + b.id + '"' + (h && String(h.bus_id) === String(b.id) ? ' selected' : '') + '>' + MB.esc(b.nombre) + '</option>'; }).join('') + '</select></div>' +
                diasHtml(h ? String(h.dias).split(',').map(Number) : [1, 2, 3, 4, 5]) +
                '<div class="campo"><label>Hora de salida</label><input name="hora" type="time" value="' + MB.esc(h ? h.hora : '') + '"></div>' +
                '<div class="dos-col"><div class="campo"><label>Sale de</label><input name="origen" maxlength="100" value="' + MB.esc(h ? h.origen || '' : '') + '"></div><div class="campo"><label>Va a</label><input name="destino" maxlength="100" value="' + MB.esc(h ? h.destino || '' : '') + '"></div></div>' +
                '<div class="campo"><label>Nota</label><input name="nota" maxlength="150" value="' + MB.esc(h ? h.nota || '' : '') + '"></div>';
            MB.modal({ titulo: h ? 'Editar salida' : 'Nueva salida', cuerpo: f, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', clase: 'primario', alPulsar: function () {
                var d = { id: h ? h.id : 0, universidad_id: selUni.value, bus_id: f.querySelector('[name=bus_id]').value, dias: diasLeidos(f), hora: f.querySelector('[name=hora]').value, origen: f.querySelector('[name=origen]').value, destino: f.querySelector('[name=destino]').value, nota: f.querySelector('[name=nota]').value };
                return MB.post('admin/uni/horario/guardar', d).then(function () { MB.toast('Salida guardada', 'ok'); cargar(); });
            } }] });
        }

        function editarAviso() {
            MB.formulario({
                titulo: 'Nuevo aviso',
                campos: [
                    { nombre: 'titulo', etiqueta: 'Título', requerido: true, max: 150 },
                    { nombre: 'mensaje', etiqueta: 'Mensaje', tipo: 'textarea', requerido: true, max: 600 },
                    { nombre: 'gravedad', etiqueta: 'Importancia', tipo: 'select', opciones: [{ valor: 'info', texto: 'Informativo' }, { valor: 'advertencia', texto: 'Importante' }, { valor: 'urgente', texto: 'Urgente' }], defecto: 'info', mitad: true },
                    { nombre: 'expira', etiqueta: 'Vence', tipo: 'date', mitad: true }
                ],
                alGuardar: function (d) { d.universidad_id = selUni.value; return MB.post('admin/uni/aviso/guardar', d).then(function () { MB.toast('Aviso publicado', 'ok'); cargar(); }); }
            });
        }

        function cargar() {
            if (!selUni.value) { zona.innerHTML = '<div class="vacio"><p>Primero registra una universidad.</p></div>'; return; }
            zona.innerHTML = '<div class="esqueleto" style="height:100px"></div>';
            Promise.all([MB.get('admin/uni/horarios', { universidad_id: selUni.value }), MB.get('admin/uni/avisos', { universidad_id: selUni.value })]).then(function (r) {
                buses = r[0].buses;
                zona.innerHTML = '';
                zona.appendChild(MB.h('div', { clase: 'fila-entre', style: 'margin:6px 0 10px' }, MB.h('h3', { texto: 'Salidas' }), P.boton('Nueva salida', 'mas', 'primario pequeno', function () { editarHorario(null); return Promise.resolve(); })));
                zona.appendChild(P.tabla([
                    { etq: 'Hora', campo: 'hora', orden: true },
                    { etq: 'Días', render: function (h) { return MB.esc(etiquetaDias(h.dias)); } },
                    { etq: 'Recorrido', render: function (h) { return MB.esc((h.origen || '—') + (h.destino ? ' → ' + h.destino : '')); } },
                    { etq: 'Bus', render: function (h) { return MB.esc(h.bus || '—'); } },
                    { etq: '', render: function (h) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editarHorario(h); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar salida', h.hora, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/uni/horario/eliminar', { id: h.id }).then(cargar).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); } }
                ], r[0].horarios, { vacio: 'Sin salidas registradas' }).el);
                zona.appendChild(MB.h('div', { clase: 'fila-entre', style: 'margin:22px 0 10px' }, MB.h('h3', { texto: 'Avisos' }), P.boton('Nuevo aviso', 'mas', 'primario pequeno', function () { editarAviso(); return Promise.resolve(); })));
                zona.appendChild(P.tabla([
                    { etq: 'Aviso', render: function (a) { return '<b>' + MB.esc(a.titulo) + '</b><div class="suave pequeno">' + MB.esc(a.mensaje) + '</div>'; } },
                    { etq: 'Importancia', render: function (a) { return P.pastilla(a.gravedad, a.gravedad === 'urgente' ? 'mal' : a.gravedad === 'advertencia' ? 'aviso' : 'info'); } },
                    { etq: 'Vence', render: function (a) { return a.expira ? MB.esc(a.expira) : 'Sin fecha'; } },
                    { etq: 'Activo', render: function (a) { return interruptor(a.activo, function (v) { return MB.post('admin/uni/aviso/estado', { id: a.id, activo: v ? 1 : 0 }); }); } },
                    { etq: '', render: function (a) { return celdaAcciones(iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar aviso', a.titulo, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/uni/aviso/eliminar', { id: a.id }).then(cargar).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); } }
                ], r[1].avisos, { vacio: 'Sin avisos publicados' }).el);
            }).catch(function (e) { falla(zona, e); });
        }

        MB.get('admin/universidades').then(function (r) {
            selUni.innerHTML = r.universidades.map(function (u) { return '<option value="' + u.id + '">' + MB.esc(u.siglas + ' · ' + u.nombre) + '</option>'; }).join('');
            cargar();
        }).catch(function (e) { falla(zona, e); });
        selUni.addEventListener('change', cargar);
        return null;
    });
})();
