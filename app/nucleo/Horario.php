<?php
final class Horario
{
    public static function obtener()
    {
        $fila = BD::uno('SELECT * FROM configuracion ORDER BY id LIMIT 1');
        return $fila ? $fila : array('id' => 0, 'hora_apertura' => '06:00:00', 'hora_cierre' => '20:00:00');
    }

    public static function dentro()
    {
        $c = self::obtener();
        $a = substr($c['hora_apertura'], 0, 8);
        $f = substr($c['hora_cierre'], 0, 8);
        $h = date('H:i:s');
        return $a <= $f ? ($h >= $a && $h <= $f) : ($h >= $a || $h <= $f);
    }

    public static function guardar($apertura, $cierre)
    {
        $c = self::obtener();
        if ((int) $c['id'] === 0) {
            BD::insertar('configuracion', array('hora_apertura' => $apertura, 'hora_cierre' => $cierre));
        } else {
            BD::ejecutar('UPDATE configuracion SET hora_apertura = ?, hora_cierre = ? WHERE id = ?', array($apertura, $cierre, $c['id']));
        }
    }
}
