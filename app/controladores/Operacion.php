<?php
final class Operacion
{
    public static function novedad($t)
    {
        $id = (int) $t['b'];
        $datos = array();

        $oc = Req::crudo('ocupacion', null);
        if ($oc !== null && $oc !== '') {
            $oc = (int) $oc;
            if ($oc < 0 || $oc > 3) {
                throw new ErrorApi('Ocupación no válida', 422);
            }
            $datos['ocupacion'] = $oc;
            $datos['ocupacion_ts'] = ahora();
        }

        $dv = Req::crudo('desvio', null);
        if ($dv !== null && $dv !== '') {
            $datos['desvio'] = Req::bandera('desvio');
        }

        if (!$datos) {
            throw new ErrorApi('Nada que actualizar', 422);
        }

        BD::actualizar('buses', $datos, 'id = ?', array($id));
        $b = BD::uno('SELECT ocupacion, desvio FROM buses WHERE id = ?', array($id));
        return array('ocupacion' => (int) $b['ocupacion'], 'desvio' => (int) $b['desvio'] === 1);
    }

    public static function llegue($t)
    {
        $id = (int) $t['b'];
        if (!Seg::limitar('llegue:' . $id, 6, 60)) {
            throw new ErrorApi('Espera un momento antes de registrar otra llegada', 429);
        }

        $b = BD::uno('SELECT lat, lng, ciudad_id FROM buses WHERE id = ?', array($id));
        if (!$b || $b['lat'] === null) {
            throw new ErrorApi('Aún no tenemos tu ubicación. Inicia la transmisión primero.', 422);
        }

        $lat = (float) $b['lat'];
        $lng = (float) $b['lng'];
        $d = 0.0012;
        $sql = 'SELECT id, nombre, numero, codigo, lat, lng FROM paradas WHERE activa = 1 AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?';
        $par = array($lat - $d, $lat + $d, $lng - $d, $lng + $d);
        if ($b['ciudad_id']) {
            $sql .= ' AND ciudad_id = ?';
            $par[] = (int) $b['ciudad_id'];
        }

        $mejor = null;
        $mejorD = 90;
        foreach (BD::todos($sql . ' LIMIT 60', $par) as $p) {
            $m = Geo::distanciaKm($lat, $lng, (float) $p['lat'], (float) $p['lng']) * 1000;
            if ($m < $mejorD) {
                $mejorD = $m;
                $mejor = $p;
            }
        }

        if (!$mejor) {
            throw new ErrorApi('No estás cerca de una parada registrada', 404);
        }

        $reciente = BD::uno('SELECT id FROM llegadas_parada WHERE bus_id = ? AND parada_id = ? AND fecha_hora >= ?', array($id, (int) $mejor['id'], hace(180)));
        if (!$reciente) {
            BD::insertar('llegadas_parada', array('bus_id' => $id, 'parada_id' => (int) $mejor['id'], 'fecha_hora' => ahora()));
        }

        return array('parada' => $mejor['nombre'], 'numero' => (int) $mejor['numero'], 'mensaje' => 'Llegada registrada en ' . ($mejor['codigo'] ? $mejor['codigo'] . ' · ' : '') . $mejor['nombre']);
    }

    private static function busesAlcance()
    {
        list($donde, $par) = Panel::alcance('b');
        return BD::todos('SELECT b.id, b.nombre, b.origen, b.destino, u.nombre AS propietario FROM buses b LEFT JOIN usuarios u ON u.id = b.propietario_id WHERE ' . $donde . ' ORDER BY b.nombre', $par);
    }

