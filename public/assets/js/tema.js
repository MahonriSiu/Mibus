(function () {
    var tema = 'oscuro';
    try {
        var guardado = localStorage.getItem('mb-tema');
        if (guardado === 'claro' || guardado === 'oscuro') {
            tema = guardado;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            tema = 'claro';
        }
    } catch (e) {}
    document.documentElement.setAttribute('data-tema', tema);
})();
