# 🚌 MiBus

### Plataforma de movilidad urbana para Nicaragua: buses en tiempo real, paradas numeradas, rutas y gestión por roles

![PHP](https://img.shields.io/badge/PHP-Backend-777BB4?logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL%20%2F%20MariaDB-Base%20de%20datos-4479A1?logo=mysql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-Mapas-199900?logo=leaflet&logoColor=white)
![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-Datos%20de%20mapa-7EBC6F?logo=openstreetmap&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Instalable-5A0FC8)
![Estado](https://img.shields.io/badge/Estado-En%20desarrollo-yellow)

**MiBus** permite a los pasajeros ver dónde están los buses de su ciudad, qué buses pasan por cada parada y cuánto tardan en llegar. A los choferes, propietarios, cooperativas, auditores y administradores les da herramientas propias según su responsabilidad.

Nació en **Bluefields** como respuesta a un problema cotidiano: esperar un bus sin saber si viene, si ya pasó o cuánto falta. La versión actual está preparada para cualquier ciudad de Nicaragua.

---

## 📚 Contenido

1. [Qué puede hacer](#-qué-puede-hacer)
2. [Roles](#-roles)
3. [Tecnologías](#-tecnologías)
4. [Arquitectura](#-arquitectura)
5. [Estructura del proyecto](#-estructura-del-proyecto)
6. [Instalación local](#-instalación-local)
7. [Cargar las paradas desde OpenStreetMap](#-cargar-las-paradas-desde-openstreetmap)
8. [Despliegue en un servidor](#-despliegue-en-un-servidor)
9. [Seguridad](#-seguridad)
10. [Rendimiento y escala](#-rendimiento-y-escala)
11. [Evolución del proyecto](#-evolución-del-proyecto)
12. [Hoja de ruta](#-hoja-de-ruta)
13. [Créditos](#-créditos)

---

## ✨ Qué puede hacer

### Para el pasajero
- 🗺️ **Mapa en vivo** con los buses de su ciudad, velocidad, ocupación (vacío, medio o lleno) y avisos de desvío.
- 🚏 **Paradas numeradas por ciudad** (`BLU-0001`, `MGA-0120`…), tomadas de OpenStreetMap. Solo ve las de su ciudad.
- ⏱️ **Qué buses pasan por una parada y en cuántos minutos llegan**, calculado con la ruta trazada y la posición real del bus.
- ⭐ **Paradas favoritas** con aviso cuando un bus está a 3 minutos (mientras la app está abierta).
- 🧭 **Planificador de viaje**: origen, destino y el bus directo recomendado, con caminata, espera y tiempo de viaje.
- 🎓 **Buses universitarios** visibles con el correo estudiantil, con horarios de salida y avisos de la universidad.
- 🚧 **Calles cerradas** marcadas en rojo en el mapa.
- 📣 **Reportes ciudadanos**: falta una parada, calle cerrada, problema con un bus.
- 📴 **Funciona con poca conexión**: guarda las paradas en el teléfono y se puede instalar como app (PWA).
- 🏙️ **Selección de ciudad** al registrarse, con las principales ciudades de Nicaragua.

### Para el chofer
- 📡 Transmisión de ubicación desde el celular.
- 🧍 Botones de ocupación y «me desvié».
- 📍 Botón «llegué a la parada».
- ⚠️ Aviso cuando se acerca a una calle cerrada.
- 🆘 Alertas de emergencia.

### Para propietarios y cooperativas
- 📊 Reporte semanal o comparativo: kilómetros, horas en servicio, paradas atendidas, notas, cortes de señal y salidas de ruta. Exportable a PDF.
- 🔔 Alertas cuando un bus se sale de su ruta o queda detenido demasiado tiempo.
- ⭐ Reseñas de sus buses.
- 🕒 Turnos: qué bus sale a qué hora y en qué días.

### Para el administrador
- 🚌 Gestión de buses, rutas (trazador), camiones de basura, cooperativas y cuentas.
- 🏙️ Ciudades y **paradas con importador de OpenStreetMap**.
- 🚧 Calles cerradas con aviso automático a los propietarios afectados.
- 🎓 Universidades por dominio de correo, horarios y avisos.
- 📥 Cola de reportes de usuarios con aprobación.
- 🔥 Mapa de demanda de paradas.
- 📢 Anuncios locales con tope de vistas y clics, estadísticas y enlace privado para el anunciante.
- 🎨 Ruta creativa y eventos.
- 💾 Respaldos automáticos diarios de la base de datos, con descarga.

### Para el auditor
- 🔎 Bitácora de seguridad con filtros y exportación a PDF.
- 📈 Consulta de desempeño, reseñas y demanda.

---

## 👥 Roles

| Rol | Acceso | Qué hace |
| --- | --- | --- |
| 🧑 Pasajero | `/` → `/mapa` | Consulta buses, paradas, rutas y reporta problemas |
| 📡 Chofer | `/emisor/login` | Transmite ubicación y estado del bus |
| 🚛 Chofer de camión | `/emisor-camion/login` | Transmite la ubicación del camión de basura |
| 🚌 Propietario | `/propietario` | Ve y analiza sus buses |
| 🤝 Cooperativa | `/cooperativa` | Supervisa los buses y turnos de su cooperativa |
| 🔎 Auditor | `/auditor` | Consulta bitácora y reportes |
| 🛠️ Administrador | `/admin` | Gestión completa |
| 📣 Anunciante | `/anunciante/{token}` | Ve las estadísticas de su anuncio con un enlace privado |

---

## 🛠️ Tecnologías

| Tecnología | Uso |
| --- | --- |
| 🐘 PHP | Backend, API JSON y vistas |
| 🗄️ MySQL / MariaDB | Base de datos |
| ⚡ JavaScript | Interfaz y lógica del cliente |
| 🗺️ Leaflet + OpenStreetMap | Mapas y teselas |
| 🧭 OSRM | Trazado de rutas por las calles |
| 🔍 Nominatim | Búsqueda de lugares |
| 📍 Overpass API | Descarga de paradas de bus |
| 📄 FPDF | Reportes en PDF |
| 📱 Service Worker y Web Manifest | App instalable y uso con poca conexión |
| 🔧 Git y GitHub | Control de versiones |

---

## 🏗️ Arquitectura

MiBus sigue una separación clara entre vistas, controladores y núcleo. Cada petición entra por `index.php`, se dirige según `config/api.php` y responde con una página o con JSON.

```text
┌──────────────────────────────────────────────────┐
│  Pasajero · Chofer · Propietario · Cooperativa   │
│  Auditor · Administrador · Anunciante            │
└───────────────────────┬──────────────────────────┘
                        │  HTML + JavaScript (PWA)
                        ▼
┌──────────────────────────────────────────────────┐
│  public/            index.php · assets · sw.js   │
└───────────────────────┬──────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────┐
│  app/nucleo/        Aplicacion · Seg · Sesion    │
│                     Acceso · Req · Resp · BD     │
│                     Rastreo · Paso · Geo         │
├──────────────────────────────────────────────────┤
│  config/api.php     Rutas y permisos por rol     │
├──────────────────────────────────────────────────┤
│  app/controladores/ Viaje · Territorio · Flota   │
│                     Operacion · Panel · Auth ... │
└───────────────────────┬──────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────┐
│  MySQL / MariaDB     database/mibus_completo.sql │
└──────────────────────────────────────────────────┘
```

### Flujo de localización

```text
📡 Celular del chofer ──► API de posición ──► validación y filtros (velocidad, límites, horario)
                                           │
                                           ▼
                                  Base de datos (posición actual + historial)
                                           │
                        ┌──────────────────┼──────────────────┐
                        ▼                  ▼                  ▼
                 Mapa del pasajero   Tiempo de llegada   Alertas al propietario
```

---

## 📁 Estructura del proyecto

```text
/
├── index.php                  Punto de entrada
├── .htaccess                  Reglas de Apache y protección de carpetas internas
│
├── app/
│   ├── controladores/         Lógica de cada módulo
│   │   ├── Auth.php           Acceso, sesiones, recuperación de contraseña
│   │   ├── Publico.php        Datos públicos: flota, paradas, anuncios
│   │   ├── Viaje.php          Paradas con llegadas, favoritas, reportes, planificador
│   │   ├── Territorio.php     Ciudades, paradas, universidades, calles cerradas
│   │   ├── Flota.php          Buses y camiones
│   │   ├── Emisor.php         Transmisión de ubicación
│   │   ├── Operacion.php      Desempeño, turnos, bitácora, respaldos, reportes
│   │   ├── Panel.php          Datos de los paneles por rol
│   │   ├── Contenido.php      Anuncios, eventos, ruta creativa
│   │   ├── Gestion.php        Cuentas, cooperativas, ciudades
│   │   ├── Seguridad.php      Registros y bloqueos
│   │   ├── Reportes.php       Exportaciones
│   │   ├── Dashboard.php      Indicadores
│   │   └── Cuenta.php         Perfil y contraseña
│   │
│   ├── nucleo/                Base del sistema (BD, seguridad, sesión, geometría de rutas…)
│   ├── servicios/             PDF
│   ├── vendor/fpdf/           Librería de PDF
│   └── vistas/                Plantillas HTML de cada pantalla
│
├── config/
│   ├── app.php                Ajustes generales y de seguridad
│   ├── api.php                Rutas de la API y rol requerido
│   └── credenciales.example.php   Plantilla de conexión a la base de datos
│
├── database/
│   └── mibus_completo.sql     Estructura completa y datos iniciales (se puede volver a ejecutar)
│
├── herramientas/
│   └── importar_paradas_osm.py    Descarga paradas de OpenStreetMap y genera el SQL
│
├── public/
│   ├── index.php
│   ├── manifest.webmanifest   Datos de la app instalable
│   ├── sw.js                  Service Worker
│   └── assets/                CSS, JavaScript e imágenes
│
└── storage/                   Caché, registros, respaldos y sesiones (no se sube a Git)
```

---

## ⚙️ Instalación local

### Requisitos
- Apache con `mod_rewrite` activado
- PHP 7 o superior, con las extensiones `pdo_mysql`, `mbstring`, `gd` y, si es posible, `zlib` (para respaldos comprimidos)
- MariaDB 10.2 o superior (el SQL usa `ADD COLUMN IF NOT EXISTS`)
- Un navegador moderno

En local se puede usar **XAMPP**.

### 1. Obtener el proyecto

```bash
git clone https://github.com/MahonriSiu/Mibus.git
```

Copia el contenido a `htdocs` (o configura un VirtualHost). No dejes una carpeta extra en medio.

### 2. Crear la base de datos

Crea una base vacía, por ejemplo `mibus`, con cotejamiento `utf8mb4_unicode_ci`, e importa:

```text
database/mibus_completo.sql
```

El archivo se puede ejecutar de nuevo en cualquier momento para actualizar una base existente.

### 3. Configurar las credenciales

Copia la plantilla y edita tus datos:

```bash
cp config/credenciales.example.php config/credenciales.php
```

```php
<?php
define('DB_HOST', 'localhost');
define('DB_USUARIO', 'root');
define('DB_NOMBRE', 'mibus');
define('DB_CONTRASENA', '');
```

> `config/credenciales.php` está en el `.gitignore` y nunca debe subirse al repositorio.

### 4. Crear el primer administrador

Genera el hash de una contraseña de al menos 10 caracteres:

```bash
php -r "echo password_hash('TuContrasenaSegura', PASSWORD_BCRYPT, ['cost' => 12]);"
```

Y ejecuta en la base de datos (cambia el correo y pega el hash):

```sql
INSERT INTO usuarios (nombre, correo, contrasena, rol, debe_cambiar_contrasena, cuenta_activa)
VALUES ('Administrador', 'tu@correo.com', 'PEGA_AQUI_EL_HASH', 'admin', 1, 1);
```

Después ajusta `CORREO_ADMIN_PRINCIPAL` en `config/app.php` con ese mismo correo. Ese administrador queda protegido contra borrado.

### 5. Abrir el sistema

- Pasajeros: `http://localhost/`
- Administración: `http://localhost/admin`

Al entrar por primera vez el sistema te pedirá cambiar la contraseña.

---

## 📍 Cargar las paradas desde OpenStreetMap

La base ya trae las principales ciudades de Nicaragua con sus coordenadas, pero **las paradas hay que importarlas**. Hay dos formas:

### Opción A: desde el panel
`Admin → Paradas → Importar de OpenStreetMap`. Elige una ciudad o todas. Las descarga tu navegador y las numera por ciudad.

### Opción B: script en tu computadora
Necesita Python 3:

```bash
python3 herramientas/importar_paradas_osm.py
```

Genera `paradas_osm.sql`, que importas en tu base de datos. Opciones:

```bash
python3 herramientas/importar_paradas_osm.py --ciudades BLU,MGA
python3 herramientas/importar_paradas_osm.py --conservar-manuales
```

Por defecto borra las paradas registradas a mano y deja solo las de OpenStreetMap. El script junta paradas a menos de 12 m, las numera desde el centro de cada ciudad y se puede ejecutar varias veces sin duplicar.

> En Nicaragua OpenStreetMap todavía tiene pocas paradas mapeadas. Donde falten, el administrador puede agregarlas a mano o aprobar los reportes de los pasajeros.

---

## 🌐 Despliegue en un servidor

1. Sube el contenido del proyecto al directorio público del servidor (sin carpeta adicional).
2. Crea la base de datos e importa `database/mibus_completo.sql`.
3. Crea `config/credenciales.php` con los datos de producción.
4. Crea el primer administrador (paso 4 de la instalación).
5. Verifica que Apache tenga `mod_rewrite` y que `storage/` tenga permisos de escritura.
6. Activa HTTPS. El sistema lo detecta y endurece las cookies.
7. Cambia `SEG_EXIGIR_2FA_ADMIN` a `true` en `config/app.php` y activa la verificación en dos pasos para los administradores.

---

## 🔐 Seguridad

El sistema incluye:
- Protección contra falsificación de peticiones (CSRF).
- Límites de intentos de acceso por IP y por cuenta, con bloqueo temporal.
- Contraseñas con hash Argon2id o bcrypt y política de longitud mínima.
- Verificación en dos pasos (TOTP) para cuentas de personal.
- Sesiones con vigencia, inactividad máxima e invalidación remota.
- Política de seguridad de contenido (CSP) y cabeceras endurecidas.
- Bitácora de seguridad encadenada con hash.
- Carpetas internas (`app`, `config`, `database`, `storage`) bloqueadas desde la web.

> Este proyecto **no ha pasado una auditoría de seguridad externa**. Antes de abrirlo al público se recomienda una prueba de penetración y activar el 2FA de administración.

---

## 📈 Rendimiento y escala

La arquitectura actual es adecuada para una ciudad o varias ciudades con tráfico moderado. Para una operación nacional con decenas de miles de usuarios simultáneos hace falta preparar la infraestructura:

- Caché delante del servidor (CDN) para las respuestas públicas de flota y paradas.
- Sesiones, caché y límites de intentos en Redis en lugar de archivos.
- Escrituras de GPS, vistas y consultas agrupadas.
- Varios servidores de aplicación detrás de un balanceador y réplica de lectura en la base de datos.
- Pruebas de carga antes de publicar.

---

## 🔄 Evolución del proyecto

1. **Prototipo con Firebase Realtime Database.**
2. **Migración a PHP + MySQL** con arquitectura MVC y módulos por rol.
3. **Versión 3:** rediseño completo, sistema de seguridad, PWA y panel por roles.
4. **Versión 5 (actual):** cobertura nacional con ciudades y paradas de OpenStreetMap, llegadas por parada, favoritas, planificador, buses universitarios, calles cerradas, reportes ciudadanos, herramientas para choferes, propietarios, cooperativas, auditoría y respaldos.

---

## 🗺️ Hoja de ruta

- [x] Mapa en vivo y transmisión de ubicación
- [x] Gestión de buses, rutas, camiones y cuentas
- [x] Paneles por rol (administrador, auditor, propietario, cooperativa, chofer)
- [x] Reseñas, anuncios locales, eventos y ruta creativa
- [x] Ciudades de Nicaragua y paradas numeradas con OpenStreetMap
- [x] Llegadas por parada, favoritas y planificador de viaje
- [x] Buses universitarios por correo estudiantil
- [x] Calles cerradas y reportes ciudadanos
- [x] Desempeño, turnos, bitácora exportable y respaldos
- [ ] Pruebas con usuarios reales
- [ ] Auditoría de seguridad externa
- [ ] Caché, Redis y pruebas de carga para escala nacional
- [ ] Planificador con transbordos
- [ ] Notificaciones push con la app cerrada
- [ ] Piloto en Bluefields y expansión a otros municipios

---

## 🎥 Video de navegación

📌 https://youtube.com/shorts/-CSKuJAp6Yc?si=fTM7oMY8l992OZ1E

---

## 👥 Créditos

Proyecto desarrollado para **Hackathon Nicaragua 2026**, categoría **Aficionado**.

**Institución:** Universidad de las Regiones Autónomas de la Costa Caribe Nicaragüense (**URACCAN**), Centro Universitario Regional Bluefields.

Mapas © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).

---

> **MiBus: tecnología para saber cuándo llega tu bus.** 🚌📍🇳🇮
