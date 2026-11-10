<?php
final class Auth
{
    private static $destinos = array(
        'admin' => '/admin',
        'auditor' => '/auditor',
        'propietario' => '/propietario',
        'cooperativa' => '/cooperativa',
        'usuario' => '/mapa',
    );

    public static function sesion()
    {
        $rol = Sesion::rol();
        return array(
            'rol' => $rol,
            'nombre' => Sesion::dato('nombre'),
            'csrf' => Sesion::csrf(),
            'debe_cambiar' => (bool) Sesion::dato('debe_cambiar'),
            'ciudad_id' => Sesion::dato('ciudad_id'),
            'servidor' => time(),
        );
    }

    private static function fallar($mensaje, $rol, $detalle, $estado = 401)
    {
        Seg::registrar('login', $detalle, false, 'auth/login', $rol);
        throw new ErrorApi($mensaje, $estado);
    }

    public static function login()
    {
        $rol = Req::opcion('rol', array('admin', 'auditor', 'propietario', 'cooperativa'));

        if ($rol === null) {
            throw new ErrorApi('Tipo de acceso no válido', 422);
        }

        if (!Seg::limitar('login:' . Seg::ip(), 20, 60)) {
            throw new ErrorApi('Demasiados intentos. Espera un minuto.', 429);
        }

        if (Seg::fallosRecientes('login', SEG_VENTANA_LOGIN_MIN) >= SEG_MAX_INTENTOS_LOGIN_IP) {
            Seg::bloquearIp('Demasiados intentos de acceso fallidos');
            Seg::registrar('bloqueo_ip', 'Bloqueo automático por intentos fallidos', false, 'auth/login');
            throw new ErrorApi('Demasiados intentos fallidos. Tu acceso fue bloqueado ' . SEG_BLOQUEO_IP_MIN . ' minutos.', 429);
        }

        $correo = Req::correo();
        $contrasena = (string) Req::crudo('contrasena', '');
        $tabla = $rol === 'cooperativa' ? 'cooperativas' : 'usuarios';

        if ($rol === 'cooperativa') {
            $fila = BD::uno('SELECT * FROM cooperativas WHERE correo = ?', array($correo));
        } else {
            $fila = BD::uno('SELECT * FROM usuarios WHERE correo = ? AND rol = ?', array($correo, $rol));
        }

        if (!$fila) {
            Clave::verificarFalso();
            self::fallar('Correo o contraseña incorrectos', $rol, 'Correo desconocido: ' . $correo);
        }

        if ($fila['bloqueado_hasta'] && strtotime($fila['bloqueado_hasta']) > time()) {
            $min = (int) ceil((strtotime($fila['bloqueado_hasta']) - time()) / 60);
            self::fallar('Cuenta bloqueada temporalmente por intentos fallidos. Intenta en ' . $min . ' minuto(s).', $rol, 'Cuenta bloqueada: ' . $correo, 429);
        }

        if (!Clave::verificar($contrasena, $fila['contrasena'])) {
            $fallos = (int) $fila['intentos_fallidos'] + 1;
            $datos = array('intentos_fallidos' => $fallos);
            if ($fallos >= SEG_MAX_FALLOS_CUENTA) {
                $datos['intentos_fallidos'] = 0;
                $datos['bloqueado_hasta'] = date('Y-m-d H:i:s', time() + SEG_BLOQUEO_CUENTA_MIN * 60);
            }
            BD::actualizar($tabla, $datos, 'id = ?', array($fila['id']));
            self::fallar('Correo o contraseña incorrectos', $rol, 'Contraseña incorrecta: ' . $correo);
        }

        if ((int) $fila['cuenta_activa'] !== 1) {
            self::fallar('Tu cuenta está desactivada. Contacta al administrador.', $rol, 'Cuenta desactivada: ' . $correo, 403);
        }

        if ($rol === 'admin' && !Acceso::ipAdminPermitida()) {
            self::fallar('Tu dirección IP no está autorizada', $rol, 'IP no autorizada', 403);
        }

        BD::actualizar($tabla, array('intentos_fallidos' => 0, 'bloqueado_hasta' => null), 'id = ?', array($fila['id']));

        if (Clave::necesitaRehash($fila['contrasena'])) {
            BD::actualizar($tabla, array('contrasena' => Clave::hash($contrasena)), 'id = ?', array($fila['id']));
        }

        if ($rol !== 'cooperativa' && (int) $fila['totp_activo'] === 1) {
            $ticket = Seg::firmar(array('t' => '2fa', 'rol' => $rol, 'uid' => (int) $fila['id'], 'h' => hash('sha256', Seg::ip() . Seg::agente())), 300);
            return array('requiere_2fa' => true, 'ticket' => $ticket);
        }

        return self::completar($rol, $fila);
    }

