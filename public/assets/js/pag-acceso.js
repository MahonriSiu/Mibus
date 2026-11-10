(function () {
    'use strict';
    var MB = window.MB;
    var rol = MB.cfg.acceso || 'admin';
    var form = MB.$('#formulario-acceso');
    var ticket = null;
    var rotulo = MB.$('#rotulo-acceso'), lema = MB.$('#lema-acceso'), titulo = MB.$('#titulo-acceso');
    if (rotulo) { rotulo.textContent = MB.cfg.etiqueta || ''; }
    if (lema) { lema.textContent = MB.cfg.lema || ''; }
    if (titulo) { titulo.textContent = 'Acceso · ' + (MB.cfg.etiqueta || ''); }

    function ir(destino) { location.href = destino || MB.url('/' + rol); }

    function mostrar2fa() {
        MB.$('#paso-clave').classList.add('oculto');
        MB.$('#paso-2fa').classList.remove('oculto');
        MB.$('#codigo2fa').focus();
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (ticket) {
            var codigo = MB.$('#codigo2fa').value.trim();
            if (codigo.length < 6) { MB.toast('Escribe el código', 'mal'); return; }
            MB.conPromesa(MB.$('#boton-2fa'), function () {
                return MB.post('auth/2fa', { ticket: ticket, codigo: codigo }).then(function (res) {
                    if (res.csrf) { MB.setCsrf(res.csrf); }
                    ir(res.destino);
                });
            }).catch(function (err) { MB.toast(err.message, 'mal'); MB.$('#codigo2fa').select(); });
            return;
        }
        var correo = MB.$('#correo').value.trim();
        var clave = MB.$('#contrasena').value;
        if (!correo || !clave) { MB.toast('Completa tu correo y contraseña', 'mal'); return; }
        MB.conPromesa(MB.$('#boton-acceso'), function () {
            return MB.post('auth/login', { rol: rol, correo: correo, contrasena: clave }).then(function (res) {
                if (res.csrf) { MB.setCsrf(res.csrf); }
                if (res.requiere_2fa) { ticket = res.ticket; mostrar2fa(); return; }
                ir(res.destino);
            });
        }).catch(function (err) { MB.toast(err.message, 'mal'); MB.$('#contrasena').value = ''; });
    });

    MB.$('#codigo2fa').addEventListener('input', function (e) {
        var v = e.target.value.replace(/\s/g, '');
        if (/^\d{6}$/.test(v)) { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
    });

    MB.$('#boton-olvide').addEventListener('click', function () {
        MB.formulario({
            titulo: 'Recuperar acceso', sub: 'Escribe tu correo. Si existe una cuenta, avisaremos al administrador para restablecer tu contraseña.',
            campos: [{ nombre: 'correo', etiqueta: 'Correo', tipo: 'email', requerido: true, max: 100, defecto: MB.$('#correo').value }],
            boton: 'Enviar solicitud',
            alGuardar: function (d) { return MB.post('auth/olvide', { correo: d.correo }).then(function (res) { MB.toast(res.mensaje || 'Solicitud enviada', 'ok'); }); }
        });
    });
})();
