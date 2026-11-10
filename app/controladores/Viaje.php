<?php
final class Viaje
{
    private static function ciudad()
    {
        $c = (int) Sesion::dato('ciudad_id', 0);
        if ($c <= 0) {
            throw new ErrorApi('Selecciona tu ciudad para continuar', 422);
        }
        return $c;
    }

    private static function universidad()
    {
        $u = (int) Sesion::dato('universidad_id', 0);
        return $u > 0 ? $u : null;
    }

    private static function paradaDeCiudad($id, $ciudad)
    {
        $p = BD::uno('SELECT id, nombre, lat, lng, numero, codigo, ciudad_id FROM paradas WHERE id = ? AND activa = 1', array($id));
        if (!$p || (int) $p['ciudad_id'] !== (int) $ciudad) {
            throw new ErrorApi('Parada no encontrada', 404);
        }
        return $p;
    }

    public static function paradaBuses()
    {
        $ciudad = self::ciudad();
        $p = self::paradaDeCiudad(Req::entero('id'), $ciudad);

        if (Seg::limitar('consulta_parada:' . (Sesion::uid() ? Sesion::uid() : Seg::ip()), 40, 300)) {
            BD::insertar('consultas_parada', array('parada_id' => (int) $p['id'], 'ciudad_id' => $ciudad, 'fecha_hora' => ahora()));
        }

        $favorita = false;
        if (Sesion::rol() === 'usuario') {
            $favorita = (bool) BD::uno('SELECT id FROM paradas_favoritas WHERE usuario_final_id = ? AND parada_id = ?', array(Sesion::uid(), (int) $p['id']));
        }

        return array(
            'parada' => array('id' => (int) $p['id'], 'nombre' => $p['nombre'], 'numero' => (int) $p['numero'], 'codigo' => $p['codigo'], 'lat' => (float) $p['lat'], 'lng' => (float) $p['lng']),
            'buses' => Paso::busesPorPunto($ciudad, self::universidad(), (float) $p['lat'], (float) $p['lng']),
            'favorita' => $favorita,
        );
    }

    public static function favoritas()
    {
        if (Sesion::rol() !== 'usuario') {
            return array('favoritas' => array());
        }

        $ciudad = (int) Sesion::dato('ciudad_id', 0);
        $filas = BD::todos('SELECT p.id, p.nombre, p.lat, p.lng, p.numero, p.codigo FROM paradas_favoritas f JOIN paradas p ON p.id = f.parada_id WHERE f.usuario_final_id = ? AND p.activa = 1 AND p.ciudad_id = ? ORDER BY f.id DESC LIMIT 12', array(Sesion::uid(), $ciudad));
        $conEta = Req::bandera('eta');
        $prep = $conEta && $filas ? Paso::preparar($ciudad, self::universidad()) : array();
        $salida = array();

        foreach ($filas as $p) {
            $fila = array('id' => (int) $p['id'], 'nombre' => $p['nombre'], 'numero' => (int) $p['numero'], 'codigo' => $p['codigo'], 'lat' => (float) $p['lat'], 'lng' => (float) $p['lng'], 'mejor' => null);
            if ($conEta) {
                foreach (Paso::busesPorPuntoPreparado($prep, (float) $p['lat'], (float) $p['lng']) as $b) {
                    if ($b['minutos'] !== null) {
                        $fila['mejor'] = array('bus_id' => $b['id'], 'bus' => $b['nombre'], 'minutos' => $b['minutos'], 'llegando' => $b['paso'] === 'llegando');
                        break;
                    }
                }
            }
            $salida[] = $fila;
        }
        return array('favoritas' => $salida);
    }

    public static function favoritaAlternar()
    {
        if (Sesion::rol() !== 'usuario') {
            throw new ErrorApi('Ingresa como pasajero para guardar paradas', 403);
        }

        $ciudad = self::ciudad();
        $p = self::paradaDeCiudad(Req::entero('parada_id'), $ciudad);
        $existe = BD::uno('SELECT id FROM paradas_favoritas WHERE usuario_final_id = ? AND parada_id = ?', array(Sesion::uid(), (int) $p['id']));

        if ($existe) {
            BD::ejecutar('DELETE FROM paradas_favoritas WHERE id = ?', array((int) $existe['id']));
            return array('favorita' => false);
        }

        if ((int) BD::valor('SELECT COUNT(*) FROM paradas_favoritas WHERE usuario_final_id = ?', array(Sesion::uid())) >= 12) {
            throw new ErrorApi('Puedes guardar hasta 12 paradas favoritas', 422);
        }

        BD::insertar('paradas_favoritas', array('usuario_final_id' => Sesion::uid(), 'parada_id' => (int) $p['id'], 'fecha' => ahora()));
        return array('favorita' => true);
    }

