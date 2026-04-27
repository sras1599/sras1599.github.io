// Theme toggle
(function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('theme', next === 'dark' ? 'dark' : 'light'); } catch (e) { }
        applyTheme(next);
    });
})();

const revealCards = document.querySelectorAll("[data-reveal]");

if (revealCards.length > 0) {
    document.body.classList.add("js-ready");

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.25 }
    );

    revealCards.forEach((card) => {
        observer.observe(card);
    });
}