    public static function segundoFactor()
    {
        if (!Seg::limitar('2fa:' . Seg::ip(), 10, 300)) {
            throw new ErrorApi('Demasiados intentos. Espera unos minutos.', 429);
        }

        $datos = Seg::verificar((string) Req::crudo('ticket', ''));

        if (!$datos || ($datos['t'] ?? '') !== '2fa' || !hash_equals($datos['h'], hash('sha256', Seg::ip() . Seg::agente()))) {
            throw new ErrorApi('La verificación expiró. Inicia sesión de nuevo.', 401);
        }

        $fila = BD::uno('SELECT * FROM usuarios WHERE id = ? AND rol = ?', array($datos['uid'], $datos['rol']));
        $codigo = preg_replace('/\s+/', '', (string) Req::crudo('codigo', ''));

        if (!$fila || (int) $fila['cuenta_activa'] !== 1) {
            throw new ErrorApi('Cuenta no disponible', 401);
        }

        $valido = Totp::verificar($fila['totp_secreto'], $codigo);

        if (!$valido && strlen($codigo) >= 8) {
            $hash = hash('sha256', strtoupper($codigo));
            $rec = BD::uno('SELECT id FROM codigos_recuperacion WHERE usuario_id = ? AND codigo_hash = ? AND usado_en IS NULL', array($fila['id'], $hash));
            if ($rec) {
                BD::actualizar('codigos_recuperacion', array('usado_en' => ahora()), 'id = ?', array($rec['id']));
                $valido = true;
                Seg::registrar('2fa_recuperacion', 'Código de recuperación usado', true, 'auth/2fa', $datos['rol'], (int) $fila['id']);
            }
        }

        if (!$valido) {
            Seg::registrar('login', 'Código 2FA incorrecto: ' . $fila['correo'], false, 'auth/2fa', $datos['rol'], (int) $fila['id']);
            throw new ErrorApi('Código incorrecto', 401);
        }

        return self::completar($datos['rol'], $fila);
    }

    private static function completar($rol, $fila)
    {
        $tabla = $rol === 'cooperativa' ? 'cooperativas' : 'usuarios';
        $cambios = array('ultimo_acceso' => ahora());
        if ($rol !== 'cooperativa') {
            $cambios['ultima_ip'] = Seg::ip();
        }
        BD::actualizar($tabla, $cambios, 'id = ?', array($fila['id']));

        Sesion::entrar($rol, $fila['id'], $fila['sesion_version'], $fila['nombre'], (int) $fila['debe_cambiar_contrasena'] === 1, $fila['ciudad_id']);
        Seg::registrar('login', 'Inicio de sesión', true, 'auth/login', $rol, (int) $fila['id']);

        return array(
            'destino' => url(self::$destinos[$rol]),
            'debe_cambiar' => (int) $fila['debe_cambiar_contrasena'] === 1,
            'csrf' => Sesion::csrf(),
            'rol' => $rol,
        );
    }

    public static function salir()
    {
        if (Sesion::rol() !== null) {
            Seg::registrar('cierre_sesion', 'Cierre de sesión', true, 'auth/salir');
        }
        Sesion::destruir();
        return array('destino' => url('/'));
    }

