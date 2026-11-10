<?php
final class Vista
{
    public static function render($vista, $datos = array())
    {
        $archivo = RAIZ . '/app/vistas/' . $vista . '.php';
        $datos = array_merge(array(
            'titulo' => APP_NOMBRE,
            'clase' => '',
            'scripts' => array(),
            'estilos' => array('mibus.css'),
            'config' => array(),
            'mapa' => false,
            'tema' => '#07131c',
        ), $datos);

        $centro = array(CENTRO_LAT, CENTRO_LNG);
        $ciudadNombre = null;
        $universidad = null;

        if (Sesion::rol() === 'usuario') {
            try {
                $ciudadId = (int) Sesion::dato('ciudad_id', 0);
                if ($ciudadId > 0) {
                    $fila = BD::uno('SELECT nombre, lat, lng FROM ciudades WHERE id = ?', array($ciudadId));
                    if ($fila) {
                        $ciudadNombre = $fila['nombre'];
                        if ($fila['lat'] !== null && $fila['lng'] !== null) {
                            $centro = array((float) $fila['lat'], (float) $fila['lng']);
                        }
                    }
                }
                $uniId = (int) Sesion::dato('universidad_id', 0);
                if ($uniId > 0) {
                    $u = BD::uno('SELECT id, nombre, siglas, color FROM universidades WHERE id = ? AND habilitada = 1', array($uniId));
                    if ($u) {
                        $universidad = array('id' => (int) $u['id'], 'nombre' => $u['nombre'], 'siglas' => $u['siglas'], 'color' => $u['color']);
                    }
                }
            } catch (Exception $e) {
                error_log('vista contexto: ' . $e->getMessage());
            }
        }

        $datos['config'] = array_merge(array(
            'base' => base_url(),
            'csrf' => Sesion::csrf(),
            'rol' => Sesion::rol(),
            'nombre' => Sesion::dato('nombre'),
            'debeCambiar' => (bool) Sesion::dato('debe_cambiar'),
            'ciudadId' => Sesion::dato('ciudad_id'),
            'centro' => $centro,
            'ciudad' => $ciudadNombre,
            'universidad' => $universidad,
            'version' => APP_VERSION,
            'gps' => array('movimiento' => GPS_INTERVALO_MOVIMIENTO_S, 'quieto' => GPS_INTERVALO_QUIETO_S),
        ), $datos['config']);

        extract($datos, EXTR_SKIP);
        ob_start();
        require $archivo;
        $contenido = ob_get_clean();
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        require RAIZ . '/app/vistas/base.php';
        exit;
    }

    public static function error($codigo, $mensaje)
    {
        if (!headers_sent()) {
            http_response_code($codigo);
        }
        if (!class_exists('Sesion', false) || !defined('APP_VERSION')) {
            echo '<!doctype html><meta charset="utf-8"><title>' . (int) $codigo . '</title><p style="font-family:sans-serif;padding:2rem">' . e($mensaje) . '</p>';
            exit;
        }
        self::render('error', array('titulo' => $codigo . ' · ' . APP_NOMBRE, 'codigo' => $codigo, 'mensaje' => $mensaje, 'clase' => 'pagina-estado'));
    }
}
