<?php
final class Paso
{
    public static function ruta($json)
    {
        $r = json_decode((string) $json, true);
        if (!is_array($r) || count($r) < 2) {
            return null;
        }
        $limpia = array();
        foreach ($r as $p) {
            if (is_array($p) && count($p) >= 2) {
                $limpia[] = array((float) $p[0], (float) $p[1]);
            }
        }
        return count($limpia) >= 2 ? $limpia : null;
    }

    public static function acumulada($ruta)
    {
        $cum = array(0.0);
        $n = count($ruta);
        for ($i = 1; $i < $n; $i++) {
            $cum[$i] = $cum[$i - 1] + Geo::distanciaKm($ruta[$i - 1][0], $ruta[$i - 1][1], $ruta[$i][0], $ruta[$i][1]) * 1000;
        }
        return $cum;
    }

    public static function proyectar($ruta, $cum, $lat, $lng)
    {
        $kx = cos(deg2rad($lat)) * 111320.0;
        $ky = 110540.0;
        $mejor = null;
        $n = count($ruta);

        for ($i = 0; $i < $n - 1; $i++) {
            $ax = ($ruta[$i][1] - $lng) * $kx;
            $ay = ($ruta[$i][0] - $lat) * $ky;
            $bx = ($ruta[$i + 1][1] - $lng) * $kx;
            $by = ($ruta[$i + 1][0] - $lat) * $ky;
            $dx = $bx - $ax;
            $dy = $by - $ay;
            $largo2 = $dx * $dx + $dy * $dy;
            $t = $largo2 > 0 ? max(0, min(1, -($ax * $dx + $ay * $dy) / $largo2)) : 0;
            $px = $ax + $t * $dx;
            $py = $ay + $t * $dy;
            $d = sqrt($px * $px + $py * $py);

            if ($mejor === null || $d < $mejor['d']) {
                $seg = $cum[$i + 1] - $cum[$i];
                $mejor = array(
                    'd' => $d,
                    's' => $cum[$i] + $t * $seg,
                    'i' => $i,
                    'lat' => $ruta[$i][0] + $t * ($ruta[$i + 1][0] - $ruta[$i][0]),
                    'lng' => $ruta[$i][1] + $t * ($ruta[$i + 1][1] - $ruta[$i][1]),
                );
            }
        }
        return $mejor;
    }

    public static function circular($ruta, $total)
    {
        $n = count($ruta);
        return $total > 800 && Geo::distanciaKm($ruta[0][0], $ruta[0][1], $ruta[$n - 1][0], $ruta[$n - 1][1]) * 1000 < 300;
    }

    public static function distanciaAdelante($sDesde, $sHasta, $total, $circular)
    {
        $delta = $sHasta - $sDesde;
        if ($delta >= -25) {
            return max(0, $delta);
        }
        return $circular ? $total - $sDesde + $sHasta : null;
    }

    public static function tramo($ruta, $cum, $sDesde, $sHasta, $total, $circular)
    {
        $n = count($ruta);
        $puntos = array();
        $tomar = function ($a, $b) use ($ruta, $cum, $n, &$puntos) {
            for ($i = 0; $i < $n; $i++) {
                if ($cum[$i] >= $a && $cum[$i] <= $b) {
                    $puntos[] = array(round($ruta[$i][0], 6), round($ruta[$i][1], 6));
                }
            }
        };

        if ($sHasta >= $sDesde) {
            $tomar($sDesde, $sHasta);
        } elseif ($circular) {
            $tomar($sDesde, $total);
            $tomar(0, $sHasta);
        }

        $max = 180;
        if (count($puntos) > $max) {
            $salto = (int) ceil(count($puntos) / $max);
            $reducido = array();
            foreach ($puntos as $i => $p) {
                if ($i % $salto === 0) {
                    $reducido[] = $p;
                }
            }
            $puntos = $reducido;
        }
        return $puntos;
    }

