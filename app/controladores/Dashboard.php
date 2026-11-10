<?php
final class Dashboard
{
    private static function kmHoy()
    {
        $archivo = RAIZ . '/storage/cache/km_hoy.json';
        if (is_file($archivo) && time() - filemtime($archivo) < 90) {
            $c = json_decode((string) file_get_contents($archivo), true);
            if (is_array($c) && isset($c['dia']) && $c['dia'] === date('Y-m-d')) {
                return $c['datos'];
            }
        }

        $inicio = date('Y-m-d') . ' 00:00:00';
        $filas = BD::todos('SELECT bus_id, lat, lng FROM historial_posiciones WHERE fecha_hora >= ? ORDER BY bus_id, id', array($inicio));
        $por = array();
        $previo = array();
        foreach ($filas as $f) {
            $id = (int) $f['bus_id'];
            if (isset($previo[$id])) {
                $d = Geo::distanciaKm($previo[$id][0], $previo[$id][1], (float) $f['lat'], (float) $f['lng']);
                if ($d < 5) {
                    $por[$id] = (isset($por[$id]) ? $por[$id] : 0) + $d;
                }
            }
            $previo[$id] = array((float) $f['lat'], (float) $f['lng']);
        }
        foreach ($por as $k => $v) {
            $por[$k] = round($v, 1);
        }
        @file_put_contents($archivo, json_encode(array('dia' => date('Y-m-d'), 'datos' => $por)), LOCK_EX);
        return $por;
    }

