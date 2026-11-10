<?php
final class Totp
{
    private static $alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generarSecreto()
    {
        return Seg::aleatorio(32, self::$alfabeto);
    }

    private static function decodificar($b32)
    {
        $b32 = strtoupper(preg_replace('/[^A-Z2-7]/', '', $b32));
        $bits = '';
        for ($i = 0, $n = strlen($b32); $i < $n; $i++) {
            $bits .= str_pad(decbin(strpos(self::$alfabeto, $b32[$i])), 5, '0', STR_PAD_LEFT);
        }
        $binario = '';
        for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
            $binario .= chr(bindec(substr($bits, $i, 8)));
        }
        return $binario;
    }

    public static function codigo($secreto, $contador)
    {
        $clave = self::decodificar($secreto);
        $mensaje = pack('N2', 0, $contador);
        $hash = hash_hmac('sha1', $mensaje, $clave, true);
        $desplazamiento = ord($hash[19]) & 0x0F;
        $valor = ((ord($hash[$desplazamiento]) & 0x7F) << 24)
            | ((ord($hash[$desplazamiento + 1]) & 0xFF) << 16)
            | ((ord($hash[$desplazamiento + 2]) & 0xFF) << 8)
            | (ord($hash[$desplazamiento + 3]) & 0xFF);
        return str_pad((string) ($valor % 1000000), 6, '0', STR_PAD_LEFT);
    }

    public static function verificar($secreto, $codigo)
    {
        $codigo = preg_replace('/\s+/', '', (string) $codigo);
        if (!preg_match('/^[0-9]{6}$/', $codigo)) {
            return false;
        }
        $ventana = (int) floor(time() / 30);
        for ($i = -1; $i <= 1; $i++) {
            if (hash_equals(self::codigo($secreto, $ventana + $i), $codigo)) {
                return true;
            }
        }
        return false;
    }

    public static function uri($secreto, $correo)
    {
        return 'otpauth://totp/' . rawurlencode('MiBus Bluefields:' . $correo)
            . '?secret=' . $secreto . '&issuer=' . rawurlencode('MiBus Bluefields') . '&algorithm=SHA1&digits=6&period=30';
    }
}
