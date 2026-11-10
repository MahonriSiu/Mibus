(function () {
    'use strict';
    var MB = window.MB, P = window.PNL, K = window.PNLK, G = window.MBG;
    if (P.rol !== 'admin') { return; }

    var cache = {};
    function ciudades() { return cache.ciudades ? Promise.resolve(cache.ciudades) : MB.get('admin/ciudades').then(function (r) { cache.ciudades = r.ciudades; return r.ciudades; }); }
    function propietarios() { return MB.get('admin/cuentas').then(function (r) { return r.cuentas.filter(function (c) { return c.rol === 'propietario'; }); }); }
    function universidades() { return MB.get('admin/universidades').then(function (r) { return r.universidades; }).catch(function () { return []; }); }
    function cooperativas() { return MB.get('admin/cooperativas').then(function (r) { return r.cooperativas; }); }
    function opciones(lista, v, t) { return lista.map(function (x) { return { valor: x[v], texto: typeof t === 'function' ? t(x) : x[t] }; }); }

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

    function mostrarClave(titulo, clave, sub) {
        var cuerpo = MB.h('div', { html: '<div class="codigo-grande">' + MB.esc(clave) + '</div>' });
        MB.modal({ titulo: titulo, sub: sub, cuerpo: cuerpo, botones: [{ texto: 'Copiar', alPulsar: function () { MB.copiar(clave); return false; } }, { texto: 'Listo', clase: 'primario', valor: true }] });
    }

    function codigoVehiculo(tipo, id, nombre) {
        var base = tipo === 'bus' ? 'admin/bus/codigo' : 'admin/camion/codigo';
        MB.get(base, { id: id }).then(function (r) {
            var cuerpo = MB.h('div', { html: '<div class="codigo-grande">' + MB.esc(r.codigo) + '</div><p class="suave pequeno centro">' + (r.ultimo_uso ? 'Último uso: ' + MB.fecha(r.ultimo_uso) : 'Aún no se ha usado') + '</p>' });
            MB.modal({
                titulo: 'Código de ' + nombre, sub: 'El chofer lo escribe en ' + (tipo === 'bus' ? '/emisor' : '/emisor-camion') + '. Si lo regeneras, el anterior deja de funcionar.', cuerpo: cuerpo,
                botones: [
                    { texto: 'Regenerar', clase: 'peligro', alPulsar: function () { return MB.confirmar('Regenerar código', 'El chofer tendrá que ingresar el nuevo código.', 'Regenerar', true).then(function (ok) { if (!ok) { return false; } return MB.post(base + '/regenerar', { id: id }).then(function (n) { mostrarClave('Nuevo código', n.codigo); }); }); } },
                    { texto: 'Copiar', alPulsar: function () { MB.copiar(r.codigo); return false; } },
                    { texto: 'Cerrar', clase: 'primario', valor: true }
                ]
            });
        }).catch(function (e) { MB.toast(e.message, 'mal'); });
    }

    function seccionBuses(interurbano) {
        return function (cont) {
            var etq = interurbano ? 'Buses interurbanos' : 'Buses urbanos';
            var nuevo = P.boton('Nuevo bus', 'mas', 'primario', function () { return editar(null); });
            cont.appendChild(P.encabezado(etq, interurbano ? 'Rutas entre ciudades con tolerancia de señal ampliada.' : 'Buses de las rutas urbanas.', [P.boton('Exportar PDF', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/exportar?tipo=flota'), '_blank'); return Promise.resolve(); }), nuevo]));
            var cuerpo = MB.h('div');
            var busq = P.buscador(function (q) { if (tbl) { tbl.filtrar(q); } }, 'Buscar bus…');
            cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, busq));
            cont.appendChild(cuerpo);
            var tbl = null;

            function editar(b) {
                return Promise.all([ciudades(), propietarios(), universidades()]).then(function (r) {
                    var campos = [
                        { nombre: 'nombre', etiqueta: 'Nombre del bus', requerido: true, max: 100 },
                        { nombre: 'origen', etiqueta: 'Origen', requerido: true, max: 100, mitad: true },
                        { nombre: 'destino', etiqueta: 'Destino', requerido: true, max: 100, mitad: true },
                        { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', max: 500 },
                        { nombre: 'color', etiqueta: 'Color en el mapa', tipo: 'color', defecto: '#22c3d8', mitad: true },
                        { nombre: 'minutos_umbral_desconexion', etiqueta: 'Minutos sin señal', tipo: 'number', defecto: interurbano ? 12 : 5, mitad: true },
                        { nombre: 'ciudad_id', etiqueta: 'Ciudad', tipo: 'select', vacio: 'Sin ciudad', opciones: opciones(r[0], 'id', 'nombre') },
                        { nombre: 'universidad_id', etiqueta: 'Bus universitario de', tipo: 'select', vacio: 'Ninguna (bus público)', opciones: opciones(r[2], 'id', function (x) { return x.siglas + ' · ' + x.nombre; }) },
                        { nombre: 'propietario_id', etiqueta: 'Propietario', tipo: 'select', vacio: 'Sin propietario', opciones: opciones(r[1], 'id', function (x) { return x.nombre + ' (' + x.correo + ')'; }) }
                    ];
                    if (!b) { campos.push({ nombre: 'tipo_emisor', etiqueta: 'Dispositivo de rastreo', tipo: 'select', opciones: [{ valor: 'celular', texto: 'Celular del chofer' }, { valor: 'gps', texto: 'Rastreador GPS de hardware' }] }); }
                    return MB.formulario({
                        titulo: b ? 'Editar ' + b.nombre : 'Nuevo bus', campos: campos, datos: b ? { nombre: b.nombre, origen: b.origen, destino: b.destino, descripcion: b.descripcion, color: b.color || '#22c3d8', ciudad_id: b.ciudad_id, universidad_id: b.universidad_id, propietario_id: b.propietario_id, minutos_umbral_desconexion: b.minutos_umbral } : {}, ancho: true,
                        alGuardar: function (d) {
                            d.id = b ? b.id : 0;
                            if (!b && interurbano) { d.interurbano = 1; }
                            return MB.post('admin/bus/guardar', d).then(function (res) { if (res.codigo) { mostrarClave('Código del chofer', res.codigo, 'Entrégalo al chofer. Solo se muestra ahora, pero puedes verlo después desde la tabla.'); } P.recargar(); });
                        }
                    });
                });
            }

            MB.get('admin/buses', { interurbano: interurbano ? 1 : 0 }).then(function (r) {
                tbl = P.tabla([
                    { etq: 'Bus', campo: 'nombre', orden: true, render: function (b) { return '<b>' + MB.esc(b.nombre) + '</b><div class="suave pequeno">' + MB.esc(b.origen) + ' → ' + MB.esc(b.destino) + '</div>' + (b.universidad ? '<div>' + P.pastilla('Universitario · ' + b.universidad, 'info') + '</div>' : ''); } },
                    { etq: 'Propietario', render: function (b) { return MB.esc(b.propietario || '—'); } },
                    { etq: 'Ciudad', render: function (b) { return MB.esc(b.ciudad || '—'); } },
                    { etq: 'Estado', valor: function (b) { return b.conectado ? 1 : 0; }, orden: true, render: function (b) { return b.conectado ? P.pastilla('En línea', 'ok') : P.pastilla('Sin señal', 'aviso'); } },
                    { etq: 'Habilitado', render: function (b) { return interruptor(b.habilitado, function (v) { return MB.post('admin/bus/estado', { id: b.id, habilitado: v ? 1 : 0 }); }); } },
                    { etq: '', render: function (b) { return celdaAcciones(iconoAccion('llave', 'Código del chofer', function () { codigoVehiculo('bus', b.id, b.nombre); }), iconoAccion('ruta', 'Trazar ruta', function () { window.__trazadorPre = { tipo: 'bus', id: b.id }; P.irA('trazador'); }), iconoAccion('editar', 'Editar', function () { editar(b); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar ' + b.nombre, 'Se borrarán también su historial y su código.', 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/bus/eliminar', { id: b.id }).then(function () { MB.toast('Bus eliminado', 'ok'); P.recargar(); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); } }
                ], r.buses, { vacio: 'No hay buses registrados' });
                cuerpo.appendChild(tbl.el);
            }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
            return null;
        };
    }
    P.registrar('buses', seccionBuses(false));
    P.registrar('interurbano', seccionBuses(true));

    P.registrar('paradas', function (cont) {
        var cuerpo = MB.h('div');
        function editar(p) {
            ciudades().then(function (c) {
                MB.formulario({
                    titulo: p ? 'Editar parada' : 'Nueva parada', datos: p || {},
                    campos: [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 100 }, { nombre: 'lat', etiqueta: 'Latitud', requerido: true, mitad: true, placeholder: '11.9986' }, { nombre: 'lng', etiqueta: 'Longitud', requerido: true, mitad: true, placeholder: '-83.7574' }, { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', mitad: true, defecto: 0 }, { nombre: 'ciudad_id', etiqueta: 'Ciudad', tipo: 'select', vacio: 'Todas', opciones: opciones(c, 'id', 'nombre'), mitad: true }],
                    alGuardar: function (d) { d.id = p ? p.id : 0; return MB.post('admin/parada/guardar', d).then(function () { MB.toast('Parada guardada', 'ok'); P.recargar(); }); }
                });
            });
        }
        cont.appendChild(P.encabezado('Paradas', 'Puntos oficiales de abordaje.', P.boton('Nueva parada', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })));
        var tbl = null;
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, P.buscador(function (q) { if (tbl) { tbl.filtrar(q); } })));
        cont.appendChild(cuerpo);
        MB.get('admin/paradas').then(function (r) {
            tbl = P.tabla([
                { etq: 'Nombre', campo: 'nombre', orden: true }, { etq: 'Ciudad', render: function (p) { return MB.esc(p.ciudad || 'Todas'); } },
                { etq: 'Coordenadas', render: function (p) { return p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); } }, { etq: 'Orden', campo: 'orden', orden: true },
                { etq: '', render: function (p) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editar(p); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar parada', p.nombre, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/parada/eliminar', { id: p.id }).then(function () { P.recargar(); }); } }); }, 'peligro')); } }
            ], r.paradas, { vacio: 'No hay paradas' });
            cuerpo.appendChild(tbl.el);
        });
        return null;
    });

    P.registrar('camiones', function (cont) {
        var cuerpo = MB.h('div');
        function editar(c) {
            ciudades().then(function (ci) {
                MB.formulario({
                    titulo: c ? 'Editar camión' : 'Nuevo camión', datos: c || { color: '#34d399' },
                    campos: [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 100 }, { nombre: 'zona', etiqueta: 'Zona de recolección', requerido: true, max: 150 }, { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', max: 500 }, { nombre: 'color', etiqueta: 'Color', tipo: 'color', mitad: true, defecto: '#34d399' }, { nombre: 'ciudad_id', etiqueta: 'Ciudad', tipo: 'select', vacio: 'Todas', mitad: true, opciones: opciones(ci, 'id', 'nombre') }],
                    alGuardar: function (d) { d.id = c ? c.id : 0; return MB.post('admin/camion/guardar', d).then(function (r) { if (r.codigo) { mostrarClave('Código del camión', r.codigo, 'Entrégalo al conductor del camión.'); } P.recargar(); }); }
                });
            });
        }
        cont.appendChild(P.encabezado('Camiones de basura', 'Recolectores con su código de transmisión y rutas semanales.', P.boton('Nuevo camión', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })));
        cont.appendChild(cuerpo);
        MB.get('admin/camiones').then(function (r) {
            cuerpo.appendChild(P.tabla([
                { etq: 'Camión', campo: 'nombre', orden: true, render: function (c) { return '<b>' + MB.esc(c.nombre) + '</b><div class="suave pequeno">' + MB.esc(c.zona) + '</div>'; } },
                { etq: 'Estado', render: function (c) { return c.conectado ? P.pastilla('En línea', 'ok') : P.pastilla('Sin señal', 'aviso'); } },
                { etq: 'Sale hoy', render: function (c) { return interruptor(c.activo_hoy, function (v) { return MB.post('admin/camion/estado', { id: c.id, activo_hoy: v ? 1 : 0 }); }); } },
                { etq: 'Habilitado', render: function (c) { return interruptor(c.habilitado, function (v) { return MB.post('admin/camion/estado', { id: c.id, habilitado: v ? 1 : 0 }); }); } },
                { etq: '', render: function (c) { return celdaAcciones(iconoAccion('llave', 'Código', function () { codigoVehiculo('camion', c.id, c.nombre); }), iconoAccion('ruta', 'Rutas', function () { window.__trazadorPre = { tipo: 'camion', id: c.id }; P.irA('trazador'); }), iconoAccion('editar', 'Editar', function () { editar(c); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar camión', c.nombre, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/camion/eliminar', { id: c.id }).then(function () { P.recargar(); }); } }); }, 'peligro')); } }
            ], r.camiones, { vacio: 'Sin camiones' }).el);
        });
        return null;
    });

    P.registrar('ciudades', function (cont) {
        var cuerpo = MB.h('div');
        function editar(c) {
            MB.formulario({ titulo: c ? 'Editar ciudad' : 'Nueva ciudad', datos: c || {}, campos: [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 100 }, { nombre: 'region', etiqueta: 'Región', requerido: true, max: 50, placeholder: 'RACCS' }], alGuardar: function (d) { d.id = c ? c.id : 0; delete cache.ciudades; return MB.post('admin/ciudad/guardar', d).then(function () { P.recargar(); }); } });
        }
        cont.appendChild(P.encabezado('Ciudades', 'Ciudades habilitadas para pasajeros y flota.', P.boton('Nueva ciudad', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })));
        cont.appendChild(cuerpo);
        MB.get('admin/ciudades').then(function (r) {
            cuerpo.appendChild(P.tabla([
                { etq: 'Ciudad', campo: 'nombre', orden: true }, { etq: 'Región', campo: 'region', orden: true }, { etq: 'Pasajeros', campo: 'usuarios', valor: function (c) { return Number(c.usuarios); }, orden: true }, { etq: 'Buses', campo: 'buses', valor: function (c) { return Number(c.buses); }, orden: true },
                { etq: 'Habilitada', render: function (c) { return interruptor(c.habilitada, function (v) { delete cache.ciudades; return MB.post('admin/ciudad/estado', { id: c.id, habilitada: v ? 1 : 0 }); }); } },
                { etq: '', render: function (c) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editar(c); })); } }
            ], r.ciudades, { vacio: 'Sin ciudades' }).el);
        });
        return null;
    });

    P.registrar('cooperativas', function (cont) {
        var cuerpo = MB.h('div');
        function editar(c) {
            ciudades().then(function (ci) {
                var campos = [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 150 }, { nombre: 'ciudad_id', etiqueta: 'Ciudad', tipo: 'select', vacio: 'Sin ciudad', opciones: opciones(ci, 'id', 'nombre') }];
                if (!c) { campos.push({ nombre: 'correo', etiqueta: 'Correo de acceso', tipo: 'email', requerido: true, max: 100 }); }
                MB.formulario({ titulo: c ? 'Editar cooperativa' : 'Nueva cooperativa', datos: c || {}, campos: campos, alGuardar: function (d) { d.id = c ? c.id : 0; return MB.post('admin/cooperativa/guardar', d).then(function (r) { if (r.contrasena_temporal) { mostrarClave('Contraseña temporal', r.contrasena_temporal, 'Entrégala de forma segura. Deberá cambiarla al ingresar.'); } P.recargar(); }); } });
            });
        }
        cont.appendChild(P.encabezado('Cooperativas', 'Agrupan propietarios y supervisan sus buses.', P.boton('Nueva cooperativa', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })));
        cont.appendChild(cuerpo);
        MB.get('admin/cooperativas').then(function (r) {
            cuerpo.appendChild(P.tabla([
                { etq: 'Cooperativa', campo: 'nombre', orden: true }, { etq: 'Correo', campo: 'correo' }, { etq: 'Ciudad', render: function (c) { return MB.esc(c.ciudad || '—'); } }, { etq: 'Propietarios', campo: 'propietarios' },
                { etq: 'Activa', render: function (c) { return interruptor(c.cuenta_activa, function (v) { return MB.post('admin/cooperativa/estado', { id: c.id, activa: v ? 1 : 0 }); }); } },
                { etq: '', render: function (c) { return celdaAcciones(iconoAccion('editar', 'Editar', function () { editar(c); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar cooperativa', c.nombre, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/cooperativa/eliminar', { id: c.id }).then(function () { P.recargar(); }); } }); }, 'peligro')); } }
            ], r.cooperativas, { vacio: 'Sin cooperativas' }).el);
        });
        return null;
    });

    P.registrar('cuentas', function (cont) {
        var cuerpo = MB.h('div');
        var datosCuentas = null;
        function crear() {
            Promise.all([ciudades(), cooperativas()]).then(function (r) {
                MB.formulario({
                    titulo: 'Nueva cuenta', sub: 'Se generará una contraseña temporal que deberá cambiarse al ingresar.',
                    campos: [
                        { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true, max: 100 }, { nombre: 'correo', etiqueta: 'Correo', tipo: 'email', requerido: true, max: 100 },
                        { nombre: 'rol', etiqueta: 'Rol', tipo: 'select', opciones: [{ valor: 'propietario', texto: 'Propietario' }, { valor: 'auditor', texto: 'Auditor' }].concat(datosCuentas && datosCuentas.es_principal ? [{ valor: 'admin', texto: 'Administrador' }] : []) },
                        { nombre: 'tipo_propietario', etiqueta: 'Tipo de propietario', tipo: 'select', mitad: true, opciones: [{ valor: 'urbano', texto: 'Urbano' }, { valor: 'interurbano', texto: 'Interurbano' }] },
                        { nombre: 'ciudad_id', etiqueta: 'Ciudad (propietarios)', tipo: 'select', mitad: true, vacio: 'Selecciona', opciones: opciones(r[0], 'id', 'nombre') },
                        { nombre: 'cooperativa_id', etiqueta: 'Cooperativa', tipo: 'select', vacio: 'Ninguna', opciones: opciones(r[1], 'id', 'nombre') }
                    ],
                    alGuardar: function (d) { return MB.post('admin/cuenta/crear', d).then(function (res) { mostrarClave('Contraseña temporal', res.contrasena_temporal, 'Entrégala de forma segura.'); P.recargar(); }); }
                });
            });
        }
        cont.appendChild(P.encabezado('Cuentas', 'Administradores, auditores y propietarios.', P.boton('Nueva cuenta', 'mas', 'primario', function () { crear(); return Promise.resolve(); })));
        var tbl = null;
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, P.buscador(function (q) { if (tbl) { tbl.filtrar(q); } })));
        cont.appendChild(cuerpo);
        var solic = MB.h('div', { style: 'margin-top:16px' });
        MB.get('admin/cuentas').then(function (r) {
            datosCuentas = r;
            tbl = P.tabla([
                { etq: 'Nombre', orden: true, valor: function (c) { return c.nombre; }, render: function (c) { return '<b>' + MB.esc(c.nombre) + '</b><div class="suave pequeno">' + MB.esc(c.correo) + '</div>'; } },
                { etq: 'Rol', campo: 'rol', orden: true, render: function (c) { return P.pastilla(c.rol, c.rol === 'admin' ? 'info' : ''); } },
                { etq: '2FA', render: function (c) { return c.rol === 'admin' ? (c.totp_activo ? P.pastilla('Activo', 'ok') : P.pastilla('Sin 2FA', 'aviso')) : '—'; } },
                { etq: 'Último acceso', render: function (c) { return MB.fecha(c.ultimo_acceso); } },
                { etq: 'Activa', render: function (c) { if (c.protegida || c.id === r.yo) { return P.pastilla('Protegida'); } return interruptor(c.cuenta_activa, function (v) { return MB.post('admin/cuenta/estado', { id: c.id, activa: v ? 1 : 0 }); }); } },
                { etq: '', render: function (c) {
                    var acc = [];
                    if (c.id !== r.yo) {
                        acc.push(iconoAccion('llave', 'Restablecer contraseña', function () { MB.confirmar('Restablecer contraseña', 'Se generará una temporal para ' + c.nombre + ' y se cerrarán sus sesiones.', 'Restablecer').then(function (ok) { if (ok) { MB.post('admin/cuenta/reset', { id: c.id }).then(function (x) { mostrarClave('Contraseña temporal', x.contrasena_temporal); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }));
                        acc.push(iconoAccion('salir', 'Cerrar sesiones', function () { MB.post('admin/cuenta/cerrar-sesiones', { id: c.id }).then(function () { MB.toast('Sesiones cerradas', 'ok'); }).catch(function (e) { MB.toast(e.message, 'mal'); }); }));
                        if (c.totp_activo) { acc.push(iconoAccion('escudo', 'Quitar 2FA', function () { MB.confirmar('Quitar 2FA', 'La cuenta quedará sin segundo factor.', 'Quitar', true).then(function (ok) { if (ok) { MB.post('admin/cuenta/quitar-2fa', { id: c.id }).then(function () { P.recargar(); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); })); }
                        if (!c.protegida) { acc.push(iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar cuenta', c.nombre + ' perderá el acceso definitivamente.', 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/cuenta/eliminar', { id: c.id }).then(function () { P.recargar(); }).catch(function (e) { MB.toast(e.message, 'mal'); }); } }); }, 'peligro')); }
                    }
                    return celdaAcciones.apply(null, acc);
                } }
            ], r.cuentas, { vacio: 'Sin cuentas' });
            cuerpo.appendChild(tbl.el);
        });
        cont.appendChild(solic);
        MB.get('admin/solicitudes').then(function (r) {
            var pend = r.solicitudes.filter(function (s) { return !Number(s.atendida); });
            if (!r.solicitudes.length) { return; }
            solic.appendChild(K.tarjeta('Solicitudes de contraseña (' + pend.length + ' pendientes)', 'candado', P.tabla([
                { etq: 'Correo', campo: 'correo' }, { etq: 'Fecha', render: function (s) { return MB.fecha(s.fecha_solicitud); } },
                { etq: 'Estado', render: function (s) { return Number(s.atendida) ? P.pastilla('Atendida', 'ok') : P.pastilla('Pendiente', 'aviso'); } },
                { etq: '', render: function (s) { return Number(s.atendida) ? '' : P.boton('Marcar atendida', 'ok', 'pequeno', function () { return MB.post('admin/solicitud/atender', { id: s.id }).then(function () { P.recargar(); }); }); } }
            ], r.solicitudes).el));
        });
        return null;
    });

    P.registrar('horario', function (cont) {
        cont.appendChild(P.encabezado('Horario de servicio', 'Fuera de este horario el mapa de buses se muestra en reposo.'));
        var cuerpo = MB.h('div', { style: 'max-width:460px' });
        cont.appendChild(cuerpo);
        MB.get('admin/horario').then(function (r) {
            var a = MB.h('input', { type: 'time', value: r.apertura });
            var c = MB.h('input', { type: 'time', value: r.cierre });
            var guardar = P.boton('Guardar horario', 'ok', 'primario bloque', function () { return MB.post('admin/horario', { apertura: a.value, cierre: c.value }).then(function () { MB.toast('Horario actualizado', 'ok'); }); });
            var f = MB.h('div', { clase: 'dos-col' }, MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Apertura' }), a), MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Cierre' }), c));
            cuerpo.appendChild(K.tarjeta(null, null, MB.h('div', null, MB.h('p', { clase: 'suave', texto: r.en_servicio ? 'Ahora mismo el servicio está activo.' : 'Ahora mismo el servicio está en reposo.' }), f, guardar)));
        });
        return null;
    });

    P.registrar('anuncios', function (cont) {
        var cuerpo = MB.h('div', { clase: 'cuadricula auto' });
        function editar(a) {
            ciudades().then(function (ci) {
                var regiones = ci.map(function (c) { return c.region; }).filter(function (v, i, l) { return v && l.indexOf(v) === i; });
                var cuerpoF = MB.h('form', { novalidate: true });
                var def = a || { tipo_alcance: 'nacional', modulo: 'bus', alcance: [] };
                cuerpoF.innerHTML =
                    '<div class="campo"><label>Negocio</label><input name="negocio" maxlength="150" value="' + MB.esc(a ? a.nombre_negocio : '') + '"></div>' +
                    '<div class="campo"><label>Texto</label><textarea name="texto" maxlength="600">' + MB.esc(a ? a.texto : '') + '</textarea></div>' +
                    '<div class="dos-col"><div class="campo"><label>Teléfono</label><input name="telefono" maxlength="30" value="' + MB.esc(a ? a.telefono : '') + '"></div><div class="campo"><label>Vence</label><input name="expira" type="date" value="' + MB.esc(a && a.fecha_expiracion ? a.fecha_expiracion : '') + '"></div></div>' +
                    '<div class="dos-col"><div class="campo"><label>Se muestra en</label><select name="modulo"><option value="bus"' + (def.modulo === 'bus' ? ' selected' : '') + '>Mapa de buses</option><option value="camion"' + (def.modulo === 'camion' ? ' selected' : '') + '>Camión de basura</option></select></div><div class="campo"><label>Alcance</label><select name="tipo_alcance"><option value="nacional">Todo el país</option><option value="region">Por región</option><option value="ciudad">Por ciudad</option></select></div></div>' +
                    '<div class="campo" id="zona-alcance"></div>' +
                    '<div class="dos-col"><div class="campo"><label>Máximo de vistas</label><input name="max_vistas" type="number" min="0" placeholder="Sin límite" value="' + MB.esc(a && a.max_vistas ? a.max_vistas : '') + '"></div><div class="campo"><label>Máximo de clics</label><input name="max_clics" type="number" min="0" placeholder="Sin límite" value="' + MB.esc(a && a.max_clics ? a.max_clics : '') + '"></div></div>' +
                    '<div class="campo"><label>Imagen o video (opcional)</label><input type="file" name="media" accept="image/*,video/mp4"></div>';
                var tipoSel = cuerpoF.querySelector('[name=tipo_alcance]');
                tipoSel.value = def.tipo_alcance;
                var zona = cuerpoF.querySelector('#zona-alcance');
                function pintarZona() {
                    var t = tipoSel.value;
                    if (t === 'nacional') { zona.innerHTML = ''; return; }
                    var lista = t === 'ciudad' ? ci.map(function (c) { return { v: String(c.id), t: c.nombre }; }) : regiones.map(function (r) { return { v: r, t: r }; });
                    var marcados = (def.alcance || []).map(String);
                    zona.innerHTML = '<label>' + (t === 'ciudad' ? 'Ciudades' : 'Regiones') + '</label>' + lista.map(function (x) { return '<label style="display:flex;gap:8px;align-items:center;font-weight:500;color:var(--texto)"><input type="checkbox" name="alc" value="' + MB.esc(x.v) + '"' + (marcados.indexOf(x.v) >= 0 ? ' checked' : '') + '> ' + MB.esc(x.t) + '</label>'; }).join('');
                }
                tipoSel.addEventListener('change', pintarZona);
                pintarZona();
                MB.modal({
                    titulo: a ? 'Editar anuncio' : 'Nuevo anuncio', cuerpo: cuerpoF, ancho: true,
                    botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', clase: 'primario', alPulsar: function () {
                        var fd = new FormData();
                        if (a) { fd.append('id', a.id); }
                        ['negocio', 'texto', 'telefono', 'expira', 'modulo', 'tipo_alcance', 'max_vistas', 'max_clics'].forEach(function (n) { fd.append(n, cuerpoF.querySelector('[name=' + n + ']').value); });
                        var marcados = Array.prototype.slice.call(cuerpoF.querySelectorAll('[name=alc]:checked')).map(function (x) { return x.value; });
                        fd.append('alcance', JSON.stringify(marcados));
                        var arch = cuerpoF.querySelector('[name=media]').files[0];
                        if (arch) { fd.append('media', arch); }
                        return MB.post('admin/anuncio/guardar', fd).then(function () { MB.toast('Anuncio guardado', 'ok'); P.recargar(); });
                    } }]
                });
            });
        }
        function estadisticas(a) {
            MB.get('admin/anuncio/estadisticas', { id: a.id }).then(function (r) {
                var c1 = MB.h('div');
                var cuerpoE = MB.h('div', null, MB.h('p', { clase: 'suave', texto: MB.num(r.total) + ' vistas · ' + MB.num(r.clics || 0) + ' clics (' + (r.ctr || 0) + '%)' }), c1, MB.h('div', { style: 'margin-top:10px', html: r.por_ciudad.map(function (x) { return '<div class="fila-entre" style="padding:4px 0"><span>' + MB.esc(x.ciudad) + '</span><b>' + MB.num(x.n) + '</b></div>'; }).join('') }));
                MB.modal({ titulo: r.anuncio.nombre_negocio, sub: 'Vistas de los últimos 14 días', cuerpo: cuerpoE, ancho: true, botones: [{ texto: 'Exportar PDF', alPulsar: function () { window.open(MB.url('/api/admin/exportar?tipo=anuncio&id=' + a.id), '_blank'); return false; } }, { texto: 'Cerrar', clase: 'primario', valor: true }], alAbrir: function () { setTimeout(function () { G.barras(c1, { alto: 170, etiquetas: r.por_dia.map(function (d) { return d.d.slice(8); }), titulos: r.por_dia.map(function (d) { return d.d; }), datos: r.por_dia.map(function (d) { return Number(d.n); }), unidad: 'vistas', color: 'acento' }); }, 60); } });
            });
        }
        cont.appendChild(P.encabezado('Publicidad', 'Anuncios locales que aparecen sobre el mapa.', [P.boton('Reporte PDF', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/exportar?tipo=anuncios'), '_blank'); return Promise.resolve(); }), P.boton('Nuevo anuncio', 'mas', 'primario', function () { editar(null); return Promise.resolve(); })]));
        cont.appendChild(cuerpo);
        MB.get('admin/anuncios').then(function (r) {
            if (!r.anuncios.length) { cuerpo.innerHTML = '<div class="vacio">' + MB.ico('imagen') + '<p>Aún no hay anuncios.</p></div>'; return; }
            r.anuncios.forEach(function (a) {
                var media = a.media ? (a.tipo_media === 'video' ? '<video src="' + MB.esc(a.media) + '" muted playsinline style="width:100%;height:130px;object-fit:cover;border-radius:12px"></video>' : '<img src="' + MB.esc(a.media) + '" alt="" loading="lazy" style="width:100%;height:130px;object-fit:cover;border-radius:12px">') : '<div style="height:130px;border-radius:12px;background:var(--card-2);display:flex;align-items:center;justify-content:center;color:var(--suave)">' + MB.ico('imagen', 'g') + '</div>';
                var t = MB.h('div', { clase: 'tarjeta', html: media + '<h3 style="margin-top:12px">' + MB.esc(a.nombre_negocio) + '</h3><p class="suave pequeno">' + MB.esc(a.texto || '') + '</p><div class="fila" style="flex-wrap:wrap;margin:8px 0">' + P.pastilla(a.modulo === 'camion' ? 'Camión' : 'Buses') + P.pastilla(a.tipo_alcance) + P.pastilla(MB.num(a.vistas) + ' vistas', 'info') + (a.vencido ? P.pastilla('Vencido', 'mal') : '') + '</div>' });
                var pie = MB.h('div', { clase: 'fila-entre' }, interruptor(a.activo, function (v) { return MB.post('admin/anuncio/estado', { id: a.id, activo: v ? 1 : 0 }); }), celdaAcciones(iconoAccion('copiar', 'Copiar enlace para el anunciante', function () { MB.post('admin/anuncio/enlace', { id: a.id }).then(function (r) { Promise.resolve(MB.copiar(location.origin + r.ruta)).then(function () { MB.toast('Enlace copiado. Quien lo tenga puede ver las cifras de este anuncio.', 'ok', 5000); }).catch(function () { MB.modal({ titulo: 'Enlace del anunciante', cuerpo: '<p class="suave" style="word-break:break-all">' + MB.esc(location.origin + r.ruta) + '</p>', botones: [{ texto: 'Cerrar', clase: 'primario', valor: true }] }); }); }).catch(function (e) { MB.toast(e.message, 'mal'); }); }), iconoAccion('grafica', 'Estadísticas', function () { estadisticas(a); }), iconoAccion('editar', 'Editar', function () { editar(a); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar anuncio', a.nombre_negocio, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/anuncio/eliminar', { id: a.id }).then(function () { P.recargar(); }); } }); }, 'peligro')));
                t.appendChild(pie);
                cuerpo.appendChild(t);
            });
        });
        return null;
    });

    P.registrar('creativa', function (cont) {
        var cuerpo = MB.h('div');
        function editarEvento(e) {
            MB.formulario({
                titulo: e ? 'Editar circuito' : 'Nuevo circuito', datos: e || { color: '#ff8a3d' },
                campos: [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 150 }, { nombre: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#ff8a3d' }, { nombre: 'siempre_activo', etiqueta: 'Siempre disponible', tipo: 'check', defecto: e ? e.siempre_activo : 1 }, { nombre: 'inicio', etiqueta: 'Inicio', tipo: 'date', mitad: true }, { nombre: 'fin', etiqueta: 'Fin', tipo: 'date', mitad: true }],
                alGuardar: function (d) { d.id = e ? e.id : 0; return MB.post('admin/evento/guardar', d).then(function () { P.recargar(); }); }
            });
        }
        function puntos(ev) {
            var lista = MB.h('div');
            function pintar() {
                lista.innerHTML = '';
                MB.get('admin/puntos', { evento_id: ev.id }).then(function (r) {
                    lista.appendChild(P.tabla([
                        { etq: 'Orden', campo: 'orden' }, { etq: 'Punto', campo: 'nombre', render: function (p) { return '<b>' + MB.esc(p.nombre) + '</b><div class="suave pequeno">' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) + '</div>'; } },
                        { etq: 'Visible', render: function (p) { return p.visible ? P.pastilla('Sí', 'ok') : P.pastilla('No'); } },
                        { etq: '', render: function (p) { return celdaAcciones(iconoAccion('imagen', 'Multimedia', function () { multimedia(p); }), iconoAccion('editar', 'Editar', function () { editarPunto(p); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar punto', p.nombre, 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/punto/eliminar', { id: p.id }).then(pintar); } }); }, 'peligro')); } }
                    ], r.puntos, { vacio: 'Este circuito no tiene puntos' }).el);
                });
            }
            function editarPunto(p) {
                MB.formulario({
                    titulo: p ? 'Editar punto' : 'Nuevo punto', datos: p || { visible: 1 },
                    campos: [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 150 }, { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', max: 2000 }, { nombre: 'lat', etiqueta: 'Latitud', requerido: true, mitad: true }, { nombre: 'lng', etiqueta: 'Longitud', requerido: true, mitad: true }, { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', mitad: true, defecto: 0 }, { nombre: 'visible', etiqueta: 'Visible para pasajeros', tipo: 'check', defecto: 1 }],
                    alGuardar: function (d) { d.id = p ? p.id : 0; d.evento_id = ev.id; return MB.post('admin/punto/guardar', d).then(pintar); }
                });
            }
            function multimedia(p) {
                MB.get('admin/punto', { id: p.id }).then(function (r) {
                    var pt = r.punto;
                    var gal = MB.h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-bottom:12px' });
                    function subir(ruta, nombreCampo, etiqueta, accept) {
                        var i = MB.h('input', { type: 'file', accept: accept });
                        var b = P.boton(etiqueta, 'imagen', 'pequeno', function () {
                            if (!i.files[0]) { MB.toast('Elige un archivo', 'mal'); return Promise.resolve(); }
                            var fd = new FormData(); fd.append('punto_id', p.id); fd.append('archivo', i.files[0]);
                            return MB.post(ruta, fd).then(function () { MB.toast('Archivo subido', 'ok'); multimedia(p); });
                        });
                        return MB.h('div', { clase: 'fila', style: 'margin-bottom:8px;flex-wrap:wrap' }, i, b);
                    }
                    (pt.imagenes || []).forEach(function (im) {
                        var cel = MB.h('div', { style: 'position:relative' }, MB.h('img', { src: MB.url('/assets/img/ruta-creativa/' + im.nombre_archivo), alt: '', style: 'width:100%;height:80px;object-fit:cover;border-radius:10px' }));
                        cel.appendChild(iconoAccion('x', 'Quitar', function () { MB.post('admin/punto/imagen/eliminar', { id: im.id }).then(function () { multimedia(p); }); }, 'peligro'));
                        gal.appendChild(cel);
                    });
                    var cuerpoM = MB.h('div', null, MB.h('p', { clase: 'suave pequeno', texto: pt.portada ? 'Portada actual cargada.' : 'Sin portada.' }), subir('admin/punto/portada', 'archivo', 'Subir portada', 'image/*'), MB.h('h4', { texto: 'Galería', style: 'margin:10px 0 6px' }), gal, subir('admin/punto/imagen', 'archivo', 'Añadir imagen', 'image/*'), MB.h('h4', { texto: 'Video (MP4)', style: 'margin:10px 0 6px' }), subir('admin/punto/video', 'archivo', 'Subir video', 'video/mp4'));
                    document.querySelectorAll('.fondo-modal.mm').forEach(function (x) { x.remove(); });
                    MB.modal({ clase: 'mm', titulo: 'Multimedia · ' + p.nombre, cuerpo: cuerpoM, ancho: true, botones: [{ texto: 'Cerrar', clase: 'primario', valor: true }] });
                });
            }
            MB.modal({ titulo: 'Puntos · ' + ev.nombre, cuerpo: lista, ancho: true, botones: [{ texto: 'Nuevo punto', alPulsar: function () { editarPunto(null); return false; } }, { texto: 'Cerrar', clase: 'primario', valor: true }], alAbrir: pintar });
        }
        cont.appendChild(P.encabezado('Ruta creativa', 'Circuitos turísticos y culturales con puntos, fotos y video.', P.boton('Nuevo circuito', 'mas', 'primario', function () { editarEvento(null); return Promise.resolve(); })));
        cont.appendChild(cuerpo);
        MB.get('admin/eventos').then(function (r) {
            cuerpo.appendChild(P.tabla([
                { etq: 'Circuito', campo: 'nombre', orden: true, render: function (e) { return '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + MB.esc(e.color) + ';margin-right:8px"></span><b>' + MB.esc(e.nombre) + '</b>'; } },
                { etq: 'Vigencia', render: function (e) { return e.siempre_activo ? 'Siempre' : MB.esc(e.fecha_inicio) + ' → ' + MB.esc(e.fecha_fin); } }, { etq: 'Puntos', campo: 'puntos' },
                { etq: 'Habilitado', render: function (e) { return interruptor(e.habilitado, function (v) { return MB.post('admin/evento/estado', { id: e.id, habilitado: v ? 1 : 0 }); }); } },
                { etq: '', render: function (e) { return celdaAcciones(iconoAccion('pin', 'Puntos', function () { puntos(e); }), iconoAccion('editar', 'Editar', function () { editarEvento(e); }), iconoAccion('basura', 'Eliminar', function () { MB.confirmar('Eliminar circuito', 'Se borrarán sus puntos y archivos.', 'Eliminar', true).then(function (ok) { if (ok) { MB.post('admin/evento/eliminar', { id: e.id }).then(function () { P.recargar(); }); } }); }, 'peligro')); } }
            ], r.eventos, { vacio: 'Sin circuitos' }).el);
        });
        return null;
    });

    P.registrar('trazador', function (cont) {
        var pre = window.__trazadorPre || null;
        window.__trazadorPre = null;
        cont.appendChild(P.encabezado('Trazador de rutas', 'Haz clic en el mapa para añadir puntos y ajústalos a las calles con OSRM.'));
        var panel = MB.h('div', { clase: 'tarjeta', style: 'margin-bottom:12px' });
        var tipoSel = MB.h('select', null, MB.h('option', { value: 'bus', texto: 'Ruta de un bus' }), MB.h('option', { value: 'camion', texto: 'Ruta semanal de un camión' }));
        var vehSel = MB.h('select');
        var rutaSel = MB.h('select');
        var nombreIn = MB.h('input', { type: 'text', placeholder: 'Nombre de la ruta', maxlength: '100' });
        var colorIn = MB.h('input', { type: 'color', value: '#22c3d8' });
        var diasCont = MB.h('div', { clase: 'fila', style: 'flex-wrap:wrap;gap:6px' });
        var nomDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        nomDias.forEach(function (d, i) { diasCont.appendChild(MB.h('label', { style: 'display:flex;gap:4px;align-items:center' }, MB.h('input', { type: 'checkbox', value: i }), d)); });
        var buscarIn = MB.h('input', { type: 'search', placeholder: 'Buscar un lugar en Nicaragua…' });
        var campoBuscar = MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Buscar lugar' }), buscarIn);
        var resultados = MB.h('div', { clase: 'feed', style: 'max-height:150px' });
        var fila = MB.h('div', { clase: 'cuadricula c3' }, MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Qué trazar' }), tipoSel), MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Vehículo' }), vehSel), MB.h('div', { clase: 'campo', id: 'campo-ruta' }, MB.h('label', { texto: 'Ruta' }), rutaSel));
        panel.appendChild(fila);
        var extra = MB.h('div', { id: 'extra-camion', clase: 'oculto' }, MB.h('div', { clase: 'dos-col' }, MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Nombre' }), nombreIn), MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Color' }), colorIn)), MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Días de recolección' }), diasCont));
        panel.appendChild(extra);
        panel.appendChild(campoBuscar);
        panel.appendChild(resultados);
        cont.appendChild(panel);
        var m = K.crearMapa('460px');
        var estado = MB.h('div', { clase: 'fila-entre', style: 'margin-top:12px;flex-wrap:wrap' });
        var info = MB.h('span', { clase: 'suave' });
        var acciones = MB.h('div', { clase: 'fila', style: 'flex-wrap:wrap' });
        estado.appendChild(info); estado.appendChild(acciones);
        cont.appendChild(MB.h('div', { clase: 'tarjeta mapa-t' }, m.caja));
        cont.appendChild(estado);
        if (!window.MBMapa.disponible()) { m.caja.innerHTML = '<div class="vacio">Mapa no disponible</div>'; return null; }
        var mapa = window.MBMapa.crear(m.id, { zoom: 14 });
        var puntos = [];
        var trazoCalles = null;
        var L = window.L;

        function dibujar() {
            mapa.limpiar('t');
            puntos.forEach(function (p, i) {
                var mk = L.marker(p, { draggable: true, icon: window.MBMapa.iconoDiv('<div class="marcador-parada" style="font-weight:800;font-size:11px">' + (i + 1) + '</div>', [30, 30]) }).addTo(mapa.capa('t'));
                mk.on('dragend', function () { var ll = mk.getLatLng(); puntos[i] = [ll.lat, ll.lng]; dibujar(); });
                mk.on('contextmenu', function () { puntos.splice(i, 1); dibujar(); });
            });
            if (puntos.length > 1) { mapa.linea('t', puntos, { color: colorIn.value, weight: 5, opacity: 0.9 }); }
            var km = 0;
            for (var i = 1; i < puntos.length; i++) { km += MB.distanciaM(puntos[i - 1], puntos[i]); }
            info.textContent = puntos.length + ' puntos · ' + MB.dist(km) + ' aprox. · clic derecho sobre un punto para quitarlo';
        }
        mapa.mapa.on('click', function (e) { puntos.push([e.latlng.lat, e.latlng.lng]); dibujar(); });

        acciones.appendChild(P.boton('Deshacer', 'izq', 'fantasma pequeno', function () { puntos.pop(); dibujar(); return Promise.resolve(); }));
        acciones.appendChild(P.boton('Limpiar', 'x', 'fantasma pequeno', function () { puntos = []; dibujar(); return Promise.resolve(); }));
        acciones.appendChild(P.boton('Ajustar a calles', 'navegar', 'pequeno', function () {
            if (puntos.length < 2) { MB.toast('Añade al menos dos puntos', 'mal'); return Promise.resolve(); }
            var tramos = [];
            for (var i = 0; i < puntos.length; i += 80) { tramos.push(puntos.slice(i, Math.min(puntos.length, i + 81))); }
            return Promise.all(tramos.map(function (t) { return window.MBMapa.osrm(t); })).then(function (r) {
                puntos = [].concat.apply([], r).filter(function (p, i, l) { return i === 0 || p[0] !== l[i - 1][0] || p[1] !== l[i - 1][1]; });
                if (puntos.length > 3500) { var salto = Math.ceil(puntos.length / 3500); puntos = puntos.filter(function (p, i) { return i % salto === 0; }); }
                dibujar(); MB.toast('Ruta ajustada a las calles', 'ok');
            }).catch(function (e) { MB.toast(e.message || 'No se pudo ajustar', 'mal'); });
        }));
        acciones.appendChild(P.boton('Guardar ruta', 'ok', 'primario pequeno', guardar));

        function guardar() {
            if (puntos.length < 2) { MB.toast('Traza al menos dos puntos', 'mal'); return Promise.resolve(); }
            var id = vehSel.value;
            if (!id) { MB.toast('Elige un vehículo', 'mal'); return Promise.resolve(); }
            if (tipoSel.value === 'bus') { return MB.post('admin/bus/ruta', { id: id, puntos: JSON.stringify(puntos) }).then(function (r) { MB.toast('Ruta guardada (' + r.puntos + ' puntos)', 'ok'); }); }
            var dias = Array.prototype.slice.call(diasCont.querySelectorAll('input:checked')).map(function (x) { return x.value; });
            if (!nombreIn.value.trim()) { MB.toast('Escribe el nombre de la ruta', 'mal'); return Promise.resolve(); }
            return MB.post('admin/camion/ruta/guardar', { id: rutaSel.value || 0, camion_id: id, nombre: nombreIn.value.trim(), dias: dias.join(','), puntos: JSON.stringify(puntos), color: colorIn.value }).then(function () { MB.toast('Ruta guardada', 'ok'); cargarRutas(); });
        }

        var rutas = [];
        function cargarRutas() {
            if (tipoSel.value !== 'camion' || !vehSel.value) { return Promise.resolve(); }
            return MB.get('admin/camion/rutas', { camion_id: vehSel.value }).then(function (r) {
                rutas = r.rutas;
                rutaSel.innerHTML = '<option value="">Nueva ruta</option>' + rutas.map(function (x) { return '<option value="' + x.id + '">' + MB.esc(x.nombre_ruta) + '</option>'; }).join('');
                aplicarRuta();
            });
        }
        function aplicarRuta() {
            var r = rutas.filter(function (x) { return String(x.id) === rutaSel.value; })[0];
            nombreIn.value = r ? r.nombre_ruta : '';
            colorIn.value = r && r.color ? r.color : '#22c3d8';
            diasCont.querySelectorAll('input').forEach(function (c) { c.checked = !!r && r.dias.indexOf(Number(c.value)) >= 0; });
            puntos = r && Array.isArray(r.puntos) ? r.puntos.map(function (p) { return [p[0], p[1]]; }) : [];
            dibujar();
            if (puntos.length) { mapa.ajustar(puntos); }
        }

        function cargarVehiculos() {
            extra.classList.toggle('oculto', tipoSel.value !== 'camion');
            MB.$('#campo-ruta').style.display = tipoSel.value === 'camion' ? '' : 'none';
            var origen = tipoSel.value === 'bus' ? MB.get('admin/buses').then(function (r) { return r.buses; }) : MB.get('admin/camiones').then(function (r) { return r.camiones; });
            return origen.then(function (lista) {
                vehSel.innerHTML = '<option value="">Elige…</option>' + lista.map(function (v) { return '<option value="' + v.id + '">' + MB.esc(v.nombre) + '</option>'; }).join('');
                cache.veh = lista;
            });
        }
        function cargarBus() {
            if (tipoSel.value !== 'bus' || !vehSel.value) { return; }
            MB.get('publico/bus', { id: vehSel.value }).then(function (r) { puntos = (r.bus.ruta || []).map(function (p) { return [p[0], p[1]]; }); colorIn.value = r.bus.color || '#22c3d8'; dibujar(); if (puntos.length) { mapa.ajustar(puntos); } }).catch(function () { puntos = []; dibujar(); });
        }
        tipoSel.addEventListener('change', function () { puntos = []; dibujar(); cargarVehiculos(); });
        vehSel.addEventListener('change', function () { if (tipoSel.value === 'bus') { cargarBus(); } else { cargarRutas(); } });
        rutaSel.addEventListener('change', aplicarRuta);
        colorIn.addEventListener('input', dibujar);
        buscarIn.addEventListener('input', MB.debounce(function () {
            var q = buscarIn.value.trim();
            if (q.length < 3) { resultados.innerHTML = ''; return; }
            window.MBMapa.buscarLugar(q).then(function (l) {
                resultados.innerHTML = '';
                l.forEach(function (x) { var f = MB.h('div', { clase: 'feed-item', style: 'cursor:pointer', html: '<i class="punto"></i><div><b>' + MB.esc(x.nombre.split(',')[0]) + '</b><span>' + MB.esc(x.nombre) + '</span></div>' }); f.addEventListener('click', function () { mapa.mapa.flyTo([x.lat, x.lng], 16, { duration: 0.8 }); resultados.innerHTML = ''; }); resultados.appendChild(f); });
            }).catch(function () {});
        }, 500));

        cargarVehiculos().then(function () {
            if (pre) { tipoSel.value = pre.tipo; return cargarVehiculos().then(function () { vehSel.value = String(pre.id); if (pre.tipo === 'bus') { cargarBus(); } else { cargarRutas(); } }); }
        });
        setTimeout(function () { mapa.invalidar(); }, 150);
        dibujar();
        return null;
    });
})();
