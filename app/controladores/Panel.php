<?php
final class Panel
{
    public static function alcance($alias = 'b')
    {
        $rol = Sesion::rol();
        if ($rol === 'propietario') {
            return array($alias . '.propietario_id = ?', array(Sesion::uid()));
        }
        if ($rol === 'cooperativa') {
            return array($alias . '.propietario_id IN (SELECT id FROM usuarios WHERE cooperativa_id = ?)', array(Sesion::uid()));
        }
        return array('1 = 1', array());
    }

    private static function estadoBus($fila)
    {
        $seg = $fila['timestamp_actualizacion'] ? max(0, time() - strtotime($fila['timestamp_actualizacion'])) : null;
        $limite = ((int) $fila['es_interurbano'] === 1 ? 12 : GPS_UMBRAL_DESCONEXION_MIN) * 60;
        return array($seg, ((int) $fila['activo'] === 1 && $seg !== null && $seg <= $limite));
    }

    public static function formatoBus($b)
    {
        list($seg, $conectado) = self::estadoBus($b);
        return array(
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
            'bateria' => $b['bateria_nivel'] !== null ? (int) $b['bateria_nivel'] : null,
            'cargando' => $b['bateria_cargando'] !== null ? (int) $b['bateria_cargando'] === 1 : null,
            'habilitado' => (int) $b['habilitado'] === 1,
            'interurbano' => (int) $b['es_interurbano'] === 1,
            'propietario_id' => $b['propietario_id'] !== null ? (int) $b['propietario_id'] : null,
            'propietario' => isset($b['propietario']) ? $b['propietario'] : null,
            'ciudad' => isset($b['ciudad']) ? $b['ciudad'] : null,
            'ultima' => $b['timestamp_actualizacion'],
            'minutos_umbral' => isset($b['minutos_umbral_desconexion']) && $b['minutos_umbral_desconexion'] !== null ? (int) $b['minutos_umbral_desconexion'] : null,
            'ciudad_id' => isset($b['ciudad_id']) && $b['ciudad_id'] !== null ? (int) $b['ciudad_id'] : null,
            'universidad_id' => isset($b['universidad_id']) && $b['universidad_id'] !== null ? (int) $b['universidad_id'] : null,
            'universidad' => isset($b['universidad']) ? $b['universidad'] : null,
            'seg' => $seg,
            'conectado' => $conectado,
        );
    }

    public static function busesDeAlcance()
    {
        list($donde, $par) = self::alcance('b');
        $filas = BD::todos('SELECT b.*, u.nombre AS propietario, c.nombre AS ciudad, un.siglas AS universidad FROM buses b LEFT JOIN usuarios u ON u.id = b.propietario_id LEFT JOIN ciudades c ON c.id = b.ciudad_id LEFT JOIN universidades un ON un.id = b.universidad_id WHERE ' . $donde . ' ORDER BY b.nombre', $par);
        return array_map(array('Panel', 'formatoBus'), $filas);
    }

    public static function resumen()
    {
        $buses = self::busesDeAlcance();
        $enLinea = 0;
        $habilitados = 0;
        foreach ($buses as $b) {
            $enLinea += $b['conectado'] ? 1 : 0;
            $habilitados += $b['habilitado'] ? 1 : 0;
        }
        return array('total' => count($buses), 'habilitados' => $habilitados, 'en_linea' => $enLinea, 'en_servicio' => Horario::dentro());
    }

    public static function buses()
    {
        return array('buses' => self::busesDeAlcance());
    }

    public static function mapa()
    {
        $salida = array('buses' => self::busesDeAlcance(), 'camiones' => array(), 'paradas' => array(), 'en_servicio' => Horario::dentro(), 'ahora' => time());
        $rol = Sesion::rol();

        if ($rol === 'admin' || $rol === 'auditor') {
            foreach (BD::todos('SELECT * FROM camiones_basura WHERE habilitado = 1 ORDER BY nombre') as $c) {
                $seg = $c['timestamp_actualizacion'] ? max(0, time() - strtotime($c['timestamp_actualizacion'])) : null;
                $salida['camiones'][] = array(
                    'id' => (int) $c['id'], 'nombre' => $c['nombre'], 'zona' => $c['zona'],
                    'lat' => $c['lat'] !== null ? (float) $c['lat'] : null, 'lng' => $c['lng'] !== null ? (float) $c['lng'] : null,
                    'vel' => $c['velocidad_kmh'] !== null ? (float) $c['velocidad_kmh'] : 0, 'rumbo' => $c['rumbo'] !== null ? (int) $c['rumbo'] : null,
                    'color' => $c['color'], 'bateria' => $c['bateria_nivel'] !== null ? (int) $c['bateria_nivel'] : null,
                    'seg' => $seg, 'conectado' => ((int) $c['activo_hoy'] === 1 && $seg !== null && $seg <= GPS_UMBRAL_DESCONEXION_MIN * 60),
                );
            }
        }

        foreach (BD::todos('SELECT id, nombre, lat, lng, numero, codigo FROM paradas WHERE activa = 1 ORDER BY ciudad_id, numero LIMIT 4000') as $p) {
            $salida['paradas'][] = array('id' => (int) $p['id'], 'nombre' => $p['nombre'], 'lat' => (float) $p['lat'], 'lng' => (float) $p['lng'], 'numero' => (int) $p['numero'], 'codigo' => $p['codigo']);
        }

        $salida['cierres'] = array();
        foreach (BD::todos('SELECT id, nombre, motivo, puntos FROM calles_cerradas WHERE activa = 1 AND (hasta IS NULL OR hasta >= ?) LIMIT 200', array(ahora())) as $k) {
            $pts = json_decode($k['puntos'], true);
            if (is_array($pts) && count($pts) > 1) {
                $salida['cierres'][] = array('id' => (int) $k['id'], 'nombre' => $k['nombre'], 'motivo' => $k['motivo'], 'puntos' => $pts);
            }
        }

        return $salida;
    }