    public static function datos()
    {
        $dias = max(7, min(60, Req::entero('dias', 14)));
        $hoy = date('Y-m-d');
        $buses = Panel::busesDeAlcance();
        $km = self::kmHoy();

        $enLinea = 0;
        $habilitados = 0;
        $bateriaBaja = 0;
        $kmTotal = 0;
        $flota = array();
        foreach ($buses as $b) {
            $b['km_hoy'] = isset($km[$b['id']]) ? $km[$b['id']] : 0;
            $kmTotal += $b['km_hoy'];
            $enLinea += $b['conectado'] ? 1 : 0;
            $habilitados += $b['habilitado'] ? 1 : 0;
            $bateriaBaja += ($b['conectado'] && $b['bateria'] !== null && $b['bateria'] <= 20 && !$b['cargando']) ? 1 : 0;
            $flota[] = $b;
        }

        $camionesEnLinea = 0;
        $camionesTotal = 0;
        foreach (BD::todos('SELECT activo_hoy, timestamp_actualizacion FROM camiones_basura WHERE habilitado = 1') as $c) {
            $camionesTotal++;
            $seg = $c['timestamp_actualizacion'] ? time() - strtotime($c['timestamp_actualizacion']) : null;
            if ((int) $c['activo_hoy'] === 1 && $seg !== null && $seg <= GPS_UMBRAL_DESCONEXION_MIN * 60) {
                $camionesEnLinea++;
            }
        }

        $desde = date('Y-m-d', time() - ($dias - 1) * 86400) . ' 00:00:00';
        $registros = array();
        foreach (BD::todos('SELECT ' . BD::sqlDia('fecha_registro') . ' AS d, COUNT(*) AS n FROM usuarios_finales WHERE fecha_registro >= ? GROUP BY d', array($desde)) as $f) {
            $registros[$f['d']] = (int) $f['n'];
        }
        $accesos = array();
        foreach (BD::todos('SELECT ' . BD::sqlDia('fecha_hora') . ' AS d, COUNT(*) AS n FROM registro_accesos WHERE fecha_hora >= ? GROUP BY d', array($desde)) as $f) {
            $accesos[$f['d']] = (int) $f['n'];
        }

        $serie = array();
        for ($i = $dias - 1; $i >= 0; $i--) {
            $d = date('Y-m-d', time() - $i * 86400);
            $serie[] = array('d' => $d, 'registros' => isset($registros[$d]) ? $registros[$d] : 0, 'accesos' => isset($accesos[$d]) ? $accesos[$d] : 0);
        }

        $calor = array_fill(0, 7, array_fill(0, 24, 0));
        $sqlCalor = 'SELECT ' . BD::sqlDiaSemana('fecha_hora') . ' AS dia, ' . BD::sqlHora('fecha_hora') . ' AS hora, COUNT(*) AS n FROM registro_accesos WHERE fecha_hora >= ? GROUP BY dia, hora';
        foreach (BD::todos($sqlCalor, array(date('Y-m-d', time() - 28 * 86400) . ' 00:00:00')) as $f) {
            $calor[(int) $f['dia']][(int) $f['hora']] = (int) $f['n'];
        }

        $dist = array(0, 0, 0, 0, 0);
        $suma = 0;
        $nRes = 0;
        foreach (BD::todos('SELECT calificacion, COUNT(*) AS n FROM resenas WHERE calificacion IS NOT NULL GROUP BY calificacion') as $f) {
            $c = (int) $f['calificacion'];
            if ($c >= 1 && $c <= 5) {
                $dist[$c - 1] = (int) $f['n'];
                $suma += $c * (int) $f['n'];
                $nRes += (int) $f['n'];
            }
        }

        $feed = array();
        foreach (BD::todos("SELECT titulo, mensaje, gravedad, fecha_hora FROM bandeja_avisos WHERE tipo_destinatario = ? ORDER BY id DESC LIMIT 8", array(Sesion::rol() === 'auditor' ? 'auditor' : 'admin')) as $a) {
            $feed[] = array('tipo' => 'aviso', 'titulo' => $a['titulo'], 'detalle' => $a['mensaje'], 'nivel' => $a['gravedad'], 'cuando' => $a['fecha_hora']);
        }
        foreach (BD::todos('SELECT nombre, fecha_registro FROM usuarios_finales ORDER BY id DESC LIMIT 5') as $u) {
            $feed[] = array('tipo' => 'usuario', 'titulo' => 'Nuevo pasajero', 'detalle' => $u['nombre'], 'nivel' => 'info', 'cuando' => $u['fecha_registro']);
        }
        foreach (BD::todos('SELECT s.tipo, s.fecha_hora, b.nombre FROM alertas_sos s JOIN buses b ON b.id = s.bus_id ORDER BY s.id DESC LIMIT 5') as $s) {
            $feed[] = array('tipo' => 'sos', 'titulo' => 'Alerta ' . $s['tipo'], 'detalle' => $s['nombre'], 'nivel' => 'urgente', 'cuando' => $s['fecha_hora']);
        }
        usort($feed, function ($a, $b) {
            return strcmp($b['cuando'], $a['cuando']);
        });

        $usuariosTotal = (int) BD::valor('SELECT COUNT(*) FROM usuarios_finales');
        $usuariosHoy = (int) BD::valor('SELECT COUNT(*) FROM usuarios_finales WHERE fecha_registro >= ?', array($hoy . ' 00:00:00'));
        $accesosHoy = (int) BD::valor('SELECT COUNT(*) FROM registro_accesos WHERE fecha_hora >= ?', array($hoy . ' 00:00:00'));
        $activos15 = (int) BD::valor('SELECT COUNT(DISTINCT usuario_final_id) FROM registro_accesos WHERE fecha_hora >= ?', array(hace(900)));
        $rol = Sesion::rol() === 'auditor' ? 'auditor' : 'admin';

        return array(
            'kpis' => array(
                'buses_total' => count($buses),
                'buses_habilitados' => $habilitados,
                'buses_en_linea' => $enLinea,
                'camiones_total' => $camionesTotal,
                'camiones_en_linea' => $camionesEnLinea,
                'bateria_baja' => $bateriaBaja,
                'km_hoy' => round($kmTotal, 1),
                'usuarios_total' => $usuariosTotal,
                'usuarios_hoy' => $usuariosHoy,
                'accesos_hoy' => $accesosHoy,
                'activos_15min' => $activos15,
                'resenas_total' => $nRes,
                'resenas_promedio' => $nRes ? round($suma / $nRes, 2) : null,
                'sos_pendientes' => (int) BD::valor('SELECT COUNT(*) FROM alertas_sos WHERE atendida = 0'),
                'avisos_sin_leer' => (int) BD::valor('SELECT COUNT(*) FROM bandeja_avisos WHERE tipo_destinatario = ? AND leido = 0', array($rol)),
                'solicitudes_pendientes' => (int) BD::valor('SELECT COUNT(*) FROM solicitudes_reseteo WHERE atendida = 0'),
            ),
            'serie' => $serie,
            'calor' => $calor,
            'calificaciones' => $dist,
            'flota' => $flota,
            'feed' => array_slice($feed, 0, 14),
            'en_servicio' => Horario::dentro(),
            'ahora' => time(),
        );
    }
}
