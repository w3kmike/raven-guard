// Perimeter: the ambient background behind the page.
// A sparse mesh of sentinel nodes drifts slowly. Links form between near nodes.
// Packets travel along links. Now and then a node sweeps its surroundings.
// Fixed behind the content, low contrast, paused when the tab is hidden,
// and a single static frame when the visitor prefers reduced motion.

(function () {
  var canvas = document.getElementById('perimeter');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1;
  var nodes = [], packets = [], sweeps = [];
  var LINK = 150;          // max link distance in CSS px
  var SPEED = 0.07;        // px per ms, drift
  var running = false, last = 0, raf = 0;

  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var count = Math.round(Math.min(90, Math.max(28, (W * H) / 16000)));
    while (nodes.length < count) nodes.push(spawn());
    nodes.length = count;
    LINK = W < 760 ? 120 : 150;
  }

  function spawn() {
    var a = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: Math.cos(a) * SPEED * (0.5 + Math.random()),
      vy: Math.sin(a) * SPEED * (0.5 + Math.random()),
      r: 1 + Math.random() * 1.4,
      sentinel: Math.random() < 0.18
    };
  }

  function step(dt) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
    }
    for (var p = packets.length - 1; p >= 0; p--) {
      packets[p].t += dt / packets[p].dur;
      if (packets[p].t >= 1) packets.splice(p, 1);
    }
    for (var s = sweeps.length - 1; s >= 0; s--) {
      sweeps[s].t += dt / sweeps[s].dur;
      if (sweeps[s].t >= 1) sweeps.splice(s, 1);
    }
    // launch a packet along a random live link roughly every 700 ms
    if (Math.random() < dt / 700) {
      var a = nodes[(Math.random() * nodes.length) | 0];
      var best = null, bd = LINK;
      for (var j = 0; j < nodes.length; j++) {
        var b = nodes[j]; if (b === a) continue;
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < bd && Math.random() < 0.5) { bd = d; best = b; }
      }
      if (best) packets.push({ a: a, b: best, t: 0, dur: 900 + bd * 4 });
    }
    // a sentinel sweeps roughly every 2.5 s
    if (Math.random() < dt / 2500) {
      var sents = nodes.filter(function (n) { return n.sentinel; });
      if (sents.length) sweeps.push({ n: sents[(Math.random() * sents.length) | 0], t: 0, dur: 2600 });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // links
    ctx.lineWidth = 1;
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        var k = 1 - Math.sqrt(d2) / LINK;
        ctx.strokeStyle = 'rgba(184,140,232,' + (0.05 + k * 0.16).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // sweeps: an expanding ring with a faint radar wedge
    for (var s = 0; s < sweeps.length; s++) {
      var sw = sweeps[s], t = sw.t, n = sw.n;
      var R = 20 + t * 140;
      ctx.strokeStyle = 'rgba(184,140,232,' + (0.35 * (1 - t)).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, Math.PI * 2); ctx.stroke();
      var ang = t * Math.PI * 4;
      var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, R);
      g.addColorStop(0, 'rgba(130,71,189,' + (0.22 * (1 - t)).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(130,71,189,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.arc(n.x, n.y, R, ang, ang + 0.7); ctx.closePath(); ctx.fill();
    }
    // nodes
    for (var q = 0; q < nodes.length; q++) {
      var nd = nodes[q];
      ctx.fillStyle = nd.sentinel ? 'rgba(184,140,232,0.75)' : 'rgba(184,140,232,0.38)';
      ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2); ctx.fill();
      if (nd.sentinel) {
        ctx.strokeStyle = 'rgba(184,140,232,0.25)';
        ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r + 3.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // packets: a bright head with a short tail
    for (var p = 0; p < packets.length; p++) {
      var pk = packets[p], e = pk.t;
      var x = pk.a.x + (pk.b.x - pk.a.x) * e, y = pk.a.y + (pk.b.y - pk.a.y) * e;
      var tx = pk.a.x + (pk.b.x - pk.a.x) * Math.max(0, e - 0.12), ty = pk.a.y + (pk.b.y - pk.a.y) * Math.max(0, e - 0.12);
      ctx.strokeStyle = 'rgba(236,232,242,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = 'rgba(236,232,242,0.9)';
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function frame(ts) {
    if (!running) return;
    var dt = Math.min(48, ts - (last || ts)); last = ts;
    step(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  size();
  if (reduce) { step(16); draw(); return; }
  start();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { size(); draw(); }, 120); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
