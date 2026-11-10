<?php
final class Respaldo
{
    private static $sinDatos = array('historial_posiciones', 'historial_posiciones_camion', 'registro_accesos', 'bitacora_seguridad', 'registros_por_ip', 'consultas_parada');

    private static function carpeta()
    {
        $c = RAIZ . '/storage/respaldos';
        if (!is_dir($c)) {
            @mkdir($c, 0755, true);
        }
        return $c;
    }

    public static function listar()
    {
        $salida = array();
        foreach ((array) glob(self::carpeta() . '/mibus_*.sql*') as $a) {
            $salida[] = array('archivo' => basename($a), 'bytes' => (int) filesize($a), 'fecha' => date('Y-m-d H:i:s', filemtime($a)));
        }
        usort($salida, function ($x, $y) {
            return strcmp($y['archivo'], $x['archivo']);
        });
        return $salida;
    }

    private static function escribir($h, $gz, $texto)
    {
        if ($gz) {
            gzwrite($h, $texto);
        } else {
            fwrite($h, $texto);
        }
    }

    public static function crear()
    {
        if (BD::motor() !== 'mysql') {
            throw new ErrorApi('El respaldo automático solo está disponible con MySQL', 422);
        }

        @set_time_limit(120);
        $gz = function_exists('gzopen');
        $nombre = 'mibus_' . date('Ymd_His') . ($gz ? '.sql.gz' : '.sql');
        $ruta = self::carpeta() . '/' . $nombre;
        $h = $gz ? gzopen($ruta, 'wb6') : fopen($ruta, 'wb');

        if (!$h) {
            throw new ErrorApi('No se pudo crear el archivo de respaldo', 500);
        }

        $pdo = BD::conectar();
        self::escribir($h, $gz, "-- Respaldo MiBus " . date('Y-m-d H:i:s') . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n");

        $tablas = array();
        foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_NUM) as $f) {
            $tablas[] = $f[0];
        }

        foreach ($tablas as $t) {
            $crear = $pdo->query('SHOW CREATE TABLE `' . str_replace('`', '', $t) . '`')->fetch(PDO::FETCH_NUM);
            self::escribir($h, $gz, 'DROP TABLE IF EXISTS `' . $t . "`;\n" . $crear[1] . ";\n\n");

            if (in_array($t, self::$sinDatos, true)) {
                continue;
            }

            $desplazamiento = 0;
            while (true) {
                $filas = $pdo->query('SELECT * FROM `' . $t . '` LIMIT 200 OFFSET ' . $desplazamiento)->fetchAll(PDO::FETCH_ASSOC);
                if (!$filas) {
                    break;
                }
                $columnas = '`' . implode('`,`', array_keys($filas[0])) . '`';
                $bloque = array();
                foreach ($filas as $fila) {
                    $valores = array();
                    foreach ($fila as $v) {
                        $valores[] = $v === null ? 'NULL' : $pdo->quote((string) $v);
                    }
                    $bloque[] = '(' . implode(',', $valores) . ')';
                }
                self::escribir($h, $gz, 'INSERT INTO `' . $t . '` (' . $columnas . ") VALUES\n" . implode(",\n", $bloque) . ";\n");
                $desplazamiento += 200;
                if (count($filas) < 200) {
                    break;
                }
            }
            self::escribir($h, $gz, "\n");
        }

        self::escribir($h, $gz, "SET FOREIGN_KEY_CHECKS = 1;\n");
        $gz ? gzclose($h) : fclose($h);

        $todos = self::listar();
        foreach (array_slice($todos, 10) as $viejo) {
            @unlink(self::carpeta() . '/' . $viejo['archivo']);
        }

        BD::guardarAjuste('ultimo_respaldo', ahora());
        return array('archivo' => $nombre, 'bytes' => (int) filesize($ruta));
    }

    public static function automatico()
    {
        $marca = RAIZ . '/storage/cache/respaldo.marca';
        if (is_file($marca) && time() - filemtime($marca) < 86400) {
            return;
        }
        @touch($marca);

        try {
            self::crear();
        } catch (Exception $e) {
            error_log('respaldo automatico: ' . $e->getMessage());
        }
    }
}
