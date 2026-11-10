(function () {
    'use strict';
    var MB = window.MB, P = window.PNL, K = window.PNLK, G = window.MBG;
    var rol = P.rol;

    function perfil(cont) {
        cont.appendChild(P.encabezado('Mi perfil', 'Datos de tu cuenta y seguridad de acceso.'));
        var caja = MB.h('div', { clase: 'cuadricula c2' });
        cont.appendChild(caja);
        MB.get('cuenta/perfil').then(function (r) {
            var p = r.perfil;
            var avatar = MB.h('div', { clase: 'avatar', style: 'width:72px;height:72px;font-size:28px', html: p.foto ? '<img src="' + MB.esc(p.foto) + '" alt="">' : MB.esc((p.nombre || '?').charAt(0).toUpperCase()) });
            var archivo = MB.h('input', { type: 'file', accept: 'image/*', clase: 'oculto' });
            archivo.addEventListener('change', function () {
                if (!archivo.files[0]) { return; }
                var fd = new FormData(); fd.append('foto', archivo.files[0]);
                MB.post('cuenta/foto', fd).then(function (x) { avatar.innerHTML = '<img src="' + MB.esc(x.foto) + '?v=' + Date.now() + '" alt="">'; MB.toast('Foto actualizada', 'ok'); }).catch(function (e) { MB.toast(e.message, 'mal'); });
            });
            var cambiarFoto = P.boton('Cambiar foto', 'imagen', 'fantasma pequeno', function () { archivo.click(); return Promise.resolve(); });
            var nombreIn = MB.h('input', { type: 'text', value: p.nombre, maxlength: '80' });
            var guardarNombre = P.boton('Guardar nombre', 'ok', 'pequeno', function () { return MB.post('cuenta/nombre', { nombre: nombreIn.value }).then(function () { MB.toast('Nombre actualizado', 'ok'); }); });
            var datos = MB.h('div', null,
                MB.h('div', { clase: 'fila', style: 'margin-bottom:14px' }, avatar, MB.h('div', null, MB.h('b', { texto: p.correo }), MB.h('div', { clase: 'suave pequeno', texto: 'Rol: ' + p.rol }), cambiarFoto, archivo)),
                MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Nombre' }), nombreIn), guardarNombre,
                MB.h('p', { clase: 'suave pequeno', style: 'margin-top:12px', texto: 'Último acceso: ' + MB.fecha(p.ultimo_acceso) + (p.ultima_ip ? ' desde ' + p.ultima_ip : '') }));
            caja.appendChild(K.tarjeta('Cuenta', 'usuario', datos));

            var actual = MB.h('input', { type: 'password', autocomplete: 'current-password' });
            var nueva = MB.h('input', { type: 'password', autocomplete: 'new-password' });
            var cambiar = P.boton('Cambiar contraseña', 'candado', 'primario pequeno', function () {
                return MB.post('cuenta/contrasena', { actual: actual.value, nueva: nueva.value }).then(function () { actual.value = ''; nueva.value = ''; MB.toast('Contraseña actualizada', 'ok'); });
            });
            var otras = P.boton('Cerrar mis otras sesiones', 'salir', 'fantasma pequeno', function () { return MB.post('cuenta/cerrar-otras').then(function () { MB.toast('Otras sesiones cerradas', 'ok'); }); });
            caja.appendChild(K.tarjeta('Contraseña', 'candado', MB.h('div', null, MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Contraseña actual' }), actual), MB.h('div', { clase: 'campo' }, MB.h('label', { texto: 'Nueva contraseña (mínimo 10, letras y números)' }), nueva), MB.h('div', { clase: 'fila', style: 'flex-wrap:wrap' }, cambiar, otras))));

            if (p.dos_factores_disponible) {
                var cuerpo = MB.h('div');
                function pintar2fa(activo) {
                    cuerpo.innerHTML = '';
                    cuerpo.appendChild(MB.h('p', { clase: 'suave', texto: activo ? 'El segundo factor está activo. Al iniciar sesión necesitarás el código de tu aplicación.' : 'Añade una capa extra: además de tu contraseña pediremos un código de 6 dígitos de una aplicación como Google Authenticator o Aegis.' }));
                    cuerpo.appendChild(activo ? P.boton('Desactivar 2FA', 'x', 'peligro pequeno', desactivar) : P.boton('Activar 2FA', 'escudo', 'primario pequeno', activar));
                }
                function activar() {
                    return MB.post('cuenta/2fa/iniciar').then(function (x) {
                        var cod = MB.h('input', { type: 'text', inputmode: 'numeric', maxlength: '6', placeholder: '000000', clase: 'codigo-2fa' });
                        var c = MB.h('div', { clase: 'tarjeta-qr' }, MB.h('div', { clase: 'qr-caja', html: x.qr }), MB.h('p', { clase: 'suave pequeno', texto: 'Escanea el QR con tu aplicación o escribe esta clave:' }), MB.h('code', { texto: x.secreto, style: 'word-break:break-all' }), cod);
                        return MB.modal({ titulo: 'Activar segundo factor', cuerpo: c, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Verificar y activar', clase: 'primario', alPulsar: function () { return MB.post('cuenta/2fa/activar', { codigo: cod.value.trim() }).then(function (res) { mostrarRecuperacion(res.recuperacion); pintar2fa(true); }); } }] });
                    });
                }
                function mostrarRecuperacion(codigos) {
                    var g = MB.h('div', { clase: 'recuperacion', html: codigos.map(function (c) { return '<span>' + MB.esc(c) + '</span>'; }).join('') });
                    MB.modal({ titulo: 'Códigos de recuperación', sub: 'Guárdalos en un lugar seguro. Cada uno sirve una sola vez si pierdes tu teléfono. No volverán a mostrarse.', cuerpo: g, obligatorio: true, botones: [{ texto: 'Copiar', alPulsar: function () { MB.copiar(codigos.join('\n')); return false; } }, { texto: 'Ya los guardé', clase: 'primario', valor: true }] });
                }
                function desactivar() {
                    return MB.formulario({ titulo: 'Desactivar 2FA', sub: 'Confirma con tu contraseña y un código vigente.', campos: [{ nombre: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', requerido: true }, { nombre: 'codigo', etiqueta: 'Código de 6 dígitos', requerido: true, max: 10 }], boton: 'Desactivar', alGuardar: function (d) { return MB.post('cuenta/2fa/desactivar', d).then(function () { MB.toast('2FA desactivado', 'ok'); pintar2fa(false); }); } });
                }
                pintar2fa(p.dos_factores);
                caja.appendChild(K.tarjeta('Verificación en dos pasos', 'escudo', cuerpo));
            }
        }).catch(function (e) { caja.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        return null;
    }
    P.registrar('perfil', perfil);

    if (rol !== 'admin') { return; }

    P.registrar('qr', function (cont) {
        cont.appendChild(P.encabezado('Códigos QR', 'Imprime y pega estos códigos. Incluyen el logo y corrección de errores nivel H.', [P.boton('PDF grande', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/qr?formato=pdf&tamano=grande'), '_blank'); return Promise.resolve(); }), P.boton('PDF pequeño (hoja de 9)', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/qr?formato=pdf&tamano=pequeno'), '_blank'); return Promise.resolve(); })]));
        var lista = [['mapa', 'Mapa público'], ['basura', 'Camión de basura'], ['admin', 'Administrador'], ['auditor', 'Auditor'], ['propietario', 'Propietario'], ['cooperativa', 'Cooperativa'], ['chofer', 'Chofer de bus'], ['camion', 'Chofer de camión']];
        var g = MB.h('div', { clase: 'cuadricula auto' });
        lista.forEach(function (x) {
            var png = MB.url('/api/admin/qr?panel=' + x[0] + '&formato=png');
            g.appendChild(MB.h('div', { clase: 'tarjeta tarjeta-qr', html: '<div class="qr-caja"><img src="' + MB.esc(png) + '" alt="QR ' + MB.esc(x[1]) + '" loading="lazy" style="width:100%;border-radius:12px;background:#fff"></div><b>' + MB.esc(x[1]) + '</b><div class="fila"><a class="boton pequeno fantasma" href="' + MB.esc(png) + '" download="qr-' + x[0] + '.png">PNG</a><a class="boton pequeno fantasma" href="' + MB.esc(MB.url('/api/admin/qr?panel=' + x[0] + '&formato=svg')) + '" download="qr-' + x[0] + '.svg">SVG</a></div>' }));
        });
        cont.appendChild(g);
        return null;
    });

    P.registrar('seguridad', function (cont) {
        var estado = { tipo: '', exito: '', ip: '', pagina: 1 };
        cont.appendChild(P.encabezado('Seguridad', 'Bitácora con cadena de integridad, bloqueos y actividad de acceso.', P.boton('Exportar bitácora', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/exportar?tipo=bitacora'), '_blank'); return Promise.resolve(); })));
        var kpis = MB.h('div', { clase: 'cuadricula c4' });
        var fila2 = MB.h('div', { clase: 'cuadricula c2', style: 'margin-top:16px' });
        var cHora = MB.h('div');
        var bloqueos = MB.h('div');
        fila2.appendChild(K.tarjeta('Inicios de sesión por hora (24 h)', 'grafica', cHora));
        fila2.appendChild(K.tarjeta('Direcciones bloqueadas', 'candado', bloqueos));
        var filtros = MB.h('div', { clase: 'barra-herramientas' });
        var tipoSel = MB.h('select', null, MB.h('option', { value: '', texto: 'Todos los eventos' }));
        ['login', 'login_2fa', 'login_emisor', 'logout', 'cambio_contrasena', 'sos', 'accion_admin', 'bloqueo_ip', 'gps_codigo', 'csrf'].forEach(function (t) { tipoSel.appendChild(MB.h('option', { value: t, texto: t })); });
        var exitoSel = MB.h('select', null, MB.h('option', { value: '', texto: 'Todos los resultados' }), MB.h('option', { value: '1', texto: 'Exitosos' }), MB.h('option', { value: '0', texto: 'Fallidos' }));
        var ipIn = MB.h('input', { type: 'search', placeholder: 'Filtrar por IP', maxlength: '45' });
        filtros.appendChild(tipoSel); filtros.appendChild(exitoSel); filtros.appendChild(ipIn);
        filtros.appendChild(P.boton('Bloquear IP', 'candado', 'peligro pequeno', function () { return bloquear(); }));
        var cuerpo = MB.h('div');
        var pie = MB.h('div', { clase: 'fila-entre', style: 'margin-top:10px' });
        cont.appendChild(kpis); cont.appendChild(fila2);
        cont.appendChild(MB.h('h3', { texto: 'Bitácora', style: 'margin:20px 0 10px' }));
        cont.appendChild(filtros); cont.appendChild(cuerpo); cont.appendChild(pie);
        var grafico = null;

        function bloquear(ip) {
            return MB.formulario({ titulo: 'Bloquear dirección IP', campos: [{ nombre: 'ip', etiqueta: 'IP', requerido: true, defecto: ip || '', max: 45 }, { nombre: 'minutos', etiqueta: 'Duración en minutos', tipo: 'number', defecto: 1440 }, { nombre: 'motivo', etiqueta: 'Motivo', max: 150 }], boton: 'Bloquear', alGuardar: function (d) { return MB.post('admin/seguridad/bloquear', d).then(function () { MB.toast('IP bloqueada', 'ok'); cargar(); }); } });
        }

        function cargar() {
            return MB.get('admin/seguridad', { tipo: estado.tipo, exito: estado.exito, ip: estado.ip, pagina: estado.pagina }).then(function (r) {
                var i = r.integridad;
                var intacta = i.alterados === 0 && i.enlaces_rotos === 0;
                var fallidos = r.conteos.filter(function (c) { return Number(c.exito) === 0; }).reduce(function (s, c) { return s + Number(c.n); }, 0);
                var ok = r.conteos.filter(function (c) { return Number(c.exito) === 1; }).reduce(function (s, c) { return s + Number(c.n); }, 0);
                kpis.innerHTML = '';
                var k1 = K.kpi('Integridad de la bitácora', 'escudo', intacta ? 'var(--ok)' : 'var(--peligro)'); k1.poner(intacta ? 'Intacta' : 'Alterada', i.verificados + ' registros verificados' + (intacta ? '' : ' · ' + i.alterados + ' alterados'), { alerta: !intacta });
                var k2 = K.kpi('Eventos fallidos (24 h)', 'alerta', 'var(--aviso)'); k2.poner(fallidos, ok + ' exitosos');
                var k3 = K.kpi('IP bloqueadas', 'candado', 'var(--peligro)'); k3.poner(r.bloqueos.length, 'vigentes ahora');
                var k4 = K.kpi('Administradores con 2FA', 'llave', r.admins.con_2fa === r.admins.total ? 'var(--ok)' : 'var(--aviso)'); k4.poner(r.admins.con_2fa + ' / ' + r.admins.total, r.https ? 'Conexión HTTPS activa' : 'Sin HTTPS: actívalo en el hosting', { alerta: !r.https });
                [k1, k2, k3, k4].forEach(function (k) { kpis.appendChild(k.el); });
                if (grafico) { grafico.destruir(); }
                var horas = []; for (var h = 0; h < 24; h++) { horas.push(h + 'h'); }
                grafico = G.lineas(cHora, { alto: 200, etiquetas: horas, series: [{ nombre: 'Correctos', color: 'ok', datos: r.logins_por_hora.map(function (x) { return x[0]; }) }, { nombre: 'Fallidos', color: 'peligro', datos: r.logins_por_hora.map(function (x) { return x[1]; }) }] });
                bloqueos.innerHTML = '';
                if (!r.bloqueos.length) { bloqueos.innerHTML = '<div class="vacio">Sin bloqueos vigentes</div>'; }
                else { bloqueos.appendChild(P.tabla([{ etq: 'IP', campo: 'ip' }, { etq: 'Motivo', campo: 'motivo' }, { etq: 'Hasta', render: function (b) { return MB.fecha(b.hasta); } }, { etq: '', render: function (b) { return P.boton('Liberar', 'ok', 'pequeno', function () { return MB.post('admin/seguridad/desbloquear', { ip: b.ip }).then(cargar); }); } }], r.bloqueos).el); }
                if (r.top_ips.length) { bloqueos.appendChild(MB.h('h4', { texto: 'IP con más fallos (24 h)', style: 'margin:14px 0 6px' })); r.top_ips.forEach(function (t) { var f = MB.h('div', { clase: 'fila-entre', style: 'padding:4px 0' }, MB.h('span', { texto: t.ip + ' · ' + t.n + ' fallos' })); if (t.ip !== r.mi_ip) { f.appendChild(P.boton('Bloquear', 'candado', 'pequeno fantasma', function () { return bloquear(t.ip); })); } bloqueos.appendChild(f); }); }
                cuerpo.innerHTML = '';
                cuerpo.appendChild(P.tabla([
                    { etq: 'Momento', render: function (x) { return MB.fecha(x.momento); } },
                    { etq: 'Evento', campo: 'tipo' },
                    { etq: 'Resultado', render: function (x) { return x.exito ? P.pastilla('OK', 'ok') : P.pastilla('Fallo', 'mal'); } },
                    { etq: 'IP', campo: 'ip' }, { etq: 'Rol', render: function (x) { return MB.esc(x.rol || '—'); } },
                    { etq: 'Detalle', render: function (x) { return '<span style="white-space:normal;display:block;min-width:180px">' + MB.esc(x.detalle || x.endpoint || '') + '</span>'; } }
                ], r.registros, { vacio: 'Sin registros' }).el);
                var paginas = Math.max(1, Math.ceil(r.total / r.por_pagina));
                pie.innerHTML = '';
                pie.appendChild(MB.h('span', { clase: 'suave pequeno', texto: MB.num(r.total) + ' registros · página ' + r.pagina + ' de ' + paginas }));
                var nav = MB.h('div', { clase: 'fila' });
                nav.appendChild(P.boton('', 'izq', 'icono fantasma', function () { if (estado.pagina > 1) { estado.pagina--; return cargar(); } return Promise.resolve(); }));
                nav.appendChild(P.boton('', 'der', 'icono fantasma', function () { if (estado.pagina < paginas) { estado.pagina++; return cargar(); } return Promise.resolve(); }));
                pie.appendChild(nav);
            });
        }
        tipoSel.addEventListener('change', function () { estado.tipo = tipoSel.value; estado.pagina = 1; cargar(); });
        exitoSel.addEventListener('change', function () { estado.exito = exitoSel.value; estado.pagina = 1; cargar(); });
        ipIn.addEventListener('input', MB.debounce(function () { estado.ip = ipIn.value.trim(); estado.pagina = 1; cargar(); }, 400));
        var s = MB.sondeo(cargar, 30000, { segundoPlano: 120000 });
        return { destruir: function () { s.parar(); if (grafico) { grafico.destruir(); } } };
    });

    P.registrar('sistema', function (cont) {
        cont.appendChild(P.encabezado('Estado del sistema', 'Diagnóstico del servidor, base de datos y permisos.', P.boton('Actualizar', 'actualizar', 'fantasma', function () { P.recargar(); return Promise.resolve(); })));
        var cuerpo = MB.h('div', { clase: 'cuadricula c2' });
        cont.appendChild(cuerpo);
        var limpiar = MB.h('div', { style: 'margin-top:16px' });
        MB.get('admin/sistema').then(function (r) {
            function fila(a, b) { return '<div class="fila-entre" style="padding:6px 0;border-bottom:1px dashed var(--borde)"><span class="suave">' + MB.esc(a) + '</span><b>' + b + '</b></div>'; }
            cuerpo.appendChild(K.tarjeta('Servidor', 'pantalla', MB.h('div', { html: fila('Versión de MiBus', MB.esc(r.version_app)) + fila('PHP', MB.esc(r.php)) + fila('Servidor web', MB.esc(r.servidor || '—')) + fila('Base de datos', MB.esc(r.base_datos)) + fila('Hash de claves', MB.esc(r.hash_claves)) + fila('HTTPS', r.https ? P.pastilla('Activo', 'ok') : P.pastilla('Inactivo', 'aviso')) + fila('Hora del servidor', MB.esc(r.hora_servidor)) + fila('Zona horaria', MB.esc(r.zona)) + fila('Sesiones activas', MB.num(r.sesiones_activas)) + fila('Peso de imágenes', MB.num(r.tamano_imagenes / 1048576, 1) + ' MB') })));
            var esq = r.esquema_ok ? P.pastilla('Al día', 'ok') : P.pastilla('Faltan columnas: ' + r.faltan.join(', '), 'mal');
            cuerpo.appendChild(K.tarjeta('Base de datos y permisos', 'escudo', MB.h('div', { html: fila('Esquema', esq) + r.escribibles.map(function (e) { return fila(e.ruta, e.ok ? P.pastilla('Escribible', 'ok') : P.pastilla('Sin permiso', 'mal')); }).join('') + r.extensiones.map(function (e) { return fila('Extensión ' + e.nombre, e.ok ? P.pastilla('Cargada', 'ok') : P.pastilla('Falta', 'aviso')); }).join('') })));
            cuerpo.appendChild(K.tarjeta('Errores recientes de PHP', 'alerta', MB.h('pre', { style: 'white-space:pre-wrap;font-size:12px;max-height:260px;overflow:auto;margin:0', texto: r.errores.length ? r.errores.join('\n') : 'Sin errores registrados.' })));
            var lim = MB.h('div', null, MB.h('p', { clase: 'suave', texto: 'Elimina datos antiguos para mantener la base liviana.' }), MB.h('div', { clase: 'fila', style: 'flex-wrap:wrap' },
                P.boton('Borrar todas las reseñas', 'basura', 'peligro pequeno', function () { return MB.confirmar('Borrar reseñas', 'Se eliminarán todas las reseñas. No se puede deshacer.', 'Borrar', true).then(function (ok) { if (ok) { return MB.post('admin/limpiar', { que: 'resenas' }).then(function () { MB.toast('Reseñas eliminadas', 'ok'); }); } }); }),
                P.boton('Borrar registro de accesos', 'basura', 'peligro pequeno', function () { return MB.confirmar('Borrar accesos', 'Se eliminará el historial de accesos de pasajeros.', 'Borrar', true).then(function (ok) { if (ok) { return MB.post('admin/limpiar', { que: 'accesos' }).then(function () { MB.toast('Accesos eliminados', 'ok'); }); } }); })));
            cuerpo.appendChild(K.tarjeta('Mantenimiento', 'ajustes', lim));
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        return null;
    });
})();