    public static function ingresarPasajero()
    {
        if (!Seg::limitar('ingreso:' . Seg::ip(), 15, 300)) {
            throw new ErrorApi('Demasiados intentos. Espera unos minutos.', 429);
        }

        $nombre = Req::texto('nombre', 60, true, 'El nombre');
        $telefono = preg_replace('/[^0-9]/', '', Req::texto('telefono', 20));
        $ciudadId = Req::entero('ciudad_id');
        $correoU = strtolower(Req::texto('correo_universitario', 100));
        $universidad = null;

        if ($correoU !== '') {
            if (!filter_var($correoU, FILTER_VALIDATE_EMAIL)) {
                throw new ErrorApi('El correo universitario no tiene un formato válido', 422);
            }
            $universidad = Territorio::universidadPorCorreo($correoU);
            if (!$universidad) {
                throw new ErrorApi('Ese correo no pertenece a una universidad registrada en MiBus. Déjalo vacío si no lo necesitas.', 422);
            }
        }

        if (function_exists('mb_strlen') && mb_strlen($nombre, 'UTF-8') < 2) {
            throw new ErrorApi('Escribe tu nombre completo', 422);
        }

        if (strlen($telefono) !== 8) {
            throw new ErrorApi('El número debe tener 8 dígitos', 422);
        }

        $existente = BD::uno('SELECT * FROM usuarios_finales WHERE telefono = ?', array($telefono));

        if ($existente) {
            $cambios = array('ultimo_acceso' => ahora());
            $ciudadFinal = $existente['ciudad_id'];
            $uniFinal = $existente['universidad_id'];

            if ($ciudadId > 0 && (int) $ciudadId !== (int) $existente['ciudad_id'] && BD::uno('SELECT id FROM ciudades WHERE id = ? AND habilitada = 1', array($ciudadId))) {
                $cambios['ciudad_id'] = $ciudadId;
                $ciudadFinal = $ciudadId;
            }
            if ($universidad) {
                $cambios['correo_universitario'] = $correoU;
                $cambios['universidad_id'] = (int) $universidad['id'];
                $uniFinal = (int) $universidad['id'];
            }

            BD::actualizar('usuarios_finales', $cambios, 'id = ?', array($existente['id']));
            Sesion::entrar('usuario', $existente['id'], 0, $existente['nombre'], false, $ciudadFinal);
            Sesion::poner('universidad_id', $uniFinal ? (int) $uniFinal : null);
            BD::insertar('registro_accesos', array('tipo_usuario' => 'usuario_final_acceso', 'usuario_final_id' => $existente['id'], 'ip' => Seg::ip(), 'fecha_hora' => ahora()));
            return array('nombre' => $existente['nombre'], 'nuevo' => false, 'destino' => url('/mapa'), 'csrf' => Sesion::csrf());
        }

        $recientes = (int) BD::valor('SELECT COUNT(*) FROM registros_por_ip WHERE ip = ? AND fecha_hora >= ?', array(Seg::ip(), hace(86400)));

        if ($recientes >= 8) {
            throw new ErrorApi('Demasiados registros nuevos desde este dispositivo hoy. Intenta mañana.', 429);
        }

        $ciudad = BD::uno('SELECT id FROM ciudades WHERE id = ? AND habilitada = 1', array($ciudadId));

        if (!$ciudad) {
            throw new ErrorApi('Selecciona tu ciudad', 422);
        }

        $id = BD::insertar('usuarios_finales', array('nombre' => $nombre, 'telefono' => $telefono, 'ciudad_id' => $ciudadId, 'correo_universitario' => $universidad ? $correoU : null, 'universidad_id' => $universidad ? (int) $universidad['id'] : null, 'ultimo_acceso' => ahora(), 'fecha_registro' => ahora()));
        BD::insertar('registros_por_ip', array('ip' => Seg::ip(), 'fecha_hora' => ahora()));
        BD::insertar('registro_accesos', array('tipo_usuario' => 'usuario_final_registro', 'usuario_final_id' => $id, 'ip' => Seg::ip(), 'fecha_hora' => ahora()));
        Sesion::entrar('usuario', $id, 0, $nombre, false, $ciudadId);
        Sesion::poner('universidad_id', $universidad ? (int) $universidad['id'] : null);

        return array('nombre' => $nombre, 'nuevo' => true, 'destino' => url('/mapa'), 'csrf' => Sesion::csrf());
    }

