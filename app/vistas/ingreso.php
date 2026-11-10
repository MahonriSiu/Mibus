<div class="escena">
    <section class="escena-arte" aria-hidden="true">
        <svg class="paisaje" viewBox="0 0 800 900" preserveAspectRatio="xMidYMax slice">
            <defs>
                <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a4b5e"/><stop offset="0.6" stop-color="#0b2d3c"/><stop offset="1" stop-color="#06121a"/></linearGradient>
                <radialGradient id="sol" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb25e" stop-opacity="0.9"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
            </defs>
            <rect width="800" height="900" fill="url(#cielo)"/>
            <circle cx="620" cy="250" r="190" fill="url(#sol)"/>
            <circle cx="620" cy="250" r="46" fill="#ffc47e"/>
            <g class="nube" opacity="0.5"><ellipse cx="120" cy="170" rx="70" ry="18" fill="#9fd6e2"/><ellipse cx="160" cy="158" rx="46" ry="16" fill="#9fd6e2"/></g>
            <g class="nube b" opacity="0.35"><ellipse cx="300" cy="260" rx="60" ry="14" fill="#9fd6e2"/><ellipse cx="335" cy="250" rx="38" ry="13" fill="#9fd6e2"/></g>
            <path d="M0 640 C 120 560 220 600 330 570 S 560 520 800 600 V900 H0Z" fill="#0b4a45" opacity="0.9"/>
            <path d="M0 700 C 150 640 260 690 400 650 S 640 620 800 690 V900 H0Z" fill="#0f6a5a"/>
            <g fill="#0a3b36"><path d="M90 690 l16 -70 l16 70z"/><path d="M130 695 l12 -52 l12 52z"/><path d="M640 668 l18 -78 l18 78z"/><path d="M690 676 l12 -54 l12 54z"/></g>
            <path d="M-20 790 C 200 730 420 790 820 740 V900 H-20Z" fill="#0a2b36"/>
            <path class="linea-camino" d="M-20 830 C 200 780 420 840 820 790" stroke="#ffb25e" stroke-width="5" fill="none" stroke-linecap="round"/>
            <g class="bus-animado" transform="translate(260 688)">
                <rect x="0" y="0" width="190" height="78" rx="18" fill="#ff8a3d"/>
                <rect x="0" y="44" width="190" height="10" fill="#e8661a"/>
                <rect x="14" y="12" width="30" height="26" rx="6" fill="#fff4e3"/><rect x="52" y="12" width="30" height="26" rx="6" fill="#fff4e3"/><rect x="90" y="12" width="30" height="26" rx="6" fill="#fff4e3"/>
                <rect x="132" y="10" width="46" height="34" rx="9" fill="#d7f3f8"/>
                <circle cx="46" cy="80" r="15" fill="#0b2d3c"/><circle cx="46" cy="80" r="6" fill="#cfe6ec"/>
                <circle cx="146" cy="80" r="15" fill="#0b2d3c"/><circle cx="146" cy="80" r="6" fill="#cfe6ec"/>
                <circle cx="184" cy="60" r="5" fill="#fff4b0"/>
            </g>
        </svg>
        <div class="texto">
            <h1>Tu bus,<br><span>en tiempo real.</span></h1>
            <p>Sigue los buses y el camión de basura de tu ciudad desde tu celular, consulta las paradas numeradas y llega justo a tiempo.</p>
        </div>
    </section>
    <section class="escena-forma">
        <button class="boton icono fantasma tema-flotante" type="button" data-accion="tema" aria-label="Cambiar tema"></button>
        <form class="caja-acceso" id="formulario-ingreso" novalidate autocomplete="on">
            <div class="marca"><img src="<?= e(recurso('img/logo.png')) ?>" alt="MiBus"><div><h2>MiBus Bluefields</h2><p class="suave pequeno">Transporte y servicios en vivo</p></div></div>
            <p class="lema">Ingresa con tu nombre y número. Si ya estabas registrado, entras directo.</p>
            <div class="campo"><label for="nombre">Nombre</label><input id="nombre" name="nombre" type="text" maxlength="60" autocomplete="name" placeholder="Ej. María López" required></div>
            <div class="campo"><label for="telefono">Número de teléfono</label><input id="telefono" name="telefono" type="tel" inputmode="numeric" maxlength="9" autocomplete="tel-national" placeholder="8888 7777" required></div>
            <div class="campo"><label for="ciudad">Ciudad</label><select id="ciudad" name="ciudad_id" required><option value="">Cargando ciudades…</option></select></div>
            <div class="campo"><label for="correo-uni">Correo universitario <span class="suave">(opcional)</span></label><input id="correo-uni" name="correo_universitario" type="email" maxlength="100" autocomplete="off" autocapitalize="none" placeholder="usuario@tuuniversidad.edu.ni"><span class="ayuda">Con tu correo estudiantil verás también los buses de tu universidad.</span></div>
            <button class="boton primario bloque" type="submit" id="boton-ingreso">Entrar al mapa</button>
            <p class="suave pequeno centro separar">Usamos tus datos solo para estadísticas del servicio.</p>
        </form>
    </section>
</div>