    public static function bandeja()
    {
        $rol = Sesion::rol();
        if ($rol === 'propietario') {
            $filas = BD::todos('SELECT a.*, b.nombre AS bus FROM bandeja_avisos a LEFT JOIN buses b ON b.id = a.bus_id WHERE a.tipo_destinatario = ? AND a.propietario_id = ? ORDER BY a.id DESC LIMIT 120', array('propietario', Sesion::uid()));
        } elseif ($rol === 'admin' || $rol === 'auditor') {
            $filas = BD::todos('SELECT a.*, b.nombre AS bus FROM bandeja_avisos a LEFT JOIN buses b ON b.id = a.bus_id WHERE a.tipo_destinatario = ? ORDER BY a.id DESC LIMIT 200', array($rol));
        } else {
            $filas = array();
        }

        $sin = 0;
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['leido'] = (int) $f['leido'] === 1;
            $sin += $f['leido'] ? 0 : 1;
        }

        return array('avisos' => $filas, 'sin_leer' => $sin);
    }

    public static function leer()
    {
        $rol = Sesion::rol();
        $id = Req::entero('id');
        $todos = Req::bandera('todos');

        if ($rol === 'propietario') {
            $donde = 'tipo_destinatario = ? AND propietario_id = ?';
            $par = array('propietario', Sesion::uid());
        } elseif ($rol === 'admin' || $rol === 'auditor') {
            $donde = 'tipo_destinatario = ?';
            $par = array($rol);
        } else {
            return array();
        }

        if ($todos) {
            BD::ejecutar('UPDATE bandeja_avisos SET leido = 1 WHERE ' . $donde, $par);
        } else {
            BD::ejecutar('UPDATE bandeja_avisos SET leido = 1 WHERE id = ? AND ' . $donde, array_merge(array($id), $par));
        }
        return array();
    }

    public static function usuariosFinales()
    {
        $q = Req::texto('q', 40);
        $sql = 'SELECT u.id, u.nombre, u.telefono, u.fecha_registro, u.ultimo_acceso, u.correo_universitario, un.siglas AS universidad, c.nombre AS ciudad, (SELECT COUNT(*) FROM registro_accesos r WHERE r.usuario_final_id = u.id) AS accesos FROM usuarios_finales u LEFT JOIN ciudades c ON c.id = u.ciudad_id LEFT JOIN universidades un ON un.id = u.universidad_id';
        $par = array();
        if ($q !== '') {
            $sql .= ' WHERE u.nombre LIKE ? OR u.telefono LIKE ?';
            $par = array('%' . $q . '%', '%' . $q . '%');
        }
        $filas = BD::todos($sql . ' ORDER BY u.id DESC LIMIT 500', $par);
        $total = (int) BD::valor('SELECT COUNT(*) FROM usuarios_finales');
        return array('usuarios' => $filas, 'total' => $total);
    }

    public static function accesos()
    {
        $filas = BD::todos('SELECT r.id, r.tipo_usuario, r.fecha_hora, u.nombre, u.telefono FROM registro_accesos r JOIN usuarios_finales u ON u.id = r.usuario_final_id ORDER BY r.id DESC LIMIT 300');
        return array('accesos' => $filas);
    }

    public static function resenas()
    {
        $filas = BD::todos('SELECT id, nombre, comentario, calificacion, modulo, fecha_hora FROM resenas ORDER BY id DESC LIMIT 500');
        $dist = array(1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0);
        $suma = 0;
        $n = 0;
        foreach ($filas as $f) {
            if ($f['calificacion']) {
                $dist[(int) $f['calificacion']]++;
                $suma += (int) $f['calificacion'];
                $n++;
            }
        }
        return array('resenas' => $filas, 'distribucion' => array_values($dist), 'promedio' => $n ? round($suma / $n, 2) : null);
    }

    public static function camiones()
    {
        $filas = BD::todos('SELECT c.*, ci.nombre AS ciudad FROM camiones_basura c LEFT JOIN ciudades ci ON ci.id = c.ciudad_id ORDER BY c.nombre');
        $salida = array();
        foreach ($filas as $c) {
            $seg = $c['timestamp_actualizacion'] ? max(0, time() - strtotime($c['timestamp_actualizacion'])) : null;
            $salida[] = array(
                'id' => (int) $c['id'], 'nombre' => $c['nombre'], 'zona' => $c['zona'], 'ciudad' => $c['ciudad'],
                'lat' => $c['lat'] !== null ? (float) $c['lat'] : null, 'lng' => $c['lng'] !== null ? (float) $c['lng'] : null,
                'vel' => $c['velocidad_kmh'] !== null ? (float) $c['velocidad_kmh'] : 0,
                'bateria' => $c['bateria_nivel'] !== null ? (int) $c['bateria_nivel'] : null,
                'habilitado' => (int) $c['habilitado'] === 1, 'activo_hoy' => (int) $c['activo_hoy'] === 1,
                'seg' => $seg, 'conectado' => ((int) $c['activo_hoy'] === 1 && $seg !== null && $seg <= GPS_UMBRAL_DESCONEXION_MIN * 60),
                'ultima' => $c['timestamp_actualizacion'],
            );
        }
        return array('camiones' => $salida);
    }

    public static function recorrido()
    {
        $id = Req::entero('bus_id');
        list($donde, $par) = self::alcance('b');
        $bus = BD::uno('SELECT b.id FROM buses b WHERE b.id = ? AND ' . $donde, array_merge(array($id), $par));
        if (!$bus) {
            throw new ErrorApi('Bus no encontrado', 404);
        }
        $horas = max(1, min(72, Req::entero('horas', 12)));
        $filas = BD::todos('SELECT lat, lng, velocidad, fecha_hora FROM historial_posiciones WHERE bus_id = ? AND fecha_hora >= ? ORDER BY id ASC LIMIT 1500', array($id, hace($horas * 3600)));
        $km = 0;
        $anterior = null;
        $puntos = array();
        foreach ($filas as $f) {
            if ($anterior) {
                $km += Geo::distanciaKm((float) $anterior['lat'], (float) $anterior['lng'], (float) $f['lat'], (float) $f['lng']);
            }
            $anterior = $f;
            $puntos[] = array((float) $f['lat'], (float) $f['lng'], $f['velocidad'] !== null ? (float) $f['velocidad'] : null, $f['fecha_hora']);
        }
        return array('puntos' => $puntos, 'km' => round($km, 1));
    }

    public static function sos()
    {
        $rol = Sesion::rol();
        $desde = Req::entero('desde');
        $sql = 'SELECT s.id, s.tipo, s.lat, s.lng, s.atendida, s.fecha_hora, b.nombre AS bus FROM alertas_sos s JOIN buses b ON b.id = s.bus_id WHERE s.id > ?';
        $par = array($desde);
        if ($rol === 'propietario') {
            $sql .= ' AND s.propietario_id = ?';
            $par[] = Sesion::uid();
        }
        $filas = BD::todos($sql . ' ORDER BY s.id DESC LIMIT 60', $par);
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['atendida'] = (int) $f['atendida'] === 1;
            $f['lat'] = $f['lat'] !== null ? (float) $f['lat'] : null;
            $f['lng'] = $f['lng'] !== null ? (float) $f['lng'] : null;
        }
        return array('sos' => $filas);
    }

    public static function sosAtender()
    {
        $id = Req::entero('id');
        $rol = Sesion::rol();
        if ($rol === 'propietario') {
            BD::ejecutar('UPDATE alertas_sos SET atendida = 1 WHERE id = ? AND propietario_id = ?', array($id, Sesion::uid()));
        } else {
            BD::ejecutar('UPDATE alertas_sos SET atendida = 1 WHERE id = ?', array($id));
        }
        return array();
    }

    public static function propietarios()
    {
        $rol = Sesion::rol();
        $sql = 'SELECT u.id, u.nombre, u.correo, u.tipo_propietario, u.cuenta_activa, u.ultimo_acceso, c.nombre AS ciudad, (SELECT COUNT(*) FROM buses b WHERE b.propietario_id = u.id) AS buses FROM usuarios u LEFT JOIN ciudades c ON c.id = u.ciudad_id WHERE u.rol = ?';
        $par = array('propietario');
        if ($rol === 'cooperativa') {
            $sql .= ' AND u.cooperativa_id = ?';
            $par[] = Sesion::uid();
        }
        return array('propietarios' => BD::todos($sql . ' ORDER BY u.nombre', $par));
    }
}
