<?php
final class Qr
{
    public static function pngNivel($texto, $nivel, $lado)
    {
        return self::png($texto, $lado, null, '', $nivel);
    }

    private static $tabla = array(
        1 => array('L' => array(7, array(array(1, 19))), 'M' => array(10, array(array(1, 16))), 'Q' => array(13, array(array(1, 13))), 'H' => array(17, array(array(1, 9)))),
        2 => array('L' => array(10, array(array(1, 34))), 'M' => array(16, array(array(1, 28))), 'Q' => array(22, array(array(1, 22))), 'H' => array(28, array(array(1, 16)))),
        3 => array('L' => array(15, array(array(1, 55))), 'M' => array(26, array(array(1, 44))), 'Q' => array(18, array(array(2, 17))), 'H' => array(22, array(array(2, 13)))),
        4 => array('L' => array(20, array(array(1, 80))), 'M' => array(18, array(array(2, 32))), 'Q' => array(26, array(array(2, 24))), 'H' => array(16, array(array(4, 9)))),
        5 => array('L' => array(26, array(array(1, 108))), 'M' => array(24, array(array(2, 43))), 'Q' => array(18, array(array(2, 15), array(2, 16))), 'H' => array(22, array(array(2, 11), array(2, 12)))),
        6 => array('L' => array(18, array(array(2, 68))), 'M' => array(16, array(array(4, 27))), 'Q' => array(24, array(array(4, 19))), 'H' => array(28, array(array(4, 15)))),
        7 => array('L' => array(20, array(array(2, 78))), 'M' => array(18, array(array(4, 31))), 'Q' => array(18, array(array(2, 14), array(4, 15))), 'H' => array(26, array(array(4, 13), array(1, 14)))),
        8 => array('L' => array(24, array(array(2, 97))), 'M' => array(22, array(array(2, 38), array(2, 39))), 'Q' => array(22, array(array(4, 18), array(2, 19))), 'H' => array(26, array(array(4, 14), array(2, 15)))),
        9 => array('L' => array(30, array(array(2, 116))), 'M' => array(22, array(array(3, 36), array(2, 37))), 'Q' => array(20, array(array(4, 16), array(4, 17))), 'H' => array(24, array(array(4, 12), array(4, 13)))),
        10 => array('L' => array(18, array(array(2, 68), array(2, 69))), 'M' => array(26, array(array(4, 43), array(1, 44))), 'Q' => array(24, array(array(6, 19), array(2, 20))), 'H' => array(28, array(array(6, 15), array(2, 16)))),
    );

    private static $alineacion = array(1 => array(), 2 => array(6, 18), 3 => array(6, 22), 4 => array(6, 26), 5 => array(6, 30), 6 => array(6, 34), 7 => array(6, 22, 38), 8 => array(6, 24, 42), 9 => array(6, 26, 46), 10 => array(6, 28, 50));
    private static $bitsNivel = array('L' => 1, 'M' => 0, 'Q' => 3, 'H' => 2);
    private static $exp = null;
    private static $log = null;

    private static function iniciarCampo()
    {
        if (self::$exp !== null) {
            return;
        }
        self::$exp = array_fill(0, 512, 0);
        self::$log = array_fill(0, 256, 0);
        $x = 1;
        for ($i = 0; $i < 255; $i++) {
            self::$exp[$i] = $x;
            self::$log[$x] = $i;
            $x <<= 1;
            if ($x & 0x100) {
                $x ^= 0x11D;
            }
        }
        for ($i = 255; $i < 512; $i++) {
            self::$exp[$i] = self::$exp[$i - 255];
        }
    }

    private static function mult($a, $b)
    {
        if ($a === 0 || $b === 0) {
            return 0;
        }
        return self::$exp[self::$log[$a] + self::$log[$b]];
    }

    private static function generador($grado)
    {
        $g = array(1);
        for ($i = 0; $i < $grado; $i++) {
            $siguiente = array_fill(0, count($g) + 1, 0);
            foreach ($g as $j => $coef) {
                $siguiente[$j] ^= $coef;
                $siguiente[$j + 1] ^= self::mult($coef, self::$exp[$i]);
            }
            $g = $siguiente;
        }
        return $g;
    }

    private static function resto($datos, $grado)
    {
        $g = self::generador($grado);
        $resto = array_fill(0, $grado, 0);
        foreach ($datos as $byte) {
            $factor = $byte ^ array_shift($resto);
            $resto[] = 0;
            for ($i = 0; $i < $grado; $i++) {
                $resto[$i] ^= self::mult($g[$i + 1], $factor);
            }
        }
        return $resto;
    }