    public static function busesDeCiudad($ciudadId, $universidadId = null)
    {
        $sql = 'SELECT id, nombre, origen, destino, color, lat, lng, velocidad_kmh, activo, timestamp_actualizacion, ruta_json, ocupacion, ocupacion_ts, desvio, universidad_id FROM buses WHERE habilitado = 1 AND ruta_json IS NOT NULL AND es_interurbano = 0 AND ((universidad_id IS NULL AND (ciudad_id = ? OR ciudad_id IS NULL))';
        $par = array($ciudadId);
        if ($universidadId) {
            $sql .= ' OR universidad_id = ?';
            $par[] = $universidadId;
        }
        return BD::todos($sql . ')', $par);
    }

    public static function ocupacionVigente($b)
    {
        if (!isset($b['ocupacion']) || (int) $b['ocupacion'] <= 0 || empty($b['ocupacion_ts'])) {
            return 0;
        }
        return time() - strtotime($b['ocupacion_ts']) <= 1800 ? (int) $b['ocupacion'] : 0;
    }

    public static function conectado($b)
    {
        if ((int) $b['activo'] !== 1 || !$b['timestamp_actualizacion'] || $b['lat'] === null) {
            return false;
        }
        return time() - strtotime($b['timestamp_actualizacion']) <= GPS_UMBRAL_DESCONEXION_MIN * 60;
    }

    public static function preparar($ciudadId, $universidadId = null)
    {
        $lista = array();
        foreach (self::busesDeCiudad($ciudadId, $universidadId) as $b) {
            $ruta = self::ruta($b['ruta_json']);
            if (!$ruta) {
                continue;
            }
            $cum = self::acumulada($ruta);
            $total = $cum[count($cum) - 1];
            $conectado = self::conectado($b);
            $pb = null;
            if ($conectado) {
                $pb = self::proyectar($ruta, $cum, (float) $b['lat'], (float) $b['lng']);
            }
            $lista[] = array('bus' => $b, 'ruta' => $ruta, 'cum' => $cum, 'total' => $total, 'circular' => self::circular($ruta, $total), 'conectado' => $conectado, 'pb' => $pb);
        }
        return $lista;
    }

    public static function busesPorPuntoPreparado($prep, $lat, $lng, $umbral = 45)
    {
        $salida = array();
        foreach ($prep as $x) {
            $b = $x['bus'];
            $p = self::proyectar($x['ruta'], $x['cum'], $lat, $lng);
            if (!$p || $p['d'] > $umbral) {
                continue;
            }

            $fila = array(
                'id' => (int) $b['id'],
                'nombre' => $b['nombre'],
                'origen' => $b['origen'],
                'destino' => $b['destino'],
                'color' => $b['color'],
                'conectado' => $x['conectado'],
                'minutos' => null,
                'distancia_m' => null,
                'paso' => null,
                'ocupacion' => self::ocupacionVigente($b),
                'desvio' => (int) $b['desvio'] === 1,
            );

            if ($x['conectado']) {
                $pb = $x['pb'];
                if ($pb && $pb['d'] <= 160) {
                    $dist = self::distanciaAdelante($pb['s'], $p['s'], $x['total'], $x['circular']);
                    if ($dist === null) {
                        $fila['paso'] = 'ya_paso';
                    } else {
                        $v = Rastreo::velocidadPromedio('bus', (int) $b['id']);
                        $fila['distancia_m'] = (int) round($dist);
                        $fila['minutos'] = (int) round(($dist / 1000) / $v * 60);
                        $fila['paso'] = $dist < 120 ? 'llegando' : 'viene';
                    }
                } else {
                    $fila['paso'] = 'fuera_de_ruta';
                }
            }
            $salida[] = $fila;
        }

        usort($salida, function ($a, $b) {
            $x = $a['minutos'] === null ? 9999 : $a['minutos'];
            $y = $b['minutos'] === null ? 9999 : $b['minutos'];
            return $x - $y;
        });
        return $salida;
    }

