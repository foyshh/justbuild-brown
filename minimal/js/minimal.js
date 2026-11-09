/* Just Build, minimal edition: image reels and the phone menu. */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A reel: a stack of images, one showing at a time. Click the left
  // or right side (or use the arrow keys when focused) to move through
  // it; the home reel also advances on its own every few seconds.
  function reel(root, opts) {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (imgs.length < 2) { if (imgs[0]) imgs[0].classList.add('is-on'); return; }
    const count = opts.count;
    const caption = opts.caption;
    let i = 0, timer = null;
    const show = (k) => {
      i = (k + imgs.length) % imgs.length;
      imgs.forEach((im, n) => im.classList.toggle('is-on', n === i));
      if (count) count.textContent = (i + 1) + ' / ' + imgs.length;
      if (caption) {
        const c = imgs[i].dataset;
        caption.textContent = c.title || '';
        caption.href = c.href || '#';
      }
    };
    const restart = () => {
      if (!opts.auto || reduce) return;
      clearTimeout(timer);
      timer = setTimeout(() => { show(i + 1); restart(); }, opts.auto);
    };
    root.querySelector('.reel-prev').addEventListener('click', (e) => { e.stopPropagation(); show(i - 1); restart(); });
    root.querySelector('.reel-next').addEventListener('click', (e) => { e.stopPropagation(); show(i + 1); restart(); });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { show(i + 1); restart(); }
      if (e.key === 'ArrowLeft') { show(i - 1); restart(); }
    });
    show(0);
    restart();
  }

  document.querySelectorAll('.reel-frame').forEach((el) => reel(el, {
    auto: 5000,
    count: document.querySelector('.reel-count'),
    caption: document.querySelector('.reel-caption')
  }));
  document.querySelectorAll('.project-car').forEach((el) => reel(el, {
    count: el.querySelector('.project-count')
  }));

  // Images fade in once as they come into view.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.fade').forEach((el) => io.observe(el));

  // Phone menu.
  const side = document.querySelector('.side');
  const toggle = document.querySelector('.menu-toggle');
  if (side && toggle) {
    toggle.addEventListener('click', () => {
      const open = side.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  // Contact form: no mail is sent from this preview; say so plainly.
  const form = document.querySelector('.form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.querySelector('.form-note').textContent = 'Thank you. This preview doesn’t send messages yet, so please email or WhatsApp Steve directly.';
    });
  }
})();
