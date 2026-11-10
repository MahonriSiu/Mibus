<?php
final class Rastreo
{
    private static $mapa = array(
        'bus' => array('tabla' => 'buses', 'historial' => 'historial_posiciones', 'clave' => 'bus_id'),
        'camion' => array('tabla' => 'camiones_basura', 'historial' => 'historial_posiciones_camion', 'clave' => 'camion_id'),
    );

    public static function registrar($tipo, $id, $lat, $lng, $precision = null, $bateria = null, $cargando = null, $velocidadCliente = null)
    {
        $d = self::$mapa[$tipo];

        if (!Geo::valida($lat, $lng)) {
            throw new ErrorApi('Coordenadas fuera de rango', 422);
        }

        if ($precision !== null && $precision > 500) {
            return array('descartada' => true, 'motivo' => 'precision');
        }

        $fila = BD::uno('SELECT lat, lng, rumbo, velocidad_kmh, timestamp_actualizacion FROM ' . $d['tabla'] . ' WHERE id = ?', array($id));

        if (!$fila) {
            throw new ErrorApi('Vehículo no encontrado', 404);
        }

        $ahora = time();
        $velocidad = null;
        $rumbo = $fila['rumbo'] !== null ? (int) $fila['rumbo'] : null;
        $metros = null;

        if ($fila['lat'] !== null && $fila['timestamp_actualizacion']) {
            $dt = max(1, $ahora - strtotime($fila['timestamp_actualizacion']));
            $km = Geo::distanciaKm((float) $fila['lat'], (float) $fila['lng'], $lat, $lng);
            $metros = $km * 1000;
            $implicita = $km / ($dt / 3600);

            if ($dt < 180 && $implicita > GPS_VELOCIDAD_MAX_KMH && $km > 0.15) {
                return array('descartada' => true, 'motivo' => 'salto');
            }

            $velocidad = $dt < 180 ? min($implicita, GPS_VELOCIDAD_MAX_KMH) : 0;

            if ($metros > 6) {
                $rumbo = Geo::rumbo((float) $fila['lat'], (float) $fila['lng'], $lat, $lng);
            }
        }

        if ($velocidadCliente !== null && $velocidadCliente >= 0 && $velocidadCliente < GPS_VELOCIDAD_MAX_KMH) {
            $velocidad = $velocidadCliente;
        }

        if ($velocidad !== null && $fila['velocidad_kmh'] !== null) {
            $velocidad = 0.6 * $velocidad + 0.4 * (float) $fila['velocidad_kmh'];
        }

        if ($metros !== null && $metros < 4 && $velocidad !== null) {
            $velocidad = min($velocidad, 2);
        }

        $datos = array(
            'lat' => round($lat, 7),
            'lng' => round($lng, 7),
            'velocidad_kmh' => $velocidad !== null ? round($velocidad, 1) : null,
            'rumbo' => $rumbo,
            'precision_m' => $precision !== null ? (int) round($precision) : null,
            'timestamp_actualizacion' => ahora(),
        );

        if ($tipo === 'bus') {
            $datos['activo'] = 1;
        }

        if ($bateria !== null) {
            $datos['bateria_nivel'] = max(0, min(100, (int) $bateria));
            $datos['bateria_cargando'] = $cargando ? 1 : 0;
        }

        BD::actualizar($d['tabla'], $datos, 'id = ?', array($id));

        $ultimo = BD::uno('SELECT lat, lng, fecha_hora FROM ' . $d['historial'] . ' WHERE ' . $d['clave'] . ' = ? ORDER BY id DESC LIMIT 1', array($id));
        $guardar = true;

        if ($ultimo) {
            $mov = Geo::distanciaKm((float) $ultimo['lat'], (float) $ultimo['lng'], $lat, $lng) * 1000;
            $edad = $ahora - strtotime($ultimo['fecha_hora']);
            $guardar = $mov >= 15 || $edad >= 90;
        }

        if ($guardar) {
            BD::insertar($d['historial'], array($d['clave'] => $id, 'lat' => round($lat, 7), 'lng' => round($lng, 7), 'velocidad' => $velocidad !== null ? round($velocidad, 1) : null, 'fecha_hora' => ahora()));
        }

        if ($tipo === 'bus') {
            try {
                Paso::vigilarBus($id, $lat, $lng);
            } catch (Exception $e) {
                error_log('vigilar bus: ' . $e->getMessage());
            }
        }

        return array('descartada' => false, 'velocidad' => $velocidad !== null ? round($velocidad, 1) : 0);
    }

    public static function velocidadPromedio($tipo, $id)
    {
        $d = self::$mapa[$tipo];
        $filas = BD::todos('SELECT velocidad FROM ' . $d['historial'] . ' WHERE ' . $d['clave'] . ' = ? AND velocidad IS NOT NULL AND fecha_hora >= ? ORDER BY id DESC LIMIT 12', array($id, hace(900)));
        $suma = 0;
        $n = 0;
        foreach ($filas as $f) {
            if ((float) $f['velocidad'] >= 3) {
                $suma += (float) $f['velocidad'];
                $n++;
            }
        }
        $v = $n >= 2 ? $suma / $n : 14;
        return max(8, min(45, $v));
    }

