/* Contact page: each enquiry is saved to the studio's database, where
   Steve reads it under "View enquiries" in his dashboard. The public
   can only add an enquiry, never read one (supabase/setup.sql). */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('enquiryForm');
    if (!form) return;
    const cfg = window.JB_SUPABASE || {};
    const ready = window.supabase && cfg.url && cfg.url.indexOf('http') === 0 && cfg.anonKey && cfg.anonKey.indexOf('PASTE') !== 0;
    const sb = ready ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } }) : null;
    const status = document.getElementById('enquiryStatus');
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    const say = (msg, ok) => { status.textContent = msg; status.hidden = false; status.classList.toggle('is-ok', !!ok); };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!sb) { say('Sorry, the form isn’t working right now. Please email steve@justbuild.com.sg or WhatsApp +65 9695 0765.'); return; }
      btn.disabled = true; btn.textContent = 'Sending…'; status.hidden = true;
      const { error } = await sb.from('enquiries').insert({
        name: form.fname.value.trim(),
        email: form.femail.value.trim(),
        project_type: form.ftype.value,
        message: form.fmsg.value.trim()
      });
      btn.disabled = false; btn.textContent = label;
      if (error) {
        console.error(error);
        say('Sorry, your message didn’t send. Please try again, or email steve@justbuild.com.sg.');
        return;
      }
      form.reset();
      say('Thank you. Your message has reached Steve, and he’ll be in touch shortly.', true);
    });
  });
})();
