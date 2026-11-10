(function () {
    'use strict';
    var MB = window.MB;

    function iniciar(opc) {
        var modulo = opc.modulo;
        var ctx = { modulo: modulo, mapa: null, ubicacion: null, pestana: null, pestanas: {}, activa: null, enServicio: true };
        var hoja = MB.$('#hoja');
        var cuerpo = MB.$('#cuerpo-hoja');

        MB.$('#btn-capa').innerHTML = MB.ico('capas');
        MB.$('#btn-ubicacion').innerHTML = MB.ico('mira');
        var bAjustar = MB.$('#btn-ajustar');
        if (bAjustar) { bAjustar.innerHTML = MB.ico('bus'); }
        var bMenu = MB.$('#boton-menu');
        if (bMenu) { bMenu.innerHTML = MB.ico('usuario'); bMenu.addEventListener('click', menuCuenta); }
        var enlaceBuses = MB.$('#enlace-buses');
        if (enlaceBuses) { enlaceBuses.innerHTML = MB.ico('bus'); }
        MB.pintarTema();

        if (!window.MBMapa.disponible()) {
            MB.$('.mapa-pantalla').innerHTML = '<div class="vacio" style="padding-top:30vh">' + MB.ico('mapa') + '<p>No se pudo cargar el mapa. Revisa tu conexión y recarga la página.</p></div>';
        } else {
            ctx.mapa = window.MBMapa.crear('mapa', { zoom: 14 });
            MB.$('#btn-capa').addEventListener('click', function () { var s = ctx.mapa.alternarSatelite(); MB.toast(s ? 'Vista satelital' : 'Vista de calles', 'info', 1400); });
            MB.$('#btn-ubicacion').addEventListener('click', function () { localizar(true); });
            if (bAjustar) { bAjustar.addEventListener('click', function () { if (opc.alAjustar) { opc.alAjustar(); } }); }
        }

        function menuCuenta() {
            var cuerpoM = MB.h('div');
            cuerpoM.appendChild(MB.h('p', { clase: 'suave', texto: (MB.cfg.nombre || 'Pasajero') + (MB.cfg.ciudad ? ' · ' + MB.cfg.ciudad : '') }));
            if (MB.cfg.universidad) { cuerpoM.appendChild(MB.h('p', { clase: 'suave pequeno', texto: 'Universidad: ' + MB.cfg.universidad.nombre })); }
            var selCiudad = MB.h('select', { 'aria-label': 'Cambiar de ciudad' });
            cuerpoM.appendChild(MB.h('div', { clase: 'campo selector-ciudad' }, MB.h('label', { texto: 'Cambiar de ciudad' }), selCiudad));
            MB.get('publico/ciudades', {}, { silencioso: true }).then(function (r) {
                selCiudad.innerHTML = MB.opcionesCiudades(r.ciudades, MB.cfg.ciudadId);
            }).catch(function () { selCiudad.innerHTML = '<option value="">No se pudo cargar</option>'; });
            selCiudad.addEventListener('change', function () {
                if (!selCiudad.value || String(selCiudad.value) === String(MB.cfg.ciudadId)) { return; }
                MB.post('publico/ciudad', { ciudad_id: selCiudad.value }).then(function () {
                    try { localStorage.setItem('mb-ciudad', selCiudad.value); } catch (e) {}
                    location.reload();
                }).catch(function (e) { MB.toast(e.message, 'mal'); });
            });
            MB.modal({ titulo: 'Tu cuenta', cuerpo: cuerpoM, botones: [{ texto: 'Cerrar', valor: null }, { texto: 'Cerrar sesión', clase: 'peligro', alPulsar: function () { return MB.post('auth/salir').then(function () { location.href = MB.url('/'); return true; }); } }] });
        }

        var estadoHoja = 'media';
        function fijarHoja(e) {
            estadoHoja = e;
            hoja.classList.toggle('alta', e === 'alta');
            hoja.classList.toggle('baja', e === 'baja');
            var anu = MB.$('#contenedor-anuncio .tarjeta-anuncio');
            if (anu) { anu.style.bottom = e === 'baja' ? '164px' : e === 'alta' ? 'calc(78vh + 14px)' : 'calc(46vh + 14px)'; }
        }
        ctx.hoja = fijarHoja;
        var asa = MB.$('#asa-hoja');
        var arrastre = null;
        asa.addEventListener('pointerdown', function (e) { arrastre = { y: e.clientY, mov: false }; asa.setPointerCapture(e.pointerId); });
        asa.addEventListener('pointermove', function (e) { if (arrastre && Math.abs(e.clientY - arrastre.y) > 8) { arrastre.mov = true; } });
        asa.addEventListener('pointerup', function (e) {
            if (!arrastre) { return; }
            var dy = e.clientY - arrastre.y;
            if (!arrastre.mov) { fijarHoja(estadoHoja === 'media' ? 'alta' : estadoHoja === 'alta' ? 'baja' : 'media'); }
            else if (dy < -30) { fijarHoja(estadoHoja === 'baja' ? 'media' : 'alta'); }
            else if (dy > 30) { fijarHoja(estadoHoja === 'alta' ? 'media' : 'baja'); }
            arrastre = null;
        });

        MB.$$('#pestanas-hoja button').forEach(function (b) {
            b.addEventListener('click', function () { activar(b.dataset.pestana); });
        });

        function activar(nombre) {
            ctx.activa = nombre;
            MB.$$('#pestanas-hoja button').forEach(function (b) { b.classList.toggle('activa', b.dataset.pestana === nombre); });
            var p = ctx.pestanas[nombre];
            cuerpo.scrollTop = 0;
            if (p) { p(cuerpo); }
        }
        ctx.registrar = function (nombre, fn) { ctx.pestanas[nombre] = fn; };
        ctx.activar = activar;
        ctx.cuerpo = cuerpo;
        ctx.refrescar = function () { if (ctx.activa && ctx.pestanas[ctx.activa]) { ctx.pestanas[ctx.activa](cuerpo, true); } };

        var geoId = null;
        function localizar(centrar) {
            if (!navigator.geolocation) { MB.toast('Tu dispositivo no permite ubicación', 'mal'); return; }
            if (geoId === null) {
                geoId = navigator.geolocation.watchPosition(function (p) {
                    ctx.ubicacion = [p.coords.latitude, p.coords.longitude];
                    if (ctx.mapa) { ctx.mapa.usuario(p.coords.latitude, p.coords.longitude, p.coords.accuracy); if (ctx.centrarProximo) { ctx.centrarProximo = false; ctx.mapa.mapa.flyTo(ctx.ubicacion, 16, { duration: 0.8 }); } }
                    if (opc.alUbicar) { opc.alUbicar(ctx.ubicacion); }
                }, function (e) {
                    geoId = null;
                    if (e.code === 1) { MB.toast('Activa el permiso de ubicación para ver tiempos de llegada', 'mal', 5000); }
                }, { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 });
            }
            if (centrar) {
                if (ctx.ubicacion && ctx.mapa) { ctx.mapa.mapa.flyTo(ctx.ubicacion, 16, { duration: 0.8 }); } else { ctx.centrarProximo = true; }
            }
        }
        ctx.localizar = localizar;
        localizar(false);

        var chip = MB.$('#chip-clima');
        MB.clima().then(function (d) {
            var r = MB.resumenClima(d);
            ctx.clima = r;
            chip.querySelector('.emoji').textContent = r.emoji;
            MB.$('#clima-temp').textContent = r.temp + '°';
            MB.$('#clima-nota').textContent = r.lluviaProxima >= 50 ? 'Lluvia probable' : r.texto;
            chip.addEventListener('click', function () { detalleClima(r); });
        }).catch(function () { chip.classList.add('oculto'); });

        function detalleClima(r) {
            var horas = r.proximas.map(function (p) {
                var i = MB.infoClima(p.codigo);
                return '<div class="hora"><small>' + p.hora + '</small><span>' + i[0] + '</span><b>' + Math.round(p.temp) + '°</b><small>' + p.lluvia + '%</small></div>';
            }).join('');
            var recomendacion = r.lluviaProxima >= 60 ? 'Es probable que llueva pronto. Lleva paraguas y espera en una parada techada.' : r.temp >= 33 ? 'Hace mucho calor. Hidrátate mientras esperas tu bus.' : 'Buen momento para viajar.';
            MB.modal({ titulo: r.emoji + ' ' + r.temp + '° · ' + r.texto, sub: (MB.cfg.ciudad || 'Tu ciudad') + ' · sensación ' + r.sensacion + '° · humedad ' + r.humedad + '% · viento ' + r.viento + ' km/h', cuerpo: '<div class="horas">' + horas + '</div><p class="insight">' + MB.esc(recomendacion) + '</p>', botones: [{ texto: 'Cerrar', valor: null }] });
        }

        function mostrarReposo(mostrar, texto) {
            var pr = MB.$('#panel-reposo');
            if (!pr) { return; }
            pr.classList.toggle('oculto', !mostrar);
            if (texto) { MB.$('#texto-reposo').textContent = texto; }
        }
        ctx.reposo = mostrarReposo;

        var reint = MB.$('#boton-reintentar');
        if (reint) { reint.addEventListener('click', function () { comprobarEstado(); }); }
        function comprobarEstado() {
            return MB.get('publico/estado').then(function (e) {
                ctx.enServicio = e.en_servicio;
                if (modulo === 'bus') { mostrarReposo(!e.en_servicio, 'El servicio de buses funciona de ' + e.apertura + ' a ' + e.cierre + '.'); }
                return e;
            }).catch(function () {});
        }
        ctx.estado = comprobarEstado;

        function cargarAnuncio() {
            MB.get('publico/anuncio', { modulo: modulo }).then(function (r) {
                var cont = MB.$('#contenedor-anuncio');
                cont.innerHTML = '';
                var a = r.anuncio;
                if (!a) { return; }
                var media = '';
                if (a.media) { media = a.tipo_media === 'video' ? '<video src="' + MB.esc(a.media) + '" autoplay muted loop playsinline></video>' : '<img src="' + MB.esc(a.media) + '" alt="" loading="lazy">'; }
                var tel = a.telefono ? '<a class="boton pequeno" href="tel:' + MB.esc(a.telefono) + '">' + MB.ico('telefono', 'p') + ' Llamar</a>' : '';
                var tarjeta = MB.h('div', { clase: 'tarjeta-anuncio cristal', html: media + '<div class="crece"><small>PUBLICIDAD</small><h4>' + MB.esc(a.negocio) + '</h4><p class="suave pequeno">' + MB.esc(a.texto || '') + '</p>' + tel + '</div>' });
                var contado = false;
                tarjeta.addEventListener('click', function (e) {
                    if (e.target.closest('.cerrar') || contado) { return; }
                    contado = true;
                    MB.post('publico/anuncio/clic', { id: a.id }, { silencioso: true }).catch(function () {});
                });
                var cerrar = MB.h('button', { clase: 'cerrar', type: 'button', 'aria-label': 'Cerrar', html: MB.ico('x', 'p') });
                cerrar.addEventListener('click', function () { tarjeta.remove(); });
                tarjeta.appendChild(cerrar);
                cont.appendChild(tarjeta);
                fijarHoja(estadoHoja);
                setTimeout(function () { tarjeta.style.transition = 'opacity .4s'; tarjeta.style.opacity = '0'; setTimeout(function () { tarjeta.remove(); }, 450); }, 20000);
            }).catch(function () {});
        }
        setTimeout(cargarAnuncio, 2500);
        setInterval(cargarAnuncio, 75000);

        ctx.formOpinion = function (contenedor) {
            var nota = 0;
            var estrellas = MB.h('div', { clase: 'estrellas' });
            var botones = [];
            for (var i = 1; i <= 5; i++) {
                (function (n) {
                    var b = MB.h('button', { type: 'button', 'aria-label': n + ' estrellas', html: MB.ico('estrella').replace('class="ico ', 'class="ico ') });
                    b.addEventListener('click', function () { nota = n; botones.forEach(function (x, k) { x.classList.toggle('on', k < n); }); });
                    botones.push(b);
                    estrellas.appendChild(b);
                })(i);
            }
            var texto = MB.h('textarea', { maxlength: '600', placeholder: 'Cuéntanos tu experiencia…', rows: '4' });
            var nombre = MB.h('input', { type: 'text', maxlength: '60', placeholder: 'Tu nombre (opcional)', value: MB.cfg.nombre || '' });
            var listaBuses = ctx.busesOpinion ? ctx.busesOpinion() : [];
            var selBus = null;
            if (modulo === 'bus' && listaBuses.length) {
                selBus = MB.h('select', { 'aria-label': 'Bus sobre el que opinas' });
                selBus.innerHTML = '<option value="">Opinión general (sin elegir bus)</option>' + listaBuses.map(function (b) { return '<option value="' + b.id + '">' + MB.esc(b.nombre) + '</option>'; }).join('');
            }
            var enviar = MB.h('button', { type: 'button', clase: 'boton primario bloque', texto: 'Enviar opinión' });
            enviar.addEventListener('click', function () {
                if (texto.value.trim().length < 3) { MB.toast('Escribe un comentario', 'mal'); return; }
                MB.conPromesa(enviar, function () {
                    return MB.post('publico/resena', { comentario: texto.value.trim(), nombre: nombre.value.trim(), calificacion: nota || null, modulo: modulo, bus_id: selBus ? selBus.value : '' }).then(function (r) { MB.toast(r.mensaje, 'ok'); texto.value = ''; nota = 0; botones.forEach(function (x) { x.classList.remove('on'); }); });
                }).catch(function (e) { MB.toast(e.message, 'mal'); });
            });
            contenedor.innerHTML = '';
            contenedor.appendChild(MB.h('h3', { texto: '¿Cómo fue tu viaje?' }));
            if (selBus) { contenedor.appendChild(MB.h('div', { clase: 'campo' }, selBus)); }
            contenedor.appendChild(MB.h('div', { clase: 'campo' }, estrellas));
            contenedor.appendChild(MB.h('div', { clase: 'campo' }, texto));
            contenedor.appendChild(MB.h('div', { clase: 'campo' }, nombre));
            contenedor.appendChild(enviar);
        };

        MB.post('publico/acceso').catch(function () {});
        comprobarEstado();
        return ctx;
    }

    window.MBP = { iniciar: iniciar };
})();
