// Scroll-scrubbed film portfolio. Vanilla JS, no build step.
// Film: site/media/film.mp4 (desktop) / film_mobile.mp4 (<=760px).
// Scroll maps to film time 0 -> 44.71s; sections fade in on their
// film-time windows (data-start / data-end in index.html, from the guide).
(function () {
  var C = window.CONFIG || {};
  var DURATION = 44.71; // seconds — CapCut-edited film, 2026-11-10 (was 46)
  var video = document.getElementById('film');
  var isMobile = window.matchMedia('(max-width: 760px)').matches;
  video.src = isMobile ? 'media/film_mobile.mp4' : 'media/film.mp4';
  // FIX 2026-11-11 — frozen film on phone preview: on mobile browsers a
  // muted video often stays at readyState 0 (no metadata/frames decoded)
  // until play() is attempted, so the old code's `readyState >= 2` gate
  // never opened and currentTime was never set — panels scrolled, film
  // stayed on its first frame. Force the load and unlock decoding with a
  // muted play() -> pause as soon as metadata arrives (and again on the
  // first touch, in case the first attempt is blocked). Seeks are also
  // queued now: setting currentTime while a seek is still in flight is
  // dropped on mobile, so a pending seek is applied on 'seeked'.
  video.preload = 'auto';
  video.load();
  var filmReady = false, unlocked = false, pendingSeek = null;
  function unlockVideo() {
    if (unlocked || !filmReady) return;
    unlocked = true;
    try {
      var p = video.play();
      if (p && p.catch) p.then(function () { video.pause(); applySeek(); }).catch(function () { unlocked = false; });
      else video.pause();
    } catch (e) { unlocked = false; }
  }
  function applySeek() {
    if (!filmReady || pendingSeek === null) return;
    if (video.seeking) return;
    var t = pendingSeek; pendingSeek = null;
    try {
      if (video.fastSeek) video.fastSeek(t);
      else video.currentTime = t;
    } catch (e) { pendingSeek = t; }
  }
  video.addEventListener('seeked', applySeek);
  video.addEventListener('loadedmetadata', function () { filmReady = true; unlockVideo(); });
  video.addEventListener('loadeddata', function () { filmReady = true; unlockVideo(); });
  ['pointerdown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlockVideo, { passive: true });
  });

  // --- Loader: shows until the film can play, then fades out ---
  // FIX 2026-11-11 — this used to sit AFTER the config fill. If any
  // config line threw, the 8s fallback never registered and the loader
  // stayed at 0% forever. Register it FIRST, before anything that can
  // throw, so the site can never trap the visitor on the loader.
  var loader = document.getElementById('loader');
  var fill = document.getElementById('loaderFill'), pct = document.getElementById('loaderPct');
  function hideLoader() { if (!loader) return; loader.classList.add('done'); setTimeout(function () { if (loader.parentNode) loader.remove(); }, 600); }
  video.addEventListener('loadeddata', function () { fill.style.width = '100%'; pct.textContent = '100%'; hideLoader(); });
  video.addEventListener('error', function () {
    pct.textContent = 'Film did not load — open the live link, not the zip';
  });
  video.addEventListener('progress', function () {
    try { if (video.buffered.length) { var p = Math.round(video.buffered.end(0) / video.duration * 100); fill.style.width = p + '%'; pct.textContent = p + '%'; } } catch (e) {}
  });
  setTimeout(hideLoader, 8000); // fallback: never trap the visitor on the loader

  // --- Fill text from config.js (edit config.js, not this file) ---
  // Guarded: a missing element in index.html must never kill the rest
  // of the script (or the loader fallback above would be the only thing
  // left standing).
  try {
  function setText(id, v) { var el = document.getElementById(id); if (el && v) el.textContent = v; }
  setText('loaderName', C.name); setText('heroName', C.name);
  setText('heroRole', C.role); setText('heroStatus', C.status);
  setText('aboutTitle', C.aboutTitle); setText('aboutText', C.about);
  setText('experience', C.experience); setText('education', C.education);
  document.title = (C.name || 'Portfolio') + ' — ' + (C.role || '');
  if (C.accent) document.documentElement.style.setProperty('--accent', C.accent);
  if (C.email) { var em = document.getElementById('emailLink'); if (em) { em.textContent = C.email; em.href = 'mailto:' + C.email; } }
  if (C.resume) { var rb = document.getElementById('resumeBtn'); if (rb) rb.href = C.resume; }
  var stats = document.getElementById('stats');
  (C.stats || []).forEach(function (s) {
    var d = document.createElement('div'); d.className = 'stat';
    d.innerHTML = '<strong></strong><span></span>';
    d.querySelector('strong').textContent = s.value; d.querySelector('span').textContent = s.label;
    stats.appendChild(d);
  });
  var proj = document.getElementById('projects');
  (C.projects || []).forEach(function (p) {
    var a = document.createElement('a'); a.className = 'card'; a.href = p.link || '#';
    a.innerHTML = '<h3></h3><p class="tech"></p><p></p>';
    a.querySelector('h3').textContent = p.title;
    a.querySelector('.tech').textContent = p.tech;
    a.querySelectorAll('p')[1].textContent = p.line;
    proj.appendChild(a);
  });
  var chips = document.getElementById('skills');
  (C.skills || []).forEach(function (s) {
    var c = document.createElement('span'); c.className = 'chip'; c.textContent = s; chips.appendChild(c);
  });
  var soc = document.getElementById('socials');
  (C.socials || []).forEach(function (s) {
    var a = document.createElement('a'); a.href = s.href || '#'; a.textContent = s.label; soc.appendChild(a);
  });
  } catch (e) { /* config fill failed — loader and scroll still work */ }

  // --- Scroll -> film time, smoothed (lerp 0.10, smoother than 0.16:
  // the film was holding a pose for a long scroll, then jumping to the
  // next shot. A smaller lerp follows the scroll frame by frame.) ---
  var target = 0, current = 0, ticking = false;
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel[data-start]'));
  var progressFill = document.getElementById('progressFill');
  var hint = document.getElementById('scrollHint');
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    target = p * DURATION;
    progressFill.style.width = (p * 100) + '%';
    if (window.scrollY > 40 && hint) hint.style.opacity = '0';
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ticking = false;
    current += (target - current) * 0.10;
    if (Math.abs(target - current) < 0.02) current = target;
    // Queue the seek instead of setting currentTime directly: on phones
    // a set made while the previous seek is still in flight is dropped,
    // which left the film stuck on its first frame.
    if (filmReady && Math.abs(video.currentTime - current) > 0.03) {
      pendingSeek = current;
      applySeek();
    }
    panels.forEach(function (el) {
      var s = parseFloat(el.dataset.start), e = parseFloat(el.dataset.end);
      var on = current >= s - 0.4 && current <= e + 0.4;
      el.classList.toggle('visible', on);
    });
    if (Math.abs(target - current) > 0.02) { ticking = true; requestAnimationFrame(tick); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // --- Nav: jump to a section's film time, then smooth-scroll there ---
  var anchors = [
    { t: 7.0, y: 0 }, { t: 14.5, y: 0 }, { t: 28.0, y: 0 },
    { t: 37.0, y: 0 }, { t: 41.0, y: 0 }, { t: 44.0, y: 0 }
  ];
  document.querySelectorAll('[data-goto]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      var i = parseInt(a.dataset.goto, 10);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (anchors[i].t / DURATION) * max, behavior: 'smooth' });
    });
  });
})();