    public static function loginEmisor()
    {
        if (!Seg::limitar('emisor_login:' . Seg::ip(), 15, 60)) {
            throw new ErrorApi('Demasiados intentos. Espera un minuto.', 429);
        }

        if (Seg::fallosRecientes('login_emisor', 15) >= 12) {
            Seg::bloquearIp('Demasiados intentos de código de chofer');
            throw new ErrorApi('Demasiados intentos fallidos. Acceso bloqueado temporalmente.', 429);
        }

        $tipo = Req::opcion('tipo', array('bus', 'camion'), 'bus');
        $codigo = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', Req::texto('codigo', 20)));

        if ($tipo === 'bus') {
            $fila = BD::uno('SELECT e.id, e.version, e.bus_id AS vehiculo_id, b.nombre, b.es_interurbano, b.habilitado FROM emisores e JOIN buses b ON b.id = e.bus_id WHERE e.codigo_acceso = ?', array($codigo));
        } else {
            $fila = BD::uno('SELECT e.id, e.version, e.camion_id AS vehiculo_id, c.nombre, 0 AS es_interurbano, c.habilitado FROM emisores_camion e JOIN camiones_basura c ON c.id = e.camion_id WHERE e.codigo_acceso = ?', array($codigo));
        }

        if ($codigo === '' || !$fila) {
            Seg::registrar('login_emisor', 'Código inválido', false, 'auth/emisor');
            throw new ErrorApi('Código inválido', 401);
        }

        if ((int) $fila['habilitado'] !== 1) {
            throw new ErrorApi('Este vehículo está deshabilitado. Contacta al administrador.', 403);
        }

        $tabla = $tipo === 'bus' ? 'emisores' : 'emisores_camion';
        BD::actualizar($tabla, array('ultimo_uso' => ahora()), 'id = ?', array($fila['id']));
        Seg::registrar('login_emisor', 'Chofer conectado: ' . $fila['nombre'], true, 'auth/emisor', $tipo === 'bus' ? 'emisor' : 'camion', (int) $fila['vehiculo_id']);

        $ttl = SEG_TOKEN_EMISOR_HORAS * 3600;
        $token = Seg::firmar(array('t' => $tipo === 'bus' ? 'emisor' : 'camion', 'e' => (int) $fila['id'], 'b' => (int) $fila['vehiculo_id'], 'v' => (int) $fila['version']), $ttl);

        return array(
            'token' => $token,
            'ttl' => $ttl,
            'nombre' => $fila['nombre'],
            'interurbano' => (int) $fila['es_interurbano'] === 1,
            'intervalo_movimiento' => GPS_INTERVALO_MOVIMIENTO_S,
            'intervalo_quieto' => GPS_INTERVALO_QUIETO_S,
        );
    }

    public static function olvide()
    {
        if (!Seg::limitar('olvide:' . Seg::ip(), 3, 3600)) {
            throw new ErrorApi('Ya enviaste varias solicitudes. Intenta más tarde.', 429);
        }

        $correo = Req::correo();
        $existe = BD::uno('SELECT id FROM usuarios WHERE correo = ? UNION SELECT id FROM cooperativas WHERE correo = ?', array($correo, $correo));

        if ($existe) {
            $pendiente = BD::valor('SELECT COUNT(*) FROM solicitudes_reseteo WHERE correo = ? AND atendida = 0', array($correo));
            if ((int) $pendiente === 0) {
                BD::insertar('solicitudes_reseteo', array('correo' => $correo, 'fecha_solicitud' => ahora(), 'atendida' => 0));
                Rastreo::aviso('admin', null, null, 'Solicitud de nueva contraseña', 'La cuenta ' . $correo . ' pidió restablecer su contraseña.', 'info');
            }
        }

        return array('mensaje' => 'Si el correo existe, el administrador recibió tu solicitud.');
    }
}
