<?php
final class Clave
{
    private static $comunes = array(
        'password', 'contrasena', 'contraseña', '123456', '12345678', '123456789', '1234567890', 'qwerty', 'qwertyuiop',
        'admin123', 'admin1234', 'administrador', 'mibus', 'mibus123', 'bluefields', 'bluefields123', 'nicaragua', 'nicaragua123',
        'abc123', 'abcd1234', 'iloveyou', 'letmein', 'welcome', 'monkey', 'dragon', 'football', 'master', 'sunshine',
        'passw0rd', 'p@ssw0rd', 'password1', 'password123', '000000', '111111', '11111111', '00000000', '1q2w3e4r', '12341234',
        'qazwsx', 'zaq12wsx', 'changeme', 'cambiame', 'usuario123', 'propietario', 'auditor123', 'cooperativa'
    );

    public static function hash($texto)
    {
        if (defined('PASSWORD_ARGON2ID')) {
            return password_hash($texto, PASSWORD_ARGON2ID, array('memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1));
        }
        return password_hash($texto, PASSWORD_BCRYPT, array('cost' => 12));
    }

    public static function verificar($texto, $hash)
    {
        return is_string($hash) && $hash !== '' && password_verify($texto, $hash);
    }

    public static function necesitaRehash($hash)
    {
        if (defined('PASSWORD_ARGON2ID')) {
            return password_needs_rehash($hash, PASSWORD_ARGON2ID, array('memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1));
        }
        return password_needs_rehash($hash, PASSWORD_BCRYPT, array('cost' => 12));
    }

    public static function verificarFalso()
    {
        password_verify('x', '$2y$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123.');
    }

    public static function validar($texto, $correo = '')
    {
        $largo = function_exists('mb_strlen') ? mb_strlen($texto, 'UTF-8') : strlen($texto);

        if ($largo < SEG_CONTRASENA_MIN) {
            throw new ErrorApi('La contraseña debe tener al menos ' . SEG_CONTRASENA_MIN . ' caracteres', 422);
        }
        if ($largo > 128) {
            throw new ErrorApi('La contraseña es demasiado larga', 422);
        }
        if (!preg_match('/[a-záéíóúñ]/iu', $texto) || !preg_match('/[0-9]/', $texto)) {
            throw new ErrorApi('La contraseña debe combinar letras y números', 422);
        }
        if (in_array(strtolower($texto), self::$comunes, true)) {
            throw new ErrorApi('Esa contraseña es muy común, elige otra', 422);
        }
        if ($correo !== '') {
            $local = strtolower(strstr($correo, '@', true));
            if ($local !== '' && strlen($local) >= 4 && stripos($texto, $local) !== false) {
                throw new ErrorApi('La contraseña no debe contener tu correo', 422);
            }
        }
        if (preg_match('/^(.)\1+$/u', $texto)) {
            throw new ErrorApi('La contraseña no puede repetir el mismo carácter', 422);
        }
    }

    public static function temporal()
    {
        return Seg::aleatorio(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ') . Seg::aleatorio(4, 'abcdefghijkmnpqrstuvwxyz') . Seg::aleatorio(3, '23456789') . Seg::aleatorio(1, '!#$%*+?');
    }
}
