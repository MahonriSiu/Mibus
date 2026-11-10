<main class="envoltura" id="app-chofer">
    <div class="fila-entre"><div class="fila"><img src="<?= e(recurso('img/logo.png')) ?>" alt="" width="32" height="40"><div><b id="titulo-chofer">MiBus · Chofer</b><div class="suave pequeno" id="subtitulo-chofer"></div></div></div><button class="boton icono fantasma" type="button" data-accion="tema" aria-label="Cambiar tema"></button></div>
    <section class="tarjeta" id="vista-login">
        <h3 id="login-titulo">Ingresa con tu código</h3>
        <form id="form-chofer" novalidate>
            <div class="campo"><label for="codigo">Código de acceso</label><input id="codigo" class="codigo-2fa" autocomplete="off" autocapitalize="characters" maxlength="10" placeholder="ABCD2345"></div>
            <button class="boton primario bloque" id="boton-codigo" type="submit">Conectar</button>
        </form>
        <p class="suave pequeno centro separar">Pídele tu código al administrador de la flota.</p>
    </section>
    <section class="oculto" id="vista-panel">
        <div class="tarjeta transmisor">
            <div class="fila-entre"><span class="pastilla" id="pastilla-estado"><i class="punto-estado"></i><span>Detenido</span></span><span class="pastilla" id="pastilla-bateria"></span></div>
            <button class="boton-transmitir" id="boton-transmitir" type="button"></button>
            <div class="metricas">
                <div class="metrica"><b id="m-vel">0</b><span>km/h</span></div>
                <div class="metrica"><b id="m-prec">--</b><span>precisión m</span></div>
                <div class="metrica"><b id="m-env">0</b><span>envíos</span></div>
            </div>
            <p class="suave pequeno" id="texto-estado">Pulsa el botón para empezar a compartir tu ubicación.</p>
        </div>
        <div class="tarjeta oculto" id="tarjeta-servicio">
            <h3>Estado del bus</h3>
            <div class="aviso-cierre oculto" id="alerta-cierre" role="alert"></div>
            <p class="suave pequeno">¿Cómo va el bus? Los pasajeros lo ven en el mapa.</p>
            <div class="grilla-ocupacion" id="grilla-ocupacion"></div>
            <div class="grilla-sos" style="margin-top:10px"><button class="boton" id="boton-desvio" type="button">Me desvié</button><button class="boton primario" id="boton-llegue" type="button">Llegué a la parada</button></div>
        </div>
        <div class="tarjeta oculto" id="tarjeta-sos">
            <h3 id="titulo-sos"></h3>
            <div class="grilla-sos" id="grilla-sos"></div>
        </div>
        <button class="boton fantasma bloque" id="boton-salir" type="button">Cerrar sesión del dispositivo</button>
    </section>
</main>
