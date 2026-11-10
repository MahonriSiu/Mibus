(function () {
    'use strict';

    var cfg = {};
    try { cfg = JSON.parse(document.getElementById('mb-config').textContent); } catch (e) {}

    var ICONOS = {
        bus: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M3 11h18M7 17v2M17 17v2"/><circle cx="7.5" cy="14" r=".6"/><circle cx="16.5" cy="14" r=".6"/>',
        mapa: '<path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/>',
        pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
        usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6"/>',
        escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
        candado: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
        llave: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
        campana: '<path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
        estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
        grafica: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-5 3 3 5-7"/>',
        pulso: '<path d="M3 12h4l2.5-7 5 14 2.5-7H21"/>',
        ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        mas: '<path d="M12 5v14M5 12h14"/>',
        basura: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        editar: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
        ok: '<path d="m5 12.5 4.5 4.5L19 7"/>',
        x: '<path d="M6 6l12 12M18 6 6 18"/>',
        alerta: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
        bateria: '<rect x="2.5" y="8" width="17" height="9" rx="2.5"/><path d="M22 11v3"/><path d="M6 11.5v2"/>',
        ruta: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
        camion: '<path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
        reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
        descargar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
        qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2v2h-2zM18.5 14.5h2M14.5 18.5h2M18.5 18.5v2h-2"/>',
        imagen: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
        video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
        calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        edificio: '<path d="M4 21V5l8-2.5L20 5v16M2 21h20M9 9h2M13 9h2M9 13h2M13 13h2M9 17h6"/>',
        destello: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
        actualizar: '<path d="M20 11a8 8 0 0 0-14.5-3.5L3 10M4 13a8 8 0 0 0 14.5 3.5L21 14M3 4v6h6M21 20v-6h-6"/>',
        ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
        correo: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7 8.5 6 8.5-6"/>',
        capas: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
        mira: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
        navegar: '<path d="m4 11 17-7-7 17-2.5-7.5z"/>',
        inicio: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
        lista: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
        filtro: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
        sos: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>',
        nube: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z"/>',
        lluvia: '<path d="M7 15a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 6.5 4.3 4.3 0 0 1 17.5 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
        viento: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/>',
        tierra: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
        pantalla: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/>',
        circulo: '<circle cx="12" cy="12" r="8"/>',
        flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        izq: '<path d="m15 5-7 7 7 7"/>',
        der: '<path d="m9 5 7 7-7 7"/>',
        copiar: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
        mecanico: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 12.5 12.5 21 3 11.5 11.5 3z" transform="scale(.8) translate(3 2)"/>',
        medica: '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="5"/>',
        robo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6z"/><path d="M12 8v4M12 15v.01"/>'
    };

    function ico(nombre, clase) {
        return '<svg class="ico ' + (clase || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONOS[nombre] || ICONOS.circulo) + '</svg>';
    }

    function esc(t) {
        return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function $(sel, raiz) { return (raiz || document).querySelector(sel); }
    function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

    function h(tag, attrs) {
        var el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                var v = attrs[k];
                if (v === null || v === undefined || v === false) { return; }
                if (k === 'clase') { el.className = v; }
                else if (k === 'html') { el.innerHTML = v; }
                else if (k === 'texto') { el.textContent = v; }
                else if (k.indexOf('on') === 0 && typeof v === 'function') { el.addEventListener(k.slice(2), v); }
                else if (k === 'datos') { Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; }); }
                else { el.setAttribute(k, v === true ? '' : v); }
            });
        }
        for (var i = 2; i < arguments.length; i++) {
            var hijo = arguments[i];
            if (hijo === null || hijo === undefined || hijo === false) { continue; }
            el.appendChild(typeof hijo === 'string' || typeof hijo === 'number' ? document.createTextNode(hijo) : hijo);
        }
        return el;
    }

    function url(ruta) { return (cfg.base || '') + ruta; }

    var csrf = cfg.csrf || '';
    var reintentoCsrf = false;

    async function api(metodo, ruta, datos, opciones) {
        opciones = opciones || {};
        var cabeceras = { 'X-CSRF-Token': csrf, 'Accept': 'application/json' };
        var cuerpo;
        var direccion = url('/api/' + ruta);

        if (metodo === 'GET' && datos) {
            var qs = new URLSearchParams();
            Object.keys(datos).forEach(function (k) { if (datos[k] !== null && datos[k] !== undefined) { qs.set(k, datos[k]); } });
            direccion += (direccion.indexOf('?') >= 0 ? '&' : '?') + qs.toString();
        } else if (datos instanceof FormData) {
            cuerpo = datos;
        } else if (datos) {
            cabeceras['Content-Type'] = 'application/json';
            cuerpo = JSON.stringify(datos);
        }

        if (opciones.token) { cabeceras['Authorization'] = 'Bearer ' + opciones.token; }

        var control = new AbortController();
        var limite = setTimeout(function () { control.abort(); }, opciones.timeout || 20000);
        var respuesta;

        try {
            respuesta = await fetch(direccion, { method: metodo, headers: cabeceras, body: cuerpo, credentials: 'same-origin', signal: control.signal, cache: 'no-store' });
        } catch (e) {
            clearTimeout(limite);
            var err = new Error(e.name === 'AbortError' ? 'La conexión tardó demasiado' : 'Sin conexión con el servidor');
            err.red = true;
            throw err;
        }
        clearTimeout(limite);

        var tipo = respuesta.headers.get('content-type') || '';
        if (tipo.indexOf('application/json') < 0) {
            var e2 = new Error('Respuesta inesperada del servidor');
            e2.estado = respuesta.status;
            throw e2;
        }

        var json = await respuesta.json();

        if (json.ok === false) {
            if (json.csrf && !reintentoCsrf) {
                reintentoCsrf = true;
                try {
                    var s = await api('GET', 'sesion');
                    csrf = s.csrf;
                    var r = await api(metodo, ruta, datos, opciones);
                    reintentoCsrf = false;
                    return r;
                } catch (e3) { reintentoCsrf = false; throw e3; }
            }
            var e4 = new Error(json.error || 'Ocurrió un error');
            e4.estado = respuesta.status;
            e4.datos = json;
            if (respuesta.status === 401 && !opciones.silencioso && !opciones.token && cfg.rol && cfg.rol !== 'usuario') {
                location.href = url('/' + cfg.rol + '/login');
            }
            throw e4;
        }

        return json;
    }

    function formatoHora(seg) {
        if (seg === null || seg === undefined) { return 'sin datos'; }
        if (seg < 10) { return 'ahora'; }
        if (seg < 60) { return 'hace ' + Math.round(seg) + ' s'; }
        if (seg < 3600) { return 'hace ' + Math.round(seg / 60) + ' min'; }
        if (seg < 86400) { return 'hace ' + Math.round(seg / 3600) + ' h'; }
        return 'hace ' + Math.round(seg / 86400) + ' d';
    }

    function fechaCorta(texto) {
        if (!texto) { return '—'; }
        var d = new Date(String(texto).replace(' ', 'T'));
        if (isNaN(d)) { return texto; }
        var ahora = new Date();
        var mismoDia = d.toDateString() === ahora.toDateString();
        var hora = d.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
        if (mismoDia) { return 'Hoy ' + hora; }
        return d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short' }) + ' ' + hora;
    }

    function numero(n, dec) {
        return Number(n || 0).toLocaleString('es-NI', { maximumFractionDigits: dec === undefined ? 0 : dec, minimumFractionDigits: dec || 0 });
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var a = arguments, c = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(c, a); }, ms || 250);
        };
    }

    var contToasts = null;
    function toast(mensaje, tipo, ms) {
        if (!contToasts) {
            contToasts = h('div', { clase: 'toasts', role: 'status', 'aria-live': 'polite' });
            document.body.appendChild(contToasts);
        }
        var el = h('div', { clase: 'toast ' + (tipo || 'info') }, h('span', { html: ico(tipo === 'ok' ? 'ok' : tipo === 'mal' ? 'alerta' : 'campana') }), h('span', { texto: mensaje }));
        contToasts.appendChild(el);
        setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 320); }, ms || 3800);
    }

    function modal(opc) {
        return new Promise(function (resolver) {
            var fondo = h('div', { clase: 'fondo-modal ' + (opc.clase || ''), role: 'dialog', 'aria-modal': 'true' });
            var caja = h('div', { clase: 'modal' + (opc.ancho ? ' ancho' : '') });
            var cerrado = false;
            function cerrar(valor) {
                if (cerrado) { return; }
                cerrado = true;
                fondo.classList.remove('visible');
                document.removeEventListener('keydown', teclas);
                setTimeout(function () { fondo.remove(); }, 220);
                resolver(valor);
            }
            function teclas(e) { if (e.key === 'Escape' && !opc.obligatorio) { cerrar(null); } }
            if (opc.titulo) { caja.appendChild(h('h2', { texto: opc.titulo })); }
            if (opc.sub) { caja.appendChild(h('p', { clase: 'sub', texto: opc.sub })); }
            if (opc.cuerpo) { caja.appendChild(typeof opc.cuerpo === 'string' ? h('div', { html: opc.cuerpo }) : opc.cuerpo); }
            var pie = h('div', { clase: 'pie' });
            (opc.botones || []).forEach(function (b) {
                var boton = h('button', { type: 'button', clase: 'boton ' + (b.clase || ''), html: b.html || esc(b.texto) });
                boton.addEventListener('click', async function () {
                    if (b.alPulsar) {
                        boton.classList.add('cargando');
                        try {
                            var r = await b.alPulsar(caja, cerrar);
                            if (r === false) { boton.classList.remove('cargando'); return; }
                            cerrar(r === undefined ? b.valor : r);
                        } catch (e) {
                            boton.classList.remove('cargando');
                            toast(e.message, 'mal');
                        }
                    } else {
                        cerrar(b.valor);
                    }
                });
                pie.appendChild(boton);
            });
            if (pie.children.length) { caja.appendChild(pie); }
            fondo.appendChild(caja);
            if (!opc.obligatorio) { fondo.addEventListener('mousedown', function (e) { if (e.target === fondo) { cerrar(null); } }); }
            document.addEventListener('keydown', teclas);
            document.body.appendChild(fondo);
            requestAnimationFrame(function () { fondo.classList.add('visible'); var p = caja.querySelector('input,select,textarea'); if (p && !opc.sinFoco) { p.focus(); } });
            if (opc.alAbrir) { opc.alAbrir(caja, cerrar); }
        });
    }

    function confirmar(titulo, sub, textoBoton, peligro) {
        return modal({ titulo: titulo, sub: sub, botones: [{ texto: 'Cancelar', valor: false }, { texto: textoBoton || 'Confirmar', clase: peligro ? 'peligro' : 'primario', valor: true }] }).then(function (v) { return v === true; });
    }

    function campoHtml(c, valor) {
        var id = 'f-' + c.nombre;
        var v = valor === undefined || valor === null ? (c.defecto === undefined ? '' : c.defecto) : valor;
        var etiqueta = '<label for="' + id + '">' + esc(c.etiqueta) + '</label>';
        var ayuda = c.ayuda ? '<span class="ayuda">' + esc(c.ayuda) + '</span>' : '';
        if (c.tipo === 'select') {
            var ops = (typeof c.opciones === 'function' ? c.opciones() : c.opciones) || [];
            return '<div class="campo">' + etiqueta + '<select id="' + id + '" name="' + c.nombre + '">' + (c.vacio !== undefined ? '<option value="">' + esc(c.vacio) + '</option>' : '') + ops.map(function (o) {
                return '<option value="' + esc(o.valor) + '"' + (String(o.valor) === String(v) ? ' selected' : '') + '>' + esc(o.texto) + '</option>';
            }).join('') + '</select>' + ayuda + '</div>';
        }
        if (c.tipo === 'textarea') {
            return '<div class="campo">' + etiqueta + '<textarea id="' + id + '" name="' + c.nombre + '" maxlength="' + (c.max || 600) + '">' + esc(v) + '</textarea>' + ayuda + '</div>';
        }
        if (c.tipo === 'check') {
            return '<div class="campo"><div class="fila-entre"><label for="' + id + '">' + esc(c.etiqueta) + '</label><label class="conmutador"><input type="checkbox" id="' + id + '" name="' + c.nombre + '"' + (Number(v) === 1 || v === true ? ' checked' : '') + '><span></span></label></div>' + ayuda + '</div>';
        }
        return '<div class="campo">' + etiqueta + '<input id="' + id + '" name="' + c.nombre + '" type="' + (c.tipo || 'text') + '" value="' + esc(v) + '"' + (c.max ? ' maxlength="' + c.max + '"' : '') + (c.requerido ? ' required' : '') + (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : '') + (c.autocompletar ? ' autocomplete="' + c.autocompletar + '"' : '') + (c.accept ? ' accept="' + c.accept + '"' : '') + '>' + ayuda + '</div>';
    }

    function formulario(opc) {
        var datos = opc.datos || {};
        var html = '';
        var fila = [];
        opc.campos.forEach(function (c) {
            var bloque = campoHtml(c, datos[c.nombre]);
            if (c.mitad) { fila.push(bloque); if (fila.length === 2) { html += '<div class="dos-col">' + fila.join('') + '</div>'; fila = []; } }
            else { if (fila.length) { html += '<div class="dos-col">' + fila.join('') + '</div>'; fila = []; } html += bloque; }
        });
        if (fila.length) { html += '<div class="dos-col">' + fila.join('') + '</div>'; }
        var cuerpo = h('form', { html: html, novalidate: true });
        cuerpo.addEventListener('submit', function (e) { e.preventDefault(); });
        return modal({
            titulo: opc.titulo, sub: opc.sub, cuerpo: cuerpo, ancho: opc.ancho,
            botones: [{ texto: 'Cancelar', valor: null }, {
                texto: opc.boton || 'Guardar', clase: 'primario',
                alPulsar: async function (caja) {
                    var salida = {};
                    opc.campos.forEach(function (c) {
                        var el = caja.querySelector('[name="' + c.nombre + '"]');
                        if (!el) { return; }
                        if (c.tipo === 'check') { salida[c.nombre] = el.checked ? 1 : 0; }
                        else if (c.tipo === 'file') { salida[c.nombre] = el.files && el.files[0] ? el.files[0] : null; }
                        else { salida[c.nombre] = el.value; }
                    });
                    for (var i = 0; i < opc.campos.length; i++) {
                        var c2 = opc.campos[i];
                        if (c2.requerido && (salida[c2.nombre] === '' || salida[c2.nombre] === null)) { throw new Error('Completa: ' + c2.etiqueta); }
                    }
                    var r = await opc.alGuardar(salida);
                    return r === undefined ? true : r;
                }
            }]
        });
    }

    function conPromesa(boton, fn) {
        boton.classList.add('cargando');
        return Promise.resolve().then(fn).finally(function () { boton.classList.remove('cargando'); });
    }

    function tema() {
        var actual = document.documentElement.getAttribute('data-tema') === 'claro' ? 'claro' : 'oscuro';
        var nuevo = actual === 'claro' ? 'oscuro' : 'claro';
        document.documentElement.setAttribute('data-tema', nuevo);
        try { localStorage.setItem('mb-tema', nuevo); } catch (e) {}
        var meta = $('meta[name="theme-color"]');
        if (meta) { meta.setAttribute('content', nuevo === 'claro' ? '#eef5f8' : '#06121a'); }
        document.dispatchEvent(new CustomEvent('mb-tema', { detail: nuevo }));
        pintarBotonesTema();
    }

    function pintarBotonesTema() {
        var claro = document.documentElement.getAttribute('data-tema') === 'claro';
        $$('[data-accion="tema"]').forEach(function (b) { b.innerHTML = ico(claro ? 'luna' : 'sol'); });
    }

    function contar(el, destino, dec) {
        var inicio = parseFloat(el.dataset.v || '0');
        destino = Number(destino) || 0;
        el.dataset.v = destino;
        if (inicio === destino || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = numero(destino, dec); return; }
        var t0 = performance.now();
        var dur = 700;
        function paso(t) {
            var p = Math.min(1, (t - t0) / dur);
            var e = 1 - Math.pow(1 - p, 3);
            el.textContent = numero(inicio + (destino - inicio) * e, dec);
            if (p < 1) { requestAnimationFrame(paso); }
        }
        requestAnimationFrame(paso);
    }

    function sondeo(fn, intervalo, opc) {
        opc = opc || {};
        var activo = true, temporizador = null, fallos = 0, enMarcha = false;
        function siguiente() {
            if (!activo) { return; }
            var base = document.hidden ? (opc.segundoPlano || intervalo * 4) : intervalo;
            var espera = base * Math.pow(1.7, Math.min(fallos, 4));
            temporizador = setTimeout(ejecutar, espera);
        }
        async function ejecutar() {
            if (!activo || enMarcha) { return; }
            if (document.hidden && opc.pausarOculto) { siguiente(); return; }
            enMarcha = true;
            try { await fn(); fallos = 0; } catch (e) { fallos++; }
            enMarcha = false;
            siguiente();
        }
        function visible() { if (!document.hidden && activo) { clearTimeout(temporizador); ejecutar(); } }
        document.addEventListener('visibilitychange', visible);
        ejecutar();
        return { parar: function () { activo = false; clearTimeout(temporizador); document.removeEventListener('visibilitychange', visible); }, ahora: function () { clearTimeout(temporizador); ejecutar(); } };
    }

    var CODIGOS_CLIMA = {
        0: ['☀️', 'Despejado'], 1: ['🌤️', 'Mayormente despejado'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'],
        45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla'], 51: ['🌦️', 'Llovizna'], 53: ['🌦️', 'Llovizna'], 55: ['🌧️', 'Llovizna intensa'],
        61: ['🌧️', 'Lluvia ligera'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia fuerte'], 80: ['🌦️', 'Chubascos'], 81: ['🌧️', 'Chubascos'], 82: ['⛈️', 'Chubascos fuertes'],
        95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta con granizo']
    };

    function infoClima(codigo) { return CODIGOS_CLIMA[codigo] || ['⛅', 'Variable']; }

    function opcionesCiudades(lista, actual) {
        var grupos = {};
        var orden = [];
        lista.forEach(function (c) {
            if (!grupos[c.region]) { grupos[c.region] = []; orden.push(c.region); }
            grupos[c.region].push(c);
        });
        return orden.map(function (r) {
            return '<optgroup label="' + esc(r) + '">' + grupos[r].map(function (c) {
                return '<option value="' + c.id + '"' + (String(c.id) === String(actual) ? ' selected' : '') + '>' + esc(c.nombre) + (c.buses === 0 ? ' · sin buses aún' : '') + '</option>';
            }).join('') + '</optgroup>';
        }).join('');
    }

    async function clima(forzar) {
        var clave = 'mb-clima-' + (cfg.centro ? Number(cfg.centro[0]).toFixed(2) + '_' + Number(cfg.centro[1]).toFixed(2) : 'x');
        try {
            var guardado = JSON.parse(localStorage.getItem(clave) || 'null');
            if (!forzar && guardado && Date.now() - guardado.t < 600000) { return guardado.d; }
        } catch (e) {}
        var c = cfg.centro || [11.9986, -83.7574];
        var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + c[0] + '&longitude=' + c[1] +
            '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
            '&hourly=temperature_2m,precipitation_probability,weather_code&daily=sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=America%2FManagua&forecast_days=2';
        var r = await fetch(u);
        if (!r.ok) { throw new Error('Clima no disponible'); }
        var d = await r.json();
        try { localStorage.setItem(clave, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
        return d;
    }

    function resumenClima(d) {
        var act = d.current;
        var inf = infoClima(act.weather_code);
        var ahoraISO = act.time;
        var idx = d.hourly.time.indexOf(ahoraISO.slice(0, 13) + ':00');
        if (idx < 0) { idx = 0; }
        var proximas = [];
        for (var i = idx; i < Math.min(idx + 12, d.hourly.time.length); i++) {
            proximas.push({ hora: d.hourly.time[i].slice(11, 16), temp: d.hourly.temperature_2m[i], lluvia: d.hourly.precipitation_probability[i] || 0, codigo: d.hourly.weather_code[i] });
        }
        var maxLluvia = proximas.slice(0, 4).reduce(function (m, p) { return Math.max(m, p.lluvia); }, 0);
        return { temp: Math.round(act.temperature_2m), sensacion: Math.round(act.apparent_temperature), humedad: act.relative_humidity_2m, viento: Math.round(act.wind_speed_10m), emoji: inf[0], texto: inf[1], lluviaProxima: maxLluvia, proximas: proximas, amanecer: d.daily.sunrise[0], atardecer: d.daily.sunset[0], uv: d.daily.uv_index_max[0], precipitacion: act.precipitation };
    }

    function esDeNoche(resumen) {
        if (!resumen) { var hh = new Date().getHours(); return hh < 6 || hh >= 18; }
        var ahora = new Date();
        return ahora < new Date(resumen.amanecer) || ahora > new Date(resumen.atardecer);
    }

    function red() {
        var barra = h('div', { clase: 'barra-red', role: 'alert', texto: 'Sin conexión. Mostrando los últimos datos guardados.' });
        document.body.appendChild(barra);
        function estado() { barra.classList.toggle('visible', !navigator.onLine); }
        window.addEventListener('online', function () { estado(); toast('Conexión restablecida', 'ok'); });
        window.addEventListener('offline', estado);
        estado();
    }

    function copiar(texto) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(texto).then(function () { toast('Copiado', 'ok', 1600); });
        }
        var t = h('textarea', { texto: texto });
        document.body.appendChild(t);
        t.select();
        try { document.execCommand('copy'); toast('Copiado', 'ok', 1600); } catch (e) {}
        t.remove();
    }

    function distanciaM(a, b) {
        var R = 6371008.8, rad = Math.PI / 180;
        var dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
        var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    function formatoDistancia(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km'; }

    function iniciar() {
        pintarBotonesTema();
        document.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('[data-accion="tema"]') : null;
            if (b) { tema(); }
        });
        red();
        if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
            navigator.serviceWorker && navigator.serviceWorker.register(url('/sw.js'), { scope: url('/') }).catch(function () {});
        }
    }

    window.MB = {
        cfg: cfg, ico: ico, esc: esc, $: $, $$: $$, h: h, url: url,
        api: api,
        get: function (r, d, o) { return api('GET', r, d, o); },
        post: function (r, d, o) { return api('POST', r, d, o); },
        setCsrf: function (t) { csrf = t; },
        hace: formatoHora, fecha: fechaCorta, num: numero, debounce: debounce,
        toast: toast, modal: modal, confirmar: confirmar, formulario: formulario, conPromesa: conPromesa,
        tema: tema, contar: contar, sondeo: sondeo, clima: clima, resumenClima: resumenClima, infoClima: infoClima, esDeNoche: esDeNoche,
        copiar: copiar, distanciaM: distanciaM, dist: formatoDistancia, pintarTema: pintarBotonesTema, opcionesCiudades: opcionesCiudades
    };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', iniciar); } else { iniciar(); }
})();
