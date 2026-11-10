(function () {
    'use strict';
    var MB = window.MB, P = window.PNL, K = window.PNLK;
    if (!P || P.rol !== 'admin') { return; }

    var cache = {};

    function ciudades(forzar) {
        if (!forzar && cache.ciudades) { return Promise.resolve(cache.ciudades); }
        return MB.get('admin/ciudades').then(function (r) { cache.ciudades = r.ciudades; return r.ciudades; });
    }

    function opciones(lista, v, t) { return lista.map(function (x) { return { valor: x[v], texto: typeof t === 'function' ? t(x) : x[t] }; }); }
    function espera(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

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

    var SERVIDORES_OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

    function consultaOverpass(c) {
        var lat = Number(c.lat), lng = Number(c.lng), radio = Number(c.radio_km || 8);
        var dLat = radio / 111.32;
        var dLng = radio / (111.32 * Math.cos(lat * Math.PI / 180));
        var caja = '(' + (lat - dLat).toFixed(5) + ',' + (lng - dLng).toFixed(5) + ',' + (lat + dLat).toFixed(5) + ',' + (lng + dLng).toFixed(5) + ')';
        return '[out:json][timeout:60];(node["highway"="bus_stop"]' + caja + ';node["public_transport"="platform"]["bus"="yes"]' + caja + ';node["public_transport"="stop_position"]["bus"="yes"]' + caja + ';);out body;';
    }

    function overpass(consulta) {
        var intento = 0;
        function probar() {
            var servidor = SERVIDORES_OVERPASS[intento % SERVIDORES_OVERPASS.length];
            return fetch(servidor, { method: 'POST', body: 'data=' + encodeURIComponent(consulta), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(function (r) {
                if (!r.ok) { throw new Error('OpenStreetMap respondió ' + r.status); }
                return r.json();
            }).catch(function (e) {
                intento++;
                if (intento >= 4) { throw new Error(e.message || 'Sin conexión con OpenStreetMap'); }
                return espera(4000 * intento).then(probar);
            });
        }
        return probar();
    }

    function prioridad(t) { return t.highway === 'bus_stop' ? 0 : t.public_transport === 'platform' ? 1 : 2; }

    function depurar(elementos, centro) {
        var nodos = elementos.filter(function (e) { return e.type === 'node' && typeof e.lat === 'number' && typeof e.lon === 'number'; });
        nodos.sort(function (a, b) { return prioridad(a.tags || {}) - prioridad(b.tags || {}); });
        var celdas = {};
        var salida = [];
        nodos.forEach(function (e) {
            var kx = Math.floor(e.lon / 0.0003), ky = Math.floor(e.lat / 0.0003);
            var cerca = false;
            for (var dx = -1; dx <= 1 && !cerca; dx++) {
                for (var dy = -1; dy <= 1 && !cerca; dy++) {
                    var lista = celdas[(kx + dx) + ':' + (ky + dy)];
                    if (!lista) { continue; }
                    for (var i = 0; i < lista.length; i++) {
                        if (MB.distanciaM([e.lat, e.lon], [lista[i].lat, lista[i].lon]) < 12) { cerca = true; break; }
                    }
                }
            }
            if (cerca) { return; }
            var k = kx + ':' + ky;
            (celdas[k] = celdas[k] || []).push(e);
            salida.push(e);
        });
        salida.sort(function (a, b) { return MB.distanciaM([a.lat, a.lon], centro) - MB.distanciaM([b.lat, b.lon], centro); });
        return salida.map(function (e) {
            var t = e.tags || {};
            return { osm_id: e.id, lat: e.lat, lng: e.lon, nombre: t.name || t.ref || '' };
        });
    }

    function ejecutarImportacion(lista, reemplazar, alTerminar) {
        var estado = MB.h('p', { clase: 'suave', texto: 'Preparando…' });
        var registro = MB.h('div', { clase: 'feed', style: 'max-height:280px' });
        var cuerpo = MB.h('div', null, estado, registro);
        var detener = false;
        var totales = { nuevas: 0, omitidas: 0, ciudades: 0 };

        function linea(texto, clase) {
            registro.appendChild(MB.h('div', { clase: 'feed-item ' + (clase || ''), html: '<i class="punto"></i><div class="crece">' + MB.esc(texto) + '</div>' }));
            registro.scrollTop = registro.scrollHeight;
        }

        MB.modal({ titulo: 'Importando paradas de OpenStreetMap', sub: 'No cierres esta ventana hasta que termine. Cerrarla detiene la importación.', cuerpo: cuerpo, obligatorio: true, botones: [{ texto: 'Cerrar', valor: true }] }).then(function () {
            detener = true;
            if (alTerminar) { alTerminar(); }
        });

        function enviar(c, items) {
            var trozos = [];
            for (var i = 0; i < items.length; i += 400) { trozos.push(items.slice(i, i + 400)); }
            var nuevas = 0;
            var omitidas = 0;
            return trozos.reduce(function (cadena, trozo) {
                return cadena.then(function () {
                    if (detener) { return null; }
                    return MB.post('admin/paradas/importar', { ciudad_id: c.id, items: JSON.stringify(trozo) }, { timeout: 60000 }).then(function (r) { nuevas += r.nuevas; omitidas += r.omitidas; });
                });
            }, Promise.resolve()).then(function () {
                totales.nuevas += nuevas;
                totales.omitidas += omitidas;
                totales.ciudades++;
                linea(c.nombre + ': ' + nuevas + ' paradas nuevas' + (omitidas ? ' (' + omitidas + ' ya existían)' : ''), 'ok');
            });
        }

        var indice = 0;
        function siguiente() {
            if (detener || indice >= lista.length) { return Promise.resolve(); }
            var c = lista[indice++];
            estado.textContent = 'Ciudad ' + indice + ' de ' + lista.length + ': ' + c.nombre;
            if (c.lat === null || c.lat === undefined || c.lng === null || c.lng === undefined) {
                linea(c.nombre + ': sin coordenadas, se omitió', 'advertencia');
                return siguiente();
            }
            return overpass(consultaOverpass(c)).then(function (d) {
                var items = depurar(d.elements || [], [Number(c.lat), Number(c.lng)]);
                if (!items.length) { linea(c.nombre + ': OpenStreetMap no tiene paradas mapeadas aquí todavía', 'advertencia'); return null; }
                return enviar(c, items);
            }).catch(function (e) {
                linea(c.nombre + ': ' + e.message, 'urgente');
            }).then(function () { return detener ? null : espera(2500); }).then(siguiente);
        }

        var previo = Promise.resolve();
        if (reemplazar) {
            previo = MB.post('admin/paradas/limpiar', { ciudad_id: lista.length === 1 ? lista[0].id : 0 }).then(function (r) { linea('Paradas registradas a mano eliminadas: ' + r.eliminadas, 'advertencia'); });
        }

        previo.then(siguiente).then(function () {
            estado.textContent = detener ? 'Importación detenida.' : 'Listo: ' + totales.nuevas + ' paradas nuevas en ' + totales.ciudades + ' ciudades.';
            cache.ciudades = null;
        }).catch(function (e) { linea(e.message, 'urgente'); estado.textContent = 'La importación falló.'; });
    }

    function dialogoImportar(preseleccion, alTerminar) {
        ciudades(true).then(function (lista) {
            var conCoord = lista.filter(function (c) { return c.lat !== null && c.habilitada; });
            MB.formulario({
                titulo: 'Importar paradas de OpenStreetMap',
                sub: 'Se buscan paradas de bus alrededor del centro de cada ciudad y se numeran automáticamente. Las repetidas se omiten.',
                campos: [
                    { nombre: 'ciudad_id', etiqueta: 'Ciudad', tipo: 'select', vacio: 'Todas las ciudades con coordenadas (' + conCoord.length + ')', opciones: opciones(conCoord, 'id', 'nombre') },
                    { nombre: 'reemplazar', etiqueta: 'Eliminar antes las paradas registradas a mano', tipo: 'check', defecto: 1, ayuda: 'Borra las paradas manuales de la ciudad elegida (o de todas) y deja solo las de OpenStreetMap.' }
                ],
                datos: { ciudad_id: preseleccion || '' },
                boton: 'Empezar',
                alGuardar: function (d) {
                    var elegidas = d.ciudad_id ? conCoord.filter(function (c) { return String(c.id) === String(d.ciudad_id); }) : conCoord;
                    if (!elegidas.length) { throw new Error('No hay ciudades con coordenadas para importar'); }
                    setTimeout(function () { ejecutarImportacion(elegidas, Number(d.reemplazar) === 1, alTerminar); }, 250);
                }
            });
        }).catch(function (e) { MB.toast(e.message, 'mal'); });
    }

    P.registrar('ciudades', function (cont) {
        var cuerpo = MB.h('div');

        function editar(c) {
            MB.formulario({
                titulo: c ? 'Editar ciudad' : 'Nueva ciudad',
                datos: c || {},
                campos: [
                    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 100 },
                    { nombre: 'region', etiqueta: 'Departamento o región', requerido: true, max: 50, mitad: true, placeholder: 'RACCS' },
                    { nombre: 'codigo', etiqueta: 'Código de paradas', max: 6, mitad: true, placeholder: 'BLU', ayuda: 'Prefijo de la numeración, por ejemplo BLU-0001.' },
                    { nombre: 'lat', etiqueta: 'Latitud del centro', mitad: true, placeholder: '11.9986' },
                    { nombre: 'lng', etiqueta: 'Longitud del centro', mitad: true, placeholder: '-83.7574' },
                    { nombre: 'radio_km', etiqueta: 'Radio de búsqueda (km)', defecto: 8, ayuda: 'Distancia desde el centro donde se buscan paradas en OpenStreetMap.' }
                ],
                alGuardar: function (d) { d.id = c ? c.id : 0; cache.ciudades = null; return MB.post('admin/ciudad/guardar', d).then(function () { P.recargar(); }); }
            });
        }

        cont.appendChild(P.encabezado('Ciudades', 'Todas las ciudades de Nicaragua disponibles al registrarse. Cada una tiene sus propias paradas.', [
            P.boton('Importar paradas', 'descargar', 'fantasma', function () { dialogoImportar('', function () { P.recargar(); }); return Promise.resolve(); }),
            P.boton('Nueva ciudad', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })
        ]));
        var tbl = null;
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, P.buscador(function (q) { if (tbl) { tbl.filtrar(q); } }, 'Buscar ciudad o departamento…')));
        cont.appendChild(cuerpo);

        MB.get('admin/ciudades').then(function (r) {
            cache.ciudades = r.ciudades;
            tbl = P.tabla([
                { etq: 'Ciudad', campo: 'nombre', orden: true, render: function (c) { return '<b>' + MB.esc(c.nombre) + '</b><div class="suave pequeno">' + MB.esc(c.region) + (c.lat === null ? ' · sin coordenadas' : '') + '</div>'; } },
                { etq: 'Código', campo: 'codigo', orden: true, render: function (c) { return c.codigo ? '<span class="codigo-parada">' + MB.esc(c.codigo) + '</span>' : '—'; } },
                { etq: 'Paradas', campo: 'paradas', valor: function (c) { return Number(c.paradas); }, orden: true },
                { etq: 'Buses', campo: 'buses', valor: function (c) { return Number(c.buses); }, orden: true },
                { etq: 'Pasajeros', campo: 'usuarios', valor: function (c) { return Number(c.usuarios); }, orden: true },
                { etq: 'Habilitada', render: function (c) { return interruptor(c.habilitada, function (v) { cache.ciudades = null; return MB.post('admin/ciudad/estado', { id: c.id, habilitada: v ? 1 : 0 }); }); } },
                { etq: '', render: function (c) { return celdaAcciones(iconoAccion('descargar', 'Importar paradas de OpenStreetMap', function () { dialogoImportar(c.id, function () { P.recargar(); }); }), iconoAccion('editar', 'Editar', function () { editar(c); })); } }
            ], r.ciudades, { vacio: 'Sin ciudades' });
            cuerpo.appendChild(tbl.el);
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        return null;
    });

    P.registrar('paradas', function (cont) {
        var cuerpo = MB.h('div');
        var info = MB.h('span', { clase: 'suave pequeno' });
        var selCiudad = MB.h('select', { 'aria-label': 'Filtrar por ciudad' });
        var buscarIn = MB.h('input', { type: 'search', placeholder: 'Buscar por nombre o código…', 'aria-label': 'Buscar parada' });
        var limpiarBtn = null;
        var listaCiudades = [];

        function editar(p) {
            ciudades().then(function (lc) {
                MB.formulario({
                    titulo: p ? 'Editar parada ' + (p.codigo || '') : 'Nueva parada',
                    datos: p ? { nombre: p.nombre, ciudad_id: p.ciudad_id, lat: p.lat, lng: p.lng } : { ciudad_id: selCiudad.value || '' },
                    campos: [
                        { nombre: 'nombre', etiqueta: 'Nombre', max: 100, ayuda: 'Si lo dejas vacío se llamará «Parada N».' },
                        { nombre: 'ciudad_id', etiqueta: 'Ciudad', tipo: 'select', vacio: 'Selecciona la ciudad', requerido: true, opciones: opciones(lc, 'id', 'nombre') },
                        { nombre: 'lat', etiqueta: 'Latitud', requerido: true, mitad: true, placeholder: '11.9986' },
                        { nombre: 'lng', etiqueta: 'Longitud', requerido: true, mitad: true, placeholder: '-83.7574' }
                    ],
                    alGuardar: function (d) { d.id = p ? p.id : 0; return MB.post('admin/parada/guardar', d).then(function () { MB.toast('Parada guardada', 'ok'); cache.ciudades = null; cargar(); }); }
                });
            });
        }

        cont.appendChild(P.encabezado('Paradas', 'Cada parada tiene un número y un código por ciudad. Los pasajeros solo ven las de su ciudad.', [
            P.boton('Importar de OpenStreetMap', 'descargar', 'primario', function () { dialogoImportar(selCiudad.value, function () { cargar(); }); return Promise.resolve(); }),
            P.boton('Nueva parada', 'mas', 'fantasma', function () { editar(null); return Promise.resolve(); })
        ]));

        var barra = MB.h('div', { clase: 'barra-herramientas' }, selCiudad, MB.h('div', { clase: 'buscador', html: MB.ico('buscar') }, buscarIn));
        cont.appendChild(barra);
        var pie = MB.h('div', { clase: 'fila-entre', style: 'margin:10px 0;flex-wrap:wrap' }, info);
        limpiarBtn = P.boton('Eliminar paradas hechas a mano', 'basura', 'peligro pequeno oculto', function () {
            var nombre = selCiudad.value ? selCiudad.options[selCiudad.selectedIndex].textContent : 'todas las ciudades';
            return MB.confirmar('Eliminar paradas manuales', 'Se borrarán las paradas registradas a mano de ' + nombre + '. Las importadas de OpenStreetMap no se tocan.', 'Eliminar', true).then(function (ok) {
                if (!ok) { return null; }
                return MB.post('admin/paradas/limpiar', { ciudad_id: selCiudad.value || 0 }).then(function (r) { MB.toast(r.eliminadas + ' paradas eliminadas', 'ok'); cargar(); });
            });
        });
        pie.appendChild(limpiarBtn);
        cont.appendChild(pie);
        cont.appendChild(cuerpo);

        function cargar() {
            return MB.get('admin/paradas', { ciudad_id: selCiudad.value || 0, q: buscarIn.value.trim(), limite: 300 }).then(function (r) {
                info.textContent = MB.num(r.total) + ' paradas' + (r.total > r.paradas.length ? ' · mostrando las primeras ' + r.paradas.length : '') + (r.manuales ? ' · ' + MB.num(r.manuales) + ' registradas a mano' : '');
                limpiarBtn.classList.toggle('oculto', !r.manuales);
                cuerpo.innerHTML = '';
                var tbl = P.tabla([
                    { etq: 'N.º', campo: 'numero', valor: function (p) { return p.numero; }, orden: true, render: function (p) { return '<span class="num-parada" style="min-width:38px;height:34px;font-size:13px">' + (p.numero || '·') + '</span>'; } },
                    { etq: 'Código', render: function (p) { return '<span class="codigo-parada">' + MB.esc(p.codigo || '—') + '</span>'; } },
                    { etq: 'Nombre', campo: 'nombre', orden: true },
                    { etq: 'Ciudad', render: function (p) { return MB.esc(p.ciudad || 'Sin ciudad'); } },
                    { etq: 'Origen', render: function (p) { return p.origen === 'osm' ? P.pastilla('OpenStreetMap', 'info') : p.origen === 'usuario' ? P.pastilla('Pasajero', 'ok') : P.pastilla('Manual', 'aviso'); } },
                    { etq: 'Coordenadas', render: function (p) { return p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); } },
                    { etq: '', render: function (p) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editar(p); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar parada', (p.codigo || '') + ' ' + p.nombre, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/parada/eliminar', { id: p.id }).then(function () { cargar(); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); } }
                ], r.paradas, { vacio: 'No hay paradas en esta ciudad. Usa «Importar de OpenStreetMap».' });
                cuerpo.appendChild(tbl.el);
            }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        }

        ciudades().then(function (lc) {
            listaCiudades = lc;
            selCiudad.innerHTML = '<option value="">Todas las ciudades</option>' + lc.map(function (c) { return '<option value="' + c.id + '">' + MB.esc(c.nombre) + ' (' + c.paradas + ')</option>'; }).join('');
            var bf = lc.filter(function (c) { return c.nombre === 'Bluefields'; })[0];
            if (bf) { selCiudad.value = bf.id; }
            cargar();
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });

        selCiudad.addEventListener('change', cargar);
        buscarIn.addEventListener('input', MB.debounce(cargar, 300));
        return null;
    });

    P.registrar('universidades', function (cont) {
        var cuerpo = MB.h('div');

        function editar(u) {
            ciudades().then(function (lc) {
                MB.formulario({
                    titulo: u ? 'Editar ' + u.siglas : 'Nueva universidad',
                    datos: u ? { nombre: u.nombre, siglas: u.siglas, dominios: u.dominios.split(',').join('\n'), ciudad_id: u.ciudad_id, color: u.color || '#2563eb' } : { color: '#2563eb' },
                    campos: [
                        { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true, max: 150 },
                        { nombre: 'siglas', etiqueta: 'Siglas', requerido: true, max: 20, mitad: true, placeholder: 'URACCAN' },
                        { nombre: 'color', etiqueta: 'Color', tipo: 'color', mitad: true },
                        { nombre: 'dominios', etiqueta: 'Dominios de correo estudiantil', tipo: 'textarea', requerido: true, max: 255, ayuda: 'Uno por línea o separados por coma. Ejemplo: uraccan.edu.ni. También acepta subdominios como est.uraccan.edu.ni.' },
                        { nombre: 'ciudad_id', etiqueta: 'Ciudad principal', tipo: 'select', vacio: 'Sin ciudad específica', opciones: opciones(lc, 'id', 'nombre') }
                    ],
                    alGuardar: function (d) { d.id = u ? u.id : 0; return MB.post('admin/universidad/guardar', d).then(function () { MB.toast('Universidad guardada', 'ok'); P.recargar(); }); }
                });
            });
        }

        cont.appendChild(P.encabezado('Universidades', 'El dominio del correo estudiantil decide qué buses universitarios ve cada pasajero.', P.boton('Nueva universidad', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })));
        cont.appendChild(MB.h('p', { clase: 'suave pequeno', style: 'margin-bottom:12px', texto: 'El correo se valida por su dominio. No se envía código de verificación. Asigna una universidad a un bus desde Buses urbanos, en «Bus universitario de».' }));
        cont.appendChild(cuerpo);

        MB.get('admin/universidades').then(function (r) {
            cuerpo.appendChild(P.tabla([
                { etq: 'Universidad', campo: 'siglas', orden: true, render: function (u) { return '<b>' + MB.esc(u.siglas) + '</b><div class="suave pequeno">' + MB.esc(u.nombre) + '</div>'; } },
                { etq: 'Dominios', render: function (u) { return '<span class="codigo-parada">' + MB.esc(u.dominios.split(',').join(', ')) + '</span>'; } },
                { etq: 'Ciudad', render: function (u) { return MB.esc(u.ciudad || '—'); } },
                { etq: 'Buses', campo: 'buses', valor: function (u) { return u.buses; }, orden: true },
                { etq: 'Estudiantes', campo: 'estudiantes', valor: function (u) { return u.estudiantes; }, orden: true },
                { etq: 'Activa', render: function (u) { return interruptor(u.habilitada, function (v) { return MB.post('admin/universidad/estado', { id: u.id, habilitada: v ? 1 : 0 }); }); } },
                { etq: '', render: function (u) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editar(u); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar ' + u.siglas, 'Sus buses pasarán a ser buses públicos y los estudiantes perderán el acceso universitario.', 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/universidad/eliminar', { id: u.id }).then(function () { P.recargar(); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); } }
            ], r.universidades, { vacio: 'No hay universidades registradas' }).el);
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        return null;
    });

    P.registrar('cierres', function (cont) {
        cont.appendChild(P.encabezado('Calles cerradas', 'Marca los tramos cerrados. Los pasajeros los ven en rojo y los propietarios reciben un aviso si su ruta pasa por ahí.'));

        var selCiudad = MB.h('select', { 'aria-label': 'Ciudad' });
        var nombreIn = MB.h('input', { type: 'text', maxlength: '150', placeholder: 'Ej. Calle Central, frente al mercado' });
        var motivoIn = MB.h('input', { type: 'text', maxlength: '255', placeholder: 'Ej. Obra en la vía, desfile, derrumbe' });
        var hastaIn = MB.h('input', { type: 'date' });
        var panel = MB.h('div', { clase: 'tarjeta', style: 'margin-bottom:12px' },
            MB.h('div', { clase: 'cuadricula c3' },
                MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Ciudad' }), selCiudad),
                MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Calle o tramo' }), nombreIn),
                MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Hasta (opcional)' }), hastaIn)),
            MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Motivo' }), motivoIn));
        cont.appendChild(panel);

        var m = K.crearMapa('440px');
        var info = MB.h('span', { clase: 'suave' });
        var acciones = MB.h('div', { clase: 'fila', style: 'flex-wrap:wrap' });
        cont.appendChild(MB.h('div', { clase: 'tarjeta mapa-t' }, m.caja));
        cont.appendChild(MB.h('div', { clase: 'fila-entre', style: 'margin-top:12px;flex-wrap:wrap' }, info, acciones));
        var tablaCont = MB.h('div', { style: 'margin-top:18px' });
        cont.appendChild(tablaCont);

        if (!window.MBMapa.disponible()) { m.caja.innerHTML = '<div class="vacio">Mapa no disponible</div>'; return null; }

        var mapa = window.MBMapa.crear(m.id, { zoom: 15 });
        var L = window.L;
        var puntos = [];
        var editando = null;
        var lista = [];

        function dibujar() {
            mapa.limpiar('trazo');
            puntos.forEach(function (p, i) {
                var mk = L.marker(p, { draggable: true, icon: window.MBMapa.iconoDiv('<div class="marcador-cierre" style="font-size:11px;font-weight:800">' + (i + 1) + '</div>', [28, 28]) }).addTo(mapa.capa('trazo'));
                mk.on('dragend', function () { var ll = mk.getLatLng(); puntos[i] = [ll.lat, ll.lng]; dibujar(); });
                mk.on('contextmenu', function () { puntos.splice(i, 1); dibujar(); });
            });
            if (puntos.length > 1) { mapa.linea('trazo', puntos, { color: '#e11d48', weight: 6, opacity: 0.95, dashArray: '10 8' }); }
            var km = 0;
            for (var i = 1; i < puntos.length; i++) { km += MB.distanciaM(puntos[i - 1], puntos[i]); }
            info.textContent = puntos.length + ' puntos · ' + MB.dist(km) + (editando ? ' · editando «' + editando.nombre + '»' : '') + ' · clic derecho sobre un punto para quitarlo';
        }

        mapa.mapa.on('click', function (e) { puntos.push([e.latlng.lat, e.latlng.lng]); dibujar(); });

        function reiniciar() {
            puntos = [];
            editando = null;
            nombreIn.value = '';
            motivoIn.value = '';
            hastaIn.value = '';
            dibujar();
        }

        function dibujarExistentes() { mapa.cierres(lista.filter(function (c) { return c.activa && !c.vencida && (!selCiudad.value || String(c.ciudad_id) === String(selCiudad.value)); })); }

        acciones.appendChild(P.boton('Deshacer', 'izq', 'fantasma pequeno', function () { puntos.pop(); dibujar(); return Promise.resolve(); }));
        acciones.appendChild(P.boton('Limpiar', 'x', 'fantasma pequeno', function () { reiniciar(); return Promise.resolve(); }));
        acciones.appendChild(P.boton('Ajustar a la calle', 'navegar', 'pequeno', function () {
            if (puntos.length < 2) { MB.toast('Marca al menos dos puntos', 'mal'); return Promise.resolve(); }
            return window.MBMapa.osrm(puntos).then(function (r) {
                puntos = r.filter(function (p, i, l) { return i === 0 || p[0] !== l[i - 1][0] || p[1] !== l[i - 1][1]; });
                if (puntos.length > 2000) { var salto = Math.ceil(puntos.length / 2000); puntos = puntos.filter(function (p, i) { return i % salto === 0; }); }
                dibujar();
                MB.toast('Trazo ajustado a las calles', 'ok');
            }).catch(function (e) { MB.toast(e.message || 'No se pudo ajustar', 'mal'); });
        }));
        acciones.appendChild(P.boton('Guardar cierre', 'ok', 'primario pequeno', function () {
            if (puntos.length < 2) { MB.toast('Marca al menos dos puntos sobre la calle', 'mal'); return Promise.resolve(); }
            if (!selCiudad.value) { MB.toast('Selecciona la ciudad', 'mal'); return Promise.resolve(); }
            if (!nombreIn.value.trim()) { MB.toast('Escribe el nombre de la calle', 'mal'); return Promise.resolve(); }
            return MB.post('admin/cierre/guardar', { id: editando ? editando.id : 0, ciudad_id: selCiudad.value, nombre: nombreIn.value.trim(), motivo: motivoIn.value.trim(), hasta: hastaIn.value, puntos: JSON.stringify(puntos) }).then(function (r) {
                MB.toast(r.buses_afectados ? 'Cierre guardado. Se avisó a los propietarios de ' + r.buses_afectados + ' buses con ruta afectada' : 'Cierre guardado', 'ok');
                reiniciar();
                return cargarLista();
            });
        }));

        function tablaCierres() {
            tablaCont.innerHTML = '';
            var tbl = P.tabla([
                { etq: 'Calle', orden: true, valor: function (c) { return c.nombre; }, render: function (c) { return '<b>' + MB.esc(c.nombre) + '</b><div class="suave pequeno">' + MB.esc(c.motivo || 'Sin motivo indicado') + '</div>'; } },
                { etq: 'Ciudad', render: function (c) { return MB.esc(c.ciudad || '—'); } },
                { etq: 'Hasta', render: function (c) { return c.hasta ? (c.vencida ? P.pastilla('Vencido ' + c.hasta.slice(0, 10), 'aviso') : MB.esc(c.hasta.slice(0, 10))) : 'Sin fecha'; } },
                { etq: 'Cerrada', render: function (c) { return interruptor(c.activa, function (v) { return MB.post('admin/cierre/estado', { id: c.id, activa: v ? 1 : 0 }).then(function (r) { c.activa = v; dibujarExistentes(); if (r.buses_afectados) { MB.toast('Se avisó a los propietarios de ' + r.buses_afectados + ' buses', 'info'); } }); }); } },
                { etq: '', render: function (c) {
                    return celdaAcciones(
                        iconoAccion('ojo', 'Ver en el mapa', function () { mapa.ajustar(c.puntos, [60, 60]); }),
                        iconoAccion('editar', 'Editar trazo y datos', function () {
                            editando = c;
                            puntos = c.puntos.map(function (p) { return [p[0], p[1]]; });
                            nombreIn.value = c.nombre;
                            motivoIn.value = c.motivo || '';
                            hastaIn.value = c.hasta ? c.hasta.slice(0, 10) : '';
                            selCiudad.value = c.ciudad_id;
                            dibujar();
                            mapa.ajustar(puntos, [60, 60]);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }),
                        iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar cierre', c.nombre, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/cierre/eliminar', { id: c.id }).then(function () { cargarLista(); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')
                    );
                } }
            ], lista, { vacio: 'No hay calles cerradas registradas' });
            tablaCont.appendChild(tbl.el);
        }

        function cargarLista() {
            return MB.get('admin/cierres').then(function (r) { lista = r.cierres; tablaCierres(); dibujarExistentes(); });
        }

        ciudades().then(function (lc) {
            selCiudad.innerHTML = '<option value="">Selecciona la ciudad</option>' + lc.map(function (c) { return '<option value="' + c.id + '">' + MB.esc(c.nombre) + '</option>'; }).join('');
            var bf = lc.filter(function (c) { return c.nombre === 'Bluefields'; })[0] || lc[0];
            if (bf) { selCiudad.value = bf.id; }
            selCiudad.addEventListener('change', function () {
                var c = lc.filter(function (x) { return String(x.id) === String(selCiudad.value); })[0];
                if (c && c.lat !== null) { mapa.mapa.flyTo([c.lat, c.lng], 15, { duration: 0.8 }); }
                dibujarExistentes();
            });
            var inicial = lc.filter(function (x) { return String(x.id) === String(selCiudad.value); })[0];
            if (inicial && inicial.lat !== null) { mapa.mapa.setView([inicial.lat, inicial.lng], 15); }
            var pre = window.PNL_CIERRE_PRE;
            if (pre) {
                window.PNL_CIERRE_PRE = null;
                if (pre.ciudad_id) { selCiudad.value = pre.ciudad_id; }
                puntos = [[pre.lat, pre.lng]];
                dibujar();
                mapa.mapa.setView([pre.lat, pre.lng], 18);
                MB.toast('Marca el resto del tramo cerrado sobre la calle', 'info', 6000);
            }
        });

        dibujar();
        cargarLista().catch(function (e) { tablaCont.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        setTimeout(function () { mapa.invalidar(); }, 150);
        return null;
    });
})();
