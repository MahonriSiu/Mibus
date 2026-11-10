<?php
final class Seg
{
    private static $ip = null;
    private static $secreto = null;
    private static $sesionRol = null;
    private static $sesionUid = null;

    public static function ip()
    {
        if (self::$ip !== null) {
            return self::$ip;
        }

        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
        $interna = !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);

        if ($interna) {
            foreach (array('HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR') as $cabecera) {
                if (empty($_SERVER[$cabecera])) {
                    continue;
                }
                $partes = explode(',', $_SERVER[$cabecera]);
                $candidata = trim($partes[0]);
                if (filter_var($candidata, FILTER_VALIDATE_IP)) {
                    $ip = $candidata;
                    break;
                }
            }
        }

        self::$ip = filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
        return self::$ip;
    }

    public static function agente()
    {
        return substr(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '', 0, 255);
    }

    public static function https()
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    }

    public static function cabeceras()
    {
        if (headers_sent()) {
            return;
        }

        $csp = "default-src 'self'; "
            . "script-src 'self' https://unpkg.com; "
            . "style-src 'self' 'unsafe-inline' https://unpkg.com; "
            . "img-src 'self' data: blob: https://server.arcgisonline.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com https://tilecache.rainviewer.com; "
            . "connect-src 'self' https://api.open-meteo.com https://router.project-osrm.org https://nominatim.openstreetmap.org https://overpass-api.de https://overpass.kumi.systems https://earthquake.usgs.gov https://api.rainviewer.com; "
            . "media-src 'self' blob:; font-src 'self' data:; worker-src 'self'; manifest-src 'self'; "
            . "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

        header('Content-Security-Policy: ' . $csp);
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()');
        header('Cross-Origin-Opener-Policy: same-origin');
        header('Cross-Origin-Resource-Policy: same-origin');
        header('X-Permitted-Cross-Domain-Policies: none');
        header('X-Robots-Tag: noindex, nofollow');
        header_remove('X-Powered-By');

        if (self::https()) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
    }

    public static function secreto()
    {
        if (self::$secreto !== null) {
            return self::$secreto;
        }

        $archivo = RAIZ . '/storage/secreto.key';

        if (!is_file($archivo)) {
            @file_put_contents($archivo, bin2hex(random_bytes(32)), LOCK_EX);
            @chmod($archivo, 0600);
        }

        $valor = is_file($archivo) ? trim((string) file_get_contents($archivo)) : '';
        self::$secreto = $valor !== '' ? $valor : hash('sha256', DB_NOMBRE . DB_CONTRASENA . 'mibus3');
        return self::$secreto;
    }

    public static function firmar($datos, $segundos)
    {
        $datos['exp'] = time() + $segundos;
        $carga = rtrim(strtr(base64_encode(json_encode($datos)), '+/', '-_'), '=');
        $firma = hash_hmac('sha256', $carga, self::secreto());
        return $carga . '.' . $firma;
    }

    public static function verificar($token)
    {
        if (!is_string($token) || strpos($token, '.') === false) {
            return null;
        }

        list($carga, $firma) = explode('.', $token, 2);
        $esperada = hash_hmac('sha256', $carga, self::secreto());

        if (!hash_equals($esperada, $firma)) {
            return null;
        }

        $datos = json_decode(base64_decode(strtr($carga, '-_', '+/')), true);

        if (!is_array($datos) || !isset($datos['exp']) || $datos['exp'] < time()) {
            return null;
        }

        return $datos;
    }

    public static function aleatorio($longitud, $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    {
        $max = strlen($alfabeto) - 1;
        $salida = '';
        for ($i = 0; $i < $longitud; $i++) {
            $salida .= $alfabeto[random_int(0, $max)];
        }
        return $salida;
    }

    public static function limitar($clave, $maximo, $segundos)
    {
        $carpeta = RAIZ . '/storage/cache';
        $archivo = $carpeta . '/rl_' . sha1($clave) . '.json';
        $ahora = time();
        $datos = array('inicio' => $ahora, 'cuenta' => 0);
        $gestor = @fopen($archivo, 'c+');

        if (!$gestor) {
            return true;
        }

        flock($gestor, LOCK_EX);
        $contenido = stream_get_contents($gestor);

        if ($contenido) {
            $leido = json_decode($contenido, true);
            if (is_array($leido) && isset($leido['inicio'], $leido['cuenta'])) {
                $datos = $leido;
            }
        }

        if (($ahora - $datos['inicio']) >= $segundos) {
            $datos = array('inicio' => $ahora, 'cuenta' => 0);
        }

        $datos['cuenta']++;
        ftruncate($gestor, 0);
        rewind($gestor);
        fwrite($gestor, json_encode($datos));
        flock($gestor, LOCK_UN);
        fclose($gestor);

        return $datos['cuenta'] <= $maximo;
    }

    public static function ipBloqueada()
    {
        $ip = self::ip();
        $fila = BD::uno('SELECT hasta FROM bloqueos_ip WHERE ip = ? AND hasta > ?', array($ip, ahora()));
        return $fila !== null;
    }

    public static function bloquearIp($motivo, $minutos = null, $ip = null)
    {
        $minutos = $minutos === null ? SEG_BLOQUEO_IP_MIN : (int) $minutos;
        $ip = $ip === null ? self::ip() : $ip;
        $hasta = date('Y-m-d H:i:s', time() + $minutos * 60);
        $existe = BD::valor('SELECT COUNT(*) FROM bloqueos_ip WHERE ip = ?', array($ip));

        if ((int) $existe > 0) {
            BD::ejecutar('UPDATE bloqueos_ip SET motivo = ?, hasta = ? WHERE ip = ?', array(substr($motivo, 0, 200), $hasta, $ip));
        } else {
            BD::insertar('bloqueos_ip', array('ip' => $ip, 'motivo' => substr($motivo, 0, 200), 'hasta' => $hasta, 'creado_en' => ahora()));
        }
    }

    public static function contextoSesion($rol, $uid)
    {
        self::$sesionRol = $rol;
        self::$sesionUid = $uid;
    }

    public static function fallosRecientes($tipo, $minutos)
    {
        return (int) BD::valor(
            'SELECT COUNT(*) FROM bitacora_seguridad WHERE ip = ? AND tipo = ? AND exito = 0 AND momento >= ?',
            array(self::ip(), $tipo, hace($minutos * 60))
        );
    }

    public static function registrar($tipo, $detalle = '', $exito = true, $endpoint = '', $rol = null, $uid = null)
    {
        try {
            $rol = $rol !== null ? $rol : (self::$sesionRol !== null ? self::$sesionRol : 'anonimo');
            $uid = $uid !== null ? $uid : self::$sesionUid;
            $momento = ahora();
            $ip = self::ip();
            $detalle = substr((string) $detalle, 0, 255);
            $endpoint = substr((string) $endpoint, 0, 80);
            $ok = $exito ? 1 : 0;
            $previo = (string) BD::valor('SELECT hash FROM bitacora_seguridad WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1', array(), '');
            $hash = self::hashBitacora($previo, $momento, $ip, $rol, $uid, $tipo, $endpoint, $detalle, $ok);

            BD::insertar('bitacora_seguridad', array(
                'momento' => $momento,
                'ip' => $ip,
                'rol' => $rol,
                'usuario_id' => $uid,
                'tipo' => $tipo,
                'endpoint' => $endpoint,
                'detalle' => $detalle,
                'exito' => $ok,
                'agente' => self::agente(),
                'hash_previo' => $previo,
                'hash' => $hash,
            ));
        } catch (Exception $e) {
            error_log('bitacora: ' . $e->getMessage());
        }
    }

    public static function hashBitacora($previo, $momento, $ip, $rol, $uid, $tipo, $endpoint, $detalle, $ok)
    {
        $cadena = implode('|', array($previo, $momento, $ip, $rol, (string) $uid, $tipo, $endpoint, $detalle, $ok));
        return hash_hmac('sha256', $cadena, self::secreto());
    }

    public static function mantenimiento()
    {
        BD::ejecutar('DELETE FROM bitacora_seguridad WHERE momento < ?', array(hace(180 * 86400)));
        BD::ejecutar('DELETE FROM bloqueos_ip WHERE hasta < ?', array(hace(86400)));
        BD::ejecutar('DELETE FROM registros_por_ip WHERE fecha_hora < ?', array(hace(2 * 86400)));
        BD::ejecutar('DELETE FROM historial_posiciones WHERE fecha_hora < ?', array(hace(GPS_RETENCION_DIAS * 86400)));
        BD::ejecutar('DELETE FROM historial_posiciones_camion WHERE fecha_hora < ?', array(hace(GPS_RETENCION_DIAS * 86400)));
        BD::ejecutar('DELETE FROM bandeja_avisos WHERE fecha_hora < ?', array(hace(60 * 86400)));

        foreach (glob(RAIZ . '/storage/cache/rl_*.json') ?: array() as $archivo) {
            if (filemtime($archivo) < time() - 3600) {
                @unlink($archivo);
            }
        }

        $limiteSesion = time() - SEG_DURACION_PASAJERO_DIAS * 86400;
        foreach (glob(RAIZ . '/storage/sesiones/sess_*') ?: array() as $archivo) {
            if (filemtime($archivo) < $limiteSesion) {
                @unlink($archivo);
            }
        }
    }
}
