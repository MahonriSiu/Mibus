<?php
final class Sesion
{
    private static $iniciada = false;

    public static function nombre()
    {
        return Seg::https() ? '__Host-mibus' : 'mibus_s';
    }

    public static function existeCookie()
    {
        return isset($_COOKIE[self::nombre()]);
    }

    public static function iniciar()
    {
        if (self::$iniciada) {
            return;
        }
        self::$iniciada = true;

        $carpeta = RAIZ . '/storage/sesiones';
        if (is_dir($carpeta) && is_writable($carpeta)) {
            session_save_path($carpeta);
        }

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.sid_length', '48');
        ini_set('session.sid_bits_per_character', '6');
        ini_set('session.gc_maxlifetime', (string) (SEG_DURACION_PASAJERO_DIAS * 86400));
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '200');

        session_name(self::nombre());
        session_set_cookie_params(array(
            'lifetime' => SEG_DURACION_PASAJERO_DIAS * 86400,
            'path' => '/',
            'secure' => Seg::https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ));

        session_start();

        $huella = hash('sha256', Seg::agente());

        if (isset($_SESSION['huella']) && !hash_equals($_SESSION['huella'], $huella)) {
            Seg::registrar('sesion_huella', 'Huella de navegador distinta, sesión destruida', false);
            self::destruir();
            session_start();
        }

        if (!isset($_SESSION['huella'])) {
            $_SESSION['huella'] = $huella;
            $_SESSION['creada'] = time();
        }

        self::validarVigencia();

        if (!isset($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }

        $_SESSION['ultima'] = time();
        Seg::contextoSesion(self::rol(), self::uid());
    }

    private static function validarVigencia()
    {
        if (!isset($_SESSION['rol']) || $_SESSION['rol'] === 'usuario') {
            return;
        }

        $inactivo = isset($_SESSION['ultima']) ? time() - $_SESSION['ultima'] : 0;
        $edad = time() - (isset($_SESSION['entro']) ? $_SESSION['entro'] : time());

        if ($inactivo > SEG_INACTIVIDAD_STAFF_MIN * 60 || $edad > SEG_DURACION_MAX_STAFF_H * 3600) {
            self::limpiarIdentidad();
            return;
        }

        $tabla = $_SESSION['rol'] === 'cooperativa' ? 'cooperativas' : 'usuarios';
        $fila = BD::uno('SELECT sesion_version, cuenta_activa FROM ' . $tabla . ' WHERE id = ?', array((int) $_SESSION['uid']));

        if (!$fila || (int) $fila['cuenta_activa'] !== 1 || (int) $fila['sesion_version'] !== (int) $_SESSION['ver']) {
            self::limpiarIdentidad();
        }
    }

    private static function limpiarIdentidad()
    {
        foreach (array('rol', 'uid', 'ver', 'entro', 'debe_cambiar', 'nombre', 'ciudad_id', 'ultima_2fa') as $clave) {
            unset($_SESSION[$clave]);
        }
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }

    public static function entrar($rol, $uid, $version, $nombre, $debeCambiar = false, $ciudadId = null)
    {
        self::iniciar();
        session_regenerate_id(true);
        $_SESSION['rol'] = $rol;
        $_SESSION['uid'] = (int) $uid;
        $_SESSION['ver'] = (int) $version;
        $_SESSION['nombre'] = $nombre;
        $_SESSION['entro'] = time();
        $_SESSION['ultima'] = time();
        $_SESSION['debe_cambiar'] = $debeCambiar ? 1 : 0;
        $_SESSION['ciudad_id'] = $ciudadId;
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        Seg::contextoSesion($rol, (int) $uid);
    }

    public static function destruir()
    {
        $_SESSION = array();
        if (ini_get('session.use_cookies')) {
            setcookie(self::nombre(), '', time() - 3600, '/', '', Seg::https(), true);
        }
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    public static function rol()
    {
        return isset($_SESSION['rol']) ? $_SESSION['rol'] : null;
    }

    public static function uid()
    {
        return isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : null;
    }

    public static function csrf()
    {
        return isset($_SESSION['csrf']) ? $_SESSION['csrf'] : '';
    }

    public static function dato($clave, $defecto = null)
    {
        return isset($_SESSION[$clave]) ? $_SESSION[$clave] : $defecto;
    }

    public static function poner($clave, $valor)
    {
        $_SESSION[$clave] = $valor;
    }

    public static function esStaff()
    {
        return in_array(self::rol(), array('admin', 'auditor', 'propietario', 'cooperativa'), true);
    }
}
