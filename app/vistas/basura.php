<div class="mapa-pantalla"><div id="mapa" aria-label="Mapa del camión de basura"></div></div>
<header class="barra-mapa">
    <div class="marca-mini cristal"><img src="<?= e(recurso('img/logo.png')) ?>" alt=""><span>Camión</span></div>
    <button class="chip-clima cristal" id="chip-clima" type="button" aria-label="Clima"><span class="emoji">⛅</span><span id="clima-temp">--°</span><small id="clima-nota"></small></button>
    <span class="crece"></span>
    <a class="btn-mapa cristal" href="<?= e(url('/mapa')) ?>" id="enlace-buses" aria-label="Ver buses"></a>
    <button class="btn-mapa cristal" id="boton-tema" type="button" data-accion="tema" aria-label="Cambiar tema"></button>
</header>
<div class="botonera-mapa" id="botonera">
    <button class="btn-mapa cristal" id="btn-capa" type="button" aria-label="Cambiar capa"></button>
    <button class="btn-mapa cristal" id="btn-ubicacion" type="button" aria-label="Mi ubicación"></button>
</div>
<section class="hoja cristal" id="hoja">
    <div class="asa" id="asa-hoja"></div>
    <div class="pestanas" id="pestanas-hoja">
        <button class="activa" data-pestana="camiones">Camiones</button>
        <button data-pestana="opinar">Opinar</button>
    </div>
    <div class="cuerpo" id="cuerpo-hoja"></div>
</section>
<div id="contenedor-anuncio"></div>
