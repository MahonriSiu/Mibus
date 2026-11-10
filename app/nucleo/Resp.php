<?php
final class Resp
{
    public static function json($datos, $estado = 200)
    {
        if (!headers_sent()) {
            http_response_code($estado);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        exit;
    }

    public static function ok($datos = array())
    {
        self::json(array_merge(array('ok' => true), $datos));
    }

    public static function error($mensaje, $estado = 400, $extra = array())
    {
        self::json(array_merge(array('ok' => false, 'error' => $mensaje), $extra), $estado);
    }
}