    public static function reporteCrear()
    {
        if (!Seg::limitar('reporte:' . Seg::ip(), 6, 3600)) {
            throw new ErrorApi('Enviaste varios reportes seguidos. Intenta más tarde.', 429);
        }

        $tipo = Req::opcion('tipo', array('parada_falta', 'parada_mal', 'calle_cerrada', 'bus_problema', 'otro'));
        if ($tipo === null) {
            throw new ErrorApi('Elige el tipo de reporte', 422);
        }

        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if (!Geo::valida($lat, $lng)) {
            throw new ErrorApi('Marca el lugar del reporte en el mapa o activa tu ubicación', 422);
        }

        $texto = Req::texto('texto', 500);
        if (($tipo === 'otro' || $tipo === 'bus_problema') && strlen($texto) < 5) {
            throw new ErrorApi('Describe brevemente lo que pasa', 422);
        }

        $bus = Req::entero('bus_id');
        $id = BD::insertar('reportes_usuarios', array(
            'usuario_final_id' => Sesion::rol() === 'usuario' ? Sesion::uid() : null,
            'ciudad_id' => (int) Sesion::dato('ciudad_id', 0) ?: null,
            'tipo' => $tipo,
            'lat' => round($lat, 7),
            'lng' => round($lng, 7),
            'texto' => $texto,
            'bus_id' => $bus > 0 ? $bus : null,
            'estado' => 'pendiente',
            'fecha_hora' => ahora(),
        ));

        Rastreo::aviso('admin', null, null, 'Nuevo reporte de usuario', 'Reporte #' . $id . ' pendiente de revisión.', 'info');
        return array('mensaje' => 'Gracias. Un administrador revisará tu reporte.');
    }

    public static function planificar()
    {
        $ciudad = self::ciudad();
        $oLat = Req::decimal('olat');
        $oLng = Req::decimal('olng');
        $dLat = Req::decimal('dlat');
        $dLng = Req::decimal('dlng');

        if (!Geo::valida($oLat, $oLng) || !Geo::valida($dLat, $dLng)) {
            throw new ErrorApi('Elige un origen y un destino dentro de Nicaragua', 422);
        }

        $directo = Geo::distanciaKm($oLat, $oLng, $dLat, $dLng) * 1000;
        if ($directo < 150) {
            return array('opciones' => array(), 'mensaje' => 'El destino está a menos de 150 metros. Es más rápido caminar.');
        }

        $maxCaminata = 700;
        $opciones = array();

        foreach (Paso::busesDeCiudad($ciudad, self::universidad()) as $b) {
            $ruta = Paso::ruta($b['ruta_json']);
            if (!$ruta) {
                continue;
            }
            $cum = Paso::acumulada($ruta);
            $total = $cum[count($cum) - 1];
            $po = Paso::proyectar($ruta, $cum, $oLat, $oLng);
            $pd = Paso::proyectar($ruta, $cum, $dLat, $dLng);
            if (!$po || !$pd || $po['d'] > $maxCaminata || $pd['d'] > $maxCaminata) {
                continue;
            }

            $circular = Paso::circular($ruta, $total);
            $viaje = Paso::distanciaAdelante($po['s'], $pd['s'], $total, $circular);
            if ($viaje === null || $viaje < 80) {
                continue;
            }

            $v = Rastreo::velocidadPromedio('bus', (int) $b['id']);
            $minViaje = (int) max(1, round(($viaje / 1000) / $v * 60));
            $minCaminata = (int) round(($po['d'] + $pd['d']) / 80);
            $espera = null;
            $conectado = Paso::conectado($b);

            if ($conectado) {
                $pb = Paso::proyectar($ruta, $cum, (float) $b['lat'], (float) $b['lng']);
                if ($pb && $pb['d'] <= 160) {
                    $dist = Paso::distanciaAdelante($pb['s'], $po['s'], $total, $circular);
                    if ($dist !== null) {
                        $espera = (int) round(($dist / 1000) / $v * 60);
                    }
                }
            }

            $opciones[] = array(
                'bus_id' => (int) $b['id'],
                'nombre' => $b['nombre'],
                'origen' => $b['origen'],
                'destino' => $b['destino'],
                'color' => $b['color'],
                'conectado' => $conectado,
                'caminata_origen_m' => (int) round($po['d']),
                'caminata_destino_m' => (int) round($pd['d']),
                'viaje_m' => (int) round($viaje),
                'minutos_viaje' => $minViaje,
                'espera_min' => $espera,
                'total_min' => $minCaminata + $minViaje + ($espera !== null ? $espera : 10),
                'sube' => array(round($po['lat'], 6), round($po['lng'], 6)),
                'baja' => array(round($pd['lat'], 6), round($pd['lng'], 6)),
                'parada_sube' => self::paradaCerca($ciudad, $po['lat'], $po['lng']),
                'parada_baja' => self::paradaCerca($ciudad, $pd['lat'], $pd['lng']),
                'tramo' => Paso::tramo($ruta, $cum, $po['s'], $pd['s'], $total, $circular),
            );
        }

        usort($opciones, function ($a, $b) {
            return $a['total_min'] - $b['total_min'];
        });

        return array('opciones' => array_slice($opciones, 0, 5), 'mensaje' => $opciones ? null : 'No hay un bus directo entre esos dos puntos. El planificador todavía no combina transbordos.');
    }

