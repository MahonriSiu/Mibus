<?php
final class Territorio
{
    private static function sinAcentos($texto)
    {
        return strtr((string) $texto, array(
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
        ));
    }

    public static function purgarCache()
    {
        foreach ((array) glob(RAIZ . '/storage/cache/paradas_*.json') as $archivo) {
            @unlink($archivo);
        }
    }

    public static function asegurarCodigo($ciudad)
    {
        if (!empty($ciudad['codigo'])) {
            return $ciudad['codigo'];
        }

        $base = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', self::sinAcentos($ciudad['nombre'])), 0, 3));
        $base = str_pad($base, 3, 'X');
        $codigo = $base;
        $n = 1;

        while ((int) BD::valor('SELECT COUNT(*) FROM ciudades WHERE codigo = ? AND id <> ?', array($codigo, (int) $ciudad['id'])) > 0) {
            $n++;
            $codigo = $base . $n;
            if ($n > 99) {
                throw new ErrorApi('No se pudo generar el código de la ciudad', 500);
            }
        }

        BD::actualizar('ciudades', array('codigo' => $codigo), 'id = ?', array((int) $ciudad['id']));
        return $codigo;
    }

    public static function numerarPendientes($ciudadId)
    {
        $ciudad = BD::uno('SELECT id, nombre, codigo FROM ciudades WHERE id = ?', array($ciudadId));
        if (!$ciudad) {
            return 0;
        }

        $codigo = self::asegurarCodigo($ciudad);
        $n = (int) BD::valor('SELECT COALESCE(MAX(numero), 0) FROM paradas WHERE ciudad_id = ?', array($ciudadId));
        $hechas = 0;

        foreach (BD::todos('SELECT id FROM paradas WHERE ciudad_id = ? AND numero = 0 ORDER BY id', array($ciudadId)) as $p) {
            $n++;
            BD::actualizar('paradas', array('numero' => $n, 'orden' => $n, 'codigo' => $codigo . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT)), 'id = ?', array((int) $p['id']));
            $hechas++;
        }

