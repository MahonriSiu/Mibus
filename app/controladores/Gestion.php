<?php
final class Gestion
{
    private static function esPrincipal()
    {
        $f = BD::uno('SELECT correo FROM usuarios WHERE id = ?', array(Sesion::uid()));
        return $f && strtolower($f['correo']) === strtolower(CORREO_ADMIN_PRINCIPAL);
    }

    public static function ciudades()
    {
        $filas = BD::todos('SELECT c.id, c.nombre, c.region, c.codigo, c.lat, c.lng, c.radio_km, c.habilitada, (SELECT COUNT(*) FROM usuarios_finales u WHERE u.ciudad_id = c.id) AS usuarios, (SELECT COUNT(*) FROM buses b WHERE b.ciudad_id = c.id) AS buses, (SELECT COUNT(*) FROM paradas p WHERE p.ciudad_id = c.id) AS paradas FROM ciudades c ORDER BY c.region, c.nombre');
        foreach ($filas as &$f) {
            $f['habilitada'] = (int) $f['habilitada'] === 1;
            $f['id'] = (int) $f['id'];
            $f['lat'] = $f['lat'] !== null ? (float) $f['lat'] : null;
            $f['lng'] = $f['lng'] !== null ? (float) $f['lng'] : null;
            $f['radio_km'] = (float) $f['radio_km'];
            $f['paradas'] = (int) $f['paradas'];
        }
        return array('ciudades' => $filas);
    }

    public static function ciudadGuardar()
    {
        $datos = array('nombre' => Req::texto('nombre', 100, true, 'El nombre'), 'region' => Req::texto('region', 50, true, 'La región'));
        $id = Req::entero('id');

        $lat = Req::decimal('lat');
        $lng = Req::decimal('lng');
        if ($lat !== null || $lng !== null) {
            if (!Geo::valida($lat, $lng)) {
                throw new ErrorApi('Las coordenadas del centro no son válidas para Nicaragua', 422);
            }
            $datos['lat'] = $lat;
            $datos['lng'] = $lng;
        }

        $radio = Req::decimal('radio_km');
        if ($radio !== null) {
            $datos['radio_km'] = max(1, min(40, $radio));
        }

        $codigo = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', Req::texto('codigo', 6)));
        if ($codigo !== '') {
            if (strlen($codigo) < 2) {
                throw new ErrorApi('El código debe tener entre 2 y 6 letras o números', 422);
            }
            if (BD::uno('SELECT id FROM ciudades WHERE codigo = ? AND id <> ?', array($codigo, $id))) {
                throw new ErrorApi('Ese código ya lo usa otra ciudad', 422);
            }
            $datos['codigo'] = $codigo;
        }

        if ($id > 0) {
            BD::actualizar('ciudades', $datos, 'id = ?', array($id));
            Territorio::purgarCache();
            return array('id' => $id);
        }
        $datos['habilitada'] = 1;
        $datos['fecha_creacion'] = ahora();
        $nuevo = BD::insertar('ciudades', $datos);
        Territorio::asegurarCodigo(array('id' => $nuevo, 'nombre' => $datos['nombre'], 'codigo' => isset($datos['codigo']) ? $datos['codigo'] : null));
        return array('id' => $nuevo);
    }

