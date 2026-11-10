<?php
final class Seguridad
{
    public static function resumen()
    {
        $tipo = Req::texto('tipo', 40);
        $solo = Req::opcion('exito', array('0', '1'), null);
        $ip = Req::texto('ip', 45);
        $pagina = max(1, Req::entero('pagina', 1));
        $porPagina = 40;
        $donde = array('1 = 1');
        $par = array();

        if ($tipo !== '') {
            $donde[] = 'tipo = ?';
            $par[] = $tipo;
        }
        if ($solo !== null) {
            $donde[] = 'exito = ?';
            $par[] = (int) $solo;
        }
        if ($ip !== '') {
            $donde[] = 'ip = ?';
            $par[] = $ip;
        }

        $cond = implode(' AND ', $donde);
        $total = (int) BD::valor('SELECT COUNT(*) FROM bitacora_seguridad WHERE ' . $cond, $par);
        $registros = BD::todos('SELECT id, momento, ip, rol, usuario_id, tipo, endpoint, detalle, exito, agente FROM bitacora_seguridad WHERE ' . $cond . ' ORDER BY id DESC LIMIT ' . $porPagina . ' OFFSET ' . (($pagina - 1) * $porPagina), $par);
        foreach ($registros as &$r) {
            $r['exito'] = (int) $r['exito'] === 1;
        }

        $desde = hace(86400);
        $conteos = BD::todos('SELECT tipo, exito, COUNT(*) AS n FROM bitacora_seguridad WHERE momento >= ? GROUP BY tipo, exito', array($desde));
        $topIps = BD::todos('SELECT ip, COUNT(*) AS n FROM bitacora_seguridad WHERE momento >= ? AND exito = 0 GROUP BY ip ORDER BY n DESC LIMIT 6', array($desde));
        $bloqueos = BD::todos('SELECT ip, motivo, hasta, creado_en FROM bloqueos_ip WHERE hasta > ? ORDER BY hasta DESC', array(ahora()));
        $porHora = array_fill(0, 24, array(0, 0));
        foreach (BD::todos('SELECT ' . BD::sqlHora('momento') . ' AS h, exito, COUNT(*) AS n FROM bitacora_seguridad WHERE momento >= ? AND tipo = ? GROUP BY h, exito', array($desde, 'login')) as $f) {
            $porHora[(int) $f['h']][(int) $f['exito'] === 1 ? 0 : 1] = (int) $f['n'];
        }

        $ultimos = BD::todos('SELECT id, momento, ip, rol, usuario_id, tipo, endpoint, detalle, exito, hash_previo, hash FROM bitacora_seguridad WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 300');
        $ultimos = array_reverse($ultimos);
        $alterados = 0;
        $enlaces = 0;
        $previo = null;
        foreach ($ultimos as $r) {
            $esperado = Seg::hashBitacora((string) $r['hash_previo'], $r['momento'], $r['ip'], $r['rol'], $r['usuario_id'], $r['tipo'], (string) $r['endpoint'], (string) $r['detalle'], (int) $r['exito']);
            if (!hash_equals($esperado, (string) $r['hash'])) {
                $alterados++;
            }
            if ($previo !== null && $previo !== (string) $r['hash_previo']) {
                $enlaces++;
            }
            $previo = (string) $r['hash'];
        }

        $cuentas = BD::uno("SELECT COUNT(*) AS total, SUM(CASE WHEN totp_activo = 1 THEN 1 ELSE 0 END) AS con2fa FROM usuarios WHERE rol = 'admin'");

        return array(
            'registros' => $registros,
            'total' => $total,
            'pagina' => $pagina,
            'por_pagina' => $porPagina,
            'conteos' => $conteos,
            'top_ips' => $topIps,
            'bloqueos' => $bloqueos,
            'logins_por_hora' => $porHora,
            'integridad' => array('verificados' => count($ultimos), 'alterados' => $alterados, 'enlaces_rotos' => $enlaces),
            'admins' => array('total' => (int) $cuentas['total'], 'con_2fa' => (int) $cuentas['con2fa']),
            'https' => Seg::https(),
            'ips_permitidas' => count(SEG_ADMIN_IPS_PERMITIDAS),
            'mi_ip' => Seg::ip(),
        );
    }

