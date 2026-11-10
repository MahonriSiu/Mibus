<!doctype html>
<html lang="es" data-tema="oscuro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="<?= e($tema) ?>">
<meta name="csrf-token" content="<?= e(Sesion::csrf()) ?>">
<meta name="color-scheme" content="dark light">
<title><?= e($titulo) ?></title>
<link rel="manifest" href="<?= e(url('/manifest.webmanifest')) ?>">
<link rel="icon" type="image/png" href="<?= e(recurso('img/logo.png')) ?>">
<link rel="apple-touch-icon" href="<?= e(recurso('img/logo.png')) ?>">
<script src="<?= e(recurso('js/tema.js')) ?>"></script>
<?php foreach ($estilos as $css): ?>
<link rel="stylesheet" href="<?= e(recurso('css/' . $css)) ?>">
<?php endforeach; ?>
<?php if ($mapa): ?>
<link rel="preconnect" href="https://tile.openstreetmap.org" crossorigin>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<?php endif; ?>
</head>
<body class="<?= e($clase) ?>">
<?= $contenido ?>
<script type="application/json" id="mb-config"><?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<?php if ($mapa): ?>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<?php endif; ?>
<?php foreach ($scripts as $js): ?>
<script src="<?= e(recurso('js/' . $js)) ?>" defer></script>
<?php endforeach; ?>
</body>
</html>