    private static function metricas($busId, $desde)
    {
        $km = 0.0;
        $seg = 0;
        $dias = array();
        $anterior = null;

        foreach (BD::todos('SELECT lat, lng, fecha_hora FROM historial_posiciones WHERE bus_id = ? AND fecha_hora >= ? ORDER BY id', array($busId, $desde)) as $f) {
            $ts = strtotime($f['fecha_hora']);
            $dias[substr($f['fecha_hora'], 0, 10)] = true;
            if ($anterior !== null) {
                $gap = $ts - $anterior['ts'];
                if ($gap > 0 && $gap <= 300) {
                    $seg += $gap;
                    $d = Geo::distanciaKm($anterior['lat'], $anterior['lng'], (float) $f['lat'], (float) $f['lng']);
                    if ($d < 3) {
                        $km += $d;
                    }
                }
            }
            $anterior = array('ts' => $ts, 'lat' => (float) $f['lat'], 'lng' => (float) $f['lng']);
        }

        return array('km' => round($km, 1), 'horas' => round($seg / 3600, 1), 'dias_activo' => count($dias));
    }

    private static function filasDesempeno($dias)
    {
        $desde = hace($dias * 86400);
        $filas = array();

        foreach (self::busesAlcance() as $b) {
            $id = (int) $b['id'];
            $m = self::metricas($id, $desde);
            $nota = BD::uno('SELECT COUNT(*) AS n, AVG(calificacion) AS prom FROM resenas WHERE bus_id = ? AND calificacion IS NOT NULL AND fecha_hora >= ?', array($id, $desde));
            $incidentes = BD::todos('SELECT titulo, COUNT(*) AS n FROM bandeja_avisos WHERE bus_id = ? AND tipo_destinatario = ? AND fecha_hora >= ? GROUP BY titulo', array($id, 'admin', $desde));
            $desconexiones = 0;
            $fuera = 0;
            foreach ($incidentes as $i) {
                if (strpos($i['titulo'], 'dejó de transmitir') !== false) {
                    $desconexiones += (int) $i['n'];
                }
                if (strpos($i['titulo'], 'fuera de su ruta') !== false) {
                    $fuera += (int) $i['n'];
                }
            }

            $filas[] = array(
                'id' => $id,
                'bus' => $b['nombre'],
                'ruta' => $b['origen'] . ' → ' . $b['destino'],
                'propietario' => $b['propietario'],
                'km' => $m['km'],
                'horas' => $m['horas'],
                'dias_activo' => $m['dias_activo'],
                'llegadas' => (int) BD::valor('SELECT COUNT(*) FROM llegadas_parada WHERE bus_id = ? AND fecha_hora >= ?', array($id, $desde)),
                'resenas' => (int) $nota['n'],
                'nota' => $nota['prom'] !== null ? round((float) $nota['prom'], 1) : null,
                'sos' => (int) BD::valor('SELECT COUNT(*) FROM alertas_sos WHERE bus_id = ? AND fecha_hora >= ?', array($id, $desde)),
                'desconexiones' => $desconexiones,
                'fuera_ruta' => $fuera,
            );
        }
        return $filas;
    }

    public static function desempeno()
    {
        $dias = max(1, min(14, Req::entero('dias', 7)));
        $filas = self::filasDesempeno($dias);
        $km = 0;
        $horas = 0;
        foreach ($filas as $f) {
            $km += $f['km'];
            $horas += $f['horas'];
        }
        return array('dias' => $dias, 'buses' => $filas, 'total_km' => round($km, 1), 'total_horas' => round($horas, 1));
    }

    public static function desempenoPdf()
    {
        $dias = max(1, min(14, Req::entero('dias', 7)));
        $filas = self::filasDesempeno($dias);
        $pdf = new Pdf();
        $pdf->configurar('Desempeño de buses', 'Últimos ' . $dias . ' días');
        $pdf->AddPage();
        $km = 0;
        $horas = 0;
        foreach ($filas as $f) {
            $km += $f['km'];
            $horas += $f['horas'];
        }
        $pdf->indicadores(array(array('Buses', count($filas)), array('Kilómetros', round($km, 1)), array('Horas en servicio', round($horas, 1))));
        $pdf->seccion('Detalle por bus');
        $pdf->tabla(array('Bus', 'Km', 'Horas', 'Paradas', 'Nota', 'SOS', 'Cortes', 'Fuera ruta'), array_map(function ($f) {
            return array($f['bus'], $f['km'], $f['horas'], $f['llegadas'], $f['nota'] !== null ? $f['nota'] . '/5' : '—', $f['sos'], $f['desconexiones'], $f['fuera_ruta']);
        }, $filas), array(50, 18, 18, 22, 18, 14, 22, 28));
        $pdf->enviar('desempeno_' . date('Y-m-d_His') . '.pdf');
    }

