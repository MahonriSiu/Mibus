<?php
final class BD
{
    private static $pdo = null;
    private static $motor = 'mysql';

    public static function conectar()
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $opciones = array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        );

        if (defined('DB_MOTOR') && DB_MOTOR === 'sqlite') {
            self::$motor = 'sqlite';
            self::$pdo = new PDO('sqlite:' . DB_ARCHIVO, null, null, $opciones);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
            return self::$pdo;
        }

        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NOMBRE . ';charset=utf8mb4';
        self::$pdo = new PDO($dsn, DB_USUARIO, DB_CONTRASENA, $opciones);
        self::$pdo->exec("SET time_zone = '" . APP_UTC_OFFSET . "'");
        self::$pdo->exec("SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
        return self::$pdo;
    }

    public static function motor()
    {
        return self::$motor;
    }

    public static function consultar($sql, $parametros = array())
    {
        $sentencia = self::conectar()->prepare($sql);
        $sentencia->execute(array_values($parametros));
        return $sentencia;
    }

    public static function todos($sql, $parametros = array())
    {
        return self::consultar($sql, $parametros)->fetchAll();
    }

    public static function uno($sql, $parametros = array())
    {
        $fila = self::consultar($sql, $parametros)->fetch();
        return $fila === false ? null : $fila;
    }

    public static function valor($sql, $parametros = array(), $defecto = null)
    {
        $fila = self::consultar($sql, $parametros)->fetch(PDO::FETCH_NUM);
        return $fila === false ? $defecto : $fila[0];
    }

    public static function ejecutar($sql, $parametros = array())
    {
        return self::consultar($sql, $parametros)->rowCount();
    }

    public static function insertar($tabla, $datos)
    {
        $columnas = array_keys($datos);
        $marcas = implode(',', array_fill(0, count($columnas), '?'));
        $sql = 'INSERT INTO ' . $tabla . ' (' . implode(',', $columnas) . ') VALUES (' . $marcas . ')';
        self::consultar($sql, array_values($datos));
        return (int) self::conectar()->lastInsertId();
    }

    public static function actualizar($tabla, $datos, $donde, $parametrosDonde = array())
    {
        $asignaciones = array();
        foreach (array_keys($datos) as $columna) {
            $asignaciones[] = $columna . ' = ?';
        }
        $sql = 'UPDATE ' . $tabla . ' SET ' . implode(', ', $asignaciones) . ' WHERE ' . $donde;
        return self::ejecutar($sql, array_merge(array_values($datos), $parametrosDonde));
    }

    public static function transaccion($funcion)
    {
        $pdo = self::conectar();
        $pdo->beginTransaction();
        try {
            $resultado = $funcion();
            $pdo->commit();
            return $resultado;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function sqlHora($columna)
    {
        return self::$motor === 'sqlite' ? "CAST(strftime('%H', $columna) AS INTEGER)" : "HOUR($columna)";
    }

    public static function sqlDiaSemana($columna)
    {
        return self::$motor === 'sqlite' ? "CAST(strftime('%w', $columna) AS INTEGER)" : "(DAYOFWEEK($columna) - 1)";
    }

    public static function sqlDia($columna)
    {
        return "DATE($columna)";
    }

    public static function ajuste($clave, $defecto = null)
    {
        $valor = self::valor('SELECT valor FROM ajustes WHERE clave = ?', array($clave));
        return $valor === null ? $defecto : $valor;
    }

    public static function guardarAjuste($clave, $valor)
    {
        $existe = self::valor('SELECT COUNT(*) FROM ajustes WHERE clave = ?', array($clave));
        if ((int) $existe > 0) {
            self::ejecutar('UPDATE ajustes SET valor = ? WHERE clave = ?', array($valor, $clave));
        } else {
            self::ejecutar('INSERT INTO ajustes (clave, valor) VALUES (?, ?)', array($clave, $valor));
        }
    }
}
