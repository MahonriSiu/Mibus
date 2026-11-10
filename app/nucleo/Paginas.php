<?php
final class Paginas
{
    private static $legado = array(
        '/index.php' => '/',
        '/usuario/index.php' => '/mapa',
        '/usuario/registro.php' => '/',
        '/basura.php' => '/basura',
        '/admin/panel.php' => '/admin',
        '/admin/login.php' => '/admin/login',
        '/auditor/panel.php' => '/auditor',
        '/auditor/login.php' => '/auditor/login',
        '/propietario/panel.php' => '/propietario',
        '/propietario/login.php' => '/propietario/login',
        '/cooperativa/panel.php' => '/cooperativa',
        '/cooperativa/login.php' => '/cooperativa/login',
        '/emisor/panel.php' => '/emisor',
        '/emisor/login.php' => '/emisor/login',
        '/emisor-camion/panel.php' => '/emisor-camion',
        '/emisor-camion/login.php' => '/emisor-camion/login',
        '/cambiar-contrasena' => '/admin',
        '/admin/gestion' => '/admin#/buses',
        '/admin/interurbano' => '/admin#/interurbano',
        '/admin/mapa' => '/admin#/mapa',
        '/admin/ciudades' => '/admin#/ciudades',
        '/admin/cooperativas' => '/admin#/cooperativas',
        '/admin/cuentas' => '/admin#/cuentas',
        '/admin/usuarios' => '/admin#/pasajeros',
        '/admin/bandeja' => '/admin#/avisos',
        '/admin/resenas' => '/admin#/resenas',
        '/admin/anuncios' => '/admin#/anuncios',
        '/admin/camion-basura' => '/admin#/camiones',
        '/admin/ruta-creativa' => '/admin#/creativa',
        '/admin/trazar-ruta' => '/admin#/trazador',
        '/admin/generador-qr' => '/admin#/qr',
        '/admin/seguridad' => '/admin#/seguridad',
        '/admin/sistema' => '/admin#/sistema',
        '/auditor/mapa' => '/auditor#/mapa',
        '/auditor/usuarios' => '/auditor#/pasajeros',
        '/auditor/bandeja' => '/auditor#/avisos',
        '/auditor/resenas' => '/auditor#/resenas',
        '/auditor/camion-basura' => '/auditor#/camiones',
        '/propietario/mapa' => '/propietario#/mapa',
        '/propietario/bandeja' => '/propietario#/avisos',
    );

    private static $accesos = array(
        'admin' => array('Administrador', 'Gestiona la flota, las cuentas y la seguridad'),
        'auditor' => array('Auditor', 'Consulta la operación sin modificar nada'),
        'propietario' => array('Propietario', 'Sigue tus buses y recibe alertas'),
        'cooperativa' => array('Cooperativa', 'Supervisa a tus propietarios y buses'),
    );

    private static function destinoSeguro($valor)
    {
        $validos = array('/mapa', '/basura');
        return in_array($valor, $validos, true) ? $valor : '/mapa';
    }

    public static function despachar($ruta)
    {
        if (isset(self::$legado[$ruta])) {
            header('Location: ' . url(self::$legado[$ruta]), true, 301);
            exit;
        }

        Sesion::iniciar();
        $rol = Sesion::rol();

        if (strpos($ruta, '/admin') === 0 && $rol !== 'admin' && !Acceso::ipAdminPermitida()) {
            Vista::error(403, 'Tu dirección IP no está autorizada');
        }

        if ($ruta === '/') {
            if ($rol !== null) {
                header('Location: ' . url(isset($_GET['sig']) ? self::destinoSeguro($_GET['sig']) : '/mapa'));
                exit;
            }
            Vista::render('ingreso', array('titulo' => 'Ingresar · ' . APP_NOMBRE, 'clase' => 'pagina-ingreso', 'scripts' => array('mb-nucleo.js', 'pag-ingreso.js'), 'config' => array('siguiente' => isset($_GET['sig']) ? self::destinoSeguro($_GET['sig']) : '/mapa')));
        }

        if ($ruta === '/mapa' || $ruta === '/basura') {
            if ($rol === null) {
                header('Location: ' . url('/?sig=' . $ruta));
                exit;
            }
            $camion = $ruta === '/basura';
            Vista::render($camion ? 'basura' : 'mapa', array(
                'titulo' => ($camion ? 'Camión de basura' : 'Mapa en vivo') . ' · ' . APP_NOMBRE,
                'clase' => 'pagina-mapa',
                'mapa' => true,
                'scripts' => array('mb-nucleo.js', 'mb-mapa.js', 'mb-pasajero.js', $camion ? 'pag-basura.js' : 'pag-mapa.js'),
                'config' => array('modulo' => $camion ? 'camion' : 'bus'),
            ));
        }

        if (preg_match('#^/anunciante/([a-f0-9]{20,64})$#', $ruta, $m)) {
            Vista::render('anunciante', array('titulo' => 'Estadísticas de tu anuncio · ' . APP_NOMBRE, 'clase' => 'pagina-punto', 'scripts' => array('mb-nucleo.js', 'mb-graficos.js', 'pag-anunciante.js'), 'config' => array('token' => $m[1])));
        }

        if (preg_match('#^/punto/([0-9]+)$#', $ruta, $m)) {
            Vista::render('punto', array('titulo' => 'Ruta creativa · ' . APP_NOMBRE, 'clase' => 'pagina-punto', 'scripts' => array('mb-nucleo.js', 'pag-punto.js'), 'config' => array('puntoId' => (int) $m[1])));
        }

        if (preg_match('#^/(admin|auditor|propietario|cooperativa)/login$#', $ruta, $m)) {
            if ($rol === $m[1]) {
                header('Location: ' . url('/' . $m[1]));
                exit;
            }
            Vista::render('acceso', array('titulo' => 'Acceso ' . self::$accesos[$m[1]][0] . ' · ' . APP_NOMBRE, 'clase' => 'pagina-acceso', 'scripts' => array('mb-nucleo.js', 'pag-acceso.js'), 'config' => array('acceso' => $m[1], 'etiqueta' => self::$accesos[$m[1]][0], 'lema' => self::$accesos[$m[1]][1])));
        }

        if (preg_match('#^/(admin|auditor|propietario|cooperativa)$#', $ruta, $m)) {
            if ($rol !== $m[1]) {
                header('Location: ' . url('/' . $m[1] . '/login'));
                exit;
            }
            Vista::render('panel', array(
                'titulo' => self::$accesos[$m[1]][0] . ' · ' . APP_NOMBRE,
                'clase' => 'pagina-panel',
                'mapa' => true,
                'scripts' => array('mb-nucleo.js', 'mb-mapa.js', 'mb-graficos.js', 'panel-base.js', 'panel-paneles.js', 'panel-gestion.js', 'panel-territorio.js', 'panel-operacion.js', 'panel-sistema.js'),
                'config' => array('panel' => $m[1]),
            ));
        }

        if ($ruta === '/emisor' || $ruta === '/emisor/login' || $ruta === '/emisor-camion' || $ruta === '/emisor-camion/login') {
            $camion = strpos($ruta, '/emisor-camion') === 0;
            Vista::render('chofer', array(
                'titulo' => ($camion ? 'Chofer del camión' : 'Chofer') . ' · ' . APP_NOMBRE,
                'clase' => 'pagina-chofer',
                'scripts' => array('mb-nucleo.js', 'pag-chofer.js'),
                'config' => array('tipo' => $camion ? 'camion' : 'bus'),
            ));
        }

        Vista::error(404, 'Página no encontrada');
    }
}
