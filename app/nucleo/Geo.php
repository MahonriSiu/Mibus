<?php
final class Geo
{
    public static function distanciaKm($lat1, $lng1, $lat2, $lng2)
    {
        $r = 6371.0088;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    public static function rumbo($lat1, $lng1, $lat2, $lng2)
    {
        $y = sin(deg2rad($lng2 - $lng1)) * cos(deg2rad($lat2));
        $x = cos(deg2rad($lat1)) * sin(deg2rad($lat2)) - sin(deg2rad($lat1)) * cos(deg2rad($lat2)) * cos(deg2rad($lng2 - $lng1));
        return (int) round(fmod(rad2deg(atan2($y, $x)) + 360, 360));
    }

    public static function valida($lat, $lng)
    {
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return false;
        }
        if ((float) $lat == 0 && (float) $lng == 0) {
            return false;
        }
        return $lat >= LIMITE_LAT_MIN && $lat <= LIMITE_LAT_MAX && $lng >= LIMITE_LNG_MIN && $lng <= LIMITE_LNG_MAX;
    }
}
