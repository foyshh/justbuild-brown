document.addEventListener('DOMContentLoaded', () => {
  // Ambient background: a calm colour wash on <body> that drifts on
  // its own, slowly, all the time. Actively scrolling adds a small
  // burst of extra speed proportional to scroll speed, which decays
  // away quickly once the visitor stops, settling back to the idle
  // drift rather than snapping still. (A glitter/star overlay used to
  // sit on top of this; removed, it read as messy rather than quiet.
  // A per-section dark/light text classifier lived here too, for a
  // version of the wash that swung all the way to a dark espresso —
  // removed along with that darker wash: text is permanent dark brown
  // now, see css/style.css's :root comment, so there's nothing left to
  // classify and one less script running on every frame.)
  let posY = 0;

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const IDLE_SPEED = 0.017;   // px/ms of constant wash drift
    const SCROLL_GAIN = 0.06;   // extra drift added per px of scroll delta
    const SCROLL_DECAY = 0.85;  // per-frame decay of that scroll-driven burst
    let scrollBurst = 0;
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min(now - lastTime, 100); // clamp so a tab switch doesn't jump
      lastTime = now;
      posY += IDLE_SPEED * dt + scrollBurst;
      scrollBurst *= SCROLL_DECAY;
      document.body.style.backgroundPositionY = posY + 'px';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      scrollBurst += (y - lastScrollY) * SCROLL_GAIN;
      lastScrollY = y;
    }, { passive: true });
  }

  // Nav: tinted background once scrolled, and hidden altogether while the
  // visitor is scrolling down through the page. It reappears the moment
  // they scroll back up, rest the cursor near the top of the window, or
  // are still close to the top of the page, so it never sits fixed over
  // the photography the whole time.
  const nav = document.querySelector('.site-nav');
  const mobileMenuEl = document.querySelector('.mobile-menu');
  let lastY = window.scrollY;
  let mouseNearTop = false;
  const REVEAL_ZONE = 90;   // px from top of viewport that counts as "cursor near top"
  const HIDE_DELTA = 6;     // px of scroll needed before we react, to ignore jitter

  const updateNav = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);

    const menuOpen = mobileMenuEl && mobileMenuEl.classList.contains('open');
    const atTop = y < 60;
    const scrollingUp = y < lastY - HIDE_DELTA;
    const scrollingDown = y > lastY + HIDE_DELTA;

    if (menuOpen || atTop || scrollingUp || mouseNearTop) {
      nav.classList.remove('nav-hidden');
    } else if (scrollingDown) {
      nav.classList.add('nav-hidden');
    }
    lastY = y;
  };
  updateNav();

  let navTicking = false;
  window.addEventListener('scroll', () => {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(() => { updateNav(); navTicking = false; });
  }, { passive: true });
  window.addEventListener('mousemove', (e) => {
    const near = e.clientY < REVEAL_ZONE;
    if (near !== mouseNearTop) { mouseNearTop = near; updateNav(); }
  });

  // Mobile menu
  const burger = document.querySelector('.nav-burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => mobileMenu.classList.add('open'));
    mobileMenu.querySelector('.close').addEventListener('click', () => mobileMenu.classList.remove('open'));
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));
  }

  // Scroll reveal, arm the fade only once JS is confirmed running,
  // so content is never stuck invisible if a script fails to load.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.add('js-armed');
    observer.observe(el);
  });

  // Growing divider, starts short and widens to fill its container
  // once scrolled into view. Fires once, like the other reveals.
  const dividerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        dividerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.divider-grow').forEach(el => dividerObserver.observe(el));

  // Image develop, photos desaturate + zoom out until they scroll
  // into view, then settle into color and true scale. Fires once.
  const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        imgObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.img-block').forEach(el => imgObserver.observe(el));

  // Headline stagger, wraps text into per-line spans that rise in
  // sequentially. Runs before the reveal observer sees the parent so
  // the split markup exists by the time IntersectionObserver fires.
  document.querySelectorAll('.split-line').forEach(el => {
    const lines = el.innerHTML.split(/<br\s*\/?>/i);
    // .sl-line is already display:block, so it creates its own line break,
    // joining with an extra <br> would double the gap between lines.
    el.innerHTML = lines.map((line, i) =>
      '<span class="sl-line" style="transition-delay:' + (i * 0.11) + 's"><span>' + line.trim() + '</span></span>'
    ).join('');
  });
  const splitObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        splitObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.split-line').forEach(el => splitObserver.observe(el));

  // Curated Collection carousel, static until the visitor clicks an
  // arrow, exactly one project per click, looping endlessly in either
  // direction rather than stopping at an end. The track holds the real
  // set three times over (see index.html); starting in the middle copy
  // leaves a full set of genuine items to scroll into on either side,
  // however many times the visitor clicks. The instant a move carries
  // the visible window into a duplicate copy, the track snaps back
  // into the middle copy with its transition switched off for that one
  // frame, invisible since the copies are pixel-identical. The step
  // distance is read live off the rendered item width rather than
  // hardcoded to match the CSS breakpoints, so the two can never
  // quietly drift out of sync.
  document.querySelectorAll('.curated-carousel-wrap').forEach((wrapEl) => {
    const track = wrapEl.querySelector('.curated-track');
    const items = track ? Array.from(track.children) : [];
    const prevBtn = wrapEl.querySelector('.curated-arrow-prev');
    const nextBtn = wrapEl.querySelector('.curated-arrow-next');
    if (!track || !items.length || !prevBtn || !nextBtn) return;

    const setCount = items.length / 3; // the real set, repeated three times over
    let index = setCount; // start in the middle copy

    const step = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0');
      return items[0].getBoundingClientRect().width + gap;
    };

    const applyTransform = () => {
      track.style.transform = 'translateX(-' + (index * step()) + 'px)';
    };

    track.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;
      if (index <= 0 || index >= setCount * 2) {
        index = ((index % setCount) + setCount) % setCount + setCount;
        track.style.transition = 'none';
        applyTransform();
        track.getBoundingClientRect(); // force reflow before restoring the transition
        track.style.transition = '';
      }
    });

    prevBtn.addEventListener('click', () => { index -= 1; applyTransform(); });
    nextBtn.addEventListener('click', () => { index += 1; applyTransform(); });
    window.addEventListener('resize', applyTransform);

    applyTransform();
  });

  // About: "As Featured In" press strip. Real native horizontal scroll
  // (overflow-x:auto in CSS) rather than a fixed CSS keyframe animation,
  // so a visitor can grab it with a trackpad swipe, a touch drag, or the
  // mouse wheel in either direction at any time. A slow, continuous
  // auto-scroll runs via requestAnimationFrame when nobody's touching
  // it; the instant a wheel/touch/pointer interaction is seen, that
  // auto-scroll steps aside, and it only resumes once the visitor has
  // been idle for a moment — always continuing from the exact scroll
  // position they left it at, never snapping back to the start. The
  // card set is tripled in the DOM (see about.html) so there's always a
  // full run of real cards to scroll into on either side; once the
  // visible window drifts into the first or third copy, it's silently
  // shifted by exactly one set's width, invisible since the copies are
  // pixel-identical — the same trick as the Curated Collection carousel
  // above, just via scrollLeft instead of a transform.
  document.querySelectorAll('.press-carousel').forEach((carousel) => {
    const track = carousel.querySelector('.press-track');
    const items = track ? Array.from(track.children) : [];
    if (!track || !items.length) return;

    const setCount = items.length / 3; // the real set, repeated three times over
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPEED_PX_S = 22;      // slow, steady drift
    const RESUME_DELAY_MS = 1200;

    let lastInteraction = 0;
    let lastFrame = null;
    let hovering = false;

    const setWidth = () => items[0].getBoundingClientRect().width * setCount
      + parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') * setCount;

    // The drift is tracked in its own fractional position (pos) rather
    // than by adding to scrollLeft directly: at ~0.4px a frame, many
    // screens round scrollLeft back down to a whole pixel every frame,
    // which silently stopped the strip from moving at all.
    let pos = setWidth(); // start in the middle copy
    carousel.scrollLeft = pos;

    const wrap = () => {
      const w = setWidth();
      if (pos <= 0) pos += w;
      else if (pos >= w * 2) pos -= w;
    };

    const markInteraction = () => { lastInteraction = performance.now(); };
    carousel.addEventListener('touchstart', markInteraction, { passive: true });
    carousel.addEventListener('touchmove', markInteraction, { passive: true });
    carousel.addEventListener('pointerdown', markInteraction);
    // Hovering pauses the drift entirely; moving off resumes it from
    // wherever the strip is.
    carousel.addEventListener('mouseenter', () => { hovering = true; });
    carousel.addEventListener('mouseleave', () => { hovering = false; markInteraction(); });
    // Wheel: only sideways motion (a trackpad swipe left/right, or
    // shift + mouse wheel) moves the strip, and the browser scrolls it
    // natively. Scrolling up or down over it scrolls the page as normal.
    carousel.addEventListener('wheel', (e) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) markInteraction();
    }, { passive: true });
    // The visitor moved it by hand: adopt their position, then keep the
    // loop seamless.
    carousel.addEventListener('scroll', () => {
      if (Math.abs(carousel.scrollLeft - pos) > 2) {
        pos = carousel.scrollLeft;
        const before = pos;
        wrap();
        if (pos !== before) carousel.scrollLeft = pos;
      }
    }, { passive: true });

    if (reduceMotion) return; // manual scrolling above still works; no auto-advance

    const tick = (now) => {
      if (lastFrame === null) lastFrame = now;
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      if (!hovering && now - lastInteraction > RESUME_DELAY_MS) {
        pos += SPEED_PX_S * dt;
        wrap();
        carousel.scrollLeft = pos;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Home curtain: as the first block slides up over the pinned
  // showcase, the showcase sinks back a touch and dims (--cover 0 to 1
  // over one screen of scrolling).
  const homeStack = document.querySelector('.home-stack');
  if (homeStack && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const pinned = homeStack.querySelector('.showcase');
    let coverTicking = false;
    const cover = () => {
      coverTicking = false;
      const p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      pinned.style.setProperty('--cover', p.toFixed(3));
    };
    window.addEventListener('scroll', () => {
      if (!coverTicking) { coverTicking = true; requestAnimationFrame(cover); }
    }, { passive: true });
    cover();
  }

  // Photo backdrop (Portfolio, About, Contact): the pinned photograph
  // darkens as the visitor scrolls through its block, from the light
  // banner state to dark enough for cream text to read over it.
  document.querySelectorAll('.backdrop-scope').forEach((scope) => {
    const MIN = 0.15, MAX = 0.78;
    let ticking = false;
    const update = () => {
      ticking = false;
      const scrolled = -scope.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, scrolled / (window.innerHeight * 0.85)));
      scope.style.setProperty('--shade', (MIN + (MAX - MIN) * p).toFixed(3));
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // Home Final CTA, background auto-cycles through a small set of
  // images via a slow crossfade rather than sitting on one static
  // frame. The dark overlay is a separate, constant layer above it
  // (see index.html/style.css), so it applies identically regardless
  // of which image is currently active.
  document.querySelectorAll('.home-cta-bg').forEach((wrap) => {
    const imgs = wrap.querySelectorAll('.home-cta-bg-img');
    if (imgs.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    setInterval(() => {
      imgs[i].classList.remove('is-active');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('is-active');
    }, 6000);
  });

  // Hero, full-screen showcase (landing + four projects), an endless,
  // slow-blending film that runs entirely on its own timer, completely
  // independent of scrolling. The hero is a normal ~100vh block in the
  // page's flow: scrolling down moves straight past it into Curated
  // Collection, scrolling back up returns to it, exactly like any
  // other section, no wheel/keyboard/touch interception. The only
  // manual control left is the dots, which jump straight to a slide
  // and reset the idle timer so the automatic blend resumes only
  // after a pause rather than fighting a click.
  const heroJack = document.getElementById('heroJack');
  if (heroJack) {
    const slides = Array.from(heroJack.querySelectorAll('.hero-jack-slide'));
    const hint = heroJack.querySelector('.flip-hint');
    const idxCurrent = heroJack.querySelector('.flip-index-current');
    const idxTotal = heroJack.querySelector('.flip-index-total');
    const dotsWrap = heroJack.querySelector('.hero-jack-dots');
    if (idxTotal) idxTotal.textContent = String(slides.length).padStart(2, '0');

    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      if (i === 0) b.classList.add('is-active');
      dotsWrap.appendChild(b);
      return b;
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let animating = false;
    const LOCK_MS = 950;          // matches the crossfade duration in CSS
    const AUTO_ADVANCE_MS = 4500; // how long a slide rests before the next blend begins

    let autoTimer = null;
    const scheduleAuto = () => {
      if (reduceMotion) return;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        goTo((index + 1) % slides.length); // wraps, slide 5 blends back to slide 1
      }, AUTO_ADVANCE_MS);
    };

    // The one place a slide actually changes, used by both the auto
    // timer and the dots. Always wraps (there's no "end" to clamp to
    // anymore, since scrolling is no longer part of this system).
    const goTo = (newIndex) => {
      if (newIndex === index || animating) return;
      animating = true;
      slides.forEach((s, i) => {
        s.classList.remove('is-active', 'is-prev');
        if (i === newIndex) s.classList.add('is-active');
        else if (i === index) s.classList.add('is-prev');
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === newIndex));
      if (idxCurrent) idxCurrent.textContent = newIndex === 0 ? 'ONE' : String(newIndex + 1).padStart(2, '0');
      if (hint) hint.classList.toggle('is-gone', newIndex > 0);
      index = newIndex;
      setTimeout(() => { animating = false; }, LOCK_MS);
      scheduleAuto();
    };

    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

    scheduleAuto(); // the hero starts blending on its own from the moment the page loads
  }

  // Home showcase: one project photograph at a time, dissolving to the
  // next every few seconds. The name list along the bottom tracks it:
  // a thin line fills under the current name while it's showing.
  // Hovering (or focusing) a name shows that project straight away and
  // pauses the cycle; clicking a name or the photograph opens it.
  const showcase = document.getElementById('showcase');
  if (showcase) {
    const slides = Array.from(showcase.querySelectorAll('.showcase-slide'));
    const links = Array.from(showcase.querySelectorAll('.showcase-ticker a'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const HOLD_MS = 5500; // keep in sync with --showcase-hold in css/style.css
    let current = 0;
    let timer = null;
    let paused = false;

    const show = (i) => {
      current = (i + slides.length) % slides.length;
      slides.forEach((s, n) => s.classList.toggle('is-active', n === current));
      links.forEach((a, n) => {
        a.classList.toggle('is-active', n === current);
        if (n === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (reduceMotion || paused) return;
      showcase.classList.remove('is-paused');
      timer = setTimeout(() => { show(current + 1); schedule(); }, HOLD_MS);
    };
    const pause = (i) => {
      paused = true;
      clearTimeout(timer);
      showcase.classList.add('is-paused');
      if (i !== current) show(i);
    };

    links.forEach((a, i) => {
      a.addEventListener('mouseenter', () => pause(i));
      a.addEventListener('focus', () => pause(i));
    });
    const ticker = showcase.querySelector('.showcase-ticker');
    ticker.addEventListener('mouseleave', () => { paused = false; schedule(); });
    ticker.addEventListener('focusout', (e) => {
      if (!ticker.contains(e.relatedTarget)) { paused = false; schedule(); }
    });
    showcase.querySelector('.showcase-slides').addEventListener('click', () => {
      window.location.href = slides[current].dataset.href;
    });
    if (reduceMotion) showcase.classList.add('is-paused');
    schedule();
  }

  // Project detail pages: split-screen gallery, standardized across
  // every project. The thumbnail column holds every photo the project
  // has and simply scrolls (native overflow, see css/style.css) — no
  // duplication or auto-animation needed. Clicking a thumbnail jumps
  // the large stage image to it immediately and resets the auto-rotate
  // timer, and gently scrolls that thumbnail into view within its own
  // column so keyboard/auto-advance navigation never leaves it hidden
  // off-screen; left alone, the stage keeps slowly crossfading through
  // every image and loops endlessly, so manual and automatic browsing
  // share one timeline instead of running as two separate systems.
  document.querySelectorAll('.project-gallery').forEach((gallery) => {
    const thumbs = Array.from(gallery.querySelectorAll('.project-thumb'));
    const stageImgs = Array.from(gallery.querySelectorAll('.project-stage-img'));
    if (!thumbs.length || !stageImgs.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const AUTO_ADVANCE_MS = 5000;
    let index = 0;
    let timer = null;

    const show = (i, opts) => {
      index = (i + stageImgs.length) % stageImgs.length;
      stageImgs.forEach((img, n) => img.classList.toggle('is-active', n === index));
      thumbs.forEach((t, n) => t.classList.toggle('is-active', n === index));
      if (!(opts && opts.skipScroll)) {
        const activeThumb = thumbs[index];
        if (activeThumb) activeThumb.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };

    const schedule = () => {
      if (reduceMotion) return;
      clearTimeout(timer);
      timer = setTimeout(() => { show(index + 1); schedule(); }, AUTO_ADVANCE_MS);
    };

    thumbs.forEach((t, n) => {
      t.addEventListener('click', () => { show(n); schedule(); });
    });

    show(0, { skipScroll: true });
    schedule();
  });

  // Portfolio category filters. No page reload, no navigation: matching
  // projects fade/settle in, non-matching ones fade/settle out and are
  // then pulled from the grid's flow (display:none) once their exit
  // transition finishes, so the remaining projects reflow into a clean
  // grid rather than leaving gaps. The visitor never leaves the page,
  // so their scroll position is naturally undisturbed.
  const filterBar = document.querySelector('.portfolio-filters');
  const filterGrid = document.querySelector('.port-grid-4');
  if (filterBar && filterGrid) {
    const buttons = Array.from(filterBar.querySelectorAll('.filter-btn'));
    const items = Array.from(filterGrid.querySelectorAll('.curated-item'));
    const emptyMsg = document.querySelector('.port-empty-msg');
    const FADE_MS = 400;

    const applyFilter = (filter) => {
      let visibleCount = 0;
      items.forEach((item) => {
        const cats = (item.dataset.categories || '').split(' ');
        const matches = filter === 'all' || cats.includes(filter);
        if (matches) {
          visibleCount++;
          item.style.display = '';
          // Force layout before removing is-filtered-out, so the
          // browser has a committed starting frame (display:none ->
          // block) to transition from rather than skipping straight to
          // the end state, the same effect a requestAnimationFrame
          // hand-off gives but without depending on a paint actually
          // occurring first.
          void item.offsetHeight;
          item.classList.remove('is-filtered-out');
        } else {
          item.classList.add('is-filtered-out');
          setTimeout(() => {
            if (item.classList.contains('is-filtered-out')) item.style.display = 'none';
          }, FADE_MS);
        }
      });
      if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? '' : 'none';
    };

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        buttons.forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        applyFilter(btn.dataset.filter);
      });
    });
  }

  // Contact form (visual feedback only, no backend)
  const form = document.getElementById('enquiryForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.textContent = 'Message Sent';
      btn.style.opacity = '0.7';
      setTimeout(() => { btn.textContent = original; btn.style.opacity = '1'; form.reset(); }, 2400);
    });
  }

  // Log In form: handled by js/portal.js (client portal).

  // Animated stat counters (About page), count up quickly from 0 the
  // moment the panel enters view, then hold at the final value.
  document.querySelectorAll('.stat-num[data-count-to]').forEach((el) => {
    const target = parseInt(el.dataset.countTo, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 900;
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        counterObserver.unobserve(el);
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3); // fast out-of-the-gate, settles at the end
          el.textContent = prefix + Math.round(eased * target) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    counterObserver.observe(el);
  });
});
