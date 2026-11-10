(function () {
    'use strict';
    var MB = window.MB;

    function css(nombre, defecto) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
        return v || defecto;
    }

    function colores() {
        return { primario: css('--primario', '#22c3d8'), acento: css('--acento', '#ff8a3d'), texto: css('--texto', '#e8f4f8'), suave: css('--suave', '#8aa6b2'), borde: css('--borde', 'rgba(255,255,255,.1)'), ok: css('--ok', '#34d399'), aviso: css('--aviso', '#fbbf24'), peligro: css('--peligro', '#fb7185'), info: css('--info', '#60a5fa') };
    }

    function resolverColor(valor) {
        var c = colores();
        if (!valor) { return c.primario; }
        if (c[valor]) { return c[valor]; }
        var m = /^var\((--[a-z0-9-]+)\)$/.exec(valor);
        if (m) { return css(m[1], c.primario); }
        return valor;
    }

    function preparar(contenedor, alto) {
        contenedor.innerHTML = '';
        contenedor.classList.add('lienzo-grafico');
        var canvas = document.createElement('canvas');
        var tip = document.createElement('div');
        tip.className = 'tip-grafico';
        contenedor.appendChild(canvas);
        contenedor.appendChild(tip);
        canvas.style.height = alto + 'px';
        return { canvas: canvas, tip: tip, alto: alto };
    }

    function ajustarLienzo(canvas, alto) {
        var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        var ancho = canvas.parentNode.clientWidth || 300;
        canvas.width = Math.round(ancho * dpr);
        canvas.height = Math.round(alto * dpr);
        var g = canvas.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { g: g, ancho: ancho, alto: alto };
    }

    function observar(contenedor, redibujar) {
        var ultimo = 0;
        var o = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () {
            var w = contenedor.clientWidth;
            if (w !== ultimo) { ultimo = w; redibujar(); }
        }) : null;
        if (o) { o.observe(contenedor); }
        document.addEventListener('mb-tema', redibujar);
        return function () { if (o) { o.disconnect(); } document.removeEventListener('mb-tema', redibujar); };
    }

    function escalaNice(max) {
        if (max <= 0) { return 4; }
        var exp = Math.pow(10, Math.floor(Math.log10(max)));
        var f = max / exp;
        var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
        return n * exp;
    }

    function mostrarTip(tip, contenedor, x, y, html) {
        tip.innerHTML = html;
        tip.classList.add('visible');
        var w = contenedor.clientWidth;
        var tw = tip.offsetWidth;
        tip.style.left = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, x)) + 'px';
        tip.style.top = Math.max(tip.offsetHeight, y) + 'px';
    }

    function lineas(contenedor, opc) {
        var alto = opc.alto || 220;
        var p = preparar(contenedor, alto);
        var hover = -1;
        var anim = 0;
        var inicio = performance.now();
        var DUR = 700;

        function dibujar(progreso) {
            var c = colores();
            var l = ajustarLienzo(p.canvas, alto);
            var g = l.g;
            var m = { t: 12, r: 12, b: 26, l: 38 };
            var w = l.ancho - m.l - m.r, h = alto - m.t - m.b;
            var n = opc.etiquetas.length;
            var max = 0;
            opc.series.forEach(function (s) { s.datos.forEach(function (v) { if (v > max) { max = v; } }); });
            var tope = escalaNice(max * 1.05) || 4;
            var paso = n > 1 ? w / (n - 1) : w;

            g.clearRect(0, 0, l.ancho, alto);
            g.font = '11px system-ui, sans-serif';
            g.textBaseline = 'middle';
            var div = tope <= 5 ? tope : 5;
            for (var i = 0; i <= div; i++) {
                var y = m.t + h - (h * i / div);
                g.strokeStyle = c.borde;
                g.lineWidth = 1;
                g.beginPath(); g.moveTo(m.l, y); g.lineTo(l.ancho - m.r, y); g.stroke();
                g.fillStyle = c.suave;
                g.textAlign = 'right';
                g.fillText(MB.num(tope * i / div, 0), m.l - 8, y);
            }
            g.textAlign = 'center';
            g.textBaseline = 'top';
            var salto = Math.ceil(n / Math.max(2, Math.floor(w / 62)));
            opc.etiquetas.forEach(function (e, k) { if (k % salto === 0 || k === n - 1) { g.fillStyle = c.suave; g.fillText(e, m.l + k * paso, alto - m.b + 8); } });

            opc.series.forEach(function (s) {
                var color = c[s.color] || s.color || c.primario;
                var pts = s.datos.map(function (v, k) { return [m.l + k * paso, m.t + h - (h * v / tope) * progreso]; });
                if (!pts.length) { return; }
                var grad = g.createLinearGradient(0, m.t, 0, m.t + h);
                grad.addColorStop(0, color + '55');
                grad.addColorStop(1, color + '00');
                g.beginPath();
                g.moveTo(pts[0][0], m.t + h);
                curva(g, pts, true);
                g.lineTo(pts[pts.length - 1][0], m.t + h);
                g.closePath();
                g.fillStyle = grad;
                g.fill();
                g.beginPath();
                curva(g, pts, false);
                g.strokeStyle = color;
                g.lineWidth = 2.5;
                g.lineJoin = 'round';
                g.stroke();
                if (hover >= 0 && pts[hover]) {
                    g.beginPath(); g.arc(pts[hover][0], pts[hover][1], 5, 0, Math.PI * 2);
                    g.fillStyle = css('--solido', '#0c1f2b'); g.fill();
                    g.lineWidth = 3; g.strokeStyle = color; g.stroke();
                }
            });
            if (hover >= 0) {
                g.strokeStyle = c.suave; g.globalAlpha = 0.4; g.setLineDash([4, 4]);
                g.beginPath(); g.moveTo(m.l + hover * paso, m.t); g.lineTo(m.l + hover * paso, m.t + h); g.stroke();
                g.setLineDash([]); g.globalAlpha = 1;
            }
            p.geo = { m: m, paso: paso, n: n, h: h, tope: tope };
        }

        function curva(g, pts, continuar) {
            if (!continuar) { g.moveTo(pts[0][0], pts[0][1]); } else { g.lineTo(pts[0][0], pts[0][1]); }
            for (var i = 0; i < pts.length - 1; i++) {
                var a = pts[i], b = pts[i + 1];
                var cx = (a[0] + b[0]) / 2;
                g.bezierCurveTo(cx, a[1], cx, b[1], b[0], b[1]);
            }
        }

        function animar(t) {
            var pr = Math.min(1, (t - inicio) / DUR);
            dibujar(1 - Math.pow(1 - pr, 3));
            if (pr < 1) { anim = requestAnimationFrame(animar); }
        }

        function mover(ev) {
            if (!p.geo) { return; }
            var r = p.canvas.getBoundingClientRect();
            var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
            var k = Math.round((x - p.geo.m.l) / p.geo.paso);
            k = Math.max(0, Math.min(p.geo.n - 1, k));
            if (k === hover) { return; }
            hover = k;
            dibujar(1);
            var s = opc.series.map(function (se) { return '<div><i style="background:' + (colores()[se.color] || se.color) + '"></i>' + MB.esc(se.nombre) + ': <b>' + MB.num(se.datos[k]) + '</b></div>'; }).join('');
            var x2 = p.geo.m.l + k * p.geo.paso;
            mostrarTip(p.tip, contenedor, x2, p.geo.m.t + 10, '<small>' + MB.esc(opc.titulos ? opc.titulos[k] : opc.etiquetas[k]) + '</small>' + s);
        }

        function salir() { hover = -1; p.tip.classList.remove('visible'); dibujar(1); }
        p.canvas.addEventListener('mousemove', mover);
        p.canvas.addEventListener('touchstart', mover, { passive: true });
        p.canvas.addEventListener('touchmove', mover, { passive: true });
        p.canvas.addEventListener('mouseleave', salir);
        p.canvas.addEventListener('touchend', function () { setTimeout(salir, 1200); });
        anim = requestAnimationFrame(animar);
        var parar = observar(contenedor, function () { dibujar(1); });
        return { destruir: function () { cancelAnimationFrame(anim); parar(); } };
    }

    function barras(contenedor, opc) {
        var alto = opc.alto || 200;
        var p = preparar(contenedor, alto);
        var hover = -1;
        var anim = 0;
        var inicio = performance.now();

        function dibujar(progreso) {
            var c = colores();
            var l = ajustarLienzo(p.canvas, alto);
            var g = l.g;
            var m = { t: 10, r: 8, b: 26, l: 34 };
            var w = l.ancho - m.l - m.r, h = alto - m.t - m.b;
            var n = opc.datos.length;
            var max = opc.datos.reduce(function (a, v) { return Math.max(a, v); }, 0);
            var tope = escalaNice(max * 1.05) || 4;
            g.clearRect(0, 0, l.ancho, alto);
            g.font = '11px system-ui, sans-serif';
            var div = tope <= 5 ? tope : 5;
            for (var i = 0; i <= div; i++) {
                var y = m.t + h - (h * i / div);
                g.strokeStyle = c.borde; g.beginPath(); g.moveTo(m.l, y); g.lineTo(l.ancho - m.r, y); g.stroke();
                g.fillStyle = c.suave; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(MB.num(tope * i / div, 0), m.l - 6, y);
            }
            var ancho = w / n;
            var bw = Math.min(46, ancho * 0.64);
            opc.datos.forEach(function (v, k) {
                var bh = (h * v / tope) * progreso;
                var x = m.l + k * ancho + (ancho - bw) / 2;
                var color = opc.colores ? opc.colores[k] : (c[opc.color] || opc.color || c.primario);
                var grad = g.createLinearGradient(0, m.t + h - bh, 0, m.t + h);
                grad.addColorStop(0, color);
                grad.addColorStop(1, color + '99');
                g.fillStyle = hover === k ? color : grad;
                var r = Math.min(8, bw / 2);
                g.beginPath();
                g.moveTo(x, m.t + h); g.lineTo(x, m.t + h - bh + r); g.quadraticCurveTo(x, m.t + h - bh, x + r, m.t + h - bh);
                g.lineTo(x + bw - r, m.t + h - bh); g.quadraticCurveTo(x + bw, m.t + h - bh, x + bw, m.t + h - bh + r); g.lineTo(x + bw, m.t + h);
                g.closePath(); g.fill();
                g.fillStyle = c.suave; g.textAlign = 'center'; g.textBaseline = 'top';
                g.fillText(opc.etiquetas[k], x + bw / 2, alto - m.b + 8);
            });
            p.geo = { m: m, ancho: ancho, n: n, h: h, tope: tope };
        }

        function animar(t) { var pr = Math.min(1, (t - inicio) / 650); dibujar(1 - Math.pow(1 - pr, 3)); if (pr < 1) { anim = requestAnimationFrame(animar); } }

        function mover(ev) {
            if (!p.geo) { return; }
            var r = p.canvas.getBoundingClientRect();
            var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
            var k = Math.floor((x - p.geo.m.l) / p.geo.ancho);
            if (k < 0 || k >= p.geo.n) { return salir(); }
            if (k === hover) { return; }
            hover = k; dibujar(1);
            var v = opc.datos[k];
            mostrarTip(p.tip, contenedor, p.geo.m.l + (k + 0.5) * p.geo.ancho, p.geo.m.t + p.geo.h - (p.geo.h * v / p.geo.tope), '<small>' + MB.esc(opc.titulos ? opc.titulos[k] : opc.etiquetas[k]) + '</small><div><b>' + MB.num(v) + '</b> ' + MB.esc(opc.unidad || '') + '</div>');
        }
        function salir() { hover = -1; p.tip.classList.remove('visible'); dibujar(1); }
        p.canvas.addEventListener('mousemove', mover);
        p.canvas.addEventListener('touchstart', mover, { passive: true });
        p.canvas.addEventListener('mouseleave', salir);
        p.canvas.addEventListener('touchend', function () { setTimeout(salir, 1200); });
        anim = requestAnimationFrame(animar);
        var parar = observar(contenedor, function () { dibujar(1); });
        return { destruir: function () { cancelAnimationFrame(anim); parar(); } };
    }

    function dona(contenedor, opc) {
        var alto = opc.alto || 200;
        var p = preparar(contenedor, alto);
        var hover = -1;
        var anim = 0;
        var inicio = performance.now();

        function dibujar(progreso) {
            var c = colores();
            var l = ajustarLienzo(p.canvas, alto);
            var g = l.g;
            g.clearRect(0, 0, l.ancho, alto);
            var cx = l.ancho / 2, cy = alto / 2;
            var R = Math.min(cx, cy) - 8, r = R * 0.64;
            var total = opc.items.reduce(function (a, i) { return a + i.valor; }, 0);
            var ang = -Math.PI / 2;
            p.arcos = [];
            if (!total) {
                g.beginPath(); g.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2); g.lineWidth = R - r; g.strokeStyle = c.borde; g.stroke();
            } else {
                opc.items.forEach(function (it, k) {
                    var a = (it.valor / total) * Math.PI * 2 * progreso;
                    var radio = hover === k ? R + 4 : R;
                    g.beginPath();
                    g.arc(cx, cy, (radio + r) / 2, ang, ang + Math.max(0, a - 0.02));
                    g.lineWidth = radio - r;
                    g.strokeStyle = it.color;
                    g.stroke();
                    p.arcos.push([ang, ang + (it.valor / total) * Math.PI * 2]);
                    ang += a;
                });
            }
            g.fillStyle = c.texto; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = '700 26px system-ui, sans-serif';
            g.fillText(opc.centro !== undefined ? opc.centro : MB.num(total), cx, cy - 6);
            g.font = '12px system-ui, sans-serif'; g.fillStyle = c.suave;
            g.fillText(opc.rotulo || '', cx, cy + 16);
            p.centro = [cx, cy, R, r];
        }
        function animar(t) { var pr = Math.min(1, (t - inicio) / 800); dibujar(1 - Math.pow(1 - pr, 3)); if (pr < 1) { anim = requestAnimationFrame(animar); } }
        function mover(ev) {
            if (!p.centro) { return; }
            var rc = p.canvas.getBoundingClientRect();
            var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rc.left - p.centro[0];
            var y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rc.top - p.centro[1];
            var d = Math.sqrt(x * x + y * y);
            var k = -1;
            if (d >= p.centro[3] - 4 && d <= p.centro[2] + 6) {
                var a = Math.atan2(y, x); if (a < -Math.PI / 2) { a += Math.PI * 2; }
                (p.arcos || []).forEach(function (ar, i) { if (a >= ar[0] && a < ar[1]) { k = i; } });
            }
            if (k === hover) { return; }
            hover = k; dibujar(1);
            if (k < 0) { p.tip.classList.remove('visible'); return; }
            var it = opc.items[k];
            var tot = opc.items.reduce(function (s, i) { return s + i.valor; }, 0);
            mostrarTip(p.tip, contenedor, p.centro[0], p.centro[1] - p.centro[2] + 18, '<small>' + MB.esc(it.etq) + '</small><div><b>' + MB.num(it.valor) + '</b> · ' + Math.round(it.valor * 100 / tot) + '%</div>');
        }
        p.canvas.addEventListener('mousemove', mover);
        p.canvas.addEventListener('touchstart', mover, { passive: true });
        p.canvas.addEventListener('mouseleave', function () { hover = -1; p.tip.classList.remove('visible'); dibujar(1); });
        anim = requestAnimationFrame(animar);
        var parar = observar(contenedor, function () { dibujar(1); });
        return { destruir: function () { cancelAnimationFrame(anim); parar(); } };
    }

    function calor(contenedor, opc) {
        var alto = opc.alto || 230;
        var p = preparar(contenedor, alto);
        var dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        var hover = null;
        var max = 0;
        opc.matriz.forEach(function (f) { f.forEach(function (v) { if (v > max) { max = v; } }); });

        function dibujar() {
            var c = colores();
            var l = ajustarLienzo(p.canvas, alto);
            var g = l.g;
            var m = { t: 4, l: 34, b: 20, r: 4 };
            var cw = (l.ancho - m.l - m.r) / 24, ch = (alto - m.t - m.b) / 7;
            g.clearRect(0, 0, l.ancho, alto);
            g.font = '10.5px system-ui, sans-serif';
            for (var d = 0; d < 7; d++) {
                g.fillStyle = c.suave; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(dias[d], m.l - 6, m.t + d * ch + ch / 2);
                for (var hh = 0; hh < 24; hh++) {
                    var v = opc.matriz[d][hh];
                    var a = max ? Math.pow(v / max, 0.6) : 0;
                    g.fillStyle = v ? 'rgba(34,195,216,' + (0.12 + a * 0.88) + ')' : c.borde;
                    var x = m.l + hh * cw + 1, y = m.t + d * ch + 1;
                    g.beginPath();
                    if (g.roundRect) { g.roundRect(x, y, cw - 2, ch - 2, 4); } else { g.rect(x, y, cw - 2, ch - 2); }
                    g.fill();
                    if (hover && hover[0] === d && hover[1] === hh) { g.strokeStyle = c.acento; g.lineWidth = 2; g.stroke(); }
                }
            }
            g.fillStyle = c.suave; g.textAlign = 'center'; g.textBaseline = 'top';
            [0, 6, 12, 18, 23].forEach(function (hh) { g.fillText(hh + 'h', m.l + hh * cw + cw / 2, alto - m.b + 5); });
            p.geo = { m: m, cw: cw, ch: ch };
        }
        function mover(ev) {
            if (!p.geo) { return; }
            var r = p.canvas.getBoundingClientRect();
            var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
            var y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
            var hh = Math.floor((x - p.geo.m.l) / p.geo.cw), d = Math.floor((y - p.geo.m.t) / p.geo.ch);
            if (hh < 0 || hh > 23 || d < 0 || d > 6) { hover = null; p.tip.classList.remove('visible'); dibujar(); return; }
            hover = [d, hh]; dibujar();
            mostrarTip(p.tip, contenedor, p.geo.m.l + (hh + 0.5) * p.geo.cw, p.geo.m.t + d * p.geo.ch, '<small>' + dias[d] + ' ' + hh + ':00</small><div><b>' + MB.num(opc.matriz[d][hh]) + '</b> accesos</div>');
        }
        p.canvas.addEventListener('mousemove', mover);
        p.canvas.addEventListener('touchstart', mover, { passive: true });
        p.canvas.addEventListener('mouseleave', function () { hover = null; p.tip.classList.remove('visible'); dibujar(); });
        dibujar();
        var parar = observar(contenedor, dibujar);
        return { destruir: parar };
    }

    function chispa(canvas, datos, color) {
        function dibujar() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = canvas.clientWidth || 100, h = canvas.clientHeight || 40;
            canvas.width = w * dpr; canvas.height = h * dpr;
            var g = canvas.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, w, h);
            if (!datos || datos.length < 2) { return; }
            var max = Math.max.apply(null, datos), min = Math.min.apply(null, datos);
            var rango = max - min || 1;
            var col = resolverColor(color);
            var pts = datos.map(function (v, i) { return [i * (w / (datos.length - 1)), h - 4 - ((v - min) / rango) * (h - 10)]; });
            var gr = g.createLinearGradient(0, 0, 0, h);
            gr.addColorStop(0, col + '44'); gr.addColorStop(1, col + '00');
            g.beginPath(); g.moveTo(0, h);
            pts.forEach(function (p) { g.lineTo(p[0], p[1]); });
            g.lineTo(w, h); g.closePath(); g.fillStyle = gr; g.fill();
            g.beginPath();
            pts.forEach(function (p, i) { if (i) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } });
            g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
        }
        dibujar();
        document.addEventListener('mb-tema', dibujar);
    }

    window.MBG = { lineas: lineas, barras: barras, dona: dona, calor: calor, chispa: chispa, colores: colores };
})();