    public static function busesPorPunto($ciudadId, $universidadId, $lat, $lng, $umbral = 45)
    {
        return self::busesPorPuntoPreparado(self::preparar($ciudadId, $universidadId), $lat, $lng, $umbral);
    }

    public static function cierreCercano($busId, $lat, $lng)
    {
        $ciudad = BD::valor('SELECT ciudad_id FROM buses WHERE id = ?', array($busId));
        $sql = 'SELECT id, nombre, motivo, puntos FROM calles_cerradas WHERE activa = 1 AND (hasta IS NULL OR hasta >= ?)';
        $par = array(ahora());
        if ($ciudad) {
            $sql .= ' AND ciudad_id = ?';
            $par[] = (int) $ciudad;
        }

        $mejor = null;
        foreach (BD::todos($sql . ' LIMIT 100', $par) as $c) {
            $pts = json_decode($c['puntos'], true);
            if (!is_array($pts) || count($pts) < 2) {
                continue;
            }
            $cum = self::acumulada($pts);
            $p = self::proyectar($pts, $cum, $lat, $lng);
            if ($p && $p['d'] <= 300 && ($mejor === null || $p['d'] < $mejor['distancia_m'])) {
                $mejor = array('nombre' => $c['nombre'], 'motivo' => $c['motivo'], 'distancia_m' => (int) round($p['d']));
            }
        }
        return $mejor;
    }

    private static function avisarUnaVez($bus, $titulo, $mensaje, $gravedad)
    {
        $existe = BD::valor('SELECT COUNT(*) FROM bandeja_avisos WHERE bus_id = ? AND titulo = ? AND fecha_hora >= ?', array((int) $bus['id'], $titulo, hace(1800)));
        if ((int) $existe > 0) {
            return;
        }
        if ($bus['propietario_id']) {
            Rastreo::aviso('propietario', (int) $bus['propietario_id'], (int) $bus['id'], $titulo, $mensaje, $gravedad);
        }
        Rastreo::aviso('admin', null, (int) $bus['id'], $titulo, $mensaje, $gravedad);
    }

    public static function vigilarBus($busId, $lat, $lng)
    {
        if (!Horario::dentro() || !Seg::limitar('vigilar_bus:' . $busId, 1, 50)) {
            return;
        }

        $bus = BD::uno('SELECT id, nombre, propietario_id, ruta_json, universidad_id FROM buses WHERE id = ?', array($busId));
        if (!$bus) {
            return;
        }

        $ruta = self::ruta($bus['ruta_json']);
        if ($ruta) {
            $cum = self::acumulada($ruta);
            $p = self::proyectar($ruta, $cum, $lat, $lng);
            $vel = (float) BD::valor('SELECT velocidad_kmh FROM buses WHERE id = ?', array($busId), 0);
            if ($p && $p['d'] > 180 && $vel >= 8) {
                self::avisarUnaVez($bus, 'Bus fuera de su ruta', $bus['nombre'] . ' se alejó unos ' . (int) round($p['d']) . ' m de su ruta trazada. Si fue un desvío autorizado, ignora este aviso.', 'advertencia');
            }
        }

        $filas = BD::todos('SELECT lat, lng FROM historial_posiciones WHERE bus_id = ? AND fecha_hora >= ? ORDER BY id DESC LIMIT 12', array($busId, hace(720)));
        $primero = BD::valor('SELECT fecha_hora FROM historial_posiciones WHERE bus_id = ? ORDER BY id DESC LIMIT 1 OFFSET 11', array($busId));
        if (count($filas) >= 6 && $primero && time() - strtotime($primero) >= 600) {
            $quieto = true;
            foreach ($filas as $f) {
                if (Geo::distanciaKm((float) $f['lat'], (float) $f['lng'], $lat, $lng) * 1000 > 40) {
                    $quieto = false;
                    break;
                }
            }
            if ($quieto) {
                self::avisarUnaVez($bus, 'Bus detenido hace rato', $bus['nombre'] . ' lleva más de 10 minutos en el mismo lugar con el GPS activo.', 'advertencia');
            }
        }
    }
}
