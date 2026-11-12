// Raven Guard Consulting: small, dependency-free behaviour.

(function () {
  // Mobile menu
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      btn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && nav.classList.contains('open')) btn.click();
    });
  }

  // Delivery matrix: hovering a cell lights its row and column
  var matrix = document.getElementById('matrix');
  if (matrix) {
    matrix.addEventListener('mouseover', function (e) {
      var cell = e.target.closest('.cell');
      if (!cell) return;
      matrix.dataset.r = cell.dataset.r;
      matrix.dataset.c = cell.dataset.c;
    });
    matrix.addEventListener('mouseleave', function () {
      delete matrix.dataset.r;
      delete matrix.dataset.c;
    });
  }

  // Contact form: compose a mailto draft (no backend yet)
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      if (!name || !email) {
        (name ? form.email : form.name).focus();
        return;
      }
      var practice = form.practice.value;
      var msg = form.message.value.trim();
      var subject = 'Raven Guard: ' + practice + ' enquiry from ' + name;
      var body = [
        msg || '(no message)',
        '',
        name,
        email,
        'Practice: ' + practice
      ].join('\n');
      window.location.href = 'mailto:hello@ravenguardconsulting.com'
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);
      form.classList.add('sent');
    });
  }
})();
