<?php
define('APP_NOMBRE', 'MiBus Bluefields');
define('APP_VERSION', '3.0.0');
define('APP_ZONA_HORARIA', 'America/Managua');
define('APP_UTC_OFFSET', '-06:00');
define('CORREO_ADMIN_PRINCIPAL', 'mahonrisiu@gmail.com');

define('CENTRO_LAT', 11.9986);
define('CENTRO_LNG', -83.7574);
define('LIMITE_LAT_MIN', 10.5);
define('LIMITE_LAT_MAX', 15.5);
define('LIMITE_LNG_MIN', -87.7);
define('LIMITE_LNG_MAX', -82.5);

define('SEG_MAX_INTENTOS_LOGIN_IP', 10);
define('SEG_VENTANA_LOGIN_MIN', 15);
define('SEG_MAX_FALLOS_CUENTA', 5);
define('SEG_BLOQUEO_CUENTA_MIN', 15);
define('SEG_BLOQUEO_IP_MIN', 30);
define('SEG_API_POR_MINUTO', 240);
define('SEG_INACTIVIDAD_STAFF_MIN', 120);
define('SEG_DURACION_MAX_STAFF_H', 12);
define('SEG_DURACION_PASAJERO_DIAS', 60);
define('SEG_ADMIN_IPS_PERMITIDAS', array());
define('SEG_CONTRASENA_MIN', 10);
define('SEG_TOKEN_EMISOR_HORAS', 24);
define('SEG_EXIGIR_2FA_ADMIN', false);

define('GPS_INTERVALO_MOVIMIENTO_S', 5);
define('GPS_INTERVALO_QUIETO_S', 20);
define('GPS_VELOCIDAD_MAX_KMH', 130);
define('GPS_UMBRAL_DESCONEXION_MIN', 3);
define('GPS_RETENCION_DIAS', 14);
