<?php
final class Aplicacion
{
    public static function ejecutar()
    {
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
        ini_set('error_log', RAIZ . '/storage/logs/php-errores.log');
        error_reporting(E_ALL);

        require_once RAIZ . '/config/app.php';
        date_default_timezone_set(APP_ZONA_HORARIA);

        $ruta = isset($_GET['ruta']) ? $_GET['ruta'] : '';
        $ruta = '/' . trim(rawurldecode($ruta), '/');
        $ruta = preg_replace('#/{2,}#', '/', $ruta);

        if (strpos($ruta, '/public/') === 0) {
            $ruta = substr($ruta, 7);
        }

        $esApi = strpos($ruta, '/api/') === 0;

        set_exception_handler(function ($e) use ($esApi) {
            error_log('excepcion: ' . get_class($e) . ' ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
            if ($esApi) {
                Resp::error('Ocurrió un error interno. Intenta de nuevo.', 500);
            }
            Vista::error(500, 'Error interno');
        });

        Seg::cabeceras();

        if ($ruta === '/robots.txt') {
            header('Content-Type: text/plain; charset=utf-8');
            echo "User-agent: *\nDisallow: /\n";
            exit;
        }

        if (!is_file(RAIZ . '/config/credenciales.php')) {
            if ($esApi) {
                Resp::error('Falta config/credenciales.php', 500);
            }
            Vista::error(500, 'Falta config/credenciales.php');
        }

        require_once RAIZ . '/config/credenciales.php';

        try {
            BD::conectar();
        } catch (Exception $e) {
            error_log('conexion: ' . $e->getMessage());
            if ($esApi) {
                Resp::error('No se pudo conectar a la base de datos', 503);
            }
            Vista::error(503, 'Servicio no disponible');
        }

        if (mt_rand(1, 300) === 1) {
            try {
                Seg::mantenimiento();
            } catch (Exception $e) {
                error_log('mantenimiento: ' . $e->getMessage());
            }
        }

        if (mt_rand(1, 25) === 1) {
            Respaldo::automatico();
        }

        if (Seg::ipBloqueada() && $ruta !== '/api/sesion') {
            if ($esApi) {
                Resp::error('Acceso bloqueado temporalmente por actividad sospechosa.', 429);
            }
            Vista::error(429, 'Acceso bloqueado temporalmente');
        }

        if ($esApi) {
            self::api(substr($ruta, 5));
        }

        Paginas::despachar($ruta);
    }

    private static function api($ruta)
    {
        $metodo = Req::metodo();
        $tabla = require RAIZ . '/config/api.php';
        $clave = $metodo . ' ' . $ruta;

        if (!isset($tabla[$clave])) {
            if (isset($tabla['GET ' . $ruta]) || isset($tabla['POST ' . $ruta])) {
                Resp::error('Método no permitido', 405);
            }
            Resp::error('Servicio no encontrado', 404);
        }

        list($destino, $acceso) = explode('|', $tabla[$clave]);
        list($clase, $accion) = explode('::', $destino);
        $bearer = in_array($acceso, array('emisor', 'camion'), true) || $ruta === 'gps';

        try {
            if (!$bearer) {
                Sesion::iniciar();
            }

            $limiteExento = $bearer;
            if (!$limiteExento && !Seg::limitar('api:' . Seg::ip(), SEG_API_POR_MINUTO, 60)) {
                Seg::registrar('limite_peticiones', 'Exceso de peticiones', false, $ruta);
                throw new ErrorApi('Demasiadas peticiones. Espera un momento.', 429);
            }

            if (!$bearer && $metodo !== 'GET') {
                self::exigirCsrf();
            }

            $datos = Acceso::exigir($acceso);
            $esEscrituraAdmin = $metodo !== 'GET' && strpos($ruta, 'admin/') === 0;
            $resultado = $clase::$accion($datos);

            if ($esEscrituraAdmin) {
                Seg::registrar('accion', $ruta, true, $ruta);
            }

            if (is_array($resultado)) {
                Resp::ok($resultado);
            }
            exit;
        } catch (ErrorApi $e) {
            if (strpos($ruta, 'admin/') === 0 && $metodo !== 'GET') {
                Seg::registrar('accion', $ruta . ': ' . $e->getMessage(), false, $ruta);
            }
            Resp::error($e->getMessage(), $e->estado(), $e->extra());
        }
    }

    private static function exigirCsrf()
    {
        $sitio = Req::cabecera('Sec-Fetch-Site');
        if ($sitio === 'cross-site') {
            Seg::registrar('csrf', 'Petición cross-site rechazada', false);
            throw new ErrorApi('Petición no permitida', 403);
        }

        $token = Req::cabecera('X-CSRF-Token');
        if ($token === '' || !hash_equals(Sesion::csrf(), $token)) {
            Seg::registrar('csrf', 'Token CSRF inválido', false);
            throw new ErrorApi('La sesión de seguridad expiró. Recarga la página.', 403, array('csrf' => true));
        }
    }
}
