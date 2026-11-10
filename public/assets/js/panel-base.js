(function () {
    'use strict';
    var MB = window.MB;
    var rol = MB.cfg.panel;
    var ETIQUETAS = { admin: 'Administración', auditor: 'Auditoría', propietario: 'Propietario', cooperativa: 'Cooperativa' };

    var SECCIONES = [
        { id: 'dashboard', etq: 'Centro de control', ico: 'pulso', grupo: 'General', roles: ['admin', 'auditor', 'propietario', 'cooperativa'] },
        { id: 'mapa', etq: 'Mapa en vivo', ico: 'mapa', grupo: 'General', roles: ['admin', 'auditor', 'propietario', 'cooperativa'] },
        { id: 'avisos', etq: 'Avisos', ico: 'campana', grupo: 'General', roles: ['admin', 'auditor', 'propietario'], contador: true },
        { id: 'buses', etq: 'Buses urbanos', ico: 'bus', grupo: 'Flota', roles: ['admin'] },
        { id: 'interurbano', etq: 'Interurbanos', ico: 'ruta', grupo: 'Flota', roles: ['admin'] },
        { id: 'camiones', etq: 'Camiones', ico: 'camion', grupo: 'Flota', roles: ['admin', 'auditor'] },
        { id: 'paradas', etq: 'Paradas', ico: 'pin', grupo: 'Flota', roles: ['admin'] },
        { id: 'cierres', etq: 'Calles cerradas', ico: 'alerta', grupo: 'Flota', roles: ['admin'] },
        { id: 'trazador', etq: 'Trazador de rutas', ico: 'navegar', grupo: 'Flota', roles: ['admin'] },
        { id: 'propietarios', etq: 'Propietarios', ico: 'usuarios', grupo: 'Flota', roles: ['cooperativa'] },
        { id: 'desempeno', etq: 'Desempeño', ico: 'grafica', grupo: 'Reportes', roles: ['admin', 'auditor', 'propietario', 'cooperativa'] },
        { id: 'misresenas', etq: 'Reseñas de buses', ico: 'estrella', grupo: 'Reportes', roles: ['admin', 'auditor', 'propietario', 'cooperativa'] },
        { id: 'turnos', etq: 'Turnos', ico: 'reloj', grupo: 'Flota', roles: ['admin', 'cooperativa'] },
        { id: 'reportes', etq: 'Reportes de usuarios', ico: 'alerta', grupo: 'Comunidad', roles: ['admin'] },
        { id: 'demanda', etq: 'Demanda de paradas', ico: 'mira', grupo: 'Comunidad', roles: ['admin', 'auditor'] },
        { id: 'pasajeros', etq: 'Pasajeros', ico: 'usuarios', grupo: 'Comunidad', roles: ['admin', 'auditor'] },
        { id: 'resenas', etq: 'Reseñas', ico: 'estrella', grupo: 'Comunidad', roles: ['admin', 'auditor'] },
        { id: 'anuncios', etq: 'Publicidad', ico: 'imagen', grupo: 'Contenido', roles: ['admin'] },
        { id: 'avisosuni', etq: 'Avisos y horarios universitarios', ico: 'calendario', grupo: 'Contenido', roles: ['admin'] },
        { id: 'creativa', etq: 'Ruta creativa', ico: 'destello', grupo: 'Contenido', roles: ['admin'] },
        { id: 'ciudades', etq: 'Ciudades', ico: 'edificio', grupo: 'Administración', roles: ['admin'] },
        { id: 'universidades', etq: 'Universidades', ico: 'usuarios', grupo: 'Administración', roles: ['admin'] },
        { id: 'cooperativas', etq: 'Cooperativas', ico: 'edificio', grupo: 'Administración', roles: ['admin'] },
        { id: 'cuentas', etq: 'Cuentas', ico: 'usuario', grupo: 'Administración', roles: ['admin'] },
        { id: 'horario', etq: 'Horario', ico: 'reloj', grupo: 'Administración', roles: ['admin'] },
        { id: 'qr', etq: 'Códigos QR', ico: 'qr', grupo: 'Administración', roles: ['admin'] },
        { id: 'bitacora', etq: 'Bitácora', ico: 'lista', grupo: 'Sistema', roles: ['admin', 'auditor'] },
        { id: 'respaldos', etq: 'Respaldos', ico: 'descargar', grupo: 'Sistema', roles: ['admin'] },
        { id: 'seguridad', etq: 'Seguridad', ico: 'escudo', grupo: 'Sistema', roles: ['admin'] },
        { id: 'sistema', etq: 'Estado del sistema', ico: 'ajustes', grupo: 'Sistema', roles: ['admin'] },
        { id: 'perfil', etq: 'Mi perfil', ico: 'usuario', grupo: 'Cuenta', roles: ['admin', 'auditor', 'propietario', 'cooperativa'] }
    ].filter(function (s) { return s.roles.indexOf(rol) >= 0; });

    var registro = {};
    var actual = null;
    var vivo = null;
    var contadorAvisos = 0;
    var el = {};

    function registrar(id, fn) { registro[id] = fn; }

    function encabezado(titulo, sub, acciones) {
        var d = MB.h('div', { clase: 'cabecera-seccion', style: 'margin-bottom:16px' }, MB.h('div', null, MB.h('h2', { texto: titulo }), sub ? MB.h('p', { texto: sub }) : null));
        if (acciones) { var c = MB.h('div', { clase: 'fila' }); (Array.isArray(acciones) ? acciones : [acciones]).forEach(function (a) { c.appendChild(a); }); d.appendChild(c); }
        return d;
    }

    function boton(texto, icono, clase, alPulsar) {
        var b = MB.h('button', { type: 'button', clase: 'boton ' + (clase || ''), html: (icono ? MB.ico(icono) + ' ' : '') + MB.esc(texto) });
        if (alPulsar) { b.addEventListener('click', function () { MB.conPromesa(b, function () { return alPulsar(b); }).catch(function (e) { MB.toast(e.message, 'mal'); }); }); }
        return b;
    }

    function buscador(alCambiar, placeholder) {
        var i = MB.h('input', { type: 'search', placeholder: placeholder || 'Buscar…', 'aria-label': 'Buscar' });
        i.addEventListener('input', MB.debounce(function () { alCambiar(i.value.trim().toLowerCase()); }, 180));
        return MB.h('div', { clase: 'buscador', html: MB.ico('buscar') }, i);
    }

    function tabla(columnas, filas, opc) {
        opc = opc || {};
        var orden = { col: -1, asc: true };
        var cuerpo = MB.h('tbody');
        var env = MB.h('div', { clase: 'tabla-envoltura' });
        var t = MB.h('table', { clase: 'tabla' });
        var cab = MB.h('tr');
        columnas.forEach(function (c, i) {
            var th = MB.h('th', { texto: c.etq, clase: c.orden ? 'ordenable' : '' });
            if (c.orden) { th.addEventListener('click', function () { orden.asc = orden.col === i ? !orden.asc : true; orden.col = i; pintar(); }); }
            cab.appendChild(th);
        });
        t.appendChild(MB.h('thead', null, cab));
        t.appendChild(cuerpo);
        env.appendChild(t);
        var datos = filas;
        var filtro = '';

        function pintar() {
            var f = datos.filter(function (r) { return !filtro || JSON.stringify(r).toLowerCase().indexOf(filtro) >= 0; });
            if (orden.col >= 0) {
                var c = columnas[orden.col];
                f = f.slice().sort(function (a, b) {
                    var x = c.valor ? c.valor(a) : a[c.campo], y = c.valor ? c.valor(b) : b[c.campo];
                    if (x === null || x === undefined) { return 1; }
                    if (y === null || y === undefined) { return -1; }
                    var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
                    return orden.asc ? r : -r;
                });
            }
            cuerpo.innerHTML = '';
            if (!f.length) { cuerpo.appendChild(MB.h('tr', null, MB.h('td', { colspan: columnas.length, clase: 'vacio', texto: opc.vacio || 'Sin resultados' }))); return; }
            f.forEach(function (r) {
                var tr = MB.h('tr', { clase: opc.alPulsar ? 'fila-click' : '' });
                columnas.forEach(function (c) {
                    var td = MB.h('td');
                    var v = c.render ? c.render(r) : MB.esc(r[c.campo] === null || r[c.campo] === undefined ? '—' : r[c.campo]);
                    if (v instanceof Node) { td.appendChild(v); } else { td.innerHTML = v; }
                    tr.appendChild(td);
                });
                if (opc.alPulsar) { tr.addEventListener('click', function (e) { if (!e.target.closest('button,a,input,label')) { opc.alPulsar(r); } }); }
                cuerpo.appendChild(tr);
            });
        }
        pintar();
        return { el: env, filtrar: function (q) { filtro = q; pintar(); }, datos: function (d) { datos = d; pintar(); } };
    }

    function pastilla(texto, clase) { return '<span class="pastilla ' + (clase || '') + '">' + MB.esc(texto) + '</span>'; }

    function menu(destino, conAjustes) {
        var grupos = {};
        SECCIONES.forEach(function (s) { (grupos[s.grupo] = grupos[s.grupo] || []).push(s); });
        destino.innerHTML = '';
        destino.appendChild(MB.h('div', { clase: 'marca', html: '<img src="' + MB.esc(MB.url('/assets/img/logo.png')) + '" alt=""><div><b>MiBus</b><small>' + ETIQUETAS[rol] + '</small></div>' }));
        Object.keys(grupos).forEach(function (g) {
            destino.appendChild(MB.h('div', { clase: 'nav-grupo', texto: g }));
            grupos[g].forEach(function (s) {
                var a = MB.h('a', { clase: 'nav-item' + (actual === s.id ? ' activo' : ''), href: '#/' + s.id, datos: { id: s.id }, html: MB.ico(s.ico) + '<span>' + MB.esc(s.etq) + '</span>' + (s.contador ? '<span class="contador oculto" data-contador="1"></span>' : '') });
                destino.appendChild(a);
            });
        });
        var pie = MB.h('div', { style: 'margin-top:auto;display:flex;flex-direction:column;gap:6px' });
        var salir = boton('Cerrar sesión', 'salir', 'fantasma bloque', function () { return MB.post('auth/salir').then(function () { location.href = MB.url('/' + rol + '/login'); }); });
        pie.appendChild(salir);
        destino.appendChild(pie);
        pintarContador();
    }

    function pintarContador() {
        MB.$$('[data-contador]').forEach(function (c) { c.textContent = contadorAvisos > 99 ? '99+' : contadorAvisos; c.classList.toggle('oculto', !contadorAvisos); });
        var camp = MB.$('#boton-campana .punto-rojo');
        if (camp) { camp.classList.toggle('oculto', !contadorAvisos); }
    }

    function cabeceraSuperior() {
        var sup = el.sup;
        sup.innerHTML = '';
        var m = MB.h('button', { clase: 'boton icono fantasma menu-movil', type: 'button', 'aria-label': 'Menú', html: MB.ico('menu') });
        m.addEventListener('click', function () { menu(el.ladoCajon); el.cajon.classList.add('visible'); });
        sup.appendChild(m);
        sup.appendChild(MB.h('h1', { id: 'titulo-seccion' }));
        sup.appendChild(MB.h('span', { clase: 'crece' }));
        var b = MB.h('button', { clase: 'buscar-rapido', type: 'button', html: MB.ico('buscar') + '<span>Buscar o ir a…</span><kbd>Ctrl K</kbd>' });
        b.addEventListener('click', paleta);
        sup.appendChild(b);
        var camp = MB.h('button', { id: 'boton-campana', clase: 'boton icono fantasma', type: 'button', 'aria-label': 'Avisos', style: 'position:relative', html: MB.ico('campana') + '<i class="punto-rojo oculto" style="position:absolute;top:6px;right:7px;width:9px;height:9px;border-radius:50%;background:var(--peligro)"></i>' });
        camp.addEventListener('click', function () { if (registro.avisos) { location.hash = '#/avisos'; } });
        if (SECCIONES.some(function (s) { return s.id === 'avisos'; })) { sup.appendChild(camp); }
        sup.appendChild(MB.h('button', { clase: 'boton icono fantasma', type: 'button', datos: { accion: 'tema' }, 'aria-label': 'Cambiar tema' }));
        var sala = MB.h('button', { clase: 'boton icono fantasma', type: 'button', 'aria-label': 'Modo sala de control', title: 'Modo sala de control', html: MB.ico('pantalla') });
        sala.addEventListener('click', function () {
            document.body.classList.toggle('sala-control');
            if (document.body.classList.contains('sala-control')) {
                if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch(function () {}); }
                MB.toast('Modo sala de control. Pulsa Esc para salir.', 'info');
            } else if (document.fullscreenElement) { document.exitFullscreen(); }
        });
        if (rol === 'admin' || rol === 'auditor') { sup.appendChild(sala); }
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('sala-control')) { document.body.classList.remove('sala-control'); } });
        MB.pintarTema();
    }

    function barraInferior() {
        var pref = ['dashboard', 'mapa', 'avisos', 'perfil'];
        var b = el.barra;
        b.innerHTML = '';
        var items = pref.map(function (id) { return SECCIONES.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
        items.forEach(function (s) {
            var x = MB.h('button', { type: 'button', datos: { id: s.id }, html: MB.ico(s.ico) + '<span>' + MB.esc(s.etq.split(' ')[0]) + '</span>' });
            x.addEventListener('click', function () { location.hash = '#/' + s.id; });
            b.appendChild(x);
        });
        var mas = MB.h('button', { type: 'button', html: MB.ico('menu') + '<span>Más</span>' });
        mas.addEventListener('click', function () { menu(el.ladoCajon); el.cajon.classList.add('visible'); });
        b.appendChild(mas);
    }

    function marcarActivo() {
        MB.$$('.nav-item,.barra-inferior button').forEach(function (n) { n.classList.toggle('activo', n.dataset.id === actual); });
    }

    function ir() {
        var id = (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'dashboard';
        if (!SECCIONES.some(function (s) { return s.id === id; })) { id = 'dashboard'; }
        if (vivo && vivo.destruir) { try { vivo.destruir(); } catch (e) {} }
        vivo = null;
        actual = id;
        var s = SECCIONES.filter(function (x) { return x.id === id; })[0];
        MB.$('#titulo-seccion').textContent = s.etq;
        document.title = s.etq + ' · MiBus';
        marcarActivo();
        el.cajon.classList.remove('visible');
        el.contenido.classList.toggle('sin-relleno', id === 'mapa');
        el.contenido.innerHTML = '';
        el.contenido.scrollTop = 0;
        window.scrollTo(0, 0);
        var fn = registro[id];
        if (!fn) { el.contenido.innerHTML = '<div class="vacio">' + MB.ico('alerta') + '<p>Sección no disponible</p></div>'; return; }
        try { vivo = fn(el.contenido) || null; } catch (e) { el.contenido.innerHTML = '<div class="vacio">' + MB.ico('alerta') + '<p>' + MB.esc(e.message) + '</p></div>'; }
    }

    function paleta() {
        var cuerpo = MB.h('div');
        var input = MB.h('input', { type: 'text', placeholder: 'Escribe para buscar una sección o acción…', 'aria-label': 'Buscar' });
        var lista = MB.h('ul');
        cuerpo.appendChild(input);
        cuerpo.appendChild(lista);
        var cmds = SECCIONES.map(function (s) { return { etq: s.etq, ico: s.ico, grupo: s.grupo, fn: function () { location.hash = '#/' + s.id; } }; });
        cmds.push({ etq: 'Cambiar tema claro/oscuro', ico: 'sol', grupo: 'Acción', fn: MB.tema });
        cmds.push({ etq: 'Actualizar datos', ico: 'actualizar', grupo: 'Acción', fn: ir });
        var sel = 0;
        var visibles = cmds;
        var cerrarFn = null;
        function pintar() {
            var q = input.value.trim().toLowerCase();
            visibles = cmds.filter(function (c) { return !q || (c.etq + ' ' + c.grupo).toLowerCase().indexOf(q) >= 0; });
            sel = Math.min(sel, Math.max(0, visibles.length - 1));
            lista.innerHTML = '';
            visibles.forEach(function (c, i) {
                var li = MB.h('li', { clase: i === sel ? 'sel' : '', html: MB.ico(c.ico) + '<span>' + MB.esc(c.etq) + '</span><small>' + MB.esc(c.grupo) + '</small>' });
                li.addEventListener('click', function () { cerrarFn(); c.fn(); });
                lista.appendChild(li);
            });
        }
        input.addEventListener('input', function () { sel = 0; pintar(); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { sel = Math.min(visibles.length - 1, sel + 1); pintar(); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); pintar(); e.preventDefault(); }
            else if (e.key === 'Enter' && visibles[sel]) { cerrarFn(); visibles[sel].fn(); }
        });
        pintar();
        MB.modal({ clase: 'paleta', cuerpo: cuerpo, alAbrir: function (c, cerrar) { cerrarFn = cerrar; } });
    }

    function cambioObligatorio() {
        MB.formulario({
            titulo: 'Cambia tu contraseña', sub: 'Por seguridad debes definir una contraseña personal antes de continuar. Mínimo 10 caracteres con letras y números.',
            campos: [{ nombre: 'actual', etiqueta: 'Contraseña actual', tipo: 'password', requerido: true, autocompletar: 'current-password' }, { nombre: 'nueva', etiqueta: 'Nueva contraseña', tipo: 'password', requerido: true, autocompletar: 'new-password' }, { nombre: 'repetir', etiqueta: 'Repite la nueva contraseña', tipo: 'password', requerido: true, autocompletar: 'new-password' }],
            boton: 'Guardar contraseña',
            alGuardar: function (d) {
                if (d.nueva !== d.repetir) { throw new Error('Las contraseñas no coinciden'); }
                return MB.post('cuenta/contrasena', { actual: d.actual, nueva: d.nueva }).then(function () { MB.toast('Contraseña actualizada', 'ok'); MB.cfg.debeCambiar = false; });
            }
        }).then(function (r) { if (r === null && MB.cfg.debeCambiar) { cambioObligatorio(); } });
    }

    function sondearAvisos() {
        if (!SECCIONES.some(function (s) { return s.id === 'avisos'; })) { return; }
        MB.sondeo(function () {
            return MB.get('panel/bandeja', null, { silencioso: true }).then(function (r) {
                if (r.sin_leer > contadorAvisos && contadorAvisos !== -1) {
                    var nuevo = r.avisos.filter(function (a) { return !a.leido; })[0];
                    if (nuevo && contadorAvisos >= 0 && window.__avisosVistos) { MB.toast(nuevo.titulo, nuevo.gravedad === 'urgente' ? 'mal' : 'info', 6000); }
                }
                window.__avisosVistos = true;
                contadorAvisos = r.sin_leer;
                pintarContador();
            });
        }, 30000, { segundoPlano: 120000 });
    }

    function iniciar() {
        el = { lateral: MB.$('#lateral'), sup: MB.$('#sup'), contenido: MB.$('#contenido'), barra: MB.$('#barra-inferior'), cajon: MB.$('#cajon'), ladoCajon: MB.$('#lado-cajon') };
        el.cajon.addEventListener('click', function (e) { if (e.target === el.cajon) { el.cajon.classList.remove('visible'); } });
        el.ladoCajon.addEventListener('click', function (e) { if (e.target.closest('a')) { el.cajon.classList.remove('visible'); } });
        menu(el.lateral);
        cabeceraSuperior();
        barraInferior();
        window.addEventListener('hashchange', ir);
        document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paleta(); } });
        ir();
        sondearAvisos();
        if (MB.cfg.debeCambiar) { cambioObligatorio(); }
    }

    window.PNL = {
        rol: rol, registrar: registrar, encabezado: encabezado, boton: boton, buscador: buscador, tabla: tabla, pastilla: pastilla,
        irA: function (id) { location.hash = '#/' + id; }, recargar: ir, secciones: SECCIONES,
        setAvisos: function (n) { contadorAvisos = n; pintarContador(); }, iniciar: iniciar
    };

    document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 0); });
})();
