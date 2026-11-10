<div class="escena">
    <section class="escena-arte" aria-hidden="true">
        <svg class="paisaje" viewBox="0 0 800 900" preserveAspectRatio="xMidYMax slice">
            <defs><linearGradient id="cielo2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b3a4a"/><stop offset="1" stop-color="#06121a"/></linearGradient></defs>
            <rect width="800" height="900" fill="url(#cielo2)"/>
            <g stroke="#22c3d8" stroke-opacity="0.18" fill="none"><circle cx="400" cy="520" r="120"/><circle cx="400" cy="520" r="200"/><circle cx="400" cy="520" r="290"/><circle cx="400" cy="520" r="390"/></g>
            <g class="bus-animado" transform="translate(330 470)"><path d="M70 0 C 110 0 140 30 140 70 C 140 120 70 190 70 190 C 70 190 0 120 0 70 C 0 30 30 0 70 0Z" fill="#22c3d8"/><circle cx="70" cy="70" r="30" fill="#06121a"/><rect x="48" y="56" width="44" height="24" rx="6" fill="#ff8a3d"/></g>
        </svg>
        <div class="texto"><h1>Panel de<br><span id="rotulo-acceso">control</span></h1><p id="lema-acceso"></p></div>
    </section>
    <section class="escena-forma">
        <button class="boton icono fantasma tema-flotante" type="button" data-accion="tema" aria-label="Cambiar tema"></button>
        <form class="caja-acceso" id="formulario-acceso" novalidate>
            <div class="marca"><img src="<?= e(recurso('img/logo.png')) ?>" alt="MiBus"><div><h2 id="titulo-acceso">Iniciar sesión</h2><p class="suave pequeno">MiBus Bluefields</p></div></div>
            <div id="paso-clave">
                <div class="campo"><label for="correo">Correo</label><input id="correo" name="correo" type="email" autocomplete="username" maxlength="100" required></div>
                <div class="campo"><label for="contrasena">Contraseña</label><input id="contrasena" name="contrasena" type="password" autocomplete="current-password" maxlength="128" required></div>
                <button class="boton primario bloque" type="submit" id="boton-acceso">Entrar</button>
                <button class="boton fantasma bloque separar" type="button" id="boton-olvide">Olvidé mi contraseña</button>
            </div>
            <div id="paso-2fa" class="oculto">
                <p class="lema">Escribe el código de 6 dígitos de tu aplicación de autenticación, o un código de recuperación.</p>
                <div class="campo"><input id="codigo2fa" class="codigo-2fa" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="000000"></div>
                <button class="boton primario bloque" type="submit" id="boton-2fa">Verificar</button>
            </div>
        </form>
    </section>
</div>
