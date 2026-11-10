<?php
define('RAIZ', dirname(dirname(__DIR__)));

spl_autoload_register(function ($clase) {
    foreach (array('nucleo', 'servicios', 'controladores') as $carpeta) {
        $archivo = RAIZ . '/app/' . $carpeta . '/' . $clase . '.php';
        if (is_file($archivo)) {
            require $archivo;
            return;
        }
    }
});

require_once RAIZ . '/app/nucleo/ayudantes.php';
