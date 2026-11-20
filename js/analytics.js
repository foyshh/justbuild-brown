/* Google Analytics 4 for justbuild.com.sg.
   Counts page views, plus the three ways a visitor can reach Steve:
   WhatsApp taps, phone taps and email taps (enquiry form sends are
   counted in enquiry.js). These become "key events" in Analytics and
   can be imported into Google Ads as conversions. */
(function () {
  var ID = 'G-41FC9EDY7T';
  if (ID.indexOf('XXXX') > -1) return;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  var s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', ID);
  window.jbTrack = function (name, params) { gtag('event', name, params || {}); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var where = a.closest('header, footer, .mobile-menu') ? 'menu' : (document.body.dataset.page || location.pathname);
    if (/wa\.me|whatsapp/i.test(h)) jbTrack('whatsapp_click', { link_url: h, placement: where });
    else if (h.indexOf('tel:') === 0) jbTrack('phone_click', { link_url: h, placement: where });
    else if (h.indexOf('mailto:') === 0) jbTrack('email_click', { link_url: h, placement: where });
  }, true);
})();
