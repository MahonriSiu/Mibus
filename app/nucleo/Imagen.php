<?php
final class Imagen
{
    private static $tiposImagen = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp');

    public static function guardar($campo, $carpetaRelativa, $prefijo, $maximo = 1600)
    {
        if (!isset($_FILES[$campo]) || !is_array($_FILES[$campo]) || $_FILES[$campo]['error'] !== UPLOAD_ERR_OK) {
            throw new ErrorApi('No se recibió ningún archivo válido', 422);
        }

        $archivo = $_FILES[$campo];

        if ($archivo['size'] > 8 * 1024 * 1024) {
            throw new ErrorApi('La imagen supera los 8 MB', 422);
        }

        if (!is_uploaded_file($archivo['tmp_name'])) {
            throw new ErrorApi('Archivo no válido', 422);
        }

        $info = @getimagesize($archivo['tmp_name']);
        $mime = $info ? $info['mime'] : '';

        if (!isset(self::$tiposImagen[$mime])) {
            throw new ErrorApi('Solo se permiten imágenes JPG, PNG o WebP', 422);
        }

        if ($info[0] < 16 || $info[1] < 16 || $info[0] * $info[1] > 40000000) {
            throw new ErrorApi('Dimensiones de imagen no permitidas', 422);
        }

        $origen = $mime === 'image/png' ? @imagecreatefrompng($archivo['tmp_name'])
            : ($mime === 'image/webp' ? @imagecreatefromwebp($archivo['tmp_name']) : @imagecreatefromjpeg($archivo['tmp_name']));

        if (!$origen) {
            throw new ErrorApi('No se pudo procesar la imagen', 422);
        }

        $ancho = imagesx($origen);
        $alto = imagesy($origen);
        $escala = min(1, $maximo / max($ancho, $alto));
        $nuevoAncho = max(1, (int) round($ancho * $escala));
        $nuevoAlto = max(1, (int) round($alto * $escala));
        $lienzo = imagecreatetruecolor($nuevoAncho, $nuevoAlto);
        imagefill($lienzo, 0, 0, imagecolorallocate($lienzo, 255, 255, 255));
        imagecopyresampled($lienzo, $origen, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);
        imagedestroy($origen);

        $carpeta = RAIZ . '/public/assets/img/' . trim($carpetaRelativa, '/');
        if (!is_dir($carpeta)) {
            @mkdir($carpeta, 0755, true);
        }

        $nombre = $prefijo . '_' . time() . '_' . random_int(1000, 9999) . '.jpg';
        $ok = imagejpeg($lienzo, $carpeta . '/' . $nombre, 84);
        imagedestroy($lienzo);

        if (!$ok) {
            throw new ErrorApi('No se pudo guardar la imagen', 500);
        }

        return $nombre;
    }

    public static function video($campo, $carpetaRelativa, $prefijo)
    {
        if (!isset($_FILES[$campo]) || !is_array($_FILES[$campo]) || $_FILES[$campo]['error'] !== UPLOAD_ERR_OK) {
            throw new ErrorApi('No se recibió ningún archivo válido', 422);
        }

        $archivo = $_FILES[$campo];

        if ($archivo['size'] > 25 * 1024 * 1024) {
            throw new ErrorApi('El video supera los 25 MB', 422);
        }

        $cabecera = (string) file_get_contents($archivo['tmp_name'], false, null, 0, 16);

        if (strlen($cabecera) < 12 || substr($cabecera, 4, 4) !== 'ftyp') {
            throw new ErrorApi('Solo se permiten videos MP4', 422);
        }

        $carpeta = RAIZ . '/public/assets/img/' . trim($carpetaRelativa, '/');
        if (!is_dir($carpeta)) {
            @mkdir($carpeta, 0755, true);
        }

        $nombre = $prefijo . '_' . time() . '_' . random_int(1000, 9999) . '.mp4';

        if (!move_uploaded_file($archivo['tmp_name'], $carpeta . '/' . $nombre)) {
            throw new ErrorApi('No se pudo guardar el video', 500);
        }

        return $nombre;
    }

    public static function borrar($carpetaRelativa, $nombre)
    {
        $nombre = basename((string) $nombre);
        if ($nombre === '') {
            return;
        }
        $ruta = RAIZ . '/public/assets/img/' . trim($carpetaRelativa, '/') . '/' . $nombre;
        if (is_file($ruta)) {
            @unlink($ruta);
        }
    }
}
