(function () {
    'use strict';
    var MB = window.MB, P = window.PNL, G = window.MBG;
    var rol = P.rol;
    var contMapa = 0;

    function kpi(etq, icono, color, grande) {
        var val = MB.h('div', { clase: 'val', texto: '0' });
        var pie = MB.h('div', { clase: 'pie-k' });
        var spark = MB.h('canvas');
        var el = MB.h('div', { clase: 'kpi' }, MB.h('div', { clase: 'etq', html: MB.esc(etq) + '<span class="ico-k" style="background:color-mix(in srgb,' + color + ' 18%,transparent);color:' + color + '">' + MB.ico(icono) + '</span>' }), val, pie, spark);
        return {
            el: el,
            poner: function (v, texto, opc) {
                opc = opc || {};
                if (typeof v === 'number') { MB.contar(val, v, opc.dec || 0); } else { val.textContent = v; }
                if (opc.sufijo) { val.insertAdjacentHTML('beforeend', ' <small>' + MB.esc(opc.sufijo) + '</small>'); }
                pie.textContent = texto || '';
                el.classList.toggle('alerta', !!opc.alerta);
                if (opc.serie) { G.chispa(spark, opc.serie, color); }
            }
        };
    }

    function tarjeta(titulo, icono, cuerpo, extra) {
        var t = MB.h('section', { clase: 'tarjeta ' + (extra || '') });
        if (titulo) { t.appendChild(MB.h('h3', { html: (icono ? MB.ico(icono) : '') + MB.esc(titulo) })); }
        if (cuerpo) { t.appendChild(cuerpo); }
        return t;
    }

    function crearMapa(alto) {
        var id = 'mapa-panel-' + (++contMapa);
        var caja = MB.h('div', { id: id, style: 'height:' + alto + ';width:100%' });
        return { caja: caja, id: id };
    }

    function radar(mapa) {
        var capa = null;
        return {
            alternar: function () {
                if (capa) { mapa.mapa.removeLayer(capa); capa = null; MB.toast('Radar apagado', 'info', 1200); return Promise.resolve(false); }
                return fetch('https://api.rainviewer.com/public/weather-maps.json').then(function (r) { return r.json(); }).then(function (d) {
                    var f = d.radar.past[d.radar.past.length - 1];
                    capa = window.L.tileLayer(d.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.6, zIndex: 400 }).addTo(mapa.mapa);
                    MB.toast('Radar de lluvia activo', 'ok', 1600);
                    return true;
                }).catch(function () { MB.toast('Radar no disponible', 'mal'); return false; });
            }
        };
    }

    function sismos() {
        var desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        var u = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=11.9986&longitude=-83.7574&maxradiuskm=600&minmagnitude=3&orderby=time&limit=3&starttime=' + desde;
        return fetch(u).then(function (r) { if (!r.ok) { throw new Error(); } return r.json(); }).then(function (d) {
            return d.features.map(function (f) { return { mag: f.properties.mag, lugar: f.properties.place, t: f.properties.time }; });
        });
    }

    function tarjetaClima() {
        var cuerpo = MB.h('div', { html: '<div class="esqueleto" style="height:120px"></div>' });
        MB.clima().then(function (d) {
            var r = MB.resumenClima(d);
            var horas = r.proximas.map(function (p) { var i = MB.infoClima(p.codigo); return '<div class="hora"><small>' + p.hora + '</small><span>' + i[0] + '</span><b>' + Math.round(p.temp) + '°</b><small>' + p.lluvia + '%</small></div>'; }).join('');
            var consejo = r.lluviaProxima >= 60 ? 'Lluvia probable en las próximas horas: espera más pasajeros en paradas techadas y mayor demanda.' : r.temp >= 33 ? 'Calor intenso: se espera alta demanda al mediodía.' : 'Condiciones normales para la operación.';
            cuerpo.innerHTML = '<div class="clima-actual"><span style="font-size:46px;line-height:1">' + r.emoji + '</span><div><b style="font-size:34px">' + r.temp + '°</b><div class="suave">' + MB.esc(r.texto) + ' · sensación ' + r.sensacion + '°</div></div></div><div class="fila suave pequeno" style="gap:16px;margin-top:8px"><span>Humedad ' + r.humedad + '%</span><span>Viento ' + r.viento + ' km/h</span><span>UV ' + Math.round(r.uv) + '</span></div><div class="horas">' + horas + '</div><p class="insight">' + MB.esc(consejo) + '</p><div id="bloque-sismo" class="suave pequeno"></div>';
            sismos().then(function (s) {
                var b = cuerpo.querySelector('#bloque-sismo');
                if (!b) { return; }
                b.innerHTML = s.length ? 'Sismos recientes (USGS, 600 km): ' + s.map(function (x) { return 'M' + x.mag.toFixed(1) + ' · ' + MB.esc(x.lugar); }).join(' | ') : 'Sin sismos relevantes en los últimos 7 días (USGS).';
            }).catch(function () {});
        }).catch(function () { cuerpo.innerHTML = '<p class="suave">Clima no disponible.</p>'; });
        return tarjeta('Clima y entorno', 'sol', cuerpo);
    }

    function dashboardAdmin(cont) {
        var estado = MB.h('span', { clase: 'pastilla' });
        var bRefrescar = P.boton('Actualizar', 'actualizar', 'fantasma', function () { return cargar(); });
        cont.appendChild(P.encabezado('Centro de control', 'Resumen en vivo de la operación de MiBus Bluefields.', [estado, bRefrescar]));

        var k = {
            buses: kpi('Buses en línea', 'bus', 'var(--primario)'),
            camiones: kpi('Camiones en línea', 'camion', 'var(--ok)'),
            activos: kpi('Pasajeros activos (15 min)', 'usuarios', 'var(--info)'),
            accesos: kpi('Accesos hoy', 'pulso', 'var(--acento)'),
            nuevos: kpi('Pasajeros nuevos hoy', 'usuario', 'var(--primario)'),
            km: kpi('Kilómetros hoy', 'ruta', 'var(--ok)'),
            nota: kpi('Calificación media', 'estrella', 'var(--aviso)'),
            alertas: kpi('Alertas pendientes', 'alerta', 'var(--peligro)')
        };
        var fila = MB.h('div', { clase: 'cuadricula c4' });
        Object.keys(k).forEach(function (n) { fila.appendChild(k[n].el); });
        cont.appendChild(fila);

        var m = crearMapa('380px');
        var mapaCaja = MB.h('div', { clase: 'tarjeta mapa-t' }, m.caja);
        var barraMapa = MB.h('div', { style: 'position:absolute;z-index:500;right:10px;top:10px;display:flex;gap:8px' });
        mapaCaja.appendChild(barraMapa);
        var clima = tarjetaClima();
        var fila2 = MB.h('div', { clase: 'cuadricula', style: 'grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);margin-top:16px' });
        fila2.appendChild(mapaCaja);
        fila2.appendChild(clima);
        cont.appendChild(fila2);

        var cSerie = MB.h('div'), cCalor = MB.h('div'), cNotas = MB.h('div'), cFlota = MB.h('div'), feed = MB.h('div', { clase: 'feed' });
        var leyenda = MB.h('div', { clase: 'leyenda', html: '<span><i style="background:var(--primario)"></i>Accesos</span><span><i style="background:var(--acento)"></i>Registros</span>' });
        var gSerie = tarjeta('Actividad de pasajeros (14 días)', 'grafica', cSerie);
        gSerie.appendChild(leyenda);
        var fila3 = MB.h('div', { clase: 'cuadricula c2', style: 'margin-top:16px' });
        fila3.appendChild(gSerie);
        fila3.appendChild(tarjeta('Horas pico de uso (4 semanas)', 'reloj', cCalor));
        cont.appendChild(fila3);
        var fila4 = MB.h('div', { clase: 'cuadricula c3', style: 'margin-top:16px' });
        fila4.appendChild(tarjeta('Calificaciones', 'estrella', cNotas));
        fila4.appendChild(tarjeta('Estado de la flota', 'bus', cFlota));
        fila4.appendChild(tarjeta('Actividad reciente', 'campana', feed));
        cont.appendChild(fila4);
        var contTabla = MB.h('div', { style: 'margin-top:16px' });
        cont.appendChild(tarjeta('Flota urbana', 'bus', contTabla));

        var mapa = window.MBMapa.disponible() ? window.MBMapa.crear(m.id, { zoom: 14 }) : null;
        var graficos = [];
        var tablaFlota = null;
        var primero = true;
        if (mapa) {
            var btnR = P.boton('Radar', 'nube', 'pequeno', null);
            var rd = radar(mapa);
            btnR.addEventListener('click', function () { rd.alternar().then(function (on) { btnR.classList.toggle('primario', on); }); });
            var btnS = P.boton('Satélite', 'capas', 'pequeno', null);
            btnS.addEventListener('click', function () { btnS.classList.toggle('primario', mapa.alternarSatelite()); });
            barraMapa.appendChild(btnR);
            barraMapa.appendChild(btnS);
        } else { m.caja.innerHTML = '<div class="vacio">' + MB.ico('mapa') + '<p>Mapa no disponible sin conexión</p></div>'; }

        function pintarFlota(d) {
            var buses = d.flota;
            if (mapa) {
                mapa.sincronizarVehiculos(buses, { tipo: 'bus', alPulsar: function () { P.irA('mapa'); } });
                if (primero) { primero = false; mapa.ajustar(buses.filter(function (b) { return b.conectado; }).map(function (b) { return [b.lat, b.lng]; })); }
            }
            var filas = buses;
            var cols = [
                { etq: 'Bus', campo: 'nombre', orden: true, render: function (b) { return '<b>' + MB.esc(b.nombre) + '</b><div class="suave pequeno">' + MB.esc(b.origen) + ' → ' + MB.esc(b.destino) + '</div>'; } },
                { etq: 'Estado', orden: true, valor: function (b) { return b.conectado ? 1 : 0; }, render: function (b) { return b.conectado ? P.pastilla('En línea', 'ok') : P.pastilla(b.habilitado ? 'Sin señal' : 'Deshabilitado', b.habilitado ? 'aviso' : ''); } },
                { etq: 'Velocidad', orden: true, valor: function (b) { return b.vel; }, render: function (b) { return b.conectado ? Math.round(b.vel) + ' km/h' : '—'; } },
                { etq: 'Batería', orden: true, valor: function (b) { return b.bateria === null ? -1 : b.bateria; }, render: function (b) { return b.bateria === null ? '—' : P.pastilla(b.bateria + '%' + (b.cargando ? ' ⚡' : ''), b.bateria <= 20 && !b.cargando ? 'mal' : 'ok'); } },
                { etq: 'Km hoy', orden: true, valor: function (b) { return b.km_hoy; }, render: function (b) { return MB.num(b.km_hoy, 1); } },
                { etq: 'Última señal', orden: true, valor: function (b) { return b.seg === null ? 9e9 : b.seg; }, render: function (b) { return MB.hace(b.seg); } }
            ];
            if (!tablaFlota) {
                contTabla.innerHTML = '';
                var busq = P.buscador(function (q) { tablaFlota.filtrar(q); }, 'Filtrar buses…');
                contTabla.appendChild(MB.h('div', { clase: 'barra-herramientas' }, busq));
                tablaFlota = P.tabla(cols, filas, { alPulsar: function () { P.irA('mapa'); }, vacio: 'No hay buses registrados' });
                contTabla.appendChild(tablaFlota.el);
            } else { tablaFlota.datos(filas); }
        }

        function cargar() {
            return MB.get('admin/dashboard').then(function (d) {
                var q = d.kpis;
                estado.className = 'pastilla ' + (d.en_servicio ? 'ok' : 'aviso');
                estado.innerHTML = '<i class="punto-estado ' + (d.en_servicio ? 'ok' : 'aviso') + '"></i>' + (d.en_servicio ? 'En servicio' : 'Fuera de horario');
                var serieAcc = d.serie.map(function (s) { return s.accesos; });
                k.buses.poner(q.buses_en_linea, 'de ' + q.buses_habilitados + ' habilitados' + (q.bateria_baja ? ' · ' + q.bateria_baja + ' con batería baja' : ''));
                k.camiones.poner(q.camiones_en_linea, 'de ' + q.camiones_total + ' registrados');
                k.activos.poner(q.activos_15min, MB.num(q.usuarios_total) + (q.usuarios_total === 1 ? ' pasajero en total' : ' pasajeros en total'));
                k.accesos.poner(q.accesos_hoy, 'Tendencia 14 días', { serie: serieAcc });
                k.nuevos.poner(q.usuarios_hoy, 'Registros recientes', { serie: d.serie.map(function (s) { return s.registros; }) });
                k.km.poner(q.km_hoy, 'recorridos por la flota', { dec: 1, sufijo: 'km' });
                k.nota.poner(q.resenas_promedio === null ? '—' : q.resenas_promedio, q.resenas_total + (q.resenas_total === 1 ? ' reseña con nota' : ' reseñas con nota'), { dec: 1 });
                var pend = q.sos_pendientes + q.solicitudes_pendientes;
                k.alertas.poner(pend, q.sos_pendientes + ' SOS · ' + q.solicitudes_pendientes + ' solicitudes de clave', { alerta: q.sos_pendientes > 0 });
                graficos.forEach(function (g) { g.destruir(); });
                graficos = [];
                graficos.push(G.lineas(cSerie, { alto: 240, etiquetas: d.serie.map(function (s) { return s.d.slice(5).replace('-', '/'); }), titulos: d.serie.map(function (s) { return s.d; }), series: [{ nombre: 'Accesos', color: 'primario', datos: serieAcc }, { nombre: 'Registros', color: 'acento', datos: d.serie.map(function (s) { return s.registros; }) }] }));
                graficos.push(G.calor(cCalor, { matriz: d.calor, alto: 240 }));
                var nombres = ['1★', '2★', '3★', '4★', '5★'];
                graficos.push(G.barras(cNotas, { alto: 200, etiquetas: nombres, datos: d.calificaciones, colores: ['#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#34d399'], unidad: 'reseñas' }));
                var conectados = d.flota.filter(function (b) { return b.conectado; }).length;
                var sinSenal = d.flota.filter(function (b) { return b.habilitado && !b.conectado; }).length;
                var off = d.flota.length - conectados - sinSenal;
                graficos.push(G.dona(cFlota, { alto: 200, rotulo: 'buses', items: [{ etq: 'En línea', valor: conectados, color: '#34d399' }, { etq: 'Sin señal', valor: sinSenal, color: '#fbbf24' }, { etq: 'Deshabilitados', valor: off, color: '#64808c' }] }));
                feed.innerHTML = '';
                if (!d.feed.length) { feed.innerHTML = '<div class="vacio">Sin actividad reciente</div>'; }
                d.feed.forEach(function (f, i) {
                    feed.appendChild(MB.h('div', { clase: 'feed-item ' + (f.nivel || ''), style: 'animation-delay:' + i * 30 + 'ms', html: '<i class="punto"></i><div><b>' + MB.esc(f.titulo) + '</b><span>' + MB.esc(f.detalle || '') + ' · ' + MB.fecha(f.cuando) + '</span></div>' }));
                });
                P.setAvisos(q.avisos_sin_leer);
                pintarFlota(d);
            });
        }

        var s1 = MB.sondeo(cargar, 20000, { segundoPlano: 90000 });
        var s2 = MB.sondeo(function () {
            return MB.get('panel/mapa', null, { silencioso: true }).then(function (r) {
                if (mapa) { mapa.sincronizarVehiculos(r.camiones, { tipo: 'camion', rotulos: false }); mapa.sincronizarVehiculos(r.buses, { tipo: 'bus', alPulsar: function () { P.irA('mapa'); } }); }
            });
        }, 5000, { segundoPlano: 30000 });
        return { destruir: function () { s1.parar(); s2.parar(); graficos.forEach(function (g) { g.destruir(); }); } };
    }

    function dashboardPropietario(cont) {
        cont.appendChild(P.encabezado(rol === 'cooperativa' ? 'Resumen de la cooperativa' : 'Resumen de mis buses', 'Estado actual de los buses bajo tu responsabilidad.'));
        var k = { total: kpi('Buses', 'bus', 'var(--primario)'), linea: kpi('En línea', 'pulso', 'var(--ok)'), baja: kpi('Batería baja', 'bateria', 'var(--aviso)'), sos: kpi('SOS sin atender', 'alerta', 'var(--peligro)') };
        var fila = MB.h('div', { clase: 'cuadricula c4' });
        Object.keys(k).forEach(function (n) { fila.appendChild(k[n].el); });
        cont.appendChild(fila);
        var cuerpo = MB.h('div');
        var sosCuerpo = MB.h('div');
        var contSos = tarjeta('Alertas SOS', 'alerta', sosCuerpo);
        if (rol === 'propietario') { contSos.style.marginTop = '16px'; }
        cont.appendChild(MB.h('div', { style: 'margin-top:16px' }, tarjeta('Mis buses', 'bus', cuerpo)));
        if (rol === 'propietario') { cont.appendChild(contSos); }
        var sondeos = [];
        sondeos.push(MB.sondeo(function () {
            return MB.get('panel/buses').then(function (r) {
                var b = r.buses;
                k.total.poner(b.length, 'registrados');
                k.linea.poner(b.filter(function (x) { return x.conectado; }).length, 'transmitiendo ahora');
                k.baja.poner(b.filter(function (x) { return x.conectado && x.bateria !== null && x.bateria <= 20 && !x.cargando; }).length, 'cargar pronto');
                cuerpo.innerHTML = '';
                var t = P.tabla([
                    { etq: 'Bus', campo: 'nombre', orden: true, render: function (x) { return '<b>' + MB.esc(x.nombre) + '</b><div class="suave pequeno">' + MB.esc(x.origen) + ' → ' + MB.esc(x.destino) + '</div>'; } },
                    { etq: 'Propietario', render: function (x) { return MB.esc(x.propietario || '—'); } },
                    { etq: 'Estado', render: function (x) { return x.conectado ? P.pastilla('En línea', 'ok') : P.pastilla('Sin señal', 'aviso'); } },
                    { etq: 'Velocidad', render: function (x) { return x.conectado ? Math.round(x.vel) + ' km/h' : '—'; } },
                    { etq: 'Batería', render: function (x) { return x.bateria === null ? '—' : x.bateria + '%'; } },
                    { etq: 'Última señal', render: function (x) { return MB.hace(x.seg); } }
                ], b, { alPulsar: function () { P.irA('mapa'); }, vacio: 'No tienes buses asignados' });
                cuerpo.appendChild(t.el);
            });
        }, 15000, { segundoPlano: 60000 }));
        if (rol === 'propietario') {
            sondeos.push(MB.sondeo(function () {
                return MB.get('panel/sos').then(function (r) {
                    var pend = r.sos.filter(function (s) { return !s.atendida; });
                    k.sos.poner(pend.length, 'requieren atención', { alerta: pend.length > 0 });
                    sosCuerpo.innerHTML = '';
                    if (!r.sos.length) { sosCuerpo.innerHTML = '<div class="vacio">Sin alertas registradas</div>'; return; }
                    var nombres = { mecanico: 'Falla mecánica', medica: 'Emergencia médica', robo: 'Robo o asalto', sos: 'SOS general' };
                    r.sos.slice(0, 12).forEach(function (s) {
                        var fila2 = MB.h('div', { clase: 'feed-item ' + (s.atendida ? '' : 'urgente'), html: '<i class="punto"></i><div class="crece"><b>' + MB.esc(nombres[s.tipo] || s.tipo) + ' · ' + MB.esc(s.bus) + '</b><span>' + MB.fecha(s.fecha_hora) + '</span></div>' });
                        if (!s.atendida) {
                            fila2.appendChild(P.boton('Atender', 'ok', 'pequeno', function () { return MB.post('panel/sos/atender', { id: s.id }).then(function () { MB.toast('Alerta atendida', 'ok'); }); }));
                        }
                        sosCuerpo.appendChild(fila2);
                    });
                });
            }, 10000, { segundoPlano: 60000 }));
        } else { k.sos.poner('—', 'solo propietarios'); }
        return { destruir: function () { sondeos.forEach(function (s) { s.parar(); }); } };
    }

    P.registrar('dashboard', function (cont) { return (rol === 'admin' || rol === 'auditor') ? dashboardAdmin(cont) : dashboardPropietario(cont); });

    P.registrar('mapa', function (cont) {
        var m = crearMapa('100%');
        var caja = MB.h('div', { clase: 'tarjeta mapa-t', style: 'height:100%;border-radius:0' }, m.caja);
        cont.appendChild(caja);
        if (!window.MBMapa.disponible()) { m.caja.innerHTML = '<div class="vacio">' + MB.ico('mapa') + '<p>No se pudo cargar el mapa.</p></div>'; return null; }
        var mapa = window.MBMapa.crear(m.id, { zoom: 14 });
        var info = MB.h('div', { clase: 'tarjeta-anuncio cristal', style: 'position:absolute;left:12px;bottom:12px;right:auto;max-width:340px;display:none;flex-direction:column' });
        caja.appendChild(info);
        var primera = true;
        var barra = MB.h('div', { style: 'position:absolute;z-index:500;right:10px;top:10px;display:flex;gap:8px' });
        var rd = radar(mapa);
        var br = P.boton('Radar', 'nube', 'pequeno cristal', null);
        br.addEventListener('click', function () { rd.alternar().then(function (on) { br.classList.toggle('primario', on); }); });
        var bs = P.boton('Satélite', 'capas', 'pequeno cristal', null);
        bs.addEventListener('click', function () { bs.classList.toggle('primario', mapa.alternarSatelite()); });
        var bf = P.boton('Ajustar', 'mira', 'pequeno cristal', null);
        barra.appendChild(br); barra.appendChild(bs); barra.appendChild(bf);
        caja.appendChild(barra);
        var ultimos = { buses: [], camiones: [] };
        bf.addEventListener('click', function () { mapa.ajustar(ultimos.buses.concat(ultimos.camiones).filter(function (v) { return v.lat !== null; }).map(function (v) { return [v.lat, v.lng]; })); });

        function ficha(b, tipo) {
            info.style.display = 'flex';
            info.innerHTML = '<b>' + MB.esc(b.nombre) + '</b><span class="suave pequeno">' + (tipo === 'bus' ? MB.esc(b.origen) + ' → ' + MB.esc(b.destino) : MB.esc(b.zona || '')) + '</span><div class="fila pequeno" style="margin-top:6px;flex-wrap:wrap">' + (b.conectado ? P.pastilla('En línea', 'ok') : P.pastilla('Sin señal', 'aviso')) + P.pastilla(Math.round(b.vel) + ' km/h') + (b.bateria !== null && b.bateria !== undefined ? P.pastilla(b.bateria + '%') : '') + '<span class="suave">' + MB.hace(b.seg) + '</span></div>';
            if (tipo === 'bus') {
                var a = P.boton('Recorrido de 12 h', 'ruta', 'pequeno', function () {
                    return MB.get('panel/recorrido', { bus_id: b.id, horas: 12 }).then(function (r) {
                        mapa.limpiar('recorrido');
                        if (r.puntos.length > 1) { mapa.linea('recorrido', r.puntos.map(function (p) { return [p[0], p[1]]; }), { color: '#ff8a3d', weight: 4 }); MB.toast(MB.num(r.km, 1) + ' km recorridos', 'ok'); } else { MB.toast('Sin recorrido registrado', 'info'); }
                    });
                });
                var c = P.boton('Cerrar', 'x', 'pequeno fantasma', function () { info.style.display = 'none'; mapa.limpiar('recorrido'); });
                var f = MB.h('div', { clase: 'fila', style: 'margin-top:8px' }, a, c);
                info.appendChild(f);
                mapa.limpiar('rutaBus');
                MB.get('publico/bus', { id: b.id }, { silencioso: true }).then(function (r) { if (r.bus.ruta && r.bus.ruta.length > 1) { mapa.linea('rutaBus', r.bus.ruta, { color: b.color || '#22c3d8', weight: 5, opacity: 0.8 }); } }).catch(function () {});
            }
        }

        var sond = MB.sondeo(function () {
            return MB.get('panel/mapa').then(function (r) {
                ultimos = r;
                mapa.sincronizarVehiculos(r.buses, { tipo: 'bus', alPulsar: function (b) { ficha(b, 'bus'); } });
                mapa.sincronizarVehiculos(r.camiones, { tipo: 'camion', alPulsar: function (c) { ficha(c, 'camion'); } });
                if (primera) {
                    primera = false;
                    mapa.limpiar('paradas');
                    mapa.paradas(r.paradas);
                    mapa.cierres(r.cierres || []);
                    mapa.ajustar(r.buses.concat(r.camiones).filter(function (v) { return v.lat !== null; }).map(function (v) { return [v.lat, v.lng]; }));
                }
            });
        }, 4000, { segundoPlano: 30000 });
        setTimeout(function () { mapa.invalidar(); }, 150);
        return { destruir: function () { sond.parar(); } };
    });

    P.registrar('avisos', function (cont) {
        var cuerpo = MB.h('div', { clase: 'feed', style: 'max-height:none' });
        var leerTodo = P.boton('Marcar todo como leído', 'ok', 'fantasma', function () { return MB.post('panel/bandeja/leer', { todos: 1 }).then(function () { P.setAvisos(0); cargar(); }); });
        cont.appendChild(P.encabezado('Avisos', 'Alertas de flota, batería, desconexiones y seguridad.', leerTodo));
        cont.appendChild(tarjeta(null, null, cuerpo));
        function cargar() {
            return MB.get('panel/bandeja').then(function (r) {
                P.setAvisos(r.sin_leer);
                cuerpo.innerHTML = '';
                if (!r.avisos.length) { cuerpo.innerHTML = '<div class="vacio">' + MB.ico('campana') + '<p>No tienes avisos.</p></div>'; return; }
                r.avisos.forEach(function (a) {
                    var f = MB.h('div', { clase: 'feed-item ' + (a.gravedad === 'urgente' ? 'urgente' : a.gravedad === 'advertencia' ? 'advertencia' : ''), style: a.leido ? 'opacity:.6' : '', html: '<i class="punto"></i><div class="crece"><b>' + MB.esc(a.titulo) + '</b><span>' + MB.esc(a.mensaje) + '</span><span>' + MB.esc(a.bus || '') + ' ' + MB.fecha(a.fecha_hora) + '</span></div>' });
                    if (!a.leido) { f.appendChild(P.boton('Leído', 'ok', 'pequeno fantasma', function () { return MB.post('panel/bandeja/leer', { id: a.id }).then(cargar); })); }
                    cuerpo.appendChild(f);
                });
            });
        }
        var s = MB.sondeo(cargar, 30000, { segundoPlano: 120000 });
        return { destruir: function () { s.parar(); } };
    });

    P.registrar('pasajeros', function (cont) {
        var cuerpo = MB.h('div');
        var exportar = P.boton('Exportar PDF', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/exportar?tipo=usuarios'), '_blank'); return Promise.resolve(); });
        if (rol === 'admin') { cont.appendChild(P.encabezado('Pasajeros', 'Personas registradas en la plataforma.', exportar)); } else { cont.appendChild(P.encabezado('Pasajeros', 'Personas registradas en la plataforma.')); }
        var tbl = null;
        var busq = P.buscador(function (q) { cargar(q); }, 'Buscar por nombre o teléfono…');
        cont.appendChild(MB.h('div', { clase: 'barra-herramientas' }, busq));
        cont.appendChild(cuerpo);
        function cargar(q) {
            return MB.get('panel/usuarios-finales', { q: q || '' }).then(function (r) {
                cuerpo.innerHTML = '';
                cuerpo.appendChild(MB.h('p', { clase: 'suave pequeno', style: 'margin-bottom:8px', texto: MB.num(r.total) + ' pasajeros en total' }));
                tbl = P.tabla([
                    { etq: 'Nombre', campo: 'nombre', orden: true },
                    { etq: 'Teléfono', campo: 'telefono' },
                    { etq: 'Ciudad', campo: 'ciudad', orden: true },
                    { etq: 'Universidad', render: function (u) { return u.universidad ? P.pastilla(u.universidad, 'info') : '—'; } },
                    { etq: 'Accesos', campo: 'accesos', orden: true, valor: function (u) { return Number(u.accesos); } },
                    { etq: 'Registro', render: function (u) { return MB.fecha(u.fecha_registro); } },
                    { etq: 'Último acceso', render: function (u) { return MB.fecha(u.ultimo_acceso); } }
                ], r.usuarios, { vacio: 'Sin pasajeros' });
                cuerpo.appendChild(tbl.el);
            });
        }
        cargar('');
        return null;
    });

    P.registrar('resenas', function (cont) {
        var acciones = [];
        if (rol === 'admin') { acciones.push(P.boton('Exportar PDF', 'descargar', 'fantasma', function () { window.open(MB.url('/api/admin/exportar?tipo=resenas'), '_blank'); return Promise.resolve(); })); }
        cont.appendChild(P.encabezado('Reseñas', 'Opiniones de los pasajeros sobre el servicio.', acciones));
        var resumen = MB.h('div', { clase: 'cuadricula c2' });
        var cuerpo = MB.h('div', { style: 'margin-top:16px' });
        cont.appendChild(resumen);
        cont.appendChild(cuerpo);
        MB.get('panel/resenas').then(function (r) {
            var cNotas = MB.h('div');
            resumen.appendChild(tarjeta('Distribución de notas', 'estrella', cNotas));
            resumen.appendChild(tarjeta('Promedio general', 'grafica', MB.h('div', { html: '<div style="font-size:54px;font-weight:800;line-height:1">' + (r.promedio === null ? '—' : MB.num(r.promedio, 1)) + '<small class="suave" style="font-size:18px"> / 5</small></div><p class="suave">' + r.resenas.length + ' reseñas recientes</p>' })));
            G.barras(cNotas, { alto: 180, etiquetas: ['1★', '2★', '3★', '4★', '5★'], datos: r.distribucion, colores: ['#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#34d399'], unidad: 'reseñas' });
            var cols = [
                { etq: 'Nombre', campo: 'nombre', orden: true },
                { etq: 'Origen', render: function (x) { return x.modulo === 'camion' ? 'Camión' : 'Buses'; } },
                { etq: 'Nota', orden: true, valor: function (x) { return x.calificacion || 0; }, render: function (x) { return x.calificacion ? '★'.repeat(x.calificacion) : '—'; } },
                { etq: 'Comentario', render: function (x) { return '<span style="white-space:normal;display:block;min-width:200px">' + MB.esc(x.comentario) + '</span>'; } },
                { etq: 'Fecha', render: function (x) { return MB.fecha(x.fecha_hora); } }
            ];
            if (rol === 'admin') {
                cols.push({ etq: '', render: function (x) { var b = P.boton('', 'basura', 'icono fantasma', function () { return MB.confirmar('Eliminar reseña', '¿Quitar esta reseña definitivamente?', 'Eliminar', true).then(function (ok) { if (!ok) { return; } return MB.post('admin/resena/eliminar', { id: x.id }).then(function () { P.recargar(); }); }); }); return b; } });
            }
            var t = P.tabla(cols, r.resenas, { vacio: 'Aún no hay reseñas' });
            cuerpo.appendChild(MB.h('div', { clase: 'barra-herramientas' }, P.buscador(function (q) { t.filtrar(q); })));
            cuerpo.appendChild(t.el);
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        return null;
    });

    P.registrar('camiones', function (cont) {
        cont.appendChild(P.encabezado('Camiones de basura', 'Estado de los camiones recolectores.'));
        var cuerpo = MB.h('div');
        cont.appendChild(cuerpo);
        var s = MB.sondeo(function () {
            return MB.get('panel/camiones').then(function (r) {
                cuerpo.innerHTML = '';
                cuerpo.appendChild(P.tabla([
                    { etq: 'Camión', campo: 'nombre', orden: true, render: function (c) { return '<b>' + MB.esc(c.nombre) + '</b><div class="suave pequeno">' + MB.esc(c.zona) + '</div>'; } },
                    { etq: 'Estado', render: function (c) { return !c.habilitado ? P.pastilla('Deshabilitado') : !c.activo_hoy ? P.pastilla('No sale hoy') : c.conectado ? P.pastilla('En línea', 'ok') : P.pastilla('Sin señal', 'aviso'); } },
                    { etq: 'Velocidad', render: function (c) { return c.conectado ? Math.round(c.vel) + ' km/h' : '—'; } },
                    { etq: 'Batería', render: function (c) { return c.bateria === null ? '—' : c.bateria + '%'; } },
                    { etq: 'Última señal', render: function (c) { return MB.hace(c.seg); } }
                ], r.camiones, { vacio: 'Sin camiones' }).el);
            });
        }, 15000, { segundoPlano: 60000 });
        return { destruir: function () { s.parar(); } };
    });

    P.registrar('propietarios', function (cont) {
        cont.appendChild(P.encabezado('Propietarios', 'Propietarios asociados a tu cooperativa.'));
        var cuerpo = MB.h('div');
        cont.appendChild(cuerpo);
        MB.get('panel/propietarios').then(function (r) {
            cuerpo.appendChild(P.tabla([
                { etq: 'Nombre', campo: 'nombre', orden: true },
                { etq: 'Correo', campo: 'correo' },
                { etq: 'Tipo', campo: 'tipo_propietario' },
                { etq: 'Buses', campo: 'buses', orden: true, valor: function (p) { return Number(p.buses); } },
                { etq: 'Cuenta', render: function (p) { return Number(p.cuenta_activa) === 1 ? P.pastilla('Activa', 'ok') : P.pastilla('Inactiva'); } },
                { etq: 'Último acceso', render: function (p) { return MB.fecha(p.ultimo_acceso); } }
            ], r.propietarios, { vacio: 'Sin propietarios' }).el);
        }).catch(function (e) { cuerpo.innerHTML = '<div class="vacio">' + MB.esc(e.message) + '</div>'; });
        return null;
    });

    window.PNLK = { kpi: kpi, tarjeta: tarjeta, crearMapa: crearMapa, radar: radar };
})();
