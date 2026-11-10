<div class="mapa-pantalla"><div id="mapa" aria-label="Mapa en vivo"></div></div>
<header class="barra-mapa">
    <div class="marca-mini cristal"><img src="<?= e(recurso('img/logo.png')) ?>" alt=""><span>MiBus</span></div>
    <button class="chip-clima cristal" id="chip-clima" type="button" aria-label="Clima"><span class="emoji">⛅</span><span id="clima-temp">--°</span><small id="clima-nota"></small></button>
    <span class="crece"></span>
    <button class="btn-mapa cristal" id="boton-tema" type="button" data-accion="tema" aria-label="Cambiar tema"></button>
    <button class="btn-mapa cristal" id="boton-menu" type="button" aria-label="Cuenta"></button>
</header>
<div class="botonera-mapa" id="botonera">
    <button class="btn-mapa cristal" id="btn-capa" type="button" aria-label="Cambiar capa del mapa"></button>
    <button class="btn-mapa cristal" id="btn-ubicacion" type="button" aria-label="Mi ubicación"></button>
    <button class="btn-mapa cristal" id="btn-ajustar" type="button" aria-label="Ver toda la flota"></button>
</div>
<section class="hoja cristal" id="hoja">
    <div class="asa" id="asa-hoja"></div>
    <div class="pestanas" id="pestanas-hoja">
        <button class="activa" data-pestana="buses">Buses</button>
        <button data-pestana="universidad" id="pestana-universidad" class="oculto">Universidad</button>
        <button data-pestana="paradas">Paradas</button>
        <button data-pestana="planificar">Ruta</button>
        <button data-pestana="circuitos">Circuitos</button>
        <button data-pestana="opinar">Opinar</button>
    </div>
    <div class="cuerpo" id="cuerpo-hoja"></div>
</section>
<div id="contenedor-anuncio"></div>
<div class="panel-reposo oculto" id="panel-reposo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <h2>El servicio está en reposo</h2>
    <p class="suave" id="texto-reposo"></p>
    <button class="boton" id="boton-reintentar">Volver a comprobar</button>
</div>
