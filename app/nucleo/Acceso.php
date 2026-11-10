<?php
final class Acceso
{
    public static function exigir($regla)
    {
        if ($regla === 'publico') {
            return null;
        }

        if ($regla === 'emisor' || $regla === 'camion') {
            return self::token($regla);
        }

        $rol = Sesion::rol();

        if ($regla === 'pasajero') {
            if ($rol === null) {
                throw new ErrorApi('Debes ingresar primero', 401);
            }
            return null;
        }

        if ($rol === null || $rol === 'usuario') {
            throw new ErrorApi('Inicia sesión para continuar', 401);
        }

        if ($regla !== 'staff' && !in_array($rol, explode(',', $regla), true)) {
            Seg::registrar('acceso_denegado', 'Rol ' . $rol . ' intentó ' . $regla, false);
            throw new ErrorApi('No tienes permiso para esta acción', 403);
        }

        if ($rol === 'admin' && !self::ipAdminPermitida()) {
            throw new ErrorApi('Tu dirección IP no está autorizada', 403);
        }

        if (Sesion::dato('debe_cambiar') && strpos(isset($_GET['ruta']) ? $_GET['ruta'] : '', 'cuenta/') === false) {
            throw new ErrorApi('Debes cambiar tu contraseña primero', 403, array('cambiar_contrasena' => true));
        }

        return null;
    }

    public static function ipAdminPermitida()
    {
        $permitidas = SEG_ADMIN_IPS_PERMITIDAS;
        return !is_array($permitidas) || count($permitidas) === 0 || in_array(Seg::ip(), $permitidas, true);
    }

    private static function token($tipo)
    {
        $cabecera = Req::cabecera('Authorization');
        $token = stripos($cabecera, 'Bearer ') === 0 ? trim(substr($cabecera, 7)) : '';
        $datos = Seg::verificar($token);

        if (!$datos || !isset($datos['t']) || $datos['t'] !== $tipo) {
            throw new ErrorApi('Sesión del dispositivo no válida', 401, array('reingresar' => true));
        }

        $tabla = $tipo === 'emisor' ? 'emisores' : 'emisores_camion';
        $fila = BD::uno('SELECT id, version FROM ' . $tabla . ' WHERE id = ?', array((int) $datos['e']));

        if (!$fila || (int) $fila['version'] !== (int) $datos['v']) {
            throw new ErrorApi('El código de acceso fue renovado. Ingresa de nuevo.', 401, array('reingresar' => true));
        }

        if (!Seg::limitar('emisor:' . $tipo . ':' . $datos['e'], 40, 60)) {
            throw new ErrorApi('Demasiadas actualizaciones', 429);
        }

        return $datos;
    }
}
