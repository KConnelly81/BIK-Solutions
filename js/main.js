/* BIK Solutions — main.js */

/* --- Nav hamburger toggle --- */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const drawer = document.querySelector('.nav-drawer');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', function () {
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    drawer.classList.toggle('open', !expanded);
    document.body.style.overflow = expanded ? '' : 'hidden';
  });

  // Close on nav drawer link click
  drawer.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      toggle.setAttribute('aria-expanded', 'false');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
})();

/* --- Active nav link --- */
(function () {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(function (a) {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* --- Contact form — Formspree AJAX submit --- */
(function () {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Sending…';
    btn.disabled = true;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
    .then(function (res) {
      if (res.ok) {
        btn.textContent = 'Sent — we\'ll be in touch!';
        form.reset();
        setTimeout(function () {
          btn.textContent = original;
          btn.disabled = false;
        }, 5000);
      } else {
        btn.textContent = 'Error — please call us on 0434 524 270';
        btn.disabled = false;
      }
    })
    .catch(function () {
      btn.textContent = 'Error — please call us on 0434 524 270';
      btn.disabled = false;
    });
  });
})();

/* --- Cart placeholder buttons --- */
(function () {
  document.querySelectorAll('.btn--cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      this.textContent = 'Coming soon';
    });
  });
})();

/* --- Free download form — Formspree AJAX + trigger download --- */
(function () {
  const form = document.getElementById('free-download-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
    .then(function (res) {
      if (res.ok) {
        // Trigger download — swap URL to real hosted PDF once available
        var a = document.createElement('a');
        a.href = 'assets/downloads/site-protection-punchlist.pdf';
        a.download = 'BIK-Solutions-Site-Protection-Punchlist.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        form.hidden = true;
        var success = document.getElementById('download-success');
        if (success) success.hidden = false;
      } else {
        btn.textContent = 'Error — please try again';
        btn.disabled = false;
      }
    })
    .catch(function () {
      btn.textContent = 'Error — please try again';
      btn.disabled = false;
    });
  });
})();
