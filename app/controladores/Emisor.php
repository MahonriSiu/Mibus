<?php
final class Emisor
{
    private static function posicionDe($tipo, $id)
    {
        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');

        if ($lat === null || $lng === null) {
            throw new ErrorApi('Faltan lat y lng', 422);
        }

        $velocidad = Req::decimal('velocidad');
        if ($velocidad !== null) {
            $velocidad = $velocidad * 3.6;
        }

        $r = Rastreo::registrar($tipo, $id, $lat, $lng, Req::decimal('precision'), Req::crudo('bateria') !== null && Req::crudo('bateria') !== '' ? Req::entero('bateria') : null, Req::bandera('cargando'), $velocidad);

        $salida = array('descartada' => $r['descartada'], 'en_servicio' => Horario::dentro(), 'servidor' => time());

        if ($tipo === 'bus' && !$r['descartada']) {
            try {
                $salida['alerta'] = Paso::cierreCercano($id, $lat, $lng);
            } catch (Exception $e) {
                error_log('cierre cercano: ' . $e->getMessage());
            }
        }

        return $salida;
    }

    public static function posicion($t)
    {
        $bus = BD::uno('SELECT habilitado FROM buses WHERE id = ?', array($t['b']));
        if (!$bus || (int) $bus['habilitado'] !== 1) {
            throw new ErrorApi('Vehículo deshabilitado', 403, array('reingresar' => true));
        }
        return self::posicionDe('bus', (int) $t['b']);
    }

    public static function posicionCamion($t)
    {
        $c = BD::uno('SELECT habilitado FROM camiones_basura WHERE id = ?', array($t['b']));
        if (!$c || (int) $c['habilitado'] !== 1) {
            throw new ErrorApi('Vehículo deshabilitado', 403, array('reingresar' => true));
        }
        return self::posicionDe('camion', (int) $t['b']);
    }

    public static function estado($t)
    {
        $b = BD::uno('SELECT nombre, origen, destino, lat, lng, timestamp_actualizacion, habilitado, ocupacion, ocupacion_ts, desvio FROM buses WHERE id = ?', array($t['b']));
        if (!$b) {
            throw new ErrorApi('Vehículo no encontrado', 404);
        }
        return array('nombre' => $b['nombre'], 'ruta' => $b['origen'] . ' → ' . $b['destino'], 'en_servicio' => Horario::dentro(), 'ultima' => $b['timestamp_actualizacion'], 'servidor' => time(), 'ocupacion' => Paso::ocupacionVigente($b), 'desvio' => (int) $b['desvio'] === 1);
    }

    public static function estadoCamion($t)
    {
        $c = BD::uno('SELECT nombre, zona, timestamp_actualizacion FROM camiones_basura WHERE id = ?', array($t['b']));
        if (!$c) {
            throw new ErrorApi('Vehículo no encontrado', 404);
        }
        return array('nombre' => $c['nombre'], 'ruta' => $c['zona'], 'en_servicio' => true, 'ultima' => $c['timestamp_actualizacion'], 'servidor' => time());
    }

    public static function sos($t)
    {
        if (!Seg::limitar('sos:' . $t['b'], 4, 300)) {
            throw new ErrorApi('Ya enviaste varias alertas. Espera un momento.', 429);
        }

        $tipo = Req::opcion('tipo', array('mecanico', 'medica', 'robo', 'sos'));
        if ($tipo === null) {
            throw new ErrorApi('Tipo de alerta no válido', 422);
        }

        $bus = BD::uno('SELECT id, nombre, propietario_id FROM buses WHERE id = ?', array($t['b']));
        if (!$bus || !$bus['propietario_id']) {
            throw new ErrorApi('Este bus no tiene propietario asignado', 422);
        }

        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if ($lat !== null && !Geo::valida($lat, $lng)) {
            $lat = null;
            $lng = null;
        }

        BD::insertar('alertas_sos', array('bus_id' => $bus['id'], 'propietario_id' => $bus['propietario_id'], 'tipo' => $tipo, 'lat' => $lat, 'lng' => $lng, 'atendida' => 0, 'fecha_hora' => ahora()));

        $nombres = array('mecanico' => 'Falla mecánica', 'medica' => 'Emergencia médica', 'robo' => 'Robo o asalto', 'sos' => 'SOS general');
        $gravedad = ($tipo === 'robo' || $tipo === 'medica' || $tipo === 'sos') ? 'urgente' : 'advertencia';
        $titulo = $nombres[$tipo] . ' en ' . $bus['nombre'];
        $mensaje = 'El chofer envió una alerta a las ' . date('H:i') . '.';

        Rastreo::aviso('propietario', (int) $bus['propietario_id'], (int) $bus['id'], $titulo, $mensaje, $gravedad);
        Rastreo::aviso('admin', null, (int) $bus['id'], $titulo, $mensaje, $gravedad);
        Seg::registrar('sos', $titulo, true, 'emisor/sos', 'emisor', (int) $bus['id']);

        return array('mensaje' => 'Alerta enviada al propietario');
    }

    public static function gps()
    {
        $codigo = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', Req::texto('codigo', 20)));

        if (!Seg::limitar('gps:' . ($codigo !== '' ? $codigo : Seg::ip()), 40, 60)) {
            throw new ErrorApi('Demasiadas actualizaciones', 429);
        }

        if (Seg::fallosRecientes('gps_codigo', 15) >= 20) {
            throw new ErrorApi('Acceso bloqueado temporalmente', 429);
        }

        $e = $codigo !== '' ? BD::uno("SELECT bus_id, tipo FROM emisores WHERE codigo_acceso = ? AND tipo = 'gps'", array($codigo)) : null;

        if (!$e) {
            Seg::registrar('gps_codigo', 'Código GPS inválido', false, 'gps');
            throw new ErrorApi('Código inválido', 401);
        }

        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if ($lat === null || $lng === null) {
            throw new ErrorApi('Faltan lat y lng', 422);
        }

        $r = Rastreo::registrar('bus', (int) $e['bus_id'], $lat, $lng);
        return array('descartada' => $r['descartada']);
    }
}