    private static function totalDatos($version, $nivel)
    {
        $total = 0;
        foreach (self::$tabla[$version][$nivel][1] as $grupo) {
            $total += $grupo[0] * $grupo[1];
        }
        return $total;
    }

    public static function matriz($texto, $nivel = 'H')
    {
        self::iniciarCampo();
        $bytes = array_values(unpack('C*', $texto) ?: array());
        $largo = count($bytes);
        $version = 0;

        for ($v = 1; $v <= 10; $v++) {
            $bitsLargo = $v < 10 ? 8 : 16;
            if (4 + $bitsLargo + 8 * $largo <= 8 * self::totalDatos($v, $nivel)) {
                $version = $v;
                break;
            }
        }

        if ($version === 0) {
            throw new ErrorApi('El texto es demasiado largo para el código QR', 422);
        }

        $bits = '0100' . str_pad(decbin($largo), $version < 10 ? 8 : 16, '0', STR_PAD_LEFT);
        foreach ($bytes as $b) {
            $bits .= str_pad(decbin($b), 8, '0', STR_PAD_LEFT);
        }

        $capacidad = 8 * self::totalDatos($version, $nivel);
        $bits .= str_repeat('0', min(4, $capacidad - strlen($bits)));
        if (strlen($bits) % 8) {
            $bits .= str_repeat('0', 8 - strlen($bits) % 8);
        }

        $palabras = array();
        for ($i = 0; $i < strlen($bits); $i += 8) {
            $palabras[] = bindec(substr($bits, $i, 8));
        }
        $relleno = array(0xEC, 0x11);
        for ($i = 0; count($palabras) < self::totalDatos($version, $nivel); $i++) {
            $palabras[] = $relleno[$i % 2];
        }

        $ecPorBloque = self::$tabla[$version][$nivel][0];
        $bloques = array();
        $posicion = 0;
        foreach (self::$tabla[$version][$nivel][1] as $grupo) {
            for ($i = 0; $i < $grupo[0]; $i++) {
                $datos = array_slice($palabras, $posicion, $grupo[1]);
                $posicion += $grupo[1];
                $bloques[] = array('datos' => $datos, 'ec' => self::resto($datos, $ecPorBloque));
            }
        }

        $final = array();
        $maxDatos = 0;
        foreach ($bloques as $b) {
            $maxDatos = max($maxDatos, count($b['datos']));
        }
        for ($i = 0; $i < $maxDatos; $i++) {
            foreach ($bloques as $b) {
                if (isset($b['datos'][$i])) {
                    $final[] = $b['datos'][$i];
                }
            }
        }
        for ($i = 0; $i < $ecPorBloque; $i++) {
            foreach ($bloques as $b) {
                $final[] = $b['ec'][$i];
            }
        }

        $flujo = array();
        foreach ($final as $palabra) {
            for ($k = 7; $k >= 0; $k--) {
                $flujo[] = ($palabra >> $k) & 1;
            }
        }

        return self::construir($version, $nivel, $flujo);
    }