    public static function bloquear()
    {
        $ip = Req::texto('ip', 45, true, 'La IP');
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            throw new ErrorApi('La dirección IP no es válida', 422);
        }
        if ($ip === Seg::ip()) {
            throw new ErrorApi('No puedes bloquear tu propia dirección', 422);
        }
        $minutos = max(5, min(60 * 24 * 30, Req::entero('minutos', 1440)));
        Seg::bloquearIp(Req::texto('motivo', 150) !== '' ? Req::texto('motivo', 150) : 'Bloqueo manual', $minutos, $ip);
        return array();
    }

    public static function desbloquear()
    {
        BD::ejecutar('DELETE FROM bloqueos_ip WHERE ip = ?', array(Req::texto('ip', 45, true, 'La IP')));
        return array();
    }

    private static function carpetaTamano($ruta)
    {
        $total = 0;
        if (!is_dir($ruta)) {
            return 0;
        }
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($ruta, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $archivo) {
            $total += $archivo->getSize();
        }
        return $total;
    }

    public static function sistema()
    {
        $versionBd = BD::motor() === 'sqlite' ? 'sqlite' : (string) BD::valor('SELECT VERSION()');
        $esquemaOk = true;
        $faltan = array();
        $revisar = array('usuarios' => 'totp_activo', 'buses' => 'velocidad_kmh', 'emisores' => 'version', 'bitacora_seguridad' => 'hash', 'cooperativas' => 'sesion_version', 'camiones_basura' => 'rumbo');
        foreach ($revisar as $tabla => $columna) {
            try {
                BD::valor('SELECT ' . $columna . ' FROM ' . $tabla . ' LIMIT 1');
            } catch (Exception $e) {
                $esquemaOk = false;
                $faltan[] = $tabla . '.' . $columna;
            }
        }

        $escribibles = array();
        foreach (array('storage/cache', 'storage/logs', 'storage/sesiones', 'public/assets/img/anuncios', 'public/assets/img/ruta-creativa', 'public/assets/img/perfiles') as $d) {
            $ruta = RAIZ . '/' . $d;
            if (!is_dir($ruta)) {
                @mkdir($ruta, 0755, true);
            }
            $escribibles[] = array('ruta' => $d, 'ok' => is_dir($ruta) && is_writable($ruta));
        }

        $extensiones = array();
        foreach (array('pdo_mysql', 'gd', 'mbstring', 'openssl', 'fileinfo', 'json', 'curl') as $x) {
            $extensiones[] = array('nombre' => $x, 'ok' => extension_loaded($x));
        }

        $log = RAIZ . '/storage/logs/php-errores.log';
        $errores = array();
        if (is_file($log)) {
            $lineas = file($log, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $errores = array_slice($lineas ?: array(), -15);
        }

        return array(
            'version_app' => APP_VERSION,
            'php' => PHP_VERSION,
            'servidor' => isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : '',
            'base_datos' => $versionBd,
            'esquema_ok' => $esquemaOk,
            'faltan' => $faltan,
            'escribibles' => $escribibles,
            'extensiones' => $extensiones,
            'hash_claves' => defined('PASSWORD_ARGON2ID') ? 'Argon2id' : 'bcrypt',
            'https' => Seg::https(),
            'hora_servidor' => date('Y-m-d H:i:s'),
            'zona' => APP_ZONA_HORARIA,
            'tamano_imagenes' => self::carpetaTamano(RAIZ . '/public/assets/img'),
            'sesiones_activas' => count(glob(RAIZ . '/storage/sesiones/sess_*') ?: array()),
            'errores' => $errores,
        );
    }
}
