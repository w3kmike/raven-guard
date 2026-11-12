// Careers page: render the jobs board from data/jobs.js, filter it, and
// compose application emails. No backend; applications open the mail client.

(function () {
  var MAIL = 'careers@ravenguardconsulting.com';
  var list = document.getElementById('jobs');
  var empty = document.getElementById('jobs-empty');
  var count = document.getElementById('jobs-count');
  var chips = document.querySelectorAll('[data-practice]');
  var typeSel = document.getElementById('job-type');
  if (!list) return;

  var jobs = (window.RG_JOBS || []).filter(function (j) { return j.open !== false; });
  var practice = 'All';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function li(items) { return '<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
  function applyHref(j) {
    var subject = 'Application: ' + j.title + ' (' + j.id + ')';
    var body = 'Role: ' + j.title + ' (' + j.id + ')\n\nName:\nLinkedIn or portfolio:\nWhy this role:\n\n(Attach your resume before sending.)';
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function fmtDate(s) {
    var d = new Date(s + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function render() {
    var type = typeSel ? typeSel.value : 'All';
    var shown = jobs.filter(function (j) {
      return (practice === 'All' || j.practice === practice) && (type === 'All' || j.type === type);
    });
    list.innerHTML = shown.map(function (j) {
      return '<details class="job" id="' + esc(j.id) + '">' +
        '<summary>' +
          '<span class="job-title">' + esc(j.title) + '</span>' +
          '<span class="job-meta"><span>' + esc(j.practice) + '</span><span>' + esc(j.type) + '</span><span>' + esc(j.location) + '</span><span>Posted ' + esc(fmtDate(j.posted)) + '</span></span>' +
          '<span class="job-summary">' + esc(j.summary) + '</span>' +
        '</summary>' +
        '<div class="job-body">' +
          '<div><h4>What you will do</h4>' + li(j.responsibilities || []) + '</div>' +
          '<div><h4>What we are looking for</h4>' + li(j.requirements || []) + '</div>' +
          '<div class="job-actions"><a class="btn" href="' + applyHref(j) + '">Apply for this role</a><span class="note">Opens your mail client with the subject filled in. Attach your resume.</span></div>' +
        '</div>' +
      '</details>';
    }).join('');
    if (empty) empty.hidden = shown.length > 0;
    if (count) count.textContent = shown.length === jobs.length
      ? jobs.length + (jobs.length === 1 ? ' open role' : ' open roles')
      : shown.length + ' of ' + jobs.length + ' open roles';
    // deep link: careers.html#SEC-001 opens that role
    var h = location.hash.replace('#', '');
    if (h) { var d = document.getElementById(h); if (d && d.tagName === 'DETAILS') { d.open = true; } }
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      practice = c.dataset.practice;
      chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      render();
    });
  });
  if (typeSel) typeSel.addEventListener('change', render);
  render();

  // General application
  var form = document.getElementById('apply-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      if (!name || !email) { (name ? form.email : form.name).focus(); return; }
      var practiceWanted = form.practice.value;
      var link = form.link.value.trim();
      var msg = form.message.value.trim();
      var subject = 'General application: ' + practiceWanted + ', ' + name;
      var body = [
        msg || '(no message)', '',
        'Name: ' + name,
        'Email: ' + email,
        'Practice: ' + practiceWanted,
        'Link: ' + (link || '(none)'),
        '', '(Attach your resume before sending.)'
      ].join('\n');
      window.location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      form.classList.add('sent');
    });
  }
})();