    public static function ciudadEstado()
    {
        BD::actualizar('ciudades', array('habilitada' => Req::bandera('habilitada')), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function cooperativas()
    {
        $filas = BD::todos('SELECT c.id, c.nombre, c.correo, c.cuenta_activa, c.ultimo_acceso, c.ciudad_id, ci.nombre AS ciudad, (SELECT COUNT(*) FROM usuarios u WHERE u.cooperativa_id = c.id) AS propietarios FROM cooperativas c LEFT JOIN ciudades ci ON ci.id = c.ciudad_id ORDER BY c.nombre');
        foreach ($filas as &$f) {
            $f['cuenta_activa'] = (int) $f['cuenta_activa'] === 1;
        }
        return array('cooperativas' => $filas);
    }

    public static function cooperativaGuardar()
    {
        $id = Req::entero('id');
        $ciudad = Req::entero('ciudad_id');
        $datos = array('nombre' => Req::texto('nombre', 150, true, 'El nombre'), 'ciudad_id' => $ciudad > 0 ? $ciudad : null);

        if ($id > 0) {
            BD::actualizar('cooperativas', $datos, 'id = ?', array($id));
            return array('id' => $id);
        }

        $correo = Req::correo();
        if (BD::uno('SELECT id FROM cooperativas WHERE correo = ?', array($correo)) || BD::uno('SELECT id FROM usuarios WHERE correo = ?', array($correo))) {
            throw new ErrorApi('Ese correo ya está registrado', 422);
        }
        $clave = Clave::temporal();
        $datos['correo'] = $correo;
        $datos['contrasena'] = Clave::hash($clave);
        $datos['cuenta_activa'] = 1;
        $datos['debe_cambiar_contrasena'] = 1;
        $datos['fecha_creacion'] = ahora();
        $id = BD::insertar('cooperativas', $datos);
        return array('id' => $id, 'contrasena_temporal' => $clave);
    }

    public static function cooperativaEstado()
    {
        BD::actualizar('cooperativas', array('cuenta_activa' => Req::bandera('activa'), 'sesion_version' => (int) BD::valor('SELECT sesion_version FROM cooperativas WHERE id = ?', array(Req::entero('id'))) + 1), 'id = ?', array(Req::entero('id')));
        return array();
    }

    public static function cooperativaEliminar()
    {
        BD::ejecutar('DELETE FROM cooperativas WHERE id = ?', array(Req::entero('id')));
        return array();
    }

    public static function propietarioCooperativa()
    {
        $coop = Req::entero('cooperativa_id');
        BD::actualizar('usuarios', array('cooperativa_id' => $coop > 0 ? $coop : null), "id = ? AND rol = 'propietario'", array(Req::entero('propietario_id')));
        return array();
    }

    public static function cuentas()
    {
        $principal = self::esPrincipal();
        $sql = 'SELECT u.id, u.nombre, u.correo, u.rol, u.tipo_propietario, u.cuenta_activa, u.totp_activo, u.ultimo_acceso, u.ultima_ip, u.ciudad_id, u.cooperativa_id, c.nombre AS ciudad, co.nombre AS cooperativa, (SELECT COUNT(*) FROM buses b WHERE b.propietario_id = u.id) AS buses FROM usuarios u LEFT JOIN ciudades c ON c.id = u.ciudad_id LEFT JOIN cooperativas co ON co.id = u.cooperativa_id';
        if (!$principal) {
            $sql .= " WHERE u.rol <> 'admin' OR u.id = " . (int) Sesion::uid();
        }
        $filas = BD::todos($sql . ' ORDER BY u.rol, u.nombre');
        foreach ($filas as &$f) {
            $f['cuenta_activa'] = (int) $f['cuenta_activa'] === 1;
            $f['totp_activo'] = (int) $f['totp_activo'] === 1;
            $f['id'] = (int) $f['id'];
            $f['protegida'] = strtolower($f['correo']) === strtolower(CORREO_ADMIN_PRINCIPAL);
        }
        return array('cuentas' => $filas, 'es_principal' => $principal, 'yo' => (int) Sesion::uid());
    }

    public static function cuentaCrear()
    {
        $rol = Req::opcion('rol', array('admin', 'auditor', 'propietario'));
        if ($rol === null) {
            throw new ErrorApi('Rol no válido', 422);
        }
        if ($rol === 'admin' && !self::esPrincipal()) {
            throw new ErrorApi('Solo el administrador principal puede crear administradores', 403);
        }
        $correo = Req::correo();
        if (BD::uno('SELECT id FROM usuarios WHERE correo = ?', array($correo)) || BD::uno('SELECT id FROM cooperativas WHERE correo = ?', array($correo))) {
            throw new ErrorApi('Ese correo ya está registrado en el sistema', 422);
        }
        $ciudad = Req::entero('ciudad_id');
        if ($rol === 'propietario' && $ciudad <= 0) {
            throw new ErrorApi('Selecciona la ciudad del propietario', 422);
        }
        $coop = Req::entero('cooperativa_id');
        $clave = Clave::temporal();
        $id = BD::insertar('usuarios', array(
            'nombre' => Req::texto('nombre', 100, true, 'El nombre'),
            'correo' => $correo,
            'contrasena' => Clave::hash($clave),
            'rol' => $rol,
            'tipo_propietario' => Req::opcion('tipo_propietario', array('urbano', 'interurbano'), 'urbano'),
            'debe_cambiar_contrasena' => 1,
            'ciudad_id' => $rol === 'propietario' ? $ciudad : null,
            'cooperativa_id' => ($rol === 'propietario' && $coop > 0) ? $coop : null,
            'cuenta_activa' => 1,
            'fecha_creacion' => ahora(),
        ));
        return array('id' => $id, 'contrasena_temporal' => $clave);
    }

    private static function objetivo($puedeSerAdmin = false)
    {
        $o = BD::uno('SELECT * FROM usuarios WHERE id = ?', array(Req::entero('id')));
        if (!$o) {
            throw new ErrorApi('Cuenta no encontrada', 404);
        }
        if ($o['rol'] === 'admin' && (!self::esPrincipal() || !$puedeSerAdmin) && (int) $o['id'] !== (int) Sesion::uid()) {
            throw new ErrorApi('Solo el administrador principal puede modificar a otros administradores', 403);
        }
        return $o;
    }

    public static function cuentaReset()
    {
        $o = self::objetivo(true);
        $clave = Clave::temporal();
        BD::insertar('historial_contrasenas', array('usuario_id' => $o['id'], 'contrasena_anterior' => $o['contrasena'], 'fecha_cambio' => ahora()));
        BD::actualizar('usuarios', array('contrasena' => Clave::hash($clave), 'debe_cambiar_contrasena' => 1, 'sesion_version' => (int) $o['sesion_version'] + 1, 'intentos_fallidos' => 0, 'bloqueado_hasta' => null), 'id = ?', array($o['id']));
        return array('contrasena_temporal' => $clave);
    }

    public static function cuentaEstado()
    {
        $o = self::objetivo(false);
        if ($o['rol'] === 'admin') {
            throw new ErrorApi('No se puede desactivar un administrador desde aquí', 422);
        }
        BD::actualizar('usuarios', array('cuenta_activa' => Req::bandera('activa'), 'sesion_version' => (int) $o['sesion_version'] + 1), 'id = ?', array($o['id']));
        return array();
    }

    public static function cuentaEliminar()
    {
        $o = self::objetivo(true);
        if (strtolower($o['correo']) === strtolower(CORREO_ADMIN_PRINCIPAL)) {
            throw new ErrorApi('No se puede eliminar la cuenta principal', 422);
        }
        if ((int) $o['id'] === (int) Sesion::uid()) {
            throw new ErrorApi('No puedes eliminar tu propia cuenta', 422);
        }
        BD::ejecutar('DELETE FROM usuarios WHERE id = ?', array($o['id']));
        return array();
    }

    public static function cuentaCerrarSesiones()
    {
        $o = self::objetivo(true);
        BD::actualizar('usuarios', array('sesion_version' => (int) $o['sesion_version'] + 1), 'id = ?', array($o['id']));
        return array();
    }

    public static function cuentaQuitar2fa()
    {
        $o = self::objetivo(true);
        BD::actualizar('usuarios', array('totp_activo' => 0, 'totp_secreto' => null, 'sesion_version' => (int) $o['sesion_version'] + 1), 'id = ?', array($o['id']));
        BD::ejecutar('DELETE FROM codigos_recuperacion WHERE usuario_id = ?', array($o['id']));
        return array();
    }

    public static function solicitudes()
    {
        return array('solicitudes' => BD::todos('SELECT id, correo, fecha_solicitud, atendida FROM solicitudes_reseteo ORDER BY atendida, id DESC LIMIT 100'));
    }

    public static function solicitudAtender()
    {
        BD::actualizar('solicitudes_reseteo', array('atendida' => 1), 'id = ?', array(Req::entero('id')));
        return array();
    }
}