    public static function resenasBus()
    {
        list($donde, $par) = Panel::alcance('b');
        $filas = BD::todos('SELECT r.id, r.nombre, r.comentario, r.calificacion, r.fecha_hora, b.nombre AS bus FROM resenas r JOIN buses b ON b.id = r.bus_id WHERE ' . $donde . ' ORDER BY r.id DESC LIMIT 200', $par);
        $resumen = BD::todos('SELECT b.nombre AS bus, COUNT(*) AS n, AVG(r.calificacion) AS prom FROM resenas r JOIN buses b ON b.id = r.bus_id WHERE ' . $donde . ' GROUP BY b.id, b.nombre ORDER BY b.nombre', $par);
        foreach ($resumen as &$r) {
            $r['n'] = (int) $r['n'];
            $r['prom'] = $r['prom'] !== null ? round((float) $r['prom'], 1) : null;
        }
        return array('resenas' => $filas, 'resumen' => $resumen);
    }

    public static function turnos()
    {
        list($donde, $par) = Panel::alcance('b');
        $filas = BD::todos('SELECT t.id, t.bus_id, t.dias, t.hora_salida, t.hora_fin, t.nota, b.nombre AS bus FROM turnos t JOIN buses b ON b.id = t.bus_id WHERE ' . $donde . ' ORDER BY b.nombre, t.hora_salida', $par);
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['bus_id'] = (int) $f['bus_id'];
            $f['hora_salida'] = substr($f['hora_salida'], 0, 5);
            $f['hora_fin'] = $f['hora_fin'] ? substr($f['hora_fin'], 0, 5) : null;
        }
        $buses = BD::todos('SELECT b.id, b.nombre FROM buses b WHERE ' . $donde . ' ORDER BY b.nombre', $par);
        return array('turnos' => $filas, 'buses' => $buses);
    }

    private static function hora($clave, $obligatoria)
    {
        $v = Req::texto($clave, 5);
        if ($v === '') {
            if ($obligatoria) {
                throw new ErrorApi('Indica la hora de salida', 422);
            }
            return null;
        }
        if (!preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/', $v)) {
            throw new ErrorApi('La hora debe tener formato HH:MM', 422);
        }
        return $v . ':00';
    }

    private static function diasValidos($crudo)
    {
        $dias = array();
        foreach (explode(',', (string) $crudo) as $d) {
            if ($d !== '' && ctype_digit($d) && (int) $d >= 0 && (int) $d <= 6) {
                $dias[(int) $d] = true;
            }
        }
        if (!$dias) {
            throw new ErrorApi('Elige al menos un día', 422);
        }
        $lista = array_keys($dias);
        sort($lista);
        return implode(',', $lista);
    }

    public static function turnoGuardar()
    {
        list($donde, $par) = Panel::alcance('b');
        $busId = Req::entero('bus_id');
        if (!BD::uno('SELECT b.id FROM buses b WHERE b.id = ? AND ' . $donde, array_merge(array($busId), $par))) {
            throw new ErrorApi('Bus no válido', 422);
        }

        $datos = array(
            'bus_id' => $busId,
            'dias' => self::diasValidos(Req::texto('dias', 20)),
            'hora_salida' => self::hora('hora_salida', true),
            'hora_fin' => self::hora('hora_fin', false),
            'nota' => Req::texto('nota', 150),
        );

        $id = Req::entero('id');
        if ($id > 0) {
            BD::actualizar('turnos', $datos, 'id = ? AND bus_id IN (SELECT b.id FROM buses b WHERE ' . $donde . ')', array_merge(array($id), $par));
            return array('id' => $id);
        }
        return array('id' => BD::insertar('turnos', $datos));
    }

    public static function turnoEliminar()
    {
        list($donde, $par) = Panel::alcance('b');
        BD::ejecutar('DELETE FROM turnos WHERE id = ? AND bus_id IN (SELECT b.id FROM buses b WHERE ' . $donde . ')', array_merge(array(Req::entero('id')), $par));
        return array();
    }

    private static function filtroBitacora()
    {
        $donde = array('1 = 1');
        $par = array();

        $tipo = Req::texto('tipo', 40);
        if ($tipo !== '') {
            $donde[] = 'tipo = ?';
            $par[] = $tipo;
        }
        $rol = Req::texto('rol', 30);
        if ($rol !== '') {
            $donde[] = 'rol = ?';
            $par[] = $rol;
        }
        $uid = Req::entero('usuario_id');
        if ($uid > 0) {
            $donde[] = 'usuario_id = ?';
            $par[] = $uid;
        }
        $desde = Req::fecha('desde');
        if ($desde) {
            $donde[] = 'momento >= ?';
            $par[] = $desde . ' 00:00:00';
        }
        $hasta = Req::fecha('hasta');
        if ($hasta) {
            $donde[] = 'momento <= ?';
            $par[] = $hasta . ' 23:59:59';
        }
        $exito = Req::opcion('exito', array('0', '1'), null);
        if ($exito !== null) {
            $donde[] = 'exito = ?';
            $par[] = (int) $exito;
        }
        $q = Req::texto('q', 60);
        if ($q !== '') {
            $donde[] = '(detalle LIKE ? OR endpoint LIKE ? OR ip LIKE ?)';
            $par[] = '%' . $q . '%';
            $par[] = '%' . $q . '%';
            $par[] = '%' . $q . '%';
        }
        return array(implode(' AND ', $donde), $par);
    }

    public static function bitacora()
    {
        list($cond, $par) = self::filtroBitacora();
        $pagina = max(1, Req::entero('pagina', 1));
        $porPagina = 50;
        $total = (int) BD::valor('SELECT COUNT(*) FROM bitacora_seguridad WHERE ' . $cond, $par);
        $filas = BD::todos('SELECT id, momento, ip, rol, usuario_id, tipo, endpoint, detalle, exito FROM bitacora_seguridad WHERE ' . $cond . ' ORDER BY id DESC LIMIT ' . $porPagina . ' OFFSET ' . (($pagina - 1) * $porPagina), $par);
        $tipos = array();
        foreach (BD::todos('SELECT DISTINCT tipo FROM bitacora_seguridad ORDER BY tipo LIMIT 60') as $t) {
            $tipos[] = $t['tipo'];
        }
        return array('registros' => $filas, 'total' => $total, 'pagina' => $pagina, 'por_pagina' => $porPagina, 'tipos' => $tipos);
    }

    public static function bitacoraPdf()
    {
        list($cond, $par) = self::filtroBitacora();
        $filas = BD::todos('SELECT momento, ip, rol, usuario_id, tipo, detalle, exito FROM bitacora_seguridad WHERE ' . $cond . ' ORDER BY id DESC LIMIT 1500', $par);
        $pdf = new Pdf();
        $pdf->configurar('Bitácora de seguridad', 'Con los filtros aplicados');
        $pdf->AddPage();
        $fallos = 0;
        foreach ($filas as $f) {
            $fallos += (int) $f['exito'] === 1 ? 0 : 1;
        }
        $pdf->indicadores(array(array('Registros', count($filas)), array('Con fallo', $fallos)));
        $pdf->seccion('Detalle');
        $pdf->tabla(array('Fecha', 'IP', 'Rol', 'Usuario', 'Tipo', 'Detalle', 'Resultado'), array_map(function ($f) {
            return array($f['momento'], $f['ip'], $f['rol'], $f['usuario_id'] !== null ? $f['usuario_id'] : '—', $f['tipo'], $f['detalle'], (int) $f['exito'] === 1 ? 'OK' : 'Fallo');
        }, $filas), array(32, 28, 20, 16, 26, 50, 18));
        $pdf->enviar('bitacora_' . date('Y-m-d_His') . '.pdf');
    }

    public static function reportes()
    {
        $estado = Req::opcion('estado', array('pendiente', 'aprobado', 'rechazado'), 'pendiente');
        $filas = BD::todos('SELECT r.id, r.tipo, r.lat, r.lng, r.texto, r.estado, r.nota_admin, r.fecha_hora, r.ciudad_id, r.bus_id, r.parada_id, u.nombre AS usuario, u.telefono, c.nombre AS ciudad, b.nombre AS bus FROM reportes_usuarios r LEFT JOIN usuarios_finales u ON u.id = r.usuario_final_id LEFT JOIN ciudades c ON c.id = r.ciudad_id LEFT JOIN buses b ON b.id = r.bus_id WHERE r.estado = ? ORDER BY r.id DESC LIMIT 200', array($estado));
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['lat'] = $f['lat'] !== null ? (float) $f['lat'] : null;
            $f['lng'] = $f['lng'] !== null ? (float) $f['lng'] : null;
            $f['similares'] = 0;
            if ($estado === 'pendiente' && $f['lat'] !== null) {
                $f['similares'] = (int) BD::valor('SELECT COUNT(*) FROM reportes_usuarios WHERE estado = ? AND tipo = ? AND id <> ? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?', array('pendiente', $f['tipo'], $f['id'], $f['lat'] - 0.0006, $f['lat'] + 0.0006, $f['lng'] - 0.0006, $f['lng'] + 0.0006));
            }
        }
        $pendientes = (int) BD::valor("SELECT COUNT(*) FROM reportes_usuarios WHERE estado = 'pendiente'");
        return array('reportes' => $filas, 'pendientes' => $pendientes);
    }

    public static function reporteResolver()
    {
        $id = Req::entero('id');
        $accion = Req::opcion('accion', array('aprobar', 'rechazar'));
        if ($accion === null) {
            throw new ErrorApi('Acción no válida', 422);
        }

        $r = BD::uno('SELECT * FROM reportes_usuarios WHERE id = ?', array($id));
        if (!$r || $r['estado'] !== 'pendiente') {
            throw new ErrorApi('El reporte ya fue atendido', 404);
        }

        $nota = Req::texto('nota', 255);
        $estado = $accion === 'aprobar' ? 'aprobado' : 'rechazado';
        $paradaId = null;
        $cerrar = null;

        if ($accion === 'aprobar') {
            if ($r['tipo'] === 'parada_falta') {
                if (!$r['ciudad_id'] || $r['lat'] === null) {
                    throw new ErrorApi('El reporte no tiene ciudad o ubicación para crear la parada', 422);
                }
                $nombre = limpiar_texto($r['texto'], 100);
                $paradaId = BD::insertar('paradas', array('nombre' => $nombre !== '' ? $nombre : 'Parada', 'lat' => $r['lat'], 'lng' => $r['lng'], 'orden' => 0, 'ciudad_id' => (int) $r['ciudad_id'], 'numero' => 0, 'origen' => 'usuario', 'activa' => 1));
                Territorio::numerarPendientes((int) $r['ciudad_id']);
                if ($nombre === '') {
                    BD::ejecutar("UPDATE paradas SET nombre = CONCAT('Parada ', numero) WHERE id = ?", array($paradaId));
                }
                Territorio::purgarCache();
            } elseif ($r['tipo'] === 'bus_problema' && $r['bus_id']) {
                $b = BD::uno('SELECT id, nombre, propietario_id FROM buses WHERE id = ?', array((int) $r['bus_id']));
                if ($b && $b['propietario_id']) {
                    Rastreo::aviso('propietario', (int) $b['propietario_id'], (int) $b['id'], 'Reporte de un pasajero sobre ' . $b['nombre'], limpiar_texto($r['texto'], 300), 'advertencia');
                }
            } elseif ($r['tipo'] === 'calle_cerrada') {
                $cerrar = array('lat' => (float) $r['lat'], 'lng' => (float) $r['lng'], 'ciudad_id' => $r['ciudad_id'] ? (int) $r['ciudad_id'] : null);
            }
        }

        $cambios = array('estado' => $estado, 'nota_admin' => $nota, 'fecha_resolucion' => ahora(), 'parada_id' => $paradaId);
        BD::actualizar('reportes_usuarios', $cambios, 'id = ?', array($id));
        $resueltos = 1;

        if (Req::bandera('similares') && $r['lat'] !== null) {
            $resueltos += BD::actualizar('reportes_usuarios', array('estado' => $estado, 'nota_admin' => $nota !== '' ? $nota : 'Resuelto junto con el reporte #' . $id, 'fecha_resolucion' => ahora()), "estado = 'pendiente' AND tipo = ? AND id <> ? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?", array($r['tipo'], $id, $r['lat'] - 0.0006, $r['lat'] + 0.0006, $r['lng'] - 0.0006, $r['lng'] + 0.0006));
        }

        return array('resueltos' => $resueltos, 'cerrar' => $cerrar, 'parada_id' => $paradaId);
    }

    public static function demanda()
    {
        $dias = max(1, min(60, Req::entero('dias', 14)));
        $ciudad = Req::entero('ciudad_id');
        $desde = hace($dias * 86400);
        $donde = 'q.fecha_hora >= ?';
        $par = array($desde);
        if ($ciudad > 0) {
            $donde .= ' AND q.ciudad_id = ?';
            $par[] = $ciudad;
        }

        $filas = BD::todos('SELECT p.id, p.nombre, p.numero, p.codigo, p.lat, p.lng, c.nombre AS ciudad, COUNT(*) AS n FROM consultas_parada q JOIN paradas p ON p.id = q.parada_id LEFT JOIN ciudades c ON c.id = p.ciudad_id WHERE ' . $donde . ' GROUP BY p.id, p.nombre, p.numero, p.codigo, p.lat, p.lng, c.nombre ORDER BY n DESC LIMIT 300', $par);
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['lat'] = (float) $f['lat'];
            $f['lng'] = (float) $f['lng'];
            $f['n'] = (int) $f['n'];
            $f['numero'] = (int) $f['numero'];
        }

        $horas = array_fill(0, 24, 0);
        foreach (BD::todos('SELECT ' . BD::sqlHora('q.fecha_hora') . ' AS h, COUNT(*) AS n FROM consultas_parada q WHERE ' . $donde . ' GROUP BY h', $par) as $h) {
            $horas[(int) $h['h']] = (int) $h['n'];
        }

        return array('dias' => $dias, 'paradas' => $filas, 'por_hora' => $horas, 'total' => (int) BD::valor('SELECT COUNT(*) FROM consultas_parada q WHERE ' . $donde, $par));
    }

    public static function respaldos()
    {
        return array('respaldos' => Respaldo::listar(), 'automatico' => true);
    }

    public static function respaldoCrear()
    {
        $r = Respaldo::crear();
        return array('archivo' => $r['archivo'], 'bytes' => $r['bytes']);
    }

    public static function respaldoDescargar()
    {
        $archivo = basename(Req::texto('archivo', 80));
        if (!preg_match('/^mibus_[0-9]{8}_[0-9]{6}\.sql(\.gz)?$/', $archivo) || !is_file(RAIZ . '/storage/respaldos/' . $archivo)) {
            throw new ErrorApi('Respaldo no encontrado', 404);
        }

        Seg::registrar('accion', 'Descarga de respaldo ' . $archivo, true, 'admin/respaldo/descargar');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $archivo . '"');
        header('Content-Length: ' . filesize(RAIZ . '/storage/respaldos/' . $archivo));
        readfile(RAIZ . '/storage/respaldos/' . $archivo);
        exit;
    }

    public static function horariosUni()
    {
        $uni = Req::entero('universidad_id');
        $filas = BD::todos('SELECT h.id, h.universidad_id, h.bus_id, h.dias, h.hora, h.origen, h.destino, h.nota, b.nombre AS bus FROM horarios_universidad h LEFT JOIN buses b ON b.id = h.bus_id WHERE h.universidad_id = ? ORDER BY h.hora', array($uni));
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['hora'] = substr($f['hora'], 0, 5);
        }
        $buses = BD::todos('SELECT id, nombre FROM buses WHERE universidad_id = ? ORDER BY nombre', array($uni));
        return array('horarios' => $filas, 'buses' => $buses);
    }

    public static function horarioUniGuardar()
    {
        $uni = Req::entero('universidad_id');
        if (!BD::uno('SELECT id FROM universidades WHERE id = ?', array($uni))) {
            throw new ErrorApi('Universidad no válida', 422);
        }

        $bus = Req::entero('bus_id');
        if ($bus > 0 && !BD::uno('SELECT id FROM buses WHERE id = ? AND universidad_id = ?', array($bus, $uni))) {
            throw new ErrorApi('Ese bus no pertenece a la universidad', 422);
        }

        $datos = array(
            'universidad_id' => $uni,
            'bus_id' => $bus > 0 ? $bus : null,
            'dias' => self::diasValidos(Req::texto('dias', 20)),
            'hora' => self::hora('hora', true),
            'origen' => Req::texto('origen', 100),
            'destino' => Req::texto('destino', 100),
            'nota' => Req::texto('nota', 150),
        );

        $id = Req::entero('id');
        if ($id > 0) {
            BD::actualizar('horarios_universidad', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }
        return array('id' => BD::insertar('horarios_universidad', $datos));
    }

    public static function horarioUniEliminar()
    {
        BD::ejecutar('DELETE FROM horarios_universidad WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function avisosUni()
    {
        $uni = Req::entero('universidad_id');
        $filas = BD::todos('SELECT a.id, a.universidad_id, a.titulo, a.mensaje, a.gravedad, a.activo, a.expira, a.fecha_hora, u.siglas FROM avisos_universidad a JOIN universidades u ON u.id = a.universidad_id' . ($uni > 0 ? ' WHERE a.universidad_id = ?' : '') . ' ORDER BY a.id DESC LIMIT 100', $uni > 0 ? array($uni) : array());
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['activo'] = (int) $f['activo'] === 1;
        }
        return array('avisos' => $filas);
    }

    public static function avisoUniGuardar()
    {
        $uni = Req::entero('universidad_id');
        if (!BD::uno('SELECT id FROM universidades WHERE id = ?', array($uni))) {
            throw new ErrorApi('Universidad no válida', 422);
        }

        $datos = array(
            'universidad_id' => $uni,
            'titulo' => Req::texto('titulo', 150, true, 'El título'),
            'mensaje' => Req::texto('mensaje', 600, true, 'El mensaje'),
            'gravedad' => Req::opcion('gravedad', array('info', 'advertencia', 'urgente'), 'info'),
            'expira' => Req::fecha('expira'),
        );

        $id = Req::entero('id');
        if ($id > 0) {
            BD::actualizar('avisos_universidad', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }

        $datos['activo'] = 1;
        $datos['fecha_hora'] = ahora();
        return array('id' => BD::insertar('avisos_universidad', $datos));
    }

    public static function avisoUniEstado()
    {
        BD::actualizar('avisos_universidad', array('activo' => Req::bandera('activo')), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function avisoUniEliminar()
    {
        BD::ejecutar('DELETE FROM avisos_universidad WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function anuncioEnlace()
    {
        $id = Req::entero('id');
        $a = BD::uno('SELECT id, token_panel FROM anuncios_locales WHERE id = ?', array($id));
        if (!$a) {
            throw new ErrorApi('Anuncio no encontrado', 404);
        }

        $token = $a['token_panel'];
        if (!$token || Req::bandera('renovar')) {
            $token = bin2hex(random_bytes(16));
            BD::actualizar('anuncios_locales', array('token_panel' => $token), 'id = ?', array($id));
        }
        return array('ruta' => url('/anunciante/' . $token));
    }
}