    private static function construir($version, $nivel, $flujo)
    {
        $n = 17 + 4 * $version;
        $m = array_fill(0, $n, array_fill(0, $n, 0));
        $f = array_fill(0, $n, array_fill(0, $n, false));

        $poner = function ($x, $y, $oscuro) use (&$m, &$f, $n) {
            if ($x >= 0 && $x < $n && $y >= 0 && $y < $n) {
                $m[$y][$x] = $oscuro ? 1 : 0;
                $f[$y][$x] = true;
            }
        };

        for ($i = 0; $i < $n; $i++) {
            $poner(6, $i, $i % 2 === 0);
            $poner($i, 6, $i % 2 === 0);
        }

        foreach (array(array(3, 3), array($n - 4, 3), array(3, $n - 4)) as $c) {
            for ($dy = -4; $dy <= 4; $dy++) {
                for ($dx = -4; $dx <= 4; $dx++) {
                    $d = max(abs($dx), abs($dy));
                    $poner($c[0] + $dx, $c[1] + $dy, $d !== 2 && $d !== 4);
                }
            }
        }

        $pos = self::$alineacion[$version];
        $k = count($pos);
        for ($i = 0; $i < $k; $i++) {
            for ($j = 0; $j < $k; $j++) {
                if (($i === 0 && $j === 0) || ($i === 0 && $j === $k - 1) || ($i === $k - 1 && $j === 0)) {
                    continue;
                }
                for ($dy = -2; $dy <= 2; $dy++) {
                    for ($dx = -2; $dx <= 2; $dx++) {
                        $poner($pos[$i] + $dx, $pos[$j] + $dy, max(abs($dx), abs($dy)) !== 1);
                    }
                }
            }
        }

        self::formato($poner, $n, $nivel, 0);

        if ($version >= 7) {
            $resto = $version;
            for ($i = 0; $i < 12; $i++) {
                $resto = ($resto << 1) ^ (($resto >> 11) * 0x1F25);
            }
            $bitsVersion = ($version << 12) | $resto;
            for ($i = 0; $i < 18; $i++) {
                $bit = (($bitsVersion >> $i) & 1) === 1;
                $a = $n - 11 + $i % 3;
                $b = intdiv($i, 3);
                $poner($a, $b, $bit);
                $poner($b, $a, $bit);
            }
        }

        $indice = 0;
        $total = count($flujo);
        for ($derecha = $n - 1; $derecha >= 1; $derecha -= 2) {
            if ($derecha === 6) {
                $derecha = 5;
            }
            for ($v = 0; $v < $n; $v++) {
                for ($j = 0; $j < 2; $j++) {
                    $x = $derecha - $j;
                    $arriba = ((($derecha + 1) & 2) === 0);
                    $y = $arriba ? $n - 1 - $v : $v;
                    if (!$f[$y][$x]) {
                        $m[$y][$x] = $indice < $total ? $flujo[$indice] : 0;
                        $indice++;
                    }
                }
            }
        }

        $mejor = null;
        $mejorPuntos = PHP_INT_MAX;
        $mejorMascara = 0;

        for ($mascara = 0; $mascara < 8; $mascara++) {
            $copia = $m;
            for ($y = 0; $y < $n; $y++) {
                for ($x = 0; $x < $n; $x++) {
                    if (!$f[$y][$x] && self::mascara($mascara, $x, $y)) {
                        $copia[$y][$x] ^= 1;
                    }
                }
            }
            $poner2 = function ($x, $y, $oscuro) use (&$copia, $n) {
                if ($x >= 0 && $x < $n && $y >= 0 && $y < $n) {
                    $copia[$y][$x] = $oscuro ? 1 : 0;
                }
            };
            self::formato($poner2, $n, $nivel, $mascara);
            $puntos = self::penalizacion($copia, $n);
            if ($puntos < $mejorPuntos) {
                $mejorPuntos = $puntos;
                $mejor = $copia;
                $mejorMascara = $mascara;
            }
        }

        return $mejor;
    }

    private static function formato($poner, $n, $nivel, $mascara)
    {
        $datos = (self::$bitsNivel[$nivel] << 3) | $mascara;
        $resto = $datos;
        for ($i = 0; $i < 10; $i++) {
            $resto = ($resto << 1) ^ (($resto >> 9) * 0x537);
        }
        $bits = (($datos << 10) | $resto) ^ 0x5412;
        $bit = function ($i) use ($bits) {
            return (($bits >> $i) & 1) === 1;
        };
        for ($i = 0; $i <= 5; $i++) {
            $poner(8, $i, $bit($i));
        }
        $poner(8, 7, $bit(6));
        $poner(8, 8, $bit(7));
        $poner(7, 8, $bit(8));
        for ($i = 9; $i < 15; $i++) {
            $poner(14 - $i, 8, $bit($i));
        }
        for ($i = 0; $i < 8; $i++) {
            $poner($n - 1 - $i, 8, $bit($i));
        }
        for ($i = 8; $i < 15; $i++) {
            $poner(8, $n - 15 + $i, $bit($i));
        }
        $poner(8, $n - 8, true);
    }

    private static function mascara($tipo, $x, $y)
    {
        switch ($tipo) {
            case 0: return ($x + $y) % 2 === 0;
            case 1: return $y % 2 === 0;
            case 2: return $x % 3 === 0;
            case 3: return ($x + $y) % 3 === 0;
            case 4: return (intdiv($x, 3) + intdiv($y, 2)) % 2 === 0;
            case 5: return ($x * $y) % 2 + ($x * $y) % 3 === 0;
            case 6: return (($x * $y) % 2 + ($x * $y) % 3) % 2 === 0;
            default: return (($x + $y) % 2 + ($x * $y) % 3) % 2 === 0;
        }
    }

