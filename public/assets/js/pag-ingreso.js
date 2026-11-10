(function () {
    'use strict';
    var MB = window.MB;
    var form = MB.$('#formulario-ingreso');
    var selector = MB.$('#ciudad');
    var boton = MB.$('#boton-ingreso');
    var correoUni = MB.$('#correo-uni');

    MB.get('publico/ciudades').then(function (r) {
        var guardada = null;
        try { guardada = localStorage.getItem('mb-ciudad'); } catch (e) {}
        selector.innerHTML = '<option value="">Selecciona tu ciudad</option>' + MB.opcionesCiudades(r.ciudades, guardada);
        if (r.ciudades.length === 1) { selector.value = r.ciudades[0].id; }
        if (guardada && selector.querySelector('option[value="' + guardada + '"]')) { selector.value = guardada; }
    }).catch(function (e) { selector.innerHTML = '<option value="">No se pudo cargar</option>'; MB.toast(e.message, 'mal'); });

    try {
        var n = localStorage.getItem('mb-nombre'), t = localStorage.getItem('mb-telefono'), u = localStorage.getItem('mb-correo-uni');
        if (n) { MB.$('#nombre').value = n; }
        if (t) { MB.$('#telefono').value = t; }
        if (u && correoUni) { correoUni.value = u; }
    } catch (e) {}

    MB.$('#telefono').addEventListener('input', function (e) {
        var d = e.target.value.replace(/\D/g, '').slice(0, 8);
        e.target.value = d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d;
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = MB.$('#nombre').value.trim();
        var tel = MB.$('#telefono').value.replace(/\D/g, '');
        var correo = correoUni ? correoUni.value.trim().toLowerCase() : '';
        if (nombre.length < 2) { MB.toast('Escribe tu nombre', 'mal'); return; }
        if (tel.length !== 8) { MB.toast('El número debe tener 8 dígitos', 'mal'); return; }
        if (!selector.value) { MB.toast('Selecciona tu ciudad', 'mal'); return; }
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { MB.toast('Revisa tu correo universitario', 'mal'); return; }
        MB.conPromesa(boton, function () {
            return MB.post('auth/ingresar', { nombre: nombre, telefono: tel, ciudad_id: selector.value, correo_universitario: correo }).then(function (r) {
                try { localStorage.setItem('mb-nombre', nombre); localStorage.setItem('mb-telefono', MB.$('#telefono').value); localStorage.setItem('mb-ciudad', selector.value); localStorage.setItem('mb-correo-uni', correo); } catch (e2) {}
                if (r.csrf) { MB.setCsrf(r.csrf); }
                location.href = r.destino || MB.url('/mapa');
            });
        }).catch(function (err) { MB.toast(err.message, 'mal'); });
    });
})();