    public static function eta($tipo, $id, $lat, $lng)
    {
        $d = self::$mapa[$tipo];
        $e = BD::uno('SELECT lat, lng, timestamp_actualizacion FROM ' . $d['tabla'] . ' WHERE id = ?', array($id));

        if (!$e || $e['lat'] === null) {
            throw new ErrorApi('Aún no transmite su ubicación', 404);
        }

        $km = Geo::distanciaKm((float) $e['lat'], (float) $e['lng'], $lat, $lng) * 1.25;
        $v = self::velocidadPromedio($tipo, $id);
        $minutos = (int) max(0, round(($km / $v) * 60));

        return array(
            'distancia_m' => (int) round($km * 1000),
            'minutos' => $minutos,
            'velocidad_kmh' => round($v, 1),
            'llegando' => $km < 0.15,
            'actualizado_hace_s' => $e['timestamp_actualizacion'] ? max(0, time() - strtotime($e['timestamp_actualizacion'])) : null,
        );
    }

    public static function vigilar()
    {
        if (!Horario::dentro()) {
            return;
        }

        $limite = hace(GPS_UMBRAL_DESCONEXION_MIN * 60 * 2);
        $buses = BD::todos('SELECT id, nombre, propietario_id, timestamp_actualizacion, bateria_nivel, es_interurbano, minutos_umbral_desconexion FROM buses WHERE habilitado = 1 AND activo = 1 AND timestamp_actualizacion IS NOT NULL AND timestamp_actualizacion < ?', array($limite));

        foreach ($buses as $b) {
            $umbral = $b['minutos_umbral_desconexion'] ? (int) $b['minutos_umbral_desconexion'] : ((int) $b['es_interurbano'] === 1 ? 20 : 6);
            $minutos = (int) round((time() - strtotime($b['timestamp_actualizacion'])) / 60);

            if ($minutos < $umbral) {
                continue;
            }

            BD::ejecutar('UPDATE buses SET activo = 0 WHERE id = ?', array($b['id']));
            $hora = date('H:i', strtotime($b['timestamp_actualizacion']));
            $causa = 'No se pudo determinar la causa.';
            $gravedad = 'advertencia';

            if ((int) $b['es_interurbano'] === 1) {
                $causa = 'Puede ser una zona rural sin cobertura o una falla real. Lleva ' . $minutos . ' minutos sin transmitir.';
                $gravedad = 'info';
            } elseif ($b['bateria_nivel'] !== null && (int) $b['bateria_nivel'] <= 20) {
                $causa = 'Es probable que se haya quedado sin batería (último nivel: ' . (int) $b['bateria_nivel'] . '%).';
            } elseif ($b['bateria_nivel'] !== null && (int) $b['bateria_nivel'] > 50) {
                $causa = 'La batería estaba bien (' . (int) $b['bateria_nivel'] . '%); el chofer detuvo el envío o perdió internet.';
            }

            $titulo = 'El bus ' . $b['nombre'] . ' dejó de transmitir';
            $mensaje = 'Su última señal fue a las ' . $hora . '. ' . $causa;
            $destinos = (int) $b['es_interurbano'] === 1 ? array() : array('admin', 'auditor');

            foreach ($destinos as $d) {
                self::aviso($d, null, $b['id'], $titulo, $mensaje, $gravedad);
            }
            if ($b['propietario_id']) {
                self::aviso('propietario', (int) $b['propietario_id'], $b['id'], $titulo, $mensaje, $gravedad);
            }
        }
    }

    public static function aviso($destinatario, $propietarioId, $busId, $titulo, $mensaje, $gravedad = 'advertencia', $camionId = null)
    {
        BD::insertar('bandeja_avisos', array(
            'tipo_destinatario' => $destinatario,
            'propietario_id' => $propietarioId,
            'bus_id' => $busId,
            'camion_id' => $camionId,
            'titulo' => $titulo,
            'mensaje' => $mensaje,
            'gravedad' => $gravedad,
            'leido' => 0,
            'fecha_hora' => ahora(),
        ));
    }

    public static function flota($ciudadId = null, $universidadId = null)
    {
        $umbral = GPS_UMBRAL_DESCONEXION_MIN * 60;
        $parametros = array();
        $sql = 'SELECT id, nombre, origen, destino, descripcion, lat, lng, velocidad_kmh, rumbo, color, ciudad_id, es_interurbano, universidad_id, ocupacion, ocupacion_ts, desvio, activo, timestamp_actualizacion FROM buses WHERE habilitado = 1';

        if ($universidadId) {
            $sql .= ' AND universidad_id = ?';
            $parametros[] = $universidadId;
        } else {
            $sql .= ' AND es_interurbano = 0 AND universidad_id IS NULL';
            if ($ciudadId) {
                $sql .= ' AND (ciudad_id = ? OR ciudad_id IS NULL)';
                $parametros[] = $ciudadId;
            }
        }

        $salida = array();
        foreach (BD::todos($sql . ' ORDER BY nombre', $parametros) as $b) {
            $seg = $b['timestamp_actualizacion'] ? max(0, time() - strtotime($b['timestamp_actualizacion'])) : null;
            $salida[] = array(
                'id' => (int) $b['id'],
                'nombre' => $b['nombre'],
                'origen' => $b['origen'],
                'destino' => $b['destino'],
                'descripcion' => $b['descripcion'],
                'lat' => $b['lat'] !== null ? (float) $b['lat'] : null,
                'lng' => $b['lng'] !== null ? (float) $b['lng'] : null,
                'vel' => $b['velocidad_kmh'] !== null ? (float) $b['velocidad_kmh'] : 0,
                'rumbo' => $b['rumbo'] !== null ? (int) $b['rumbo'] : null,
                'color' => $b['color'],
                'seg' => $seg,
                'conectado' => ((int) $b['activo'] === 1 && $seg !== null && $seg <= $umbral),
                'ocupacion' => Paso::ocupacionVigente($b),
                'desvio' => (int) $b['desvio'] === 1,
            );
        }

        return $salida;
    }
}
