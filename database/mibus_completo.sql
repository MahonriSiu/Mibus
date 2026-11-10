SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ciudades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    codigo VARCHAR(6) NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    radio_km DECIMAL(5,1) NOT NULL DEFAULT 8,
    habilitada TINYINT(1) DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cooperativas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    ciudad_id INT NULL,
    cuenta_activa TINYINT(1) DEFAULT 1,
    debe_cambiar_contrasena TINYINT(1) DEFAULT 1,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    sesion_version INT NOT NULL DEFAULT 1,
    ultimo_acceso DATETIME NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('admin','auditor','propietario') NOT NULL,
    tipo_propietario ENUM('urbano','interurbano') DEFAULT 'urbano',
    debe_cambiar_contrasena TINYINT(1) DEFAULT 1,
    foto_perfil VARCHAR(255) NULL,
    ciudad_id INT NULL,
    cooperativa_id INT NULL,
    cuenta_activa TINYINT(1) DEFAULT 1,
    totp_secreto VARCHAR(64) NULL,
    totp_activo TINYINT(1) NOT NULL DEFAULT 0,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    sesion_version INT NOT NULL DEFAULT 1,
    ultimo_acceso DATETIME NULL,
    ultima_ip VARCHAR(45) NULL,
    contrasena_cambiada DATETIME NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE SET NULL,
    FOREIGN KEY (cooperativa_id) REFERENCES cooperativas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_contrasenas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    contrasena_anterior VARCHAR(255) NOT NULL,
    fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS codigos_recuperacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    codigo_hash CHAR(64) NOT NULL,
    usado_en DATETIME NULL,
    INDEX idx_rec_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS buses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    propietario_id INT NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    velocidad_kmh DECIMAL(5,1) NULL,
    rumbo SMALLINT NULL,
    precision_m SMALLINT NULL,
    color VARCHAR(7) NULL,
    ruta_json LONGTEXT NULL,
    timestamp_actualizacion DATETIME NULL,
    activo TINYINT(1) DEFAULT 0,
    habilitado TINYINT(1) DEFAULT 1,
    ciudad_id INT NULL,
    es_interurbano TINYINT(1) DEFAULT 0,
    universidad_id INT NULL,
    bateria_nivel INT NULL,
    bateria_cargando TINYINT(1) NULL,
    minutos_umbral_desconexion INT NULL,
    FOREIGN KEY (propietario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS paradas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    orden INT DEFAULT 0,
    ciudad_id INT NULL,
    codigo VARCHAR(20) NULL,
    numero INT NOT NULL DEFAULT 0,
    osm_id BIGINT NULL,
    origen VARCHAR(10) NOT NULL DEFAULT 'manual',
    activa TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emisores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_acceso VARCHAR(10) NOT NULL UNIQUE,
    bus_id INT NOT NULL,
    tipo ENUM('celular','gps') DEFAULT 'celular',
    version INT NOT NULL DEFAULT 1,
    ultimo_uso DATETIME NULL,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios_finales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    ciudad_id INT NULL,
    correo_universitario VARCHAR(100) NULL,
    universidad_id INT NULL,
    ultimo_acceso DATETIME NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ajustes (
    clave VARCHAR(60) NOT NULL PRIMARY KEY,
    valor TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_posiciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    velocidad DECIMAL(5,1) NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bus_fecha (bus_id, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS registro_accesos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_usuario VARCHAR(50) NOT NULL,
    usuario_final_id INT NULL,
    ip VARCHAR(45) NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_acceso_fecha (fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS registros_por_ip (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_fecha (ip, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS solicitudes_reseteo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(100) NOT NULL,
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    atendida TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resenas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    comentario TEXT NOT NULL,
    calificacion INT NULL,
    modulo ENUM('bus','camion') NOT NULL DEFAULT 'bus',
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anuncios_locales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_negocio VARCHAR(150) NULL,
    texto TEXT NULL,
    telefono VARCHAR(30) NULL,
    tipo_media ENUM('ninguno','imagen','video') DEFAULT 'ninguno',
    url_media VARCHAR(255) NULL,
    url_audio VARCHAR(255) NULL,
    activo TINYINT(1) DEFAULT 1,
    tipo_alcance ENUM('ciudad','region','nacional') NOT NULL DEFAULT 'nacional',
    alcance_valor TEXT NULL,
    fecha_expiracion DATE NULL,
    modulo ENUM('bus','camion') NOT NULL DEFAULT 'bus',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anuncio_vistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anuncio_id INT NOT NULL,
    ciudad_id INT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anuncio_id) REFERENCES anuncios_locales(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    color VARCHAR(7) DEFAULT '#1a73e8',
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    siempre_activo TINYINT(1) DEFAULT 0,
    habilitado TINYINT(1) DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS puntos_ruta_creativa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    orden INT DEFAULT 0,
    visible TINYINT(1) DEFAULT 1,
    imagen_portada VARCHAR(255) NULL,
    video_url VARCHAR(255) NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS imagenes_ruta_creativa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    punto_id INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (punto_id) REFERENCES puntos_ruta_creativa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS camiones_basura (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    zona VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    velocidad_kmh DECIMAL(5,1) NULL,
    rumbo SMALLINT NULL,
    precision_m SMALLINT NULL,
    timestamp_actualizacion DATETIME NULL,
    activo_hoy TINYINT(1) DEFAULT 1,
    habilitado TINYINT(1) DEFAULT 1,
    color VARCHAR(7) DEFAULT '#6b7280',
    ciudad_id INT NULL,
    bateria_nivel INT NULL,
    bateria_cargando TINYINT(1) NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emisores_camion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    camion_id INT NOT NULL,
    codigo_acceso VARCHAR(10) NOT NULL UNIQUE,
    version INT NOT NULL DEFAULT 1,
    ultimo_uso DATETIME NULL,
    FOREIGN KEY (camion_id) REFERENCES camiones_basura(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historial_posiciones_camion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    camion_id INT NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    velocidad DECIMAL(5,1) NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_camion_fecha (camion_id, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rutas_camion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    camion_id INT NOT NULL,
    nombre_ruta VARCHAR(100) NOT NULL,
    dias VARCHAR(50) NOT NULL,
    puntos LONGTEXT NOT NULL,
    color VARCHAR(7) DEFAULT '#6b7280',
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camion_id) REFERENCES camiones_basura(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bandeja_avisos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_destinatario ENUM('admin','auditor','propietario') NOT NULL,
    propietario_id INT NULL,
    bus_id INT NULL,
    camion_id INT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    gravedad ENUM('info','advertencia','urgente') DEFAULT 'advertencia',
    leido TINYINT(1) DEFAULT 0,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_destinatario (tipo_destinatario, propietario_id, leido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alertas_sos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    propietario_id INT NOT NULL,
    tipo ENUM('mecanico','medica','robo','sos') NOT NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    atendida TINYINT(1) DEFAULT 0,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bitacora_seguridad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    momento DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'anonimo',
    usuario_id INT NULL,
    tipo VARCHAR(40) NOT NULL,
    endpoint VARCHAR(80) NULL,
    detalle VARCHAR(255) NULL,
    exito TINYINT(1) DEFAULT 1,
    agente VARCHAR(255) NULL,
    hash_previo CHAR(64) NULL,
    hash CHAR(64) NULL,
    INDEX idx_bitacora_ip_tipo (ip, tipo, momento),
    INDEX idx_bitacora_momento (momento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bloqueos_ip (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    motivo VARCHAR(200) NULL,
    hasta DATETIME NOT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO configuracion (hora_apertura, hora_cierre) SELECT '06:00:00', '20:00:00' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM configuracion);

CREATE TABLE IF NOT EXISTS universidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    siglas VARCHAR(20) NOT NULL,
    dominios VARCHAR(255) NOT NULL,
    ciudad_id INT NULL,
    color VARCHAR(7) NULL,
    habilitada TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_universidad_siglas (siglas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calles_cerradas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ciudad_id INT NULL,
    nombre VARCHAR(150) NOT NULL,
    motivo VARCHAR(255) NULL,
    puntos LONGTEXT NOT NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    hasta DATETIME NULL,
    creado_por INT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cierre_ciudad (ciudad_id, activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anuncio_clics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anuncio_id INT NOT NULL,
    ciudad_id INT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clic_anuncio (anuncio_id, fecha_hora),
    FOREIGN KEY (anuncio_id) REFERENCES anuncios_locales(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ajustes (
    clave VARCHAR(60) NOT NULL PRIMARY KEY,
    valor TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS codigos_recuperacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    codigo_hash CHAR(64) NOT NULL,
    usado_en DATETIME NULL,
    INDEX idx_rec_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE cooperativas ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE cooperativas ADD COLUMN IF NOT EXISTS bloqueado_hasta DATETIME NULL;
ALTER TABLE cooperativas ADD COLUMN IF NOT EXISTS sesion_version INT NOT NULL DEFAULT 1;
ALTER TABLE cooperativas ADD COLUMN IF NOT EXISTS ultimo_acceso DATETIME NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_secreto VARCHAR(64) NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_activo TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta DATETIME NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_version INT NOT NULL DEFAULT 1;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso DATETIME NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultima_ip VARCHAR(45) NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS contrasena_cambiada DATETIME NULL;

ALTER TABLE buses ADD COLUMN IF NOT EXISTS velocidad_kmh DECIMAL(5,1) NULL;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS rumbo SMALLINT NULL;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS precision_m SMALLINT NULL;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS color VARCHAR(7) NULL;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS ruta_json LONGTEXT NULL;

ALTER TABLE emisores ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE emisores ADD COLUMN IF NOT EXISTS ultimo_uso DATETIME NULL;

ALTER TABLE usuarios_finales ADD COLUMN IF NOT EXISTS ultimo_acceso DATETIME NULL;

ALTER TABLE historial_posiciones ADD COLUMN IF NOT EXISTS velocidad DECIMAL(5,1) NULL;
ALTER TABLE historial_posiciones_camion ADD COLUMN IF NOT EXISTS velocidad DECIMAL(5,1) NULL;

ALTER TABLE camiones_basura ADD COLUMN IF NOT EXISTS velocidad_kmh DECIMAL(5,1) NULL;
ALTER TABLE camiones_basura ADD COLUMN IF NOT EXISTS rumbo SMALLINT NULL;
ALTER TABLE camiones_basura ADD COLUMN IF NOT EXISTS precision_m SMALLINT NULL;

ALTER TABLE emisores_camion ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE emisores_camion ADD COLUMN IF NOT EXISTS ultimo_uso DATETIME NULL;

ALTER TABLE bitacora_seguridad ADD COLUMN IF NOT EXISTS usuario_id INT NULL;
ALTER TABLE bitacora_seguridad ADD COLUMN IF NOT EXISTS hash_previo CHAR(64) NULL;
ALTER TABLE bitacora_seguridad ADD COLUMN IF NOT EXISTS hash CHAR(64) NULL;

ALTER TABLE ciudades ADD COLUMN IF NOT EXISTS codigo VARCHAR(6) NULL;
ALTER TABLE ciudades ADD COLUMN IF NOT EXISTS lat DECIMAL(10,8) NULL;
ALTER TABLE ciudades ADD COLUMN IF NOT EXISTS lng DECIMAL(11,8) NULL;
ALTER TABLE ciudades ADD COLUMN IF NOT EXISTS radio_km DECIMAL(5,1) NOT NULL DEFAULT 8;

ALTER TABLE paradas ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) NULL;
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS numero INT NOT NULL DEFAULT 0;
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS osm_id BIGINT NULL;
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'manual';
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS activa TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE buses ADD COLUMN IF NOT EXISTS universidad_id INT NULL;

ALTER TABLE usuarios_finales ADD COLUMN IF NOT EXISTS correo_universitario VARCHAR(100) NULL;
ALTER TABLE usuarios_finales ADD COLUMN IF NOT EXISTS universidad_id INT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ciudad_codigo ON ciudades (codigo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_parada_osm ON paradas (osm_id);
CREATE INDEX IF NOT EXISTS idx_parada_ciudad_numero ON paradas (ciudad_id, numero);
CREATE INDEX IF NOT EXISTS idx_bus_universidad ON buses (universidad_id);
CREATE INDEX IF NOT EXISTS idx_final_universidad ON usuarios_finales (universidad_id);

CREATE TABLE IF NOT EXISTS paradas_favoritas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_final_id INT NOT NULL,
    parada_id INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_favorita (usuario_final_id, parada_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reportes_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_final_id INT NULL,
    ciudad_id INT NULL,
    tipo VARCHAR(20) NOT NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    texto VARCHAR(500) NULL,
    bus_id INT NULL,
    parada_id INT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    nota_admin VARCHAR(255) NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion DATETIME NULL,
    INDEX idx_reporte_estado (estado, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS consultas_parada (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parada_id INT NOT NULL,
    ciudad_id INT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_consulta_parada (parada_id, fecha_hora),
    INDEX idx_consulta_fecha (fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS llegadas_parada (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    parada_id INT NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_llegada_bus (bus_id, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS turnos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    dias VARCHAR(20) NOT NULL,
    hora_salida TIME NOT NULL,
    hora_fin TIME NULL,
    nota VARCHAR(150) NULL,
    INDEX idx_turno_bus (bus_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS horarios_universidad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    universidad_id INT NOT NULL,
    bus_id INT NULL,
    dias VARCHAR(20) NOT NULL,
    hora TIME NOT NULL,
    origen VARCHAR(100) NULL,
    destino VARCHAR(100) NULL,
    nota VARCHAR(150) NULL,
    INDEX idx_horario_uni (universidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS avisos_universidad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    universidad_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje VARCHAR(600) NOT NULL,
    gravedad VARCHAR(12) NOT NULL DEFAULT 'info',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    expira DATE NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_aviso_uni (universidad_id, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE buses ADD COLUMN IF NOT EXISTS ocupacion TINYINT NOT NULL DEFAULT 0;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS ocupacion_ts DATETIME NULL;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS desvio TINYINT NOT NULL DEFAULT 0;
ALTER TABLE resenas ADD COLUMN IF NOT EXISTS bus_id INT NULL;
ALTER TABLE anuncios_locales ADD COLUMN IF NOT EXISTS max_vistas INT NULL;
ALTER TABLE anuncios_locales ADD COLUMN IF NOT EXISTS max_clics INT NULL;
ALTER TABLE anuncios_locales ADD COLUMN IF NOT EXISTS token_panel VARCHAR(40) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_anuncio_token ON anuncios_locales (token_panel);
CREATE INDEX IF NOT EXISTS idx_resena_bus ON resenas (bus_id);

DROP TABLE IF EXISTS _semilla_ciudades;
CREATE TABLE _semilla_ciudades (
    nombre VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    radio_km DECIMAL(5,1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO _semilla_ciudades (nombre, region, codigo, lat, lng, radio_km) VALUES
('Managua', 'Managua', 'MGA', 12.1364, -86.2514, 18.0),
('Ciudad Sandino', 'Managua', 'CSD', 12.1500, -86.3500, 6.0),
('Tipitapa', 'Managua', 'TIP', 12.1944, -86.0950, 6.0),
('Ticuantepe', 'Managua', 'TIC', 11.9333, -86.2000, 4.0),
('Mateare', 'Managua', 'MTR', 12.2300, -86.4200, 5.0),
('San Rafael del Sur', 'Managua', 'SRS', 11.8500, -86.4333, 5.0),
('Masaya', 'Masaya', 'MSY', 11.9744, -86.0942, 8.0),
('Nindirí', 'Masaya', 'NDR', 12.0000, -86.1000, 4.0),
('Masatepe', 'Masaya', 'MST', 11.9100, -86.1450, 4.0),
('Granada', 'Granada', 'GRA', 11.9299, -85.9560, 7.0),
('Nandaime', 'Granada', 'NDM', 11.7600, -86.0500, 5.0),
('Jinotepe', 'Carazo', 'JTP', 11.8500, -86.2000, 6.0),
('Diriamba', 'Carazo', 'DRB', 11.8564, -86.2386, 6.0),
('Rivas', 'Rivas', 'RIV', 11.4375, -85.8283, 6.0),
('San Juan del Sur', 'Rivas', 'SJS', 11.2527, -85.8700, 4.0),
('León', 'León', 'LEO', 12.4379, -86.8780, 9.0),
('Nagarote', 'León', 'NGR', 12.2600, -86.5700, 4.0),
('La Paz Centro', 'León', 'LPC', 12.3000, -86.6667, 4.0),
('Telica', 'León', 'TLC', 12.5333, -86.8667, 3.0),
('Chinandega', 'Chinandega', 'CHD', 12.6294, -87.1311, 8.0),
('Chichigalpa', 'Chinandega', 'CHG', 12.5667, -87.0333, 4.0),
('Corinto', 'Chinandega', 'COR', 12.4833, -87.1744, 4.0),
('El Viejo', 'Chinandega', 'EVJ', 12.6667, -87.1667, 4.0),
('Somotillo', 'Chinandega', 'SMT', 13.0333, -86.9000, 4.0),
('Estelí', 'Estelí', 'EST', 13.0910, -86.3540, 8.0),
('Condega', 'Estelí', 'CND', 13.3500, -86.4000, 3.0),
('Somoto', 'Madriz', 'SOM', 13.4800, -86.5880, 5.0),
('Palacagüina', 'Madriz', 'PLC', 13.4500, -86.4167, 3.0),
('Ocotal', 'Nueva Segovia', 'OCO', 13.6294, -86.4750, 6.0),
('Jalapa', 'Nueva Segovia', 'JLP', 13.9167, -86.1333, 4.0),
('Jinotega', 'Jinotega', 'JNT', 13.0910, -86.0020, 7.0),
('San Rafael del Norte', 'Jinotega', 'SRN', 13.2000, -86.1000, 3.0),
('Matagalpa', 'Matagalpa', 'MTG', 12.9256, -85.9170, 7.0),
('Sébaco', 'Matagalpa', 'SBC', 12.8500, -86.0833, 4.0),
('Ciudad Darío', 'Matagalpa', 'CDR', 12.7300, -86.1200, 4.0),
('Río Blanco', 'Matagalpa', 'RBL', 12.9400, -85.2000, 4.0),
('Matiguás', 'Matagalpa', 'MTS', 12.8333, -85.4500, 3.0),
('Muy Muy', 'Matagalpa', 'MYM', 12.7667, -85.6167, 3.0),
('Boaco', 'Boaco', 'BOA', 12.4700, -85.6600, 5.0),
('Camoapa', 'Boaco', 'CMP', 12.3833, -85.5167, 4.0),
('Juigalpa', 'Chontales', 'JUI', 12.1060, -85.3640, 6.0),
('Acoyapa', 'Chontales', 'ACY', 11.9722, -85.1750, 3.0),
('Santo Tomás', 'Chontales', 'STM', 12.0667, -85.0833, 3.0),
('San Carlos', 'Río San Juan', 'SCR', 11.1200, -84.7800, 5.0),
('Bluefields', 'RACCS', 'BLU', 11.9986, -83.7574, 8.0),
('El Rama', 'RACCS', 'ERM', 12.1600, -84.2500, 5.0),
('Nueva Guinea', 'RACCS', 'NGN', 11.6833, -84.4500, 6.0),
('Laguna de Perlas', 'RACCS', 'LPE', 12.3500, -83.6667, 3.0),
('Corn Island', 'RACCS', 'COI', 12.1700, -83.0400, 4.0),
('Bilwi', 'RACCN', 'BIL', 14.0333, -83.3833, 6.0),
('Siuna', 'RACCN', 'SIU', 13.7333, -84.7667, 4.0),
('Rosita', 'RACCN', 'ROS', 13.9167, -84.4000, 3.0),
('Bonanza', 'RACCN', 'BNZ', 13.9500, -84.5833, 3.0),
('Waspam', 'RACCN', 'WSP', 14.7333, -83.9667, 3.0),
('Waslala', 'RACCN', 'WSL', 13.3333, -85.3667, 3.0);

INSERT INTO ciudades (nombre, region, codigo, lat, lng, radio_km, habilitada)
SELECT s.nombre, s.region, s.codigo, s.lat, s.lng, s.radio_km, 1 FROM _semilla_ciudades s
WHERE NOT EXISTS (SELECT 1 FROM ciudades c WHERE c.nombre = s.nombre)
AND NOT EXISTS (SELECT 1 FROM ciudades c2 WHERE c2.codigo = s.codigo);

UPDATE ciudades c JOIN _semilla_ciudades s ON s.nombre = c.nombre
SET c.radio_km = IF(c.lat IS NULL, s.radio_km, c.radio_km),
    c.codigo = IF(c.codigo IS NULL, s.codigo, c.codigo),
    c.lat = IF(c.lat IS NULL, s.lat, c.lat),
    c.lng = IF(c.lng IS NULL, s.lng, c.lng);

DROP TABLE IF EXISTS _semilla_ciudades;

INSERT IGNORE INTO universidades (nombre, siglas, dominios, color, habilitada) VALUES
('Universidad de las Regiones Autónomas de la Costa Caribe Nicaragüense', 'URACCAN', 'uraccan.edu.ni', '#16a34a', 1),
('Bluefields Indian & Caribbean University', 'BICU', 'bicu.edu.ni', '#2563eb', 1),
('Universidad Nacional Autónoma de Nicaragua, Managua', 'UNAN-MANAGUA', 'unan.edu.ni', '#1d4ed8', 1),
('Universidad Nacional Autónoma de Nicaragua, León', 'UNAN-LEON', 'unanleon.edu.ni', '#b91c1c', 1),
('Universidad Nacional de Ingeniería', 'UNI', 'uni.edu.ni', '#dc2626', 1),
('Universidad Centroamericana', 'UCA', 'uca.edu.ni', '#7c3aed', 1),
('Universidad Nacional Agraria', 'UNA', 'una.edu.ni', '#15803d', 1),
('Universidad Politécnica de Nicaragua', 'UPOLI', 'upoli.edu.ni', '#0e7490', 1);

INSERT INTO ajustes (clave, valor) SELECT 'esquema_version', '5' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ajustes WHERE clave = 'esquema_version');
UPDATE ajustes SET valor = '5' WHERE clave = 'esquema_version';
INSERT INTO configuracion (hora_apertura, hora_cierre) SELECT '06:00:00', '20:00:00' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM configuracion);
