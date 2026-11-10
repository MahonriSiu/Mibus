(function () {
    'use strict';
    var MB = window.MB;
    var G = window.MBG;

    MB.get('publico/anunciante', { token: MB.cfg.token }).then(function (r) {
        MB.$('#sub-negocio').textContent = r.negocio;
        var estado = r.activo ? '<span class="pastilla ok">Activo</span>' : '<span class="pastilla aviso">Pausado</span>';
        var limite = r.max_vistas ? '<div class="suave pequeno" style="margin-top:8px">Tu plan incluye ' + MB.num(r.max_vistas) + ' vistas. Llevas ' + MB.num(r.vistas) + ' (' + Math.min(100, Math.round(r.vistas * 100 / r.max_vistas)) + '%).</div>' : '';
        var vence = r.expira ? '<div class="suave pequeno">Vigente hasta ' + MB.esc(r.expira) + '</div>' : '';
        MB.$('#resumen-anuncio').innerHTML = '<div class="fila-entre"><h3>' + MB.esc(r.negocio) + '</h3>' + estado + '</div>' +
            '<div class="metricas" style="margin-top:12px"><div class="metrica"><b>' + MB.num(r.vistas) + '</b><span>vistas</span></div><div class="metrica"><b>' + MB.num(r.clics) + '</b><span>clics</span></div><div class="metrica"><b>' + r.ctr + '%</b><span>clics por vista</span></div></div>' + limite + vence;

        if (r.por_dia.length) {
            MB.$('#tarjeta-dias').classList.remove('oculto');
            setTimeout(function () { G.barras(MB.$('#grafico-dias'), { alto: 170, etiquetas: r.por_dia.map(function (d) { return d.d.slice(8); }), titulos: r.por_dia.map(function (d) { return d.d; }), datos: r.por_dia.map(function (d) { return Number(d.n); }), unidad: 'vistas', color: 'acento' }); }, 60);
        }

        if (r.por_ciudad.length) {
            MB.$('#tarjeta-ciudades').classList.remove('oculto');
            MB.$('#lista-ciudades').innerHTML = r.por_ciudad.map(function (x) { return '<div class="fila-entre" style="padding:6px 0"><span>' + MB.esc(x.ciudad) + '</span><b>' + MB.num(x.n) + '</b></div>'; }).join('');
        }
    }).catch(function (e) {
        MB.$('#sub-negocio').textContent = 'Enlace no válido';
        MB.$('#resumen-anuncio').innerHTML = '<div class="vacio"><p>' + MB.esc(e.message) + '</p></div>';
    });
})();