    private static function paradaCerca($ciudad, $lat, $lng)
    {
        $d = 0.0025;
        $filas = BD::todos('SELECT id, nombre, numero, codigo, lat, lng FROM paradas WHERE ciudad_id = ? AND activa = 1 AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? LIMIT 40', array($ciudad, $lat - $d, $lat + $d, $lng - $d, $lng + $d));
        $mejor = null;
        $mejorD = 160;
        foreach ($filas as $f) {
            $m = Geo::distanciaKm($lat, $lng, (float) $f['lat'], (float) $f['lng']) * 1000;
            if ($m < $mejorD) {
                $mejorD = $m;
                $mejor = array('id' => (int) $f['id'], 'nombre' => $f['nombre'], 'numero' => (int) $f['numero'], 'codigo' => $f['codigo'], 'distancia_m' => (int) round($m));
            }
        }
        return $mejor;
    }

    public static function universidadInfo()
    {
        $uid = self::universidad();
        if (!$uid) {
            return array('horarios' => array(), 'avisos' => array());
        }

        $hoy = (string) date('w');
        $horarios = array();
        foreach (BD::todos('SELECT h.dias, h.hora, h.origen, h.destino, h.nota, b.nombre AS bus FROM horarios_universidad h LEFT JOIN buses b ON b.id = h.bus_id WHERE h.universidad_id = ? ORDER BY h.hora', array($uid)) as $h) {
            $dias = array_filter(explode(',', $h['dias']), 'strlen');
            $horarios[] = array('hora' => substr($h['hora'], 0, 5), 'dias' => array_map('intval', $dias), 'hoy' => in_array($hoy, $dias, true), 'origen' => $h['origen'], 'destino' => $h['destino'], 'nota' => $h['nota'], 'bus' => $h['bus']);
        }

        $avisos = BD::todos('SELECT titulo, mensaje, gravedad, fecha_hora FROM avisos_universidad WHERE universidad_id = ? AND activo = 1 AND (expira IS NULL OR expira >= ?) ORDER BY id DESC LIMIT 6', array($uid, date('Y-m-d')));
        return array('horarios' => $horarios, 'avisos' => $avisos);
    }

    public static function anunciante()
    {
        if (!Seg::limitar('anunciante:' . Seg::ip(), 30, 300)) {
            throw new ErrorApi('Demasiadas consultas. Intenta en unos minutos.', 429);
        }

        $token = preg_replace('/[^a-f0-9]/', '', strtolower(Req::texto('token', 64)));
        if (strlen($token) < 20) {
            throw new ErrorApi('Enlace no válido', 404);
        }

        $a = BD::uno('SELECT id, nombre_negocio, texto, activo, fecha_expiracion, max_vistas, max_clics, tipo_alcance FROM anuncios_locales WHERE token_panel = ?', array($token));
        if (!$a) {
            throw new ErrorApi('Enlace no válido', 404);
        }

        $id = (int) $a['id'];
        $vistas = (int) BD::valor('SELECT COUNT(*) FROM anuncio_vistas WHERE anuncio_id = ?', array($id));
        $clics = (int) BD::valor('SELECT COUNT(*) FROM anuncio_clics WHERE anuncio_id = ?', array($id));
        $dia = BD::sqlDia('fecha_hora');

        return array(
            'negocio' => $a['nombre_negocio'],
            'texto' => $a['texto'],
            'activo' => (int) $a['activo'] === 1,
            'expira' => $a['fecha_expiracion'],
            'max_vistas' => $a['max_vistas'] !== null ? (int) $a['max_vistas'] : null,
            'vistas' => $vistas,
            'clics' => $clics,
            'ctr' => $vistas > 0 ? round($clics * 100 / $vistas, 1) : 0,
            'por_dia' => BD::todos('SELECT ' . $dia . ' AS d, COUNT(*) AS n FROM anuncio_vistas WHERE anuncio_id = ? AND fecha_hora >= ? GROUP BY d ORDER BY d', array($id, hace(30 * 86400))),
            'clics_por_dia' => BD::todos('SELECT ' . $dia . ' AS d, COUNT(*) AS n FROM anuncio_clics WHERE anuncio_id = ? AND fecha_hora >= ? GROUP BY d ORDER BY d', array($id, hace(30 * 86400))),
            'por_ciudad' => BD::todos('SELECT COALESCE(c.nombre, ?) AS ciudad, COUNT(*) AS n FROM anuncio_vistas v LEFT JOIN ciudades c ON c.id = v.ciudad_id WHERE v.anuncio_id = ? GROUP BY ciudad ORDER BY n DESC LIMIT 15', array('Sin ciudad', $id)),
        );
    }
}
