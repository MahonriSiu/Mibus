<?php
final class Req
{
    private static $cuerpo = null;

    public static function metodo()
    {
        return strtoupper(isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET');
    }

    public static function cuerpo()
    {
        if (self::$cuerpo !== null) {
            return self::$cuerpo;
        }

        self::$cuerpo = array();
        $tipo = isset($_SERVER['CONTENT_TYPE']) ? strtolower($_SERVER['CONTENT_TYPE']) : '';

        if (strpos($tipo, 'application/json') !== false) {
            $crudo = file_get_contents('php://input', false, null, 0, 1048576);
            $datos = json_decode($crudo, true);
            if (is_array($datos)) {
                self::$cuerpo = $datos;
            }
        } else {
            self::$cuerpo = $_POST;
        }

        return self::$cuerpo;
    }

    public static function crudo($clave, $defecto = null)
    {
        $cuerpo = self::cuerpo();
        if (array_key_exists($clave, $cuerpo)) {
            return $cuerpo[$clave];
        }
        if (isset($_GET[$clave])) {
            return $_GET[$clave];
        }
        return $defecto;
    }

    public static function texto($clave, $max = 255, $obligatorio = false, $etiqueta = null)
    {
        $valor = self::crudo($clave, '');
        $valor = is_scalar($valor) ? limpiar_texto($valor, $max) : '';
        if ($obligatorio && $valor === '') {
            throw new ErrorApi(($etiqueta ? $etiqueta : $clave) . ' es obligatorio', 422);
        }
        return $valor;
    }

    public static function entero($clave, $defecto = 0)
    {
        $valor = self::crudo($clave, null);
        if ($valor === null || $valor === '' || !is_numeric($valor)) {
            return $defecto;
        }
        return (int) $valor;
    }

    public static function decimal($clave, $defecto = null)
    {
        $valor = self::crudo($clave, null);
        if ($valor === null || $valor === '' || !is_numeric($valor)) {
            return $defecto;
        }
        return (float) $valor;
    }

    public static function bandera($clave, $defecto = 0)
    {
        $valor = self::crudo($clave, null);
        if ($valor === null || $valor === '') {
            return $defecto;
        }
        if (is_bool($valor)) {
            return $valor ? 1 : 0;
        }
        return in_array(strtolower((string) $valor), array('1', 'true', 'si', 'sí', 'on'), true) ? 1 : 0;
    }

    public static function opcion($clave, $permitidos, $defecto = null)
    {
        $valor = self::crudo($clave, null);
        return in_array($valor, $permitidos, true) ? $valor : $defecto;
    }

    public static function correo($clave = 'correo')
    {
        $valor = strtolower(self::texto($clave, 100, true, 'El correo'));
        if (!filter_var($valor, FILTER_VALIDATE_EMAIL)) {
            throw new ErrorApi('El correo no tiene un formato válido', 422);
        }
        return $valor;
    }

    public static function cabecera($nombre)
    {
        $clave = 'HTTP_' . strtoupper(str_replace('-', '_', $nombre));
        return isset($_SERVER[$clave]) ? $_SERVER[$clave] : '';
    }

    public static function fecha($clave)
    {
        $valor = self::texto($clave, 10);
        if ($valor === '') {
            return null;
        }
        $d = DateTime::createFromFormat('Y-m-d', $valor);
        return ($d && $d->format('Y-m-d') === $valor) ? $valor : null;
    }
}