        return $hechas;
    }

    public static function paradas()
    {
        $ciudad = Req::entero('ciudad_id');
        $q = Req::texto('q', 60);
        $limite = max(50, min(500, Req::entero('limite', 300)));
        $donde = array();
        $par = array();

        if ($ciudad > 0) {
            $donde[] = 'p.ciudad_id = ?';
            $par[] = $ciudad;
        }
        if ($q !== '') {
            $donde[] = '(p.nombre LIKE ? OR p.codigo LIKE ?)';
            $par[] = '%' . $q . '%';
            $par[] = '%' . $q . '%';
        }

        $clausula = $donde ? ' WHERE ' . implode(' AND ', $donde) : '';
        $total = (int) BD::valor('SELECT COUNT(*) FROM paradas p' . $clausula, $par);
        $filas = BD::todos('SELECT p.id, p.nombre, p.lat, p.lng, p.numero, p.codigo, p.origen, p.activa, p.ciudad_id, c.nombre AS ciudad FROM paradas p LEFT JOIN ciudades c ON c.id = p.ciudad_id' . $clausula . ' ORDER BY p.ciudad_id, p.numero, p.id LIMIT ' . $limite, $par);

        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['lat'] = (float) $f['lat'];
            $f['lng'] = (float) $f['lng'];
            $f['numero'] = (int) $f['numero'];
            $f['activa'] = (int) $f['activa'] === 1;
        }

        $manuales = (int) BD::valor("SELECT COUNT(*) FROM paradas WHERE origen = 'manual'" . ($ciudad > 0 ? ' AND (ciudad_id = ? OR ciudad_id IS NULL)' : ''), $ciudad > 0 ? array($ciudad) : array());

        return array('paradas' => $filas, 'total' => $total, 'manuales' => $manuales);
    }

    public static function paradaGuardar()
    {
        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if (!Geo::valida($lat, $lng)) {
            throw new ErrorApi('Ubicación fuera de rango', 422);
        }

        $ciudad = Req::entero('ciudad_id');
        if ($ciudad <= 0 || !BD::uno('SELECT id FROM ciudades WHERE id = ?', array($ciudad))) {
            throw new ErrorApi('Selecciona la ciudad de la parada', 422);
        }

        $nombre = Req::texto('nombre', 100);
        $id = Req::entero('id');

        if ($id > 0) {
            $actual = BD::uno('SELECT id, ciudad_id, numero FROM paradas WHERE id = ?', array($id));
            if (!$actual) {
                throw new ErrorApi('Parada no encontrada', 404);
            }
            $datos = array('nombre' => $nombre !== '' ? $nombre : 'Parada ' . (int) $actual['numero'], 'lat' => $lat, 'lng' => $lng, 'activa' => Req::bandera('activa', 1));
            if ((int) $actual['ciudad_id'] !== $ciudad) {
                $datos['ciudad_id'] = $ciudad;
                $datos['numero'] = 0;
                $datos['codigo'] = null;
            }
            BD::actualizar('paradas', $datos, 'id = ?', array($id));
            self::numerarPendientes($ciudad);
            self::purgarCache();
            return array('id' => $id);
        }

        $nuevo = BD::insertar('paradas', array('nombre' => $nombre !== '' ? $nombre : 'Parada', 'lat' => $lat, 'lng' => $lng, 'orden' => 0, 'ciudad_id' => $ciudad, 'numero' => 0, 'origen' => 'manual', 'activa' => 1));
        self::numerarPendientes($ciudad);
        if ($nombre === '') {
            BD::ejecutar("UPDATE paradas SET nombre = CONCAT('Parada ', numero) WHERE id = ?", array($nuevo));
        }
        self::purgarCache();
        return array('id' => $nuevo);
    }

    public static function paradaEliminar()
    {
        BD::ejecutar('DELETE FROM paradas WHERE id = ?', array(Req::entero('id')));
        self::purgarCache();
        return array();
    }

    public static function paradasLimpiar()
    {
        $ciudad = Req::entero('ciudad_id');
        if ($ciudad > 0) {
            $n = BD::ejecutar("DELETE FROM paradas WHERE origen = 'manual' AND (ciudad_id = ? OR ciudad_id IS NULL)", array($ciudad));
        } else {
            $n = BD::ejecutar("DELETE FROM paradas WHERE origen = 'manual'");
        }
        self::purgarCache();
        return array('eliminadas' => $n);
    }

    public static function paradasImportar()
    {
        $ciudadId = Req::entero('ciudad_id');
        $ciudad = BD::uno('SELECT id, nombre, codigo FROM ciudades WHERE id = ?', array($ciudadId));
        if (!$ciudad) {
            throw new ErrorApi('Ciudad no válida', 422);
        }

        $items = json_decode((string) Req::crudo('items', '[]'), true);
        if (!is_array($items)) {
            throw new ErrorApi('Datos de paradas no válidos', 422);
        }
        if (count($items) > 600) {
            throw new ErrorApi('Envía las paradas en grupos de 600 o menos', 422);
        }

        $codigo = self::asegurarCodigo($ciudad);
        $nuevas = 0;
        $omitidas = 0;

        BD::transaccion(function () use ($items, $ciudadId, $codigo, &$nuevas, &$omitidas) {
            $n = (int) BD::valor('SELECT COALESCE(MAX(numero), 0) FROM paradas WHERE ciudad_id = ?', array($ciudadId));

            foreach ($items as $it) {
                if (!is_array($it) || !isset($it['osm_id'], $it['lat'], $it['lng']) || !is_numeric($it['osm_id']) || !Geo::valida($it['lat'], $it['lng'])) {
                    $omitidas++;
                    continue;
                }

                $osm = (int) $it['osm_id'];
                if ($osm <= 0 || BD::uno('SELECT id FROM paradas WHERE osm_id = ?', array($osm))) {
                    $omitidas++;
                    continue;
                }

                $n++;
                $nombre = limpiar_texto(isset($it['nombre']) ? $it['nombre'] : '', 100);
                BD::insertar('paradas', array(
                    'nombre' => $nombre !== '' ? $nombre : 'Parada ' . $n,
                    'lat' => round((float) $it['lat'], 7),
                    'lng' => round((float) $it['lng'], 7),
                    'orden' => $n,
                    'ciudad_id' => $ciudadId,
                    'codigo' => $codigo . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT),
                    'numero' => $n,
                    'osm_id' => $osm,
                    'origen' => 'osm',
                    'activa' => 1,
                ));
                $nuevas++;
            }
        });

        self::numerarPendientes($ciudadId);
        self::purgarCache();
        return array('nuevas' => $nuevas, 'omitidas' => $omitidas);
    }

    public static function dominiosNormalizados($texto)
    {
        $lista = array();
        foreach (preg_split('/[\s,;]+/', strtolower((string) $texto)) as $d) {
            $d = ltrim(trim($d), '@');
            if ($d === '') {
                continue;
            }
            if (!preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $d)) {
                throw new ErrorApi('Dominio no válido: ' . $d, 422);
            }
            $lista[$d] = true;
        }
        return array_keys($lista);
    }

    public static function universidadPorCorreo($correo)
    {
        $correo = strtolower(trim((string) $correo));
        $pos = strrpos($correo, '@');
        if ($pos === false) {
            return null;
        }
        $host = substr($correo, $pos + 1);

        foreach (BD::todos('SELECT id, nombre, siglas, dominios, color FROM universidades WHERE habilitada = 1') as $u) {
            foreach (explode(',', $u['dominios']) as $d) {
                $d = trim($d);
                if ($d === '') {
                    continue;
                }
                if ($host === $d || substr($host, -(strlen($d) + 1)) === '.' . $d) {
                    return $u;
                }
            }
        }
        return null;
    }

    public static function universidades()
    {
        $filas = BD::todos('SELECT u.id, u.nombre, u.siglas, u.dominios, u.ciudad_id, u.color, u.habilitada, c.nombre AS ciudad, (SELECT COUNT(*) FROM buses b WHERE b.universidad_id = u.id) AS buses, (SELECT COUNT(*) FROM usuarios_finales f WHERE f.universidad_id = u.id) AS estudiantes FROM universidades u LEFT JOIN ciudades c ON c.id = u.ciudad_id ORDER BY u.siglas');
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['habilitada'] = (int) $f['habilitada'] === 1;
            $f['buses'] = (int) $f['buses'];
            $f['estudiantes'] = (int) $f['estudiantes'];
        }
        return array('universidades' => $filas);
    }

    public static function universidadGuardar()
    {
        $id = Req::entero('id');
        $siglas = strtoupper(preg_replace('/[^A-Za-z0-9\-]/', '', Req::texto('siglas', 20, true, 'Las siglas')));
        if ($siglas === '') {
            throw new ErrorApi('Las siglas no son válidas', 422);
        }

        $dominios = self::dominiosNormalizados(Req::texto('dominios', 255, true, 'Los dominios de correo'));
        if (!$dominios) {
            throw new ErrorApi('Escribe al menos un dominio de correo, por ejemplo uraccan.edu.ni', 422);
        }

        $repetida = BD::uno('SELECT id FROM universidades WHERE siglas = ? AND id <> ?', array($siglas, $id));
        if ($repetida) {
            throw new ErrorApi('Ya existe una universidad con esas siglas', 422);
        }

        $ciudad = Req::entero('ciudad_id');
        $color = Req::crudo('color');
        $datos = array(
            'nombre' => Req::texto('nombre', 150, true, 'El nombre'),
            'siglas' => $siglas,
            'dominios' => implode(',', $dominios),
            'ciudad_id' => $ciudad > 0 ? $ciudad : null,
            'color' => es_color($color) ? $color : null,
        );

        if ($id > 0) {
            BD::actualizar('universidades', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }

        $datos['habilitada'] = 1;
        $datos['fecha_creacion'] = ahora();
        return array('id' => BD::insertar('universidades', $datos));
    }

    public static function universidadEstado()
    {
        BD::actualizar('universidades', array('habilitada' => Req::bandera('habilitada')), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function universidadEliminar()
    {
        $id = Req::entero('id');
        BD::ejecutar('UPDATE buses SET universidad_id = NULL WHERE universidad_id = ?', array($id));
        BD::ejecutar('UPDATE usuarios_finales SET universidad_id = NULL WHERE universidad_id = ?', array($id));
        BD::ejecutar('DELETE FROM universidades WHERE id = ?', array($id));
        return array();
    }

    public static function universitariosPublico()
    {
        $uid = (int) Sesion::dato('universidad_id', 0);
        if ($uid <= 0) {
            return array('universidad' => null, 'buses' => array(), 'ahora' => time());
        }

        $uni = BD::uno('SELECT id, nombre, siglas, color FROM universidades WHERE id = ? AND habilitada = 1', array($uid));
        if (!$uni) {
            return array('universidad' => null, 'buses' => array(), 'ahora' => time());
        }

        $uni['id'] = (int) $uni['id'];
        return array('universidad' => $uni, 'buses' => Rastreo::flota(null, $uid), 'ahora' => time());
    }

    public static function exigirAccesoBus($busId)
    {
        $uni = BD::valor('SELECT universidad_id FROM buses WHERE id = ?', array((int) $busId));
        if ($uni !== null && (int) $uni > 0 && (int) $uni !== (int) Sesion::dato('universidad_id', 0)) {
            throw new ErrorApi('Bus no encontrado', 404);
        }
    }

    public static function cambiarCiudad()
    {
        if (Sesion::rol() !== 'usuario') {
            throw new ErrorApi('Solo los pasajeros pueden cambiar de ciudad', 403);
        }

        $ciudadId = Req::entero('ciudad_id');
        $ciudad = BD::uno('SELECT id, nombre, lat, lng FROM ciudades WHERE id = ? AND habilitada = 1', array($ciudadId));
        if (!$ciudad) {
            throw new ErrorApi('Ciudad no válida', 422);
        }

        BD::actualizar('usuarios_finales', array('ciudad_id' => $ciudadId), 'id = ?', array(Sesion::uid()));
        Sesion::poner('ciudad_id', $ciudadId);
        return array('ciudad' => $ciudad['nombre']);
    }

    private static function puntosValidos($crudo)
    {
        $puntos = json_decode((string) $crudo, true);
        if (!is_array($puntos)) {
            throw new ErrorApi('El trazo de la calle no es válido', 422);
        }

        $limpios = array();
        foreach ($puntos as $p) {
            if (is_array($p) && count($p) >= 2 && Geo::valida($p[0], $p[1])) {
                $limpios[] = array(round((float) $p[0], 6), round((float) $p[1], 6));
            }
        }

        if (count($limpios) < 2) {
            throw new ErrorApi('Marca al menos dos puntos sobre la calle cerrada', 422);
        }
        if (count($limpios) > 2500) {
            throw new ErrorApi('El trazo tiene demasiados puntos', 422);
        }
        return $limpios;
    }

    private static function cercaDeTrazo($ruta, $trazo, $umbralM)
    {
        $paso = max(1, (int) floor(count($trazo) / 80));
        $muestra = array();
        for ($i = 0; $i < count($trazo); $i += $paso) {
            $muestra[] = $trazo[$i];
        }
        $muestra[] = $trazo[count($trazo) - 1];

        $minLat = 999;
        $maxLat = -999;
        $minLng = 999;
        $maxLng = -999;
        foreach ($muestra as $p) {
            $minLat = min($minLat, $p[0]);
            $maxLat = max($maxLat, $p[0]);
            $minLng = min($minLng, $p[1]);
            $maxLng = max($maxLng, $p[1]);
        }
        $margen = 0.0006;

        foreach ($ruta as $r) {
            if (!is_array($r) || count($r) < 2) {
                continue;
            }
            if ($r[0] < $minLat - $margen || $r[0] > $maxLat + $margen || $r[1] < $minLng - $margen || $r[1] > $maxLng + $margen) {
                continue;
            }
            foreach ($muestra as $p) {
                if (Geo::distanciaKm((float) $r[0], (float) $r[1], $p[0], $p[1]) * 1000 <= $umbralM) {
                    return true;
                }
            }
        }
        return false;
    }

    private static function avisarBuses($cierreId, $ciudadId, $nombre, $motivo, $trazo)
    {
        $sql = 'SELECT id, nombre, propietario_id, ruta_json FROM buses WHERE habilitado = 1 AND ruta_json IS NOT NULL';
        $par = array();
        if ($ciudadId) {
            $sql .= ' AND (ciudad_id = ? OR ciudad_id IS NULL)';
            $par[] = $ciudadId;
        }

        $avisados = 0;
        foreach (BD::todos($sql, $par) as $b) {
            $ruta = json_decode($b['ruta_json'], true);
            if (!is_array($ruta) || !self::cercaDeTrazo($ruta, $trazo, 35)) {
                continue;
            }
            if ($b['propietario_id']) {
                Rastreo::aviso('propietario', (int) $b['propietario_id'], (int) $b['id'], 'Calle cerrada en tu ruta', $nombre . ($motivo !== '' ? ' (' . $motivo . ')' : '') . ' está cerrada y cruza la ruta de ' . $b['nombre'] . '. Avisa al chofer.', 'urgente');
            }
            $avisados++;
        }
        return $avisados;
    }

    public static function cierres()
    {
        $filas = BD::todos('SELECT k.id, k.ciudad_id, k.nombre, k.motivo, k.puntos, k.activa, k.hasta, k.fecha_creacion, c.nombre AS ciudad FROM calles_cerradas k LEFT JOIN ciudades c ON c.id = k.ciudad_id ORDER BY k.activa DESC, k.id DESC LIMIT 400');
        $ahora = ahora();
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['activa'] = (int) $f['activa'] === 1;
            $f['vencida'] = $f['hasta'] !== null && $f['hasta'] < $ahora;
            $p = json_decode($f['puntos'], true);
            $f['puntos'] = is_array($p) ? $p : array();
        }
        return array('cierres' => $filas);
    }

    public static function cierreGuardar()
    {
        $id = Req::entero('id');
        $ciudad = Req::entero('ciudad_id');
        if ($ciudad <= 0 || !BD::uno('SELECT id FROM ciudades WHERE id = ?', array($ciudad))) {
            throw new ErrorApi('Selecciona la ciudad del cierre', 422);
        }

        $trazo = self::puntosValidos(Req::crudo('puntos', '[]'));
        $fecha = Req::fecha('hasta');
        $datos = array(
            'ciudad_id' => $ciudad,
            'nombre' => Req::texto('nombre', 150, true, 'El nombre de la calle'),
            'motivo' => Req::texto('motivo', 255),
            'puntos' => json_encode($trazo),
            'hasta' => $fecha ? $fecha . ' 23:59:59' : null,
        );

        if ($id > 0) {
            BD::actualizar('calles_cerradas', $datos, 'id = ?', array($id));
            return array('id' => $id, 'buses_afectados' => 0);
        }

        $datos['activa'] = 1;
        $datos['creado_por'] = Sesion::uid();
        $datos['fecha_creacion'] = ahora();
        $id = BD::insertar('calles_cerradas', $datos);
        $afectados = self::avisarBuses($id, $ciudad, $datos['nombre'], $datos['motivo'], $trazo);
        return array('id' => $id, 'buses_afectados' => $afectados);
    }

    public static function cierreEstado()
    {
        $id = Req::entero('id');
        $activa = Req::bandera('activa');
        BD::actualizar('calles_cerradas', array('activa' => $activa), 'id = ?', array($id));

        $afectados = 0;
        if ($activa) {
            $c = BD::uno('SELECT ciudad_id, nombre, motivo, puntos FROM calles_cerradas WHERE id = ?', array($id));
            $trazo = $c ? json_decode($c['puntos'], true) : null;
            if ($c && is_array($trazo) && count($trazo) >= 2) {
                $afectados = self::avisarBuses($id, $c['ciudad_id'] ? (int) $c['ciudad_id'] : null, $c['nombre'], (string) $c['motivo'], $trazo);
            }
        }
        return array('buses_afectados' => $afectados);
    }

    public static function cierreEliminar()
    {
        BD::ejecutar('DELETE FROM calles_cerradas WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function cierresPublicos()
    {
        $c = Sesion::dato('ciudad_id');
        if (!$c) {
            return array('cierres' => array());
        }

        $filas = BD::todos('SELECT id, nombre, motivo, puntos, hasta FROM calles_cerradas WHERE activa = 1 AND ciudad_id = ? AND (hasta IS NULL OR hasta >= ?) ORDER BY id DESC LIMIT 100', array((int) $c, ahora()));
        $salida = array();
        foreach ($filas as $f) {
            $p = json_decode($f['puntos'], true);
            if (!is_array($p) || count($p) < 2) {
                continue;
            }
            $salida[] = array('id' => (int) $f['id'], 'nombre' => $f['nombre'], 'motivo' => $f['motivo'], 'hasta' => $f['hasta'], 'puntos' => $p);
        }
        return array('cierres' => $salida);
    }
}
