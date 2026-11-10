<?php
final class Cuenta
{
    private static function tabla()
    {
        return Sesion::rol() === 'cooperativa' ? 'cooperativas' : 'usuarios';
    }

    private static function fila()
    {
        $fila = BD::uno('SELECT * FROM ' . self::tabla() . ' WHERE id = ?', array(Sesion::uid()));
        if (!$fila) {
            throw new ErrorApi('Cuenta no encontrada', 404);
        }
        return $fila;
    }

    public static function perfil()
    {
        $f = self::fila();
        return array('perfil' => array(
            'id' => (int) $f['id'],
            'nombre' => $f['nombre'],
            'correo' => $f['correo'],
            'rol' => Sesion::rol(),
            'foto' => isset($f['foto_perfil']) && $f['foto_perfil'] ? url('/assets/img/perfiles/' . $f['foto_perfil']) : null,
            'dos_factores' => isset($f['totp_activo']) ? (int) $f['totp_activo'] === 1 : false,
            'dos_factores_disponible' => Sesion::rol() !== 'cooperativa',
            'ultimo_acceso' => $f['ultimo_acceso'],
            'ultima_ip' => isset($f['ultima_ip']) ? $f['ultima_ip'] : null,
            'fecha_creacion' => $f['fecha_creacion'],
        ));
    }

    public static function nombre()
    {
        $nombre = Req::texto('nombre', 80, true, 'El nombre');
        BD::actualizar(self::tabla(), array('nombre' => $nombre), 'id = ?', array(Sesion::uid()));
        Sesion::poner('nombre', $nombre);
        return array('nombre' => $nombre);
    }

    public static function foto()
    {
        if (Sesion::rol() === 'cooperativa') {
            throw new ErrorApi('Las cooperativas no tienen foto de perfil', 422);
        }
        $actual = self::fila();
        $nombre = Imagen::guardar('foto', 'perfiles', 'usuario_' . Sesion::uid(), 512);
        BD::actualizar('usuarios', array('foto_perfil' => $nombre), 'id = ?', array(Sesion::uid()));
        if ($actual['foto_perfil']) {
            Imagen::borrar('perfiles', $actual['foto_perfil']);
        }
        return array('foto' => url('/assets/img/perfiles/' . $nombre));
    }

    public static function contrasena()
    {
        $f = self::fila();
        $actual = (string) Req::crudo('actual', '');
        $nueva = (string) Req::crudo('nueva', '');

        if (!Seg::limitar('cambio_clave:' . Sesion::uid(), 6, 600)) {
            throw new ErrorApi('Demasiados intentos. Espera unos minutos.', 429);
        }

        if (!Clave::verificar($actual, $f['contrasena'])) {
            Seg::registrar('cambio_contrasena', 'Contraseña actual incorrecta', false, 'cuenta/contrasena');
            throw new ErrorApi('La contraseña actual no es correcta', 422);
        }

        if (hash_equals($actual, $nueva)) {
            throw new ErrorApi('La nueva contraseña debe ser distinta a la actual', 422);
        }

        Clave::validar($nueva, $f['correo']);

        if (self::tabla() === 'usuarios') {
            BD::insertar('historial_contrasenas', array('usuario_id' => $f['id'], 'contrasena_anterior' => $f['contrasena'], 'fecha_cambio' => ahora()));
        }

        $version = (int) $f['sesion_version'] + 1;
        $datos = array('contrasena' => Clave::hash($nueva), 'debe_cambiar_contrasena' => 0, 'sesion_version' => $version);
        if (self::tabla() === 'usuarios') {
            $datos['contrasena_cambiada'] = ahora();
        }
        BD::actualizar(self::tabla(), $datos, 'id = ?', array($f['id']));
        Sesion::poner('ver', $version);
        Sesion::poner('debe_cambiar', 0);
        session_regenerate_id(true);
        Seg::registrar('cambio_contrasena', 'Contraseña actualizada', true, 'cuenta/contrasena');

        return array('destino' => url('/' . Sesion::rol()));
    }

    public static function cerrarOtras()
    {
        $f = self::fila();
        $version = (int) $f['sesion_version'] + 1;
        BD::actualizar(self::tabla(), array('sesion_version' => $version), 'id = ?', array($f['id']));
        Sesion::poner('ver', $version);
        Seg::registrar('cerrar_otras', 'Otras sesiones cerradas', true, 'cuenta/cerrar-otras');
        return array();
    }

    private static function soloUsuarios()
    {
        if (Sesion::rol() === 'cooperativa') {
            throw new ErrorApi('La verificación en dos pasos no está disponible para cooperativas', 422);
        }
    }

    public static function dosFactorIniciar()
    {
        self::soloUsuarios();
        $f = self::fila();

        if ((int) $f['totp_activo'] === 1) {
            throw new ErrorApi('La verificación en dos pasos ya está activa', 422);
        }

        $secreto = Totp::generarSecreto();
        BD::actualizar('usuarios', array('totp_secreto' => $secreto), 'id = ?', array($f['id']));
        $uri = Totp::uri($secreto, $f['correo']);

        return array('secreto' => $secreto, 'uri' => $uri, 'qr' => Qr::svg($uri, 'M'));
    }

    public static function dosFactorActivar()
    {
        self::soloUsuarios();
        $f = self::fila();

        if (!$f['totp_secreto'] || !Totp::verificar($f['totp_secreto'], Req::texto('codigo', 10))) {
            throw new ErrorApi('El código no coincide. Revisa la hora de tu teléfono.', 422);
        }

        BD::actualizar('usuarios', array('totp_activo' => 1), 'id = ?', array($f['id']));
        BD::ejecutar('DELETE FROM codigos_recuperacion WHERE usuario_id = ?', array($f['id']));
        $codigos = array();
        for ($i = 0; $i < 8; $i++) {
            $codigo = Seg::aleatorio(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') . Seg::aleatorio(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
            $codigos[] = $codigo;
            BD::insertar('codigos_recuperacion', array('usuario_id' => $f['id'], 'codigo_hash' => hash('sha256', $codigo)));
        }
        Seg::registrar('2fa', 'Verificación en dos pasos activada', true, 'cuenta/2fa/activar');

        return array('recuperacion' => $codigos);
    }

    public static function dosFactorDesactivar()
    {
        self::soloUsuarios();
        $f = self::fila();

        if (!Clave::verificar((string) Req::crudo('contrasena', ''), $f['contrasena']) || !Totp::verificar((string) $f['totp_secreto'], Req::texto('codigo', 10))) {
            throw new ErrorApi('Contraseña o código incorrectos', 422);
        }

        BD::actualizar('usuarios', array('totp_activo' => 0, 'totp_secreto' => null), 'id = ?', array($f['id']));
        BD::ejecutar('DELETE FROM codigos_recuperacion WHERE usuario_id = ?', array($f['id']));
        Seg::registrar('2fa', 'Verificación en dos pasos desactivada', true, 'cuenta/2fa/desactivar');
        return array();
    }
}
