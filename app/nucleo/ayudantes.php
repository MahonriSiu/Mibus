<?php
function base_url()
{
    static $base = null;
    if ($base === null) {
        $script = isset($_SERVER['SCRIPT_NAME']) ? str_replace('\\', '/', $_SERVER['SCRIPT_NAME']) : '';
        $dir = rtrim(dirname($script), '/');
        if (substr($dir, -7) === '/public') {
            $dir = substr($dir, 0, -7);
        }
        $base = ($dir === '/' || $dir === '.') ? '' : $dir;
    }
    return $base;
}

function url($ruta = '/')
{
    return base_url() . '/' . ltrim($ruta, '/');
}

function recurso($ruta)
{
    $ruta = ltrim($ruta, '/');
    $archivo = RAIZ . '/public/assets/' . $ruta;
    $version = is_file($archivo) ? filemtime($archivo) : APP_VERSION;
    return url('/assets/' . $ruta) . '?v=' . $version;
}

function e($texto)
{
    return htmlspecialchars((string) $texto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function ahora()
{
    return date('Y-m-d H:i:s');
}

function hace($segundos)
{
    return date('Y-m-d H:i:s', time() - $segundos);
}

function limpiar_texto($texto, $max = 255)
{
    $texto = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $texto);
    $texto = trim($texto);
    if (function_exists('mb_substr')) {
        return mb_substr($texto, 0, $max, 'UTF-8');
    }
    return substr($texto, 0, $max);
}

function es_color($valor)
{
    return (bool) preg_match('/^#[0-9a-fA-F]{6}$/', (string) $valor);
}
