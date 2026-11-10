<?php
final class Flota
{
    private static function codigoUnico($tabla)
    {
        for ($i = 0; $i < 20; $i++) {
            $codigo = Seg::aleatorio(8);
            if ((int) BD::valor('SELECT COUNT(*) FROM ' . $tabla . ' WHERE codigo_acceso = ?', array($codigo)) === 0) {
                return $codigo;
            }
        }
        throw new ErrorApi('No se pudo generar un código único', 500);
    }

    public static function buses()
    {
        $filas = Panel::busesDeAlcance();
        $urbano = Req::crudo('interurbano', '');
        if ($urbano !== '') {
            $q = (int) $urbano === 1;
            $filas = array_values(array_filter($filas, function ($b) use ($q) {
                return $b['interurbano'] === $q;
            }));
        }
        return array('buses' => $filas);
    }

    public static function busGuardar()
    {
        $id = Req::entero('id');
        $datos = array(
            'nombre' => Req::texto('nombre', 100, true, 'El nombre'),
            'origen' => Req::texto('origen', 100, true, 'El origen'),
            'destino' => Req::texto('destino', 100, true, 'El destino'),
            'descripcion' => Req::texto('descripcion', 500),
            'color' => es_color(Req::crudo('color')) ? Req::crudo('color') : null,
        );

        $prop = Req::entero('propietario_id');
        if ($prop > 0) {
            if (!BD::uno("SELECT id FROM usuarios WHERE id = ? AND rol = 'propietario'", array($prop))) {
                throw new ErrorApi('Propietario no válido', 422);
            }
            $datos['propietario_id'] = $prop;
        } elseif ($id === 0) {
            throw new ErrorApi('Selecciona un propietario. Créalo primero en Cuentas.', 422);
        }

        $ciudad = Req::entero('ciudad_id');
        $datos['ciudad_id'] = $ciudad > 0 ? $ciudad : null;
        $universidad = Req::entero('universidad_id');
        if ($universidad > 0 && !BD::uno('SELECT id FROM universidades WHERE id = ?', array($universidad))) {
            throw new ErrorApi('Universidad no válida', 422);
        }
        $datos['universidad_id'] = $universidad > 0 ? $universidad : null;
        $umbral = Req::entero('minutos_umbral_desconexion');
        $datos['minutos_umbral_desconexion'] = $umbral > 0 ? min(120, $umbral) : null;

        if ($id > 0) {
            BD::actualizar('buses', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }

        $datos['es_interurbano'] = Req::bandera('interurbano');
        $datos['habilitado'] = 1;
        $datos['activo'] = 0;
        $id = BD::insertar('buses', $datos);
        $codigo = self::codigoUnico('emisores');
        BD::insertar('emisores', array('codigo_acceso' => $codigo, 'bus_id' => $id, 'tipo' => Req::opcion('tipo_emisor', array('celular', 'gps'), 'celular'), 'version' => 1));
        return array('id' => $id, 'codigo' => $codigo);
    }

    public static function busEstado()
    {
        BD::actualizar('buses', array('habilitado' => Req::bandera('habilitado')), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function busEliminar()
    {
        BD::ejecutar('DELETE FROM buses WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function busRuta()
    {
        $puntos = json_decode((string) Req::crudo('puntos', '[]'), true);
        if (!is_array($puntos)) {
            throw new ErrorApi('Ruta no válida', 422);
        }
        $limpios = array();
        foreach ($puntos as $p) {
            if (is_array($p) && count($p) >= 2 && Geo::valida($p[0], $p[1])) {
                $limpios[] = array(round((float) $p[0], 6), round((float) $p[1], 6));
            }
        }
        if (count($limpios) > 4000) {
            throw new ErrorApi('La ruta tiene demasiados puntos', 422);
        }
        BD::actualizar('buses', array('ruta_json' => $limpios ? json_encode($limpios) : null), 'id = ?', array(Req::entero('id')));
        return array('puntos' => count($limpios));
    }

    public static function busCodigo()
    {
        $e = BD::uno('SELECT codigo_acceso, tipo, ultimo_uso FROM emisores WHERE bus_id = ?', array(Req::entero('id')));
        if (!$e) {
            throw new ErrorApi('Este bus no tiene código asignado', 404);
        }
        return array('codigo' => $e['codigo_acceso'], 'tipo' => $e['tipo'], 'ultimo_uso' => $e['ultimo_uso']);
    }

    public static function busCodigoRegenerar()
    {
        $id = Req::entero('id');
        $codigo = self::codigoUnico('emisores');
        $e = BD::uno('SELECT id, version FROM emisores WHERE bus_id = ?', array($id));
        if ($e) {
            BD::actualizar('emisores', array('codigo_acceso' => $codigo, 'version' => (int) $e['version'] + 1), 'id = ?', array($e['id']));
        } else {
            BD::insertar('emisores', array('codigo_acceso' => $codigo, 'bus_id' => $id, 'tipo' => 'celular', 'version' => 1));
        }
        return array('codigo' => $codigo);
    }

    public static function camiones()
    {
        return Panel::camiones();
    }

    public static function camionGuardar()
    {
        $id = Req::entero('id');
        $ciudad = Req::entero('ciudad_id');
        $datos = array(
            'nombre' => Req::texto('nombre', 100, true, 'El nombre'),
            'zona' => Req::texto('zona', 150, true, 'La zona'),
            'descripcion' => Req::texto('descripcion', 500),
            'ciudad_id' => $ciudad > 0 ? $ciudad : null,
            'color' => es_color(Req::crudo('color')) ? Req::crudo('color') : '#6b7280',
        );
        if ($id > 0) {
            BD::actualizar('camiones_basura', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }
        $datos['fecha_creacion'] = ahora();
        $datos['activo_hoy'] = 1;
        $datos['habilitado'] = 1;
        $id = BD::insertar('camiones_basura', $datos);
        $codigo = self::codigoUnico('emisores_camion');
        BD::insertar('emisores_camion', array('camion_id' => $id, 'codigo_acceso' => $codigo, 'version' => 1));
        return array('id' => $id, 'codigo' => $codigo);
    }

    public static function camionEstado()
    {
        $datos = array();
        if (Req::crudo('habilitado') !== null) {
            $datos['habilitado'] = Req::bandera('habilitado');
        }
        if (Req::crudo('activo_hoy') !== null) {
            $datos['activo_hoy'] = Req::bandera('activo_hoy');
        }
        if ($datos) {
            BD::actualizar('camiones_basura', $datos, 'id = ?', array(Req::entero('id')));
        }
        return array();
    }

    public static function camionEliminar()
    {
        BD::ejecutar('DELETE FROM camiones_basura WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function camionCodigo()
    {
        $e = BD::uno('SELECT codigo_acceso, ultimo_uso FROM emisores_camion WHERE camion_id = ?', array(Req::entero('id')));
        if (!$e) {
            throw new ErrorApi('Este camión no tiene código asignado', 404);
        }
        return array('codigo' => $e['codigo_acceso'], 'ultimo_uso' => $e['ultimo_uso']);
    }

    public static function camionCodigoRegenerar()
    {
        $id = Req::entero('id');
        $codigo = self::codigoUnico('emisores_camion');
        $e = BD::uno('SELECT id, version FROM emisores_camion WHERE camion_id = ?', array($id));
        if ($e) {
            BD::actualizar('emisores_camion', array('codigo_acceso' => $codigo, 'version' => (int) $e['version'] + 1), 'id = ?', array($e['id']));
        } else {
            BD::insertar('emisores_camion', array('camion_id' => $id, 'codigo_acceso' => $codigo, 'version' => 1));
        }
        return array('codigo' => $codigo);
    }

    public static function camionRutas()
    {
        $filas = BD::todos('SELECT id, nombre_ruta, dias, puntos, color FROM rutas_camion WHERE camion_id = ? ORDER BY id', array(Req::entero('camion_id')));
        foreach ($filas as &$f) {
            $f['puntos'] = json_decode($f['puntos'], true);
            $f['dias'] = array_map('intval', array_filter(explode(',', $f['dias']), 'strlen'));
        }
        return array('rutas' => $filas);
    }

    public static function camionRutaGuardar()
    {
        $camion = Req::entero('camion_id');
        if (!BD::uno('SELECT id FROM camiones_basura WHERE id = ?', array($camion))) {
            throw new ErrorApi('Camión no encontrado', 404);
        }
        $dias = Req::crudo('dias', array());
        if (is_string($dias)) {
            $dias = explode(',', $dias);
        }
        $dias = array_values(array_unique(array_filter(array_map('intval', (array) $dias), function ($d) {
            return $d >= 0 && $d <= 6;
        })));
        if (!$dias) {
            throw new ErrorApi('Selecciona al menos un día', 422);
        }
        $puntos = Req::crudo('puntos', array());
        if (is_string($puntos)) {
            $puntos = json_decode($puntos, true);
        }
        $limpios = array();
        foreach ((array) $puntos as $p) {
            if (is_array($p) && count($p) >= 2 && Geo::valida($p[0], $p[1])) {
                $limpios[] = array(round((float) $p[0], 6), round((float) $p[1], 6));
            }
        }
        if (count($limpios) < 2) {
            throw new ErrorApi('Traza al menos dos puntos', 422);
        }
        $datos = array(
            'camion_id' => $camion,
            'nombre_ruta' => Req::texto('nombre', 100, true, 'El nombre de la ruta'),
            'dias' => implode(',', $dias),
            'puntos' => json_encode($limpios),
            'color' => es_color(Req::crudo('color')) ? Req::crudo('color') : '#6b7280',
            'fecha_actualizacion' => ahora(),
        );
        $id = Req::entero('id');
        if ($id > 0) {
            unset($datos['camion_id']);
            BD::actualizar('rutas_camion', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }
        return array('id' => BD::insertar('rutas_camion', $datos));
    }

    public static function camionRutaEliminar()
    {
        BD::ejecutar('DELETE FROM rutas_camion WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function horario()
    {
        $h = Horario::obtener();
        return array('apertura' => substr($h['hora_apertura'], 0, 5), 'cierre' => substr($h['hora_cierre'], 0, 5), 'en_servicio' => Horario::dentro());
    }

    public static function horarioGuardar()
    {
        $a = Req::texto('apertura', 5, true, 'La hora de apertura');
        $c = Req::texto('cierre', 5, true, 'La hora de cierre');
        if (!preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/', $a) || !preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/', $c)) {
            throw new ErrorApi('Formato de hora no válido (HH:MM)', 422);
        }
        Horario::guardar($a . ':00', $c . ':00');
        return array();
    }
}