    private static function penalizacion($m, $n)
    {
        $puntos = 0;
        $oscuros = 0;

        for ($pasada = 0; $pasada < 2; $pasada++) {
            for ($a = 0; $a < $n; $a++) {
                $corrida = 1;
                $linea = '';
                for ($b = 0; $b < $n; $b++) {
                    $v = $pasada === 0 ? $m[$a][$b] : $m[$b][$a];
                    $linea .= $v;
                    if ($pasada === 0) {
                        $oscuros += $v;
                    }
                    if ($b > 0) {
                        $anterior = $pasada === 0 ? $m[$a][$b - 1] : $m[$b - 1][$a];
                        if ($anterior === $v) {
                            $corrida++;
                            if ($corrida === 5) {
                                $puntos += 3;
                            } elseif ($corrida > 5) {
                                $puntos++;
                            }
                        } else {
                            $corrida = 1;
                        }
                    }
                }
                $puntos += 40 * (substr_count($linea, '00001011101') + substr_count($linea, '10111010000'));
            }
        }

        for ($y = 0; $y < $n - 1; $y++) {
            for ($x = 0; $x < $n - 1; $x++) {
                $v = $m[$y][$x];
                if ($v === $m[$y][$x + 1] && $v === $m[$y + 1][$x] && $v === $m[$y + 1][$x + 1]) {
                    $puntos += 3;
                }
            }
        }

        $total = $n * $n;
        $puntos += 10 * (int) floor(abs($oscuros * 20 - $total * 10) / $total);
        return $puntos;
    }

    public static function svg($texto, $nivel = 'H', $colorOscuro = '#0b3b4a', $colorClaro = '#ffffff')
    {
        $m = self::matriz($texto, $nivel);
        $n = count($m);
        $borde = 4;
        $tam = $n + 2 * $borde;
        $ruta = '';
        for ($y = 0; $y < $n; $y++) {
            $x = 0;
            while ($x < $n) {
                if ($m[$y][$x] === 1) {
                    $inicio = $x;
                    while ($x < $n && $m[$y][$x] === 1) {
                        $x++;
                    }
                    $ruta .= 'M' . ($inicio + $borde) . ' ' . ($y + $borde) . 'h' . ($x - $inicio) . 'v1h-' . ($x - $inicio) . 'z';
                } else {
                    $x++;
                }
            }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $tam . ' ' . $tam . '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' . $colorClaro . '"/><path d="' . $ruta . '" fill="' . $colorOscuro . '"/></svg>';
    }

    public static function png($texto, $lado = 720, $archivoLogo = null, $etiqueta = '', $nivel = 'H')
    {
        $m = self::matriz($texto, $nivel);
        $n = count($m);
        $borde = 4;
        $modulo = max(2, (int) floor($lado / ($n + 2 * $borde)));
        $tam = $modulo * ($n + 2 * $borde);
        $pie = $etiqueta !== '' ? 70 : 0;
        $img = imagecreatetruecolor($tam, $tam + $pie);
        $blanco = imagecolorallocate($img, 255, 255, 255);
        $oscuro = imagecolorallocate($img, 11, 59, 74);
        imagefill($img, 0, 0, $blanco);

        for ($y = 0; $y < $n; $y++) {
            for ($x = 0; $x < $n; $x++) {
                if ($m[$y][$x] === 1) {
                    imagefilledrectangle($img, ($x + $borde) * $modulo, ($y + $borde) * $modulo, ($x + $borde + 1) * $modulo - 1, ($y + $borde + 1) * $modulo - 1, $oscuro);
                }
            }
        }

        if ($archivoLogo && is_file($archivoLogo)) {
            $logo = @imagecreatefromstring((string) file_get_contents($archivoLogo));
            if ($logo) {
                $lado = (int) round($tam * 0.2);
                $placa = $lado + (int) round($tam * 0.03);
                $cx = (int) round($tam / 2);
                $cy = (int) round($tam / 2);
                imagefilledrectangle($img, $cx - (int) ($placa / 2), $cy - (int) ($placa / 2), $cx + (int) ($placa / 2), $cy + (int) ($placa / 2), $blanco);
                imagecopyresampled($img, $logo, $cx - (int) ($lado / 2), $cy - (int) ($lado / 2), 0, 0, $lado, $lado, imagesx($logo), imagesy($logo));
                imagedestroy($logo);
            }
        }

        if ($etiqueta !== '') {
            $texto = $etiqueta;
            $ancho = imagefontwidth(5) * strlen($texto);
            imagestring($img, 5, (int) max(0, ($tam - $ancho) / 2), $tam + 22, $texto, $oscuro);
        }

        ob_start();
        imagepng($img, null, 6);
        $datos = ob_get_clean();
        imagedestroy($img);
        return $datos;
    }
}
