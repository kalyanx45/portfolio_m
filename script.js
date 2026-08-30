/* ==========================================================================
   GLASSMORPHISM PORTFOLIO — script.js

   Systems:
   1. Trail-based particle system (semi-transparent frame clear, curved paths,
      mouse reactivity, constellation lines, varying trail lengths)
   2. Film-strip navbar (sprocket holes injected, scroll-condense behavior)
   3. Hero "assemble" animation (name fades in, secondaries scatter then settle)
   4. Navbar scroll behavior + scrollspy
   5. Mobile overlay menu
   6. Scroll reveal (IntersectionObserver)
   7. Smooth scroll
   8. 3D card tilt with spring easing + dynamic shadow
   9. Visibility API — pause on tab blur
   ========================================================================== */

(function () {
  'use strict';

  // Teal accent RGB
  const AC_R = 45, AC_G = 212, AC_B = 191;


  /* ======================================================================
     1. TRAIL-BASED PARTICLE SYSTEM
     Key technique: instead of ctx.clearRect(), draw a semi-transparent
     dark rectangle each frame — older positions fade naturally
     ====================================================================== */
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let isTabVisible = true;

  // Mouse position for cursor reactivity
  let mouse = { x: -9999, y: -9999 };
  document.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  const CFG = {
    count: 110,
    connectDist: 120,
    mouseRadius: 140,
    mouseForce: 0.8,
    trailFade: 0.08,        // alpha of the dark rect drawn each frame (controls trail persistence)
    minSpeed: 0.1,
    maxSpeed: 0.4,
    minRadius: 1,
    maxRadius: 2.8,
    lineOpacity: 0.1,
  };

  function resizeCanvas() {
    // When canvas resizes, we must re-fill with bg color or trails reset messily
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    // Pre-fill with background so trails don't flash
    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function createParticles() {
    particles = [];
    const count = window.innerWidth < 768
      ? Math.floor(CFG.count * 0.55)
      : CFG.count;

    for (let i = 0; i < count; i++) {
      const speed = CFG.minSpeed + Math.random() * (CFG.maxSpeed - CFG.minSpeed);
      const angle = Math.random() * Math.PI * 2;

      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: CFG.minRadius + Math.random() * (CFG.maxRadius - CFG.minRadius),
        opacity: 0.2 + Math.random() * 0.2,

        // Curved path parameters — each particle has unique sine wave
        sinePhase: Math.random() * Math.PI * 2,
        sineFreqX: 0.006 + Math.random() * 0.006,
        sineFreqY: 0.004 + Math.random() * 0.005,
        sineAmpX: 0.25 + Math.random() * 0.35,
        sineAmpY: 0.2  + Math.random() * 0.3,

        // Perlin-like noise offset for organic, non-repeating drift
        noiseOff: Math.random() * 500,
        noiseSpd: 0.003 + Math.random() * 0.004,
      });
    }
  }

  // Cheap smooth-noise (same deterministic hash as before)
  function sNoise(t) {
    const i = Math.floor(t), f = t - i;
    const a = (Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
    const b = (Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453) % 1;
    const u = f * f * (3 - 2 * f);
    return Math.abs(a + (Math.abs(b) - Math.abs(a)) * u);
  }

  function updateParticles() {
    const cw = canvas.width, ch = canvas.height;

    for (const p of particles) {
      p.sinePhase += 0.012;
      p.noiseOff  += p.noiseSpd;

      // Curved drift: combination of sine waves and noise offset
      const curveDx = Math.sin(p.sinePhase * p.sineFreqX * 60) * p.sineAmpX
                    + (sNoise(p.noiseOff) - 0.5) * 0.3;
      const curveDy = Math.cos(p.sinePhase * p.sineFreqY * 60) * p.sineAmpY
                    + (sNoise(p.noiseOff + 100) - 0.5) * 0.25;

      p.x += p.vx + curveDx;
      p.y += p.vy + curveDy;

      // Mouse repulsion — causes visible trail bending near cursor
      const dmx = p.x - mouse.x;
      const dmy = p.y - mouse.y;
      const mDist = Math.sqrt(dmx * dmx + dmy * dmy);
      if (mDist < CFG.mouseRadius && mDist > 0) {
        const force = (1 - mDist / CFG.mouseRadius) * CFG.mouseForce;
        p.x += (dmx / mDist) * force;
        p.y += (dmy / mDist) * force;
      }

      // Wrap edges
      if (p.x < -10) p.x = cw + 10;
      if (p.x > cw + 10) p.x = -10;
      if (p.y < -10) p.y = ch + 10;
      if (p.y > ch + 10) p.y = -10;
    }
  }

  function drawFrame() {
    // ── TRAIL TECHNIQUE: draw semi-transparent bg rect each frame ──
    // Instead of clearRect(), older particle positions fade slowly to bg color
    ctx.fillStyle = `rgba(8, 12, 18, ${CFG.trailFade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const connDistSq = CFG.connectDist * CFG.connectDist;

    // ── Constellation connecting lines (drawn on top of trails) ──
    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dSq = dx * dx + dy * dy;
        if (dSq < connDistSq) {
          const ratio = 1 - dSq / connDistSq;
          const alpha = ratio * ratio * CFG.lineOpacity;
          ctx.strokeStyle = `rgba(${AC_R}, ${AC_G}, ${AC_B}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // ── Draw particle dots ──
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${AC_R}, ${AC_G}, ${AC_B}, ${p.opacity})`;
      ctx.fill();
    }
  }

  function animateParticles() {
    if (isTabVisible) {
      updateParticles();
      drawFrame();
    }
    requestAnimationFrame(animateParticles);
  }

  resizeCanvas();
  createParticles();
  animateParticles();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resizeCanvas(); createParticles(); }, 200);
  });

  document.addEventListener('visibilitychange', () => { isTabVisible = !document.hidden; });


  /* ======================================================================
     2. FILM-STRIP NAVBAR — Inject sprocket holes, condense on scroll
     ====================================================================== */
  function buildSprocketHoles(stripEl) {
    // Fill strip width with sprocket-hole spans
    const count = Math.ceil(window.innerWidth / 24) + 4;
    stripEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const hole = document.createElement('span');
      hole.className = 'sprocket-hole';
      stripEl.appendChild(hole);
    }
  }

  const stripTop = document.getElementById('stripTop');
  const stripBot = document.getElementById('stripBot');
  if (stripTop) buildSprocketHoles(stripTop);
  if (stripBot) buildSprocketHoles(stripBot);

  // Rebuild holes on resize
  window.addEventListener('resize', () => {
    if (stripTop) buildSprocketHoles(stripTop);
    if (stripBot) buildSprocketHoles(stripBot);
  });

  const navbar = document.getElementById('navbar');

  function handleNavScroll() {
    const isScrolled = window.scrollY > 60;
    navbar.classList.toggle('scrolled', isScrolled);
    navbar.classList.toggle('condensed', isScrolled);
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });


  /* ======================================================================
     3. HERO ASSEMBLE — Letter-scatter animation

     Tagline: split into individual letter <span>s, each scattered to a
     random offset/rotation near its final position, then assembled
     left-to-right with 15-20ms per-letter stagger.

     Stat values: same treatment, staggered right after tagline finishes.

     Scroll cue: whole-element spring-in (kept as before).

     Name: CSS animation only (fade+slide, defined in stylesheet).
     ====================================================================== */

  /**
   * Split the text content of `el` into individual letter <span>s.
   * Spaces become non-breaking spaces to preserve layout.
   * Returns array of all letter spans created.
   */
  function splitIntoLetters(el) {
    const text = el.textContent;
    el.textContent = '';
    const spans = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const span = document.createElement('span');
      span.className = 'scatter-letter';
      // Preserve spaces so line-wrapping stays natural
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(span);
      spans.push(span);
    }
    return spans;
  }

  /**
   * Apply a randomised scatter transform to a letter span.
   * Offset is bounded so letters stay close-ish to final spot.
   */
  function scatterLetter(span) {
    const tx  = (Math.random() - 0.5) * 180;  // ±90px horizontal
    const ty  = (Math.random() - 0.5) * 140;  // ±70px vertical
    const rot = (Math.random() - 0.5) * 90;   // ±45°
    const op  = (Math.random() * 0.3);         // 0–0.3 opacity
    span.style.opacity   = op;
    span.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
  }

  /**
   * Animate a letter span into its natural (final) position.
   * Uses a CSS transition triggered by removing the transform.
   */
  function assembleLetter(span) {
    // Transition defined in CSS for .scatter-letter — adding .assembled clears transform
    span.classList.add('assembled');
  }

  function initHeroAssemble() {
    // ── Collect targets ──────────────────────────────────────────────
    const taglineEl    = document.getElementById('heroTagline');
    const statValue0   = document.querySelector('#heroStat0 .hero__stat-value');
    const statValue1   = document.querySelector('#heroStat1 .hero__stat-value');
    const statValue2   = document.querySelector('#heroStat2 .hero__stat-value');
    const scrollCueEl  = document.getElementById('heroScrollCue');

    if (!taglineEl) return;

    // ── Split into letter spans ───────────────────────────────────────
    const taglineLetters = splitIntoLetters(taglineEl);
    const stat0Letters   = statValue0 ? splitIntoLetters(statValue0) : [];
    const stat1Letters   = statValue1 ? splitIntoLetters(statValue1) : [];
    const stat2Letters   = statValue2 ? splitIntoLetters(statValue2) : [];

    // Full ordered sequence: tagline first, then stat groups, then scroll cue
    const allLetterGroups = [
      taglineLetters,
      stat0Letters,
      stat1Letters,
      stat2Letters,
    ];

    // Flatten all letter spans into one ordered array
    const allLetters = allLetterGroups.flat();

    // ── Scatter everything immediately (before first paint) ───────────
    // Make the whole tagline / stat containers invisible until we scatter
    // (avoids a flash of assembled state before JS kicks in)
    taglineEl.style.opacity = '1'; // container stays, only letters are positioned
    allLetters.forEach(scatterLetter);

    // Also scatter the scroll cue as a whole element (no letter split)
    if (scrollCueEl) {
      scrollCueEl.style.transform = 'translateY(60px) scale(0.7)';
      scrollCueEl.style.opacity   = '0';
    }

    // ── Timing ───────────────────────────────────────────────────────
    const NAME_SETTLE_MS  = 650;   // wait for name CSS animation to finish
    const STAGGER_MS      = 18;    // delay between each letter
    const SCROLL_CUE_EXTRA = 200; // extra delay after last letter before scroll cue appears

    // ── Assemble letters one by one ───────────────────────────────────
    allLetters.forEach((span, i) => {
      setTimeout(() => assembleLetter(span), NAME_SETTLE_MS + i * STAGGER_MS);
    });

    // ── Scroll cue springs in after all letters are done ─────────────
    if (scrollCueEl) {
      const scrollCueDelay = NAME_SETTLE_MS + allLetters.length * STAGGER_MS + SCROLL_CUE_EXTRA;
      setTimeout(() => {
        scrollCueEl.style.transition = 'transform 0.65s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.5s ease';
        scrollCueEl.style.transform  = 'none';
        scrollCueEl.style.opacity    = '1';
      }, scrollCueDelay);
    }
  }

  // Run synchronously so scatter is set before first paint
  initHeroAssemble();


  /* ======================================================================
     4. SCROLLSPY
     ====================================================================== */
  const spySections = document.querySelectorAll('section[id]');
  const spyLinks    = document.querySelectorAll('.navbar__link[data-section]');

  function updateScrollspy() {
    const scrollY = window.scrollY + window.innerHeight * 0.35;
    let currentId = '';

    spySections.forEach((sec) => {
      if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
        currentId = sec.id;
      }
    });

    spyLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.section === currentId);
    });
  }

  window.addEventListener('scroll', updateScrollspy, { passive: true });
  updateScrollspy();


  /* ======================================================================
     5. MOBILE OVERLAY MENU
     ====================================================================== */
  const navToggle     = document.getElementById('navToggle');
  const navToggleIcon = document.getElementById('navToggleIcon');
  const mobileOverlay = document.getElementById('mobileOverlay');

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const isOpen = mobileOverlay.classList.toggle('open');
      navToggleIcon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  document.querySelectorAll('[data-mobile-link]').forEach((link) => {
    link.addEventListener('click', () => {
      mobileOverlay.classList.remove('open');
      if (navToggleIcon) navToggleIcon.className = 'fa-solid fa-bars';
      document.body.style.overflow = '';
    });
  });


  /* ======================================================================
     6. SCROLL REVEAL
     ====================================================================== */
  const revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
      },
      { rootMargin: '0px 0px -50px 0px', threshold: 0.1 }
    );
    revealEls.forEach((el) => obs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('visible'));
  }


  /* ======================================================================
     7. SMOOTH SCROLL
     ====================================================================== */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', function (e) {
      const id = this.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });


  /* ======================================================================
     8. 3D CARD TILT — cursor-driven, spring easing on leave
     ====================================================================== */
  function initCardTilt() {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const rx = ((y - r.height / 2) / (r.height / 2)) * -10;
        const ry = ((x - r.width  / 2) / (r.width  / 2)) *  10;
        const sx = -ry * 1.5, sy = -rx * 1.5;

        card.style.transition = 'transform 0.1s ease-out, box-shadow 0.1s ease-out';
        card.style.transform  = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03,1.03,1.03)`;
        card.style.boxShadow  = `${sx}px ${sy}px 30px rgba(${AC_R},${AC_G},${AC_B},0.15), 0 10px 40px rgba(0,0,0,0.3)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        card.style.transform  = 'perspective(700px) rotateX(0) rotateY(0) scale3d(1,1,1)';
        card.style.boxShadow  = '';
      });
    });
  }

  initCardTilt();

})();
