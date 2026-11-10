<?php
final class Contenido
{
    public static function resenaEliminar()
    {
        BD::ejecutar('DELETE FROM resenas WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function limpiar()
    {
        $que = Req::opcion('que', array('resenas', 'accesos'));
        if ($que === 'resenas') {
            BD::ejecutar('DELETE FROM resenas');
        } elseif ($que === 'accesos') {
            BD::ejecutar('DELETE FROM registro_accesos WHERE usuario_final_id IS NOT NULL');
        } else {
            throw new ErrorApi('Opción no válida', 422);
        }
        Seg::registrar('limpieza', 'Se limpió: ' . $que, true, 'admin/limpiar');
        return array();
    }

    public static function anuncios()
    {
        $filas = BD::todos('SELECT a.*, (SELECT COUNT(*) FROM anuncio_vistas v WHERE v.anuncio_id = a.id) AS vistas FROM anuncios_locales a ORDER BY a.id DESC');
        foreach ($filas as &$a) {
            $a['activo'] = (int) $a['activo'] === 1;
            $a['vistas'] = (int) $a['vistas'];
            $a['media'] = $a['url_media'] ? url('/assets/img/anuncios/' . $a['url_media']) : null;
            $a['alcance'] = $a['alcance_valor'] ? json_decode($a['alcance_valor'], true) : array();
            $a['vencido'] = $a['fecha_expiracion'] && $a['fecha_expiracion'] < date('Y-m-d');
        }
        return array('anuncios' => $filas);
    }

    public static function anuncioGuardar()
    {
        $alcance = Req::opcion('tipo_alcance', array('ciudad', 'region', 'nacional'), 'nacional');
        $valores = Req::crudo('alcance', array());
        if (is_string($valores)) {
            $decodificado = json_decode($valores, true);
            $valores = is_array($decodificado) ? $decodificado : array();
        }
        $valores = array_values(array_filter(array_map(function ($v) {
            return limpiar_texto($v, 60);
        }, (array) $valores), 'strlen'));

        if ($alcance !== 'nacional' && !$valores) {
            throw new ErrorApi('Selecciona al menos una ' . ($alcance === 'ciudad' ? 'ciudad' : 'región'), 422);
        }

        $texto = Req::texto('texto', 600);
        $negocio = Req::texto('negocio', 150, true, 'El nombre del negocio');
        $tipoMedia = 'ninguno';
        $media = null;

        if (isset($_FILES['media']) && $_FILES['media']['error'] === UPLOAD_ERR_OK) {
            $info = @getimagesize($_FILES['media']['tmp_name']);
            if ($info) {
                $media = Imagen::guardar('media', 'anuncios', 'anuncio', 1400);
                $tipoMedia = 'imagen';
            } else {
                $media = Imagen::video('media', 'anuncios', 'anuncio');
                $tipoMedia = 'video';
            }
        }

        $datos = array(
            'nombre_negocio' => $negocio,
            'texto' => $texto,
            'telefono' => Req::texto('telefono', 30),
            'tipo_alcance' => $alcance,
            'alcance_valor' => $alcance === 'nacional' ? null : json_encode($valores),
            'fecha_expiracion' => Req::fecha('expira'),
            'modulo' => Req::opcion('modulo', array('bus', 'camion'), 'bus'),
            'max_vistas' => Req::entero('max_vistas') > 0 ? Req::entero('max_vistas') : null,
            'max_clics' => Req::entero('max_clics') > 0 ? Req::entero('max_clics') : null,
        );

        if ($texto === '' && $media === null && Req::entero('id') === 0) {
            throw new ErrorApi('Escribe un texto o sube una imagen o video', 422);
        }

        $id = Req::entero('id');
        if ($id > 0) {
            if ($media !== null) {
                $viejo = BD::uno('SELECT url_media FROM anuncios_locales WHERE id = ?', array($id));
                $datos['tipo_media'] = $tipoMedia;
                $datos['url_media'] = $media;
                if ($viejo && $viejo['url_media']) {
                    Imagen::borrar('anuncios', $viejo['url_media']);
                }
            }
            BD::actualizar('anuncios_locales', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }

        $datos['tipo_media'] = $tipoMedia;
        $datos['url_media'] = $media;
        $datos['activo'] = 1;
        $datos['fecha_creacion'] = ahora();
        return array('id' => BD::insertar('anuncios_locales', $datos));
    }

    public static function anuncioEstado()
    {
        BD::actualizar('anuncios_locales', array('activo' => Req::bandera('activo')), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function anuncioEliminar()
    {
        $id = Req::entero('id');
        $a = BD::uno('SELECT url_media FROM anuncios_locales WHERE id = ?', array($id));
        if ($a && $a['url_media']) {
            Imagen::borrar('anuncios', $a['url_media']);
        }
        BD::ejecutar('DELETE FROM anuncios_locales WHERE id = ?', array($id));
        return array();
    }

    public static function anuncioEstadisticas()
    {
        $id = Req::entero('id');
        $a = BD::uno('SELECT id, nombre_negocio FROM anuncios_locales WHERE id = ?', array($id));
        if (!$a) {
            throw new ErrorApi('Anuncio no encontrado', 404);
        }
        $total = (int) BD::valor('SELECT COUNT(*) FROM anuncio_vistas WHERE anuncio_id = ?', array($id));
        $porDia = BD::todos('SELECT ' . BD::sqlDia('fecha_hora') . ' AS d, COUNT(*) AS n FROM anuncio_vistas WHERE anuncio_id = ? AND fecha_hora >= ? GROUP BY d ORDER BY d', array($id, hace(14 * 86400)));
        $porCiudad = BD::todos('SELECT COALESCE(c.nombre, ?) AS ciudad, COUNT(*) AS n FROM anuncio_vistas v LEFT JOIN ciudades c ON c.id = v.ciudad_id WHERE v.anuncio_id = ? GROUP BY ciudad ORDER BY n DESC', array('Sin ciudad', $id));
        $clics = (int) BD::valor('SELECT COUNT(*) FROM anuncio_clics WHERE anuncio_id = ?', array($id));
        $clicsCiudad = BD::todos('SELECT COALESCE(c.nombre, ?) AS ciudad, COUNT(*) AS n FROM anuncio_clics v LEFT JOIN ciudades c ON c.id = v.ciudad_id WHERE v.anuncio_id = ? GROUP BY ciudad ORDER BY n DESC', array('Sin ciudad', $id));
        return array('anuncio' => $a, 'total' => $total, 'por_dia' => $porDia, 'por_ciudad' => $porCiudad, 'clics' => $clics, 'clics_por_ciudad' => $clicsCiudad, 'ctr' => $total > 0 ? round($clics * 100 / $total, 1) : 0);
    }

    public static function eventos()
    {
        $filas = BD::todos('SELECT e.*, (SELECT COUNT(*) FROM puntos_ruta_creativa p WHERE p.evento_id = e.id) AS puntos FROM eventos e ORDER BY e.siempre_activo DESC, e.id DESC');
        foreach ($filas as &$f) {
            $f['siempre_activo'] = (int) $f['siempre_activo'] === 1;
            $f['habilitado'] = (int) $f['habilitado'] === 1;
        }
        return array('eventos' => $filas);
    }

    public static function eventoGuardar()
    {
        $siempre = Req::bandera('siempre_activo');
        $inicio = Req::fecha('inicio');
        $fin = Req::fecha('fin');
        if (!$siempre && (!$inicio || !$fin || $fin < $inicio)) {
            throw new ErrorApi('Indica un rango de fechas válido o márcalo como permanente', 422);
        }
        $datos = array(
            'nombre' => Req::texto('nombre', 150, true, 'El nombre'),
            'color' => es_color(Req::crudo('color')) ? Req::crudo('color') : '#1a73e8',
            'fecha_inicio' => $siempre ? null : $inicio,
            'fecha_fin' => $siempre ? null : $fin,
            'siempre_activo' => $siempre,
        );
        $id = Req::entero('id');
        if ($id > 0) {
            BD::actualizar('eventos', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }
        $datos['habilitado'] = 1;
        $datos['fecha_creacion'] = ahora();
        return array('id' => BD::insertar('eventos', $datos));
    }

    public static function eventoEstado()
    {
        BD::actualizar('eventos', array('habilitado' => Req::bandera('habilitado')), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function eventoEliminar()
    {
        $id = Req::entero('id');
        foreach (BD::todos('SELECT id, imagen_portada, video_url FROM puntos_ruta_creativa WHERE evento_id = ?', array($id)) as $p) {
            self::borrarArchivosPunto($p);
        }
        BD::ejecutar('DELETE FROM eventos WHERE id = ?', array($id));
        return array();
    }

    private static function borrarArchivosPunto($p)
    {
        if ($p['imagen_portada']) {
            Imagen::borrar('ruta-creativa', $p['imagen_portada']);
        }
        if ($p['video_url']) {
            Imagen::borrar('ruta-creativa', $p['video_url']);
        }
        foreach (BD::todos('SELECT nombre_archivo FROM imagenes_ruta_creativa WHERE punto_id = ?', array($p['id'])) as $i) {
            Imagen::borrar('ruta-creativa', $i['nombre_archivo']);
        }
    }

    private static function formatoPunto($p)
    {
        $p['id'] = (int) $p['id'];
        $p['evento_id'] = (int) $p['evento_id'];
        $p['lat'] = (float) $p['lat'];
        $p['lng'] = (float) $p['lng'];
        $p['visible'] = (int) $p['visible'] === 1;
        $p['portada'] = $p['imagen_portada'] ? url('/assets/img/ruta-creativa/' . $p['imagen_portada']) : null;
        $p['video'] = $p['video_url'] ? url('/assets/img/ruta-creativa/' . $p['video_url']) : null;
        return $p;
    }

    public static function puntos()
    {
        $filas = BD::todos('SELECT * FROM puntos_ruta_creativa WHERE evento_id = ? ORDER BY orden, id', array(Req::entero('evento_id')));
        return array('puntos' => array_map(array('Contenido', 'formatoPunto'), $filas));
    }

    public static function punto()
    {
        $p = BD::uno('SELECT * FROM puntos_ruta_creativa WHERE id = ?', array(Req::entero('id')));
        if (!$p) {
            throw new ErrorApi('Punto no encontrado', 404);
        }
        $p = self::formatoPunto($p);
        $p['imagenes'] = BD::todos('SELECT id, nombre_archivo FROM imagenes_ruta_creativa WHERE punto_id = ? ORDER BY id', array($p['id']));
        foreach ($p['imagenes'] as &$i) {
            $i['url'] = url('/assets/img/ruta-creativa/' . $i['nombre_archivo']);
        }
        return array('punto' => $p);
    }

    public static function puntoGuardar()
    {
        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if (!Geo::valida($lat, $lng)) {
            throw new ErrorApi('Ubicación fuera de rango', 422);
        }
        $datos = array(
            'nombre' => Req::texto('nombre', 150, true, 'El nombre'),
            'descripcion' => Req::texto('descripcion', 2000),
            'lat' => $lat,
            'lng' => $lng,
            'orden' => Req::entero('orden'),
            'visible' => Req::bandera('visible', 1),
        );
        $id = Req::entero('id');
        if ($id > 0) {
            BD::actualizar('puntos_ruta_creativa', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }
        $evento = Req::entero('evento_id');
        if (!BD::uno('SELECT id FROM eventos WHERE id = ?', array($evento))) {
            throw new ErrorApi('Evento no encontrado', 404);
        }
        $datos['evento_id'] = $evento;
        $datos['fecha_creacion'] = ahora();
        return array('id' => BD::insertar('puntos_ruta_creativa', $datos));
    }

    public static function puntoEliminar()
    {
        $p = BD::uno('SELECT id, imagen_portada, video_url FROM puntos_ruta_creativa WHERE id = ?', array(Req::entero('id')));
        if ($p) {
            self::borrarArchivosPunto($p);
            BD::ejecutar('DELETE FROM puntos_ruta_creativa WHERE id = ?', array($p['id']));
        }
        return array();
    }

    private static function puntoExiste()
    {
        $p = BD::uno('SELECT * FROM puntos_ruta_creativa WHERE id = ?', array(Req::entero('punto_id')));
        if (!$p) {
            throw new ErrorApi('Punto no encontrado', 404);
        }
        return $p;
    }

    public static function puntoPortada()
    {
        $p = self::puntoExiste();
        $nombre = Imagen::guardar('archivo', 'ruta-creativa', 'portada_' . $p['id']);
        BD::actualizar('puntos_ruta_creativa', array('imagen_portada' => $nombre), 'id = ?', array($p['id']));
        if ($p['imagen_portada']) {
            Imagen::borrar('ruta-creativa', $p['imagen_portada']);
        }
        return array('url' => url('/assets/img/ruta-creativa/' . $nombre));
    }

    public static function puntoImagen()
    {
        $p = self::puntoExiste();
        $cuenta = (int) BD::valor('SELECT COUNT(*) FROM imagenes_ruta_creativa WHERE punto_id = ?', array($p['id']));
        if ($cuenta >= 12) {
            throw new ErrorApi('Máximo 12 imágenes por punto', 422);
        }
        $nombre = Imagen::guardar('archivo', 'ruta-creativa', 'punto_' . $p['id']);
        $id = BD::insertar('imagenes_ruta_creativa', array('punto_id' => $p['id'], 'nombre_archivo' => $nombre, 'fecha_creacion' => ahora()));
        return array('id' => $id, 'url' => url('/assets/img/ruta-creativa/' . $nombre));
    }

    public static function puntoVideo()
    {
        $p = self::puntoExiste();
        $nombre = Imagen::video('archivo', 'ruta-creativa', 'video_' . $p['id']);
        BD::actualizar('puntos_ruta_creativa', array('video_url' => $nombre), 'id = ?', array($p['id']));
        if ($p['video_url']) {
            Imagen::borrar('ruta-creativa', $p['video_url']);
        }
        return array('url' => url('/assets/img/ruta-creativa/' . $nombre));
    }

    public static function puntoImagenEliminar()
    {
        $i = BD::uno('SELECT id, nombre_archivo FROM imagenes_ruta_creativa WHERE id = ?', array(Req::entero('id')));
        if ($i) {
            Imagen::borrar('ruta-creativa', $i['nombre_archivo']);
            BD::ejecutar('DELETE FROM imagenes_ruta_creativa WHERE id = ?', array($i['id']));
        }
        return array();
    }
}
