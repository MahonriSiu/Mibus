<?php
final class Reportes
{
    private static $paneles = array(
        'mapa' => array('Mapa público', '/'),
        'basura' => array('Camión de basura', '/basura'),
        'admin' => array('Administrador', '/admin/login'),
        'auditor' => array('Auditor', '/auditor/login'),
        'propietario' => array('Propietario', '/propietario/login'),
        'cooperativa' => array('Cooperativa', '/cooperativa/login'),
        'chofer' => array('Chofer de bus', '/emisor/login'),
        'camion' => array('Chofer de camión', '/emisor-camion/login'),
    );

    private static function urlAbsoluta($ruta)
    {
        $host = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.:\-]/', '', $_SERVER['HTTP_HOST']) : 'localhost';
        return (Seg::https() ? 'https://' : 'http://') . $host . url($ruta);
    }

    public static function qr()
    {
        $clave = Req::opcion('panel', array_keys(self::$paneles), null);
        $formato = Req::opcion('formato', array('png', 'svg', 'pdf'), 'png');

        if ($formato === 'pdf') {
            self::qrPdf(Req::opcion('tamano', array('grande', 'pequeno'), 'grande'));
        }

        if ($clave === null) {
            throw new ErrorApi('Panel no válido', 422);
        }

        $dato = self::urlAbsoluta(self::$paneles[$clave][1]);
        $etiqueta = self::$paneles[$clave][0];

        if ($formato === 'svg') {
            header('Content-Type: image/svg+xml');
            header('Cache-Control: private, max-age=300');
            echo Qr::svg($dato, 'H');
            exit;
        }

        header('Content-Type: image/png');
        if (Req::bandera('descargar')) {
            header('Content-Disposition: attachment; filename="qr_' . $clave . '.png"');
        }
        echo Qr::png($dato, 900, RAIZ . '/public/assets/img/logo.png', Pdf::t($etiqueta));
        exit;
    }

    private static function qrPdf($tamano)
    {
        $pdf = new Pdf();
        $pdf->configurar('Códigos QR de acceso', 'Nivel de corrección H con logo', false);
        $lado = $tamano === 'grande' ? 130 : 56;
        $porFila = $tamano === 'grande' ? 1 : 3;
        $temporales = array();
        $i = 0;

        foreach (self::$paneles as $clave => $p) {
            if ($tamano === 'grande' || $i % 9 === 0) {
                $pdf->AddPage();
            }
            $archivo = tempnam(sys_get_temp_dir(), 'qr') . '.png';
            file_put_contents($archivo, Qr::png(self::urlAbsoluta($p[1]), 700, RAIZ . '/public/assets/img/logo.png'));
            $temporales[] = $archivo;

            if ($tamano === 'grande') {
                $pdf->Image($archivo, 40, 55, $lado, $lado, 'PNG');
                $pdf->SetFont('Helvetica', 'B', 20);
                $pdf->SetXY(10, 195);
                $pdf->Cell(190, 10, Pdf::t($p[0]), 0, 1, 'C');
                $pdf->SetFont('Helvetica', '', 9);
                $pdf->SetTextColor(110, 122, 134);
                $pdf->Cell(190, 6, self::urlAbsoluta($p[1]), 0, 1, 'C');
                $pdf->SetTextColor(20, 30, 40);
            } else {
                $col = $i % $porFila;
                $fila = intdiv($i % 9, $porFila);
                $x = 12 + $col * 63;
                $y = 42 + $fila * 78;
                $pdf->Image($archivo, $x, $y, $lado, $lado, 'PNG');
                $pdf->SetFont('Helvetica', 'B', 9);
                $pdf->SetXY($x, $y + $lado + 1);
                $pdf->Cell($lado, 6, Pdf::t($p[0]), 0, 0, 'C');
            }
            $i++;
        }

        foreach ($temporales as $t) {
            @unlink($t);
        }
        $pdf->enviar('qr_mibus_' . date('Y-m-d') . '.pdf');
    }

    public static function exportar()
    {
        $tipo = Req::opcion('tipo', array('resenas', 'accesos', 'anuncios', 'bitacora', 'flota', 'usuarios', 'anuncio'), null);
        if ($tipo === null) {
            throw new ErrorApi('Tipo de reporte no válido', 422);
        }

        $pdf = new Pdf();

        if ($tipo === 'resenas') {
            $f = BD::todos('SELECT nombre, modulo, calificacion, comentario, fecha_hora FROM resenas ORDER BY id DESC LIMIT 1500');
            $notas = array_filter(array_map(function ($r) {
                return $r['calificacion'];
            }, $f));
            $pdf->configurar('Reporte de reseñas');
            $pdf->AddPage();
            $pdf->indicadores(array(array('Reseñas', count($f)), array('Con calificación', count($notas)), array('Promedio', $notas ? round(array_sum($notas) / count($notas), 2) . ' / 5' : '—')));
            $pdf->seccion('Detalle');
            $pdf->tabla(array('Nombre', 'Origen', 'Nota', 'Comentario', 'Fecha'), array_map(function ($r) {
                return array($r['nombre'], $r['modulo'] === 'camion' ? 'Camión' : 'Buses', $r['calificacion'] ? $r['calificacion'] . '/5' : '—', $r['comentario'], $r['fecha_hora']);
            }, $f), array(30, 20, 14, 88, 38));
            $pdf->enviar('resenas_' . date('Y-m-d_His') . '.pdf');
        }

        if ($tipo === 'accesos') {
            $f = BD::todos('SELECT u.nombre, u.telefono, r.tipo_usuario, r.fecha_hora FROM registro_accesos r JOIN usuarios_finales u ON u.id = r.usuario_final_id ORDER BY r.id DESC LIMIT 2000');
            $pdf->configurar('Historial de accesos');
            $pdf->AddPage();
            $pdf->indicadores(array(array('Accesos listados', count($f))));
            $pdf->seccion('Detalle');
            $pdf->tabla(array('Nombre', 'Teléfono', 'Tipo', 'Fecha y hora'), array_map(function ($r) {
                return array($r['nombre'], $r['telefono'], $r['tipo_usuario'] === 'usuario_final_registro' ? 'Registro nuevo' : 'Reingreso', $r['fecha_hora']);
            }, $f), array(60, 35, 40, 55));
            $pdf->enviar('accesos_' . date('Y-m-d_His') . '.pdf');
        }

        if ($tipo === 'usuarios') {
            $f = BD::todos('SELECT u.nombre, u.telefono, c.nombre AS ciudad, u.fecha_registro FROM usuarios_finales u LEFT JOIN ciudades c ON c.id = u.ciudad_id ORDER BY u.id DESC LIMIT 3000');
            $pdf->configurar('Pasajeros registrados');
            $pdf->AddPage();
            $pdf->indicadores(array(array('Pasajeros', count($f))));
            $pdf->seccion('Detalle');
            $pdf->tabla(array('Nombre', 'Teléfono', 'Ciudad', 'Registro'), array_map(function ($r) {
                return array($r['nombre'], $r['telefono'], $r['ciudad'], $r['fecha_registro']);
            }, $f), array(65, 35, 40, 50));
            $pdf->enviar('pasajeros_' . date('Y-m-d_His') . '.pdf');
        }

        if ($tipo === 'anuncios') {
            $f = BD::todos('SELECT a.nombre_negocio, a.tipo_alcance, a.modulo, a.activo, a.fecha_expiracion, (SELECT COUNT(*) FROM anuncio_vistas v WHERE v.anuncio_id = a.id) AS vistas FROM anuncios_locales a ORDER BY a.id DESC');
            $pdf->configurar('Reporte de anuncios');
            $pdf->AddPage();
            $total = 0;
            foreach ($f as $r) {
                $total += (int) $r['vistas'];
            }
            $pdf->indicadores(array(array('Anuncios', count($f)), array('Vistas totales', $total)));
            $pdf->seccion('Detalle');
            $pdf->tabla(array('Negocio', 'Alcance', 'Módulo', 'Estado', 'Vence', 'Vistas'), array_map(function ($r) {
                return array($r['nombre_negocio'], $r['tipo_alcance'], $r['modulo'], (int) $r['activo'] === 1 ? 'Activo' : 'Pausado', $r['fecha_expiracion'] ? $r['fecha_expiracion'] : 'Sin fecha', $r['vistas']);
            }, $f), array(60, 28, 24, 24, 32, 22));
            $pdf->enviar('anuncios_' . date('Y-m-d_His') . '.pdf');
        }

        if ($tipo === 'anuncio') {
            $e = Contenido::anuncioEstadisticas();
            $pdf->configurar('Reporte de anuncio: ' . $e['anuncio']['nombre_negocio']);
            $pdf->AddPage();
            $pdf->indicadores(array(array('Vistas totales', $e['total'])));
            $pdf->seccion('Vistas por ciudad');
            $pdf->tabla(array('Ciudad', 'Vistas'), array_map(function ($r) {
                return array($r['ciudad'], $r['n']);
            }, $e['por_ciudad']), array(140, 50));
            $pdf->seccion('Últimos 14 días');
            $pdf->tabla(array('Día', 'Vistas'), array_map(function ($r) {
                return array($r['d'], $r['n']);
            }, $e['por_dia']), array(140, 50));
            $pdf->enviar('anuncio_' . $e['anuncio']['id'] . '_' . date('Y-m-d') . '.pdf');
        }

        if ($tipo === 'bitacora') {
            $f = BD::todos('SELECT momento, ip, rol, tipo, endpoint, detalle, exito FROM bitacora_seguridad ORDER BY id DESC LIMIT 1500');
            $pdf->configurar('Bitácora de seguridad', '', false);
            $pdf->AddPage();
            $fallos = 0;
            foreach ($f as $r) {
                $fallos += (int) $r['exito'] === 1 ? 0 : 1;
            }
            $pdf->indicadores(array(array('Eventos', count($f)), array('Fallidos', $fallos)));
            $pdf->seccion('Detalle');
            $pdf->tabla(array('Momento', 'IP', 'Rol', 'Tipo', 'Detalle', 'Res.'), array_map(function ($r) {
                return array($r['momento'], $r['ip'], $r['rol'], $r['tipo'], $r['detalle'], (int) $r['exito'] === 1 ? 'OK' : 'Falló');
            }, $f), array(34, 30, 20, 28, 66, 12));
            $pdf->enviar('bitacora_' . date('Y-m-d_His') . '.pdf');
        }

        $buses = Panel::busesDeAlcance();
        $km = Dashboard::datos();
        $pdf->configurar('Estado de la flota');
        $pdf->AddPage();
        $pdf->indicadores(array(array('Buses', count($buses)), array('En línea', $km['kpis']['buses_en_linea']), array('Km hoy', $km['kpis']['km_hoy'])));
        $pdf->seccion('Buses');
        $pdf->tabla(array('Bus', 'Ruta', 'Propietario', 'Estado', 'Batería', 'Km hoy'), array_map(function ($b) {
            return array($b['nombre'], $b['origen'] . ' - ' . $b['destino'], $b['propietario'], $b['conectado'] ? 'En línea' : 'Sin señal', $b['bateria'] !== null ? $b['bateria'] . '%' : '—', isset($b['km_hoy']) ? $b['km_hoy'] : 0);
        }, $km['flota']), array(34, 50, 40, 24, 20, 22));
        $pdf->enviar('flota_' . date('Y-m-d_His') . '.pdf');
    }
}
