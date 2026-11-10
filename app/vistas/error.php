<main class="estado-pagina">
    <div class="codigo"><?= (int) $codigo ?></div>
    <h1><?= e($mensaje) ?></h1>
    <p class="suave">La página que buscas no está disponible.</p>
    <a class="boton primario" href="<?= e(url('/')) ?>">Volver al inicio</a>
</main>
