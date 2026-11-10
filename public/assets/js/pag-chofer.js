(function () {
    'use strict';
    var MB = window.MB;
    var tipo = MB.cfg.tipo === 'camion' ? 'camion' : 'bus';
    var claveToken = 'mb-chofer-' + tipo;
    var token = null;
    var datos = null;
    var transmitiendo = false;
    var geoId = null;
    var ultimaEnvio = 0;
    var ultima = null;
    var enviados = 0;
    var cola = [];
    var bloqueo = null;
    var bateria = { nivel: null, cargando: false };
    var enVuelo = false;

    var vistaLogin = MB.$('#vista-login');
    var vistaPanel = MB.$('#vista-panel');
    var boton = MB.$('#boton-transmitir');
    var pastilla = MB.$('#pastilla-estado');
    var texto = MB.$('#texto-estado');

    MB.$('#titulo-chofer').textContent = tipo === 'camion' ? 'MiBus · Camión' : 'MiBus · Chofer';
    MB.$('#login-titulo').textContent = tipo === 'camion' ? 'Código del camión' : 'Código del bus';

    function estado(clase, rotulo) {
        pastilla.className = 'pastilla ' + clase;
        pastilla.innerHTML = '<i class="punto-estado ' + clase + '"></i><span>' + rotulo + '</span>';
    }

    function guardar(t, d) { try { localStorage.setItem(claveToken, JSON.stringify({ t: t, d: d, e: Date.now() + (d.ttl || 0) * 1000 })); } catch (e) {} }
    function cargarGuardado() {
        try {
            var g = JSON.parse(localStorage.getItem(claveToken) || 'null');
            if (g && g.e > Date.now()) { token = g.t; datos = g.d; return true; }
        } catch (e) {}
        return false;
    }
    function olvidar() { token = null; datos = null; try { localStorage.removeItem(claveToken); } catch (e) {} }

    function mostrarPanel() {
        vistaLogin.classList.add('oculto');
        vistaPanel.classList.remove('oculto');
        MB.$('#subtitulo-chofer').textContent = datos.nombre;
        boton.innerHTML = MB.ico('navegar') + '<span>Iniciar</span>';
        estado('', 'Detenido');
        var sos = MB.$('#tarjeta-sos');
        if (tipo === 'bus') {
            sos.classList.remove('oculto');
            MB.$('#titulo-sos').textContent = 'Alertas de emergencia';
            var tipos = [['mecanico', 'Falla mecánica', 'mecanico'], ['medica', 'Emergencia médica', 'medica'], ['robo', 'Robo o asalto', 'robo'], ['sos', 'SOS general', 'sos']];
            var grilla = MB.$('#grilla-sos');
            grilla.innerHTML = '';
            tipos.forEach(function (t) {
                var b = MB.h('button', { type: 'button', clase: 'boton ' + (t[0] === 'sos' ? 'peligro' : ''), html: MB.ico(t[2]) + ' ' + t[1] });
                b.addEventListener('click', function () { enviarSos(t[0], t[1]); });
                grilla.appendChild(b);
            });
        }
        if (tipo === 'bus') { prepararServicio(); }
        MB.get(tipo === 'camion' ? 'camion/estado' : 'emisor/estado', null, { token: token, silencioso: true }).then(function (r) {
            if (r.en_servicio === false) { texto.textContent = 'Fuera del horario de servicio. Puedes transmitir cuando abra.'; }
            if (tipo === 'bus') { marcarServicio(r.ocupacion || 0, !!r.desvio); }
        }).catch(function (e) { if (e.estado === 401) { salir(); } });
    }

    var ocupacionActual = 0;
    var desvioActual = false;
    var alertaVista = '';

    function marcarServicio(oc, dv) {
        ocupacionActual = oc;
        desvioActual = dv;
        Array.prototype.slice.call(MB.$('#grilla-ocupacion').children).forEach(function (b) { b.classList.toggle('sel', Number(b.getAttribute('data-oc')) === oc); });
        var bd = MB.$('#boton-desvio');
        bd.classList.toggle('sel', dv);
        bd.textContent = dv ? 'Volví a la ruta' : 'Me desvié';
    }

    function prepararServicio() {
        MB.$('#tarjeta-servicio').classList.remove('oculto');
        var grilla = MB.$('#grilla-ocupacion');
        grilla.innerHTML = '';
        [[1, 'Vacío'], [2, 'Medio'], [3, 'Lleno']].forEach(function (o) {
            var b = MB.h('button', { type: 'button', clase: 'boton', texto: o[1] });
            b.setAttribute('data-oc', o[0]);
            b.addEventListener('click', function () {
                var nuevo = ocupacionActual === o[0] ? 0 : o[0];
                MB.post('emisor/novedad', { ocupacion: nuevo }, { token: token }).then(function (r) { marcarServicio(r.ocupacion, r.desvio); }).catch(function (e) { MB.toast(e.message, 'mal'); });
            });
            grilla.appendChild(b);
        });
        MB.$('#boton-desvio').onclick = function () {
            MB.post('emisor/novedad', { desvio: desvioActual ? 0 : 1 }, { token: token }).then(function (r) { marcarServicio(r.ocupacion, r.desvio); MB.toast(r.desvio ? 'Los pasajeros verán que hay un desvío' : 'Desvío desactivado', 'ok'); }).catch(function (e) { MB.toast(e.message, 'mal'); });
        };
        MB.$('#boton-llegue').onclick = function () {
            MB.post('emisor/llegue', {}, { token: token }).then(function (r) { MB.toast(r.mensaje, 'ok'); if (navigator.vibrate) { navigator.vibrate(120); } }).catch(function (e) { MB.toast(e.message, 'mal'); });
        };
    }

    function mostrarAlerta(a) {
        var caja = MB.$('#alerta-cierre');
        if (!caja) { return; }
        if (!a) { caja.classList.add('oculto'); alertaVista = ''; return; }
        caja.innerHTML = MB.ico('alerta') + '<div class="crece"><b>Calle cerrada cerca</b><div>' + MB.esc(a.nombre) + (a.motivo ? ' · ' + MB.esc(a.motivo) : '') + ' · a ' + a.distancia_m + ' m</div></div>';
        caja.classList.remove('oculto');
        if (alertaVista !== a.nombre) { alertaVista = a.nombre; if (navigator.vibrate) { navigator.vibrate([200, 100, 200]); } }
    }

    function enviarSos(tipoAlerta, nombre) {
        MB.confirmar('Enviar alerta', '¿Enviar "' + nombre + '" al propietario?', 'Enviar alerta', true).then(function (ok) {
            if (!ok) { return; }
            var cargar = function (lat, lng) {
                MB.post('emisor/sos', { tipo: tipoAlerta, lat: lat, lng: lng }, { token: token }).then(function (r) { MB.toast(r.mensaje, 'ok'); if (navigator.vibrate) { navigator.vibrate(200); } }).catch(function (e) { MB.toast(e.message, 'mal'); });
            };
            if (ultima) { cargar(ultima.lat, ultima.lng); }
            else if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(function (p) { cargar(p.coords.latitude, p.coords.longitude); }, function () { cargar(null, null); }, { timeout: 6000 }); }
            else { cargar(null, null); }
        });
    }

    function salir() {
        detener();
        olvidar();
        vistaPanel.classList.add('oculto');
        vistaLogin.classList.remove('oculto');
    }

    MB.$('#form-chofer').addEventListener('submit', function (e) {
        e.preventDefault();
        var codigo = MB.$('#codigo').value.trim().toUpperCase();
        if (codigo.length < 4) { MB.toast('Escribe tu código', 'mal'); return; }
        MB.conPromesa(MB.$('#boton-codigo'), function () {
            return MB.post('auth/emisor', { codigo: codigo, tipo: tipo }).then(function (r) { token = r.token; datos = r; guardar(token, r); mostrarPanel(); });
        }).catch(function (err) { MB.toast(err.message, 'mal'); });
    });

    MB.$('#boton-salir').addEventListener('click', function () {
        MB.confirmar('Cerrar sesión', 'Dejarás de compartir tu ubicación en este dispositivo.', 'Cerrar sesión', true).then(function (ok) { if (ok) { salir(); } });
    });

    function leerBateria() {
        if (!navigator.getBattery) { return; }
        navigator.getBattery().then(function (b) {
            function actualizar() {
                bateria = { nivel: Math.round(b.level * 100), cargando: b.charging };
                var p = MB.$('#pastilla-bateria');
                p.className = 'pastilla ' + (bateria.nivel <= 15 && !b.charging ? 'mal' : bateria.nivel <= 30 ? 'aviso' : 'ok');
                p.innerHTML = MB.ico('bateria', 'p') + ' ' + bateria.nivel + '%' + (b.charging ? ' ⚡' : '');
            }
            actualizar();
            b.addEventListener('levelchange', actualizar);
            b.addEventListener('chargingchange', actualizar);
        }).catch(function () {});
    }
    leerBateria();

    function adquirirBloqueo() {
        if (!navigator.wakeLock) { return; }
        navigator.wakeLock.request('screen').then(function (l) { bloqueo = l; l.addEventListener('release', function () { bloqueo = null; }); }).catch(function () {});
    }
    document.addEventListener('visibilitychange', function () { if (transmitiendo && !document.hidden && !bloqueo) { adquirirBloqueo(); } });

    function intervalo() {
        var cfg = MB.cfg.gps || { movimiento: 5, quieto: 20 };
        var v = ultima ? ultima.vel : 0;
        var base = v > 3 ? cfg.movimiento : cfg.quieto;
        if (bateria.nivel !== null && bateria.nivel <= 15 && !bateria.cargando) { base *= 2; }
        return base * 1000;
    }

    async function vaciarCola() {
        if (enVuelo || !cola.length || !token) { return; }
        enVuelo = true;
        try {
            while (cola.length) {
                var p = cola[0];
                var r = await MB.post(tipo === 'camion' ? 'camion/posicion' : 'emisor/posicion', p, { token: token, silencioso: true, timeout: 12000 });
                cola.shift();
                enviados++;
                MB.$('#m-env').textContent = enviados;
                if (r.en_servicio === false) { texto.textContent = 'Fuera del horario de servicio; tu posición se guarda pero no se muestra.'; }
                if (tipo === 'bus') { mostrarAlerta(r.alerta || null); }
            }
            estado('ok', 'Transmitiendo');
        } catch (e) {
            if (e.estado === 401 || (e.datos && e.datos.reingresar)) { MB.toast('Tu sesión expiró. Ingresa de nuevo.', 'mal'); salir(); }
            else if (e.estado === 422 || e.estado === 429) { cola.shift(); }
            else { estado('aviso', 'Sin conexión · en cola ' + cola.length); }
        }
        enVuelo = false;
    }

    function alPosicion(p) {
        var c = p.coords;
        ultima = { lat: c.latitude, lng: c.longitude, vel: c.speed !== null && c.speed !== undefined ? c.speed * 3.6 : 0 };
        MB.$('#m-vel').textContent = Math.round(ultima.vel);
        MB.$('#m-prec').textContent = Math.round(c.accuracy);
        var ahora = Date.now();
        if (ahora - ultimaEnvio < intervalo()) { return; }
        ultimaEnvio = ahora;
        cola.push({ lat: c.latitude, lng: c.longitude, precision: Math.round(c.accuracy), velocidad: c.speed !== null && c.speed !== undefined ? c.speed : null, bateria: bateria.nivel, cargando: bateria.cargando ? 1 : 0 });
        if (cola.length > 40) { cola.splice(0, cola.length - 40); }
        vaciarCola();
    }

    function alError(e) {
        if (e.code === 1) { MB.toast('Permite el acceso a la ubicación para transmitir', 'mal', 6000); detener(); }
        else { estado('aviso', 'Buscando señal GPS'); }
    }

    function iniciar() {
        if (!navigator.geolocation) { MB.toast('Este dispositivo no tiene GPS', 'mal'); return; }
        transmitiendo = true;
        boton.classList.add('activo');
        boton.innerHTML = MB.ico('x') + '<span>Detener</span>';
        estado('aviso', 'Buscando señal GPS');
        texto.textContent = 'Mantén esta pantalla abierta. Se evita que el teléfono se apague mientras transmites.';
        geoId = navigator.geolocation.watchPosition(alPosicion, alError, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 });
        adquirirBloqueo();
    }

    function detener() {
        transmitiendo = false;
        if (geoId !== null) { navigator.geolocation.clearWatch(geoId); geoId = null; }
        if (bloqueo) { bloqueo.release().catch(function () {}); bloqueo = null; }
        boton.classList.remove('activo');
        if (datos) { boton.innerHTML = MB.ico('navegar') + '<span>Iniciar</span>'; estado('', 'Detenido'); texto.textContent = 'Pulsa el botón para empezar a compartir tu ubicación.'; }
    }

    boton.addEventListener('click', function () { if (transmitiendo) { detener(); } else { iniciar(); } });
    window.addEventListener('online', vaciarCola);

    if (cargarGuardado()) { mostrarPanel(); }
})();
