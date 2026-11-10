(function () {
    'use strict';
    var MB = window.MB;
    var cont = MB.$('#punto-contenido');

    MB.get('publico/punto', { id: MB.cfg.puntoId }).then(function (r) {
        var p = r.punto;
        var medios = p.galeria.map(function (u) { return { tipo: 'img', u: u }; });
        if (p.video) { medios.push({ tipo: 'video', u: p.video }); }
        var indice = 0;
        var galeria = MB.h('div', { clase: 'galeria' });
        var cuenta = MB.h('span', { clase: 'cuenta' });
        function pintar() {
            galeria.querySelectorAll('img,video').forEach(function (n) { n.remove(); });
            if (!medios.length) { galeria.insertBefore(MB.h('div', { clase: 'vacio', html: MB.ico('imagen') + '<p>Sin imágenes</p>' }), cuenta); cuenta.textContent = ''; return; }
            var m = medios[indice];
            var el = m.tipo === 'video' ? MB.h('video', { src: m.u, controls: true, playsinline: true, preload: 'metadata' }) : MB.h('img', { src: m.u, alt: p.nombre, loading: 'lazy' });
            galeria.insertBefore(el, galeria.firstChild);
            cuenta.textContent = (indice + 1) + ' / ' + medios.length;
        }
        function mover(d) { indice = (indice + d + medios.length) % medios.length; pintar(); }
        var izq = MB.h('button', { clase: 'boton icono nav izq', type: 'button', 'aria-label': 'Anterior', html: MB.ico('izq') });
        var der = MB.h('button', { clase: 'boton icono nav der', type: 'button', 'aria-label': 'Siguiente', html: MB.ico('der') });
        izq.addEventListener('click', function () { mover(-1); });
        der.addEventListener('click', function () { mover(1); });
        galeria.appendChild(cuenta);
        if (medios.length > 1) { galeria.appendChild(izq); galeria.appendChild(der); }
        var xInicio = null;
        galeria.addEventListener('touchstart', function (e) { xInicio = e.touches[0].clientX; }, { passive: true });
        galeria.addEventListener('touchend', function (e) { if (xInicio === null || medios.length < 2) { return; } var dx = e.changedTouches[0].clientX - xInicio; if (Math.abs(dx) > 40) { mover(dx < 0 ? 1 : -1); } xInicio = null; });
        pintar();
        document.title = p.nombre + ' · MiBus';
        cont.innerHTML = '';
        cont.appendChild(galeria);
        cont.appendChild(MB.h('div', { clase: 'tarjeta separar', html: '<span class="pastilla" style="color:' + MB.esc(p.color || '#ff8a3d') + '">' + MB.esc(p.evento) + '</span><h2 style="margin:10px 0 6px">' + MB.esc(p.nombre) + '</h2><p class="suave" style="white-space:pre-line">' + MB.esc(p.descripcion || '') + '</p>' }));
        var ir = MB.h('a', { clase: 'boton primario bloque separar', target: '_blank', rel: 'noopener', href: 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng, html: MB.ico('navegar') + ' Cómo llegar' });
        cont.appendChild(ir);
    }).catch(function (e) {
        cont.innerHTML = '<div class="vacio">' + MB.ico('alerta') + '<p>' + MB.esc(e.message) + '</p><a class="boton" href="' + MB.url('/mapa') + '">Volver al mapa</a></div>';
    });
})();
