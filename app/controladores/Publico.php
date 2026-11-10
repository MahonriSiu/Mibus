<?php
final class Publico
{
    private static function ciudadSesion()
    {
        $c = Sesion::dato('ciudad_id');
        return $c ? (int) $c : null;
    }

    public static function ciudades()
    {
        $filas = BD::todos('SELECT c.id, c.nombre, c.region, (SELECT COUNT(*) FROM buses b WHERE b.ciudad_id = c.id AND b.habilitado = 1 AND b.universidad_id IS NULL) AS buses, (SELECT COUNT(*) FROM paradas p WHERE p.ciudad_id = c.id AND p.activa = 1) AS paradas FROM ciudades c WHERE c.habilitada = 1 ORDER BY c.region, c.nombre');
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['buses'] = (int) $f['buses'];
            $f['paradas'] = (int) $f['paradas'];
        }
        return array('ciudades' => $filas);
    }

    public static function estado()
    {
        $h = Horario::obtener();
        return array(
            'en_servicio' => Horario::dentro(),
            'apertura' => substr($h['hora_apertura'], 0, 5),
            'cierre' => substr($h['hora_cierre'], 0, 5),
            'centro' => array(CENTRO_LAT, CENTRO_LNG),
            'ahora' => time(),
        );
    }

    public static function flota()
    {
        $ciudad = self::ciudadSesion();
        $clave = 'flota_' . ($ciudad ? $ciudad : 'todas');
        $archivo = RAIZ . '/storage/cache/' . $clave . '.json';

        if (is_file($archivo) && time() - filemtime($archivo) < 2) {
            $c = json_decode((string) file_get_contents($archivo), true);
            if (is_array($c)) {
                return $c;
            }
        }

        if (mt_rand(1, 25) === 1) {
            Rastreo::vigilar();
        }

        $datos = array(
            'buses' => Rastreo::flota($ciudad),
            'en_servicio' => Horario::dentro(),
            'ahora' => time(),
        );
        @file_put_contents($archivo, json_encode($datos), LOCK_EX);
        return $datos;
    }

    public static function bus()
    {
        $id = Req::entero('id');
        $b = BD::uno('SELECT id, nombre, origen, destino, descripcion, lat, lng, velocidad_kmh, rumbo, color, ruta_json, activo, timestamp_actualizacion FROM buses WHERE id = ? AND habilitado = 1', array($id));

        if (!$b) {
            throw new ErrorApi('Bus no encontrado', 404);
        }

        if (Sesion::rol() === 'usuario') {
            Territorio::exigirAccesoBus($id);
        }

        $rastro = array();
        $filas = BD::todos('SELECT lat, lng FROM historial_posiciones WHERE bus_id = ? AND fecha_hora >= ? ORDER BY id DESC LIMIT 60', array($id, hace(3600)));
        foreach (array_reverse($filas) as $f) {
            $rastro[] = array((float) $f['lat'], (float) $f['lng']);
        }

        $seg = $b['timestamp_actualizacion'] ? max(0, time() - strtotime($b['timestamp_actualizacion'])) : null;
        $ruta = $b['ruta_json'] ? json_decode($b['ruta_json'], true) : null;

        return array('bus' => array(
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
            'conectado' => ((int) $b['activo'] === 1 && $seg !== null && $seg <= GPS_UMBRAL_DESCONEXION_MIN * 60),
            'rastro' => $rastro,
            'ruta' => is_array($ruta) ? $ruta : null,
        ), 'en_servicio' => Horario::dentro());
    }

    public static function paradas()
    {
        $c = self::ciudadSesion();
        if (!$c) {
            return array('paradas' => array());
        }

        $archivo = RAIZ . '/storage/cache/paradas_' . $c . '.json';
        if (is_file($archivo) && time() - filemtime($archivo) < 300) {
            $cache = json_decode((string) file_get_contents($archivo), true);
            if (is_array($cache)) {
                return $cache;
            }
        }

        $filas = BD::todos('SELECT id, nombre, lat, lng, numero, codigo FROM paradas WHERE ciudad_id = ? AND activa = 1 ORDER BY numero, id LIMIT 4000', array($c));
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['lat'] = (float) $f['lat'];
            $f['lng'] = (float) $f['lng'];
            $f['numero'] = (int) $f['numero'];
        }
        $datos = array('paradas' => $filas);
        @file_put_contents($archivo, json_encode($datos, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $datos;
    }

    private static function coordenadasUsuario()
    {
        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if ($lat === null || $lng === null || !Geo::valida($lat, $lng)) {
            throw new ErrorApi('Ubicación no válida', 422);
        }
        return array($lat, $lng);
    }

    public static function eta()
    {
        list($lat, $lng) = self::coordenadasUsuario();
        $busId = Req::entero('bus_id');
        if (Sesion::rol() === 'usuario') {
            Territorio::exigirAccesoBus($busId);
        }
        return Rastreo::eta('bus', $busId, $lat, $lng);
    }

    public static function camionEta()
    {
        list($lat, $lng) = self::coordenadasUsuario();
        return Rastreo::eta('camion', Req::entero('camion_id'), $lat, $lng);
    }

    public static function anuncio()
    {
        $modulo = Req::opcion('modulo', array('bus', 'camion'), 'bus');
        $ciudad = self::ciudadSesion();
        $region = $ciudad ? BD::valor('SELECT region FROM ciudades WHERE id = ?', array($ciudad)) : null;
        $filas = BD::todos('SELECT * FROM anuncios_locales WHERE activo = 1 AND modulo = ? AND (fecha_expiracion IS NULL OR fecha_expiracion >= ?)', array($modulo, date('Y-m-d')));
        $candidatos = array();
        $vistasPor = array();
        foreach (BD::todos('SELECT anuncio_id, COUNT(*) AS n FROM anuncio_vistas WHERE anuncio_id IN (SELECT id FROM anuncios_locales WHERE max_vistas IS NOT NULL) GROUP BY anuncio_id') as $v) {
            $vistasPor[(int) $v['anuncio_id']] = (int) $v['n'];
        }
        $clicsPor = array();
        foreach (BD::todos('SELECT anuncio_id, COUNT(*) AS n FROM anuncio_clics WHERE anuncio_id IN (SELECT id FROM anuncios_locales WHERE max_clics IS NOT NULL) GROUP BY anuncio_id') as $v) {
            $clicsPor[(int) $v['anuncio_id']] = (int) $v['n'];
        }

        foreach ($filas as $a) {
            if ($a['max_vistas'] !== null && (isset($vistasPor[(int) $a['id']]) ? $vistasPor[(int) $a['id']] : 0) >= (int) $a['max_vistas']) {
                continue;
            }
            if ($a['max_clics'] !== null && (isset($clicsPor[(int) $a['id']]) ? $clicsPor[(int) $a['id']] : 0) >= (int) $a['max_clics']) {
                continue;
            }
            if ($a['tipo_alcance'] === 'nacional') {
                $candidatos[] = $a;
                continue;
            }
            $valores = json_decode($a['alcance_valor'] ? $a['alcance_valor'] : '[]', true);
            if (!is_array($valores) || !$valores) {
                continue;
            }
            if ($a['tipo_alcance'] === 'ciudad' && $ciudad && in_array((string) $ciudad, array_map('strval', $valores), true)) {
                $candidatos[] = $a;
            } elseif ($a['tipo_alcance'] === 'region' && $region && in_array($region, $valores, true)) {
                $candidatos[] = $a;
            }
        }

        if (!$candidatos) {
            return array('anuncio' => null);
        }

        $a = $candidatos[array_rand($candidatos)];
        BD::insertar('anuncio_vistas', array('anuncio_id' => $a['id'], 'ciudad_id' => $ciudad, 'fecha_hora' => ahora()));

        return array('anuncio' => array(
            'id' => (int) $a['id'],
            'negocio' => $a['nombre_negocio'],
            'texto' => $a['texto'],
            'telefono' => $a['telefono'],
            'tipo_media' => $a['tipo_media'],
            'media' => $a['url_media'] ? url('/assets/img/anuncios/' . $a['url_media']) : null,
        ));
    }

    public static function anuncioClic()
    {
        if (!Seg::limitar('clic_anuncio:' . Seg::ip(), 20, 600)) {
            throw new ErrorApi('Demasiadas acciones. Espera un momento.', 429);
        }

        $id = Req::entero('id');
        if (!BD::uno('SELECT id FROM anuncios_locales WHERE id = ?', array($id))) {
            throw new ErrorApi('Anuncio no encontrado', 404);
        }

        BD::insertar('anuncio_clics', array('anuncio_id' => $id, 'ciudad_id' => self::ciudadSesion(), 'fecha_hora' => ahora()));
        return array();
    }

    public static function resena()
    {
        if (!Seg::limitar('resena:' . Seg::ip(), 5, 600)) {
            throw new ErrorApi('Ya enviaste varias reseñas. Intenta más tarde.', 429);
        }

        $comentario = Req::texto('comentario', 600, true, 'El comentario');
        $nombre = Req::texto('nombre', 100);
        $nota = Req::entero('calificacion');

        $busId = Req::entero('bus_id');
        if ($busId > 0 && !BD::uno('SELECT id FROM buses WHERE id = ?', array($busId))) {
            $busId = 0;
        }

        BD::insertar('resenas', array(
            'bus_id' => $busId > 0 ? $busId : null,
            'nombre' => $nombre !== '' ? $nombre : (string) Sesion::dato('nombre', 'Anónimo'),
            'comentario' => $comentario,
            'calificacion' => ($nota >= 1 && $nota <= 5) ? $nota : null,
            'modulo' => Req::opcion('modulo', array('bus', 'camion'), 'bus'),
            'fecha_hora' => ahora(),
        ));

        return array('mensaje' => '¡Gracias por tu opinión!');
    }

    public static function acceso()
    {
        if (Sesion::rol() !== 'usuario') {
            return array('registrado' => false);
        }

        $ultimo = BD::valor('SELECT MAX(fecha_hora) FROM registro_accesos WHERE usuario_final_id = ?', array(Sesion::uid()));

        if ($ultimo && time() - strtotime($ultimo) < 1200) {
            return array('registrado' => false);
        }

        BD::insertar('registro_accesos', array('tipo_usuario' => 'usuario_final_acceso', 'usuario_final_id' => Sesion::uid(), 'ip' => Seg::ip(), 'fecha_hora' => ahora()));
        BD::actualizar('usuarios_finales', array('ultimo_acceso' => ahora()), 'id = ?', array(Sesion::uid()));
        return array('registrado' => true);
    }

    public static function eventos()
    {
        $hoy = date('Y-m-d');
        $filas = BD::todos('SELECT id, nombre, color, siempre_activo FROM eventos WHERE habilitado = 1 AND (siempre_activo = 1 OR (fecha_inicio <= ? AND fecha_fin >= ?)) ORDER BY siempre_activo DESC, fecha_inicio', array($hoy, $hoy));
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['siempre_activo'] = (int) $f['siempre_activo'] === 1;
        }
        return array('eventos' => $filas);
    }

    public static function rutaCreativa()
    {
        $id = Req::entero('evento_id');
        $puntos = BD::todos('SELECT id, nombre, descripcion, lat, lng, orden, visible, imagen_portada, video_url FROM puntos_ruta_creativa WHERE evento_id = ? ORDER BY orden, id', array($id));
        foreach ($puntos as &$p) {
            $p['id'] = (int) $p['id'];
            $p['lat'] = (float) $p['lat'];
            $p['lng'] = (float) $p['lng'];
            $p['visible'] = (int) $p['visible'] === 1;
            $p['portada'] = $p['imagen_portada'] ? url('/assets/img/ruta-creativa/' . $p['imagen_portada']) : null;
            $p['video'] = $p['video_url'] ? url('/assets/img/ruta-creativa/' . $p['video_url']) : null;
            unset($p['imagen_portada'], $p['video_url']);
            $imgs = BD::todos('SELECT nombre_archivo FROM imagenes_ruta_creativa WHERE punto_id = ? ORDER BY id', array($p['id']));
            $p['imagenes'] = array_map(function ($i) {
                return url('/assets/img/ruta-creativa/' . $i['nombre_archivo']);
            }, $imgs);
        }
        return array('puntos' => $puntos);
    }

    public static function punto()
    {
        $id = Req::entero('id');
        $p = BD::uno('SELECT p.*, e.nombre AS evento, e.color FROM puntos_ruta_creativa p JOIN eventos e ON e.id = p.evento_id WHERE p.id = ? AND e.habilitado = 1', array($id));

        if (!$p) {
            throw new ErrorApi('Punto no encontrado', 404);
        }

        $imgs = BD::todos('SELECT nombre_archivo FROM imagenes_ruta_creativa WHERE punto_id = ? ORDER BY id', array($id));
        $galeria = array();
        if ($p['imagen_portada']) {
            $galeria[] = url('/assets/img/ruta-creativa/' . $p['imagen_portada']);
        }
        foreach ($imgs as $i) {
            $galeria[] = url('/assets/img/ruta-creativa/' . $i['nombre_archivo']);
        }

        return array('punto' => array(
            'id' => (int) $p['id'],
            'nombre' => $p['nombre'],
            'descripcion' => $p['descripcion'],
            'lat' => (float) $p['lat'],
            'lng' => (float) $p['lng'],
            'evento' => $p['evento'],
            'color' => $p['color'],
            'galeria' => $galeria,
            'video' => $p['video_url'] ? url('/assets/img/ruta-creativa/' . $p['video_url']) : null,
        ));
    }

    public static function camiones()
    {
        $ciudad = self::ciudadSesion();
        $sql = 'SELECT id, nombre, zona, descripcion, lat, lng, velocidad_kmh, rumbo, color, activo_hoy, timestamp_actualizacion FROM camiones_basura WHERE habilitado = 1';
        $par = array();
        if ($ciudad) {
            $sql .= ' AND (ciudad_id = ? OR ciudad_id IS NULL)';
            $par[] = $ciudad;
        }
        $salida = array();
        foreach (BD::todos($sql . ' ORDER BY nombre', $par) as $c) {
            $seg = $c['timestamp_actualizacion'] ? max(0, time() - strtotime($c['timestamp_actualizacion'])) : null;
            $salida[] = array(
                'id' => (int) $c['id'],
                'nombre' => $c['nombre'],
                'zona' => $c['zona'],
                'descripcion' => $c['descripcion'],
                'lat' => $c['lat'] !== null ? (float) $c['lat'] : null,
                'lng' => $c['lng'] !== null ? (float) $c['lng'] : null,
                'vel' => $c['velocidad_kmh'] !== null ? (float) $c['velocidad_kmh'] : 0,
                'rumbo' => $c['rumbo'] !== null ? (int) $c['rumbo'] : null,
                'color' => $c['color'],
                'activo_hoy' => (int) $c['activo_hoy'] === 1,
                'seg' => $seg,
                'conectado' => ((int) $c['activo_hoy'] === 1 && $seg !== null && $seg <= GPS_UMBRAL_DESCONEXION_MIN * 60),
            );
        }
        return array('camiones' => $salida, 'ahora' => time());
    }

    public static function camionRuta()
    {
        $id = Req::entero('camion_id');
        $hoy = (int) date('w');
        foreach (BD::todos('SELECT * FROM rutas_camion WHERE camion_id = ? ORDER BY id', array($id)) as $r) {
            $dias = array_map('intval', array_filter(explode(',', $r['dias']), 'strlen'));
            if (in_array($hoy, $dias, true)) {
                $puntos = json_decode($r['puntos'], true);
                return array('hay_ruta' => true, 'nombre' => $r['nombre_ruta'], 'puntos' => is_array($puntos) ? $puntos : array(), 'color' => $r['color']);
            }
        }
        return array('hay_ruta' => false, 'nombre' => null, 'puntos' => array(), 'color' => '#6b7280');
    }
}
