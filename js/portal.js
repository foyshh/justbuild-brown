/* ========================================================
   Client portal (Supabase)
   --------------------------------------------------------
   Three pages share this file:
     login.html   sign in with a username, then route by role
     portal.html  a client's own project, read-only
     studio.html  Steve's area: Create a client, View projects,
                  View enquiries, and one page per project

   Data lives in Supabase (see supabase/setup.sql). Row-level security
   in the database decides who can read what: Steve sees everything, a
   client only their own project. Usernames map to sign-in emails on
   the private users.justbuild.com.sg name (no email is ever sent to
   them), so clients never need an email address.
   ======================================================== */

(function () {
  const cfg = window.JB_SUPABASE || {};
  const configured = window.supabase && cfg.url && cfg.url.indexOf('http') === 0 && cfg.anonKey && cfg.anonKey.indexOf('PASTE') !== 0;
  const sb = configured ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const BUCKET = 'update-photos';

  const STAGES = [
    { name: 'Demolition',   desc: 'Hacking and clearing the existing space, with common areas protected.' },
    { name: 'Wet works',    desc: 'Masonry, plastering, screeding and waterproofing for the wet areas.' },
    { name: 'Tiling works', desc: 'Floor and wall tiles laid, levelled and grouted.' },
    { name: 'M&E',          desc: 'Electrical, plumbing and air-con piping run and tested.' },
    { name: 'Partition',    desc: 'Partition walls, false ceilings and boxing-up.' },
    { name: 'Painting',     desc: 'Walls and ceilings primed and painted.' },
    { name: 'Carpentry',    desc: 'Built-in cabinets, wardrobes and joinery installed.' },
    { name: 'Defects',      desc: 'Final walk-through with you, touch-ups, then handover.' }
  ];

  /* ---------- Helpers ---------- */
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  const emailFor = (username) => norm(username) + '@users.justbuild.com.sg';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso, opts) => {
    if (!iso) return 'Not set';
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-SG', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const todayISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const daysUntil = (iso) => {
    if (!iso) return null;
    return Math.round((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
  };
  // A project counts as halfway through whichever stage it is in.
  const overallPercent = (p) => Math.round(((p.current_stage + 0.5) / STAGES.length) * 100);
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };
  const firstName = (name) => (name || '').split(/\s|&/)[0];
  const randomPassword = () => {
    const a = 'abcdefghjkmnpqrstuvwxyz23456789';
    const r = crypto.getRandomValues(new Uint32Array(10));
    return Array.from(r, n => a[n % a.length]).join('').replace(/^(.{5})/, '$1-');
  };
  const notConnected = (root) => {
    if (root) root.innerHTML = '<p class="portal-empty">The client portal isn’t connected yet. Please check back soon, or contact Steve directly.</p>';
  };

  async function currentProfile() {
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('id, username, name, role').eq('id', session.user.id).maybeSingle();
    return data || null;
  }
  const homeFor = (profile) => profile.role === 'admin' ? 'studio.html' : 'portal.html';

  /* Signed-in user's name + Sign out, in the nav's right-hand slot. */
  function mountAccountBar(profile) {
    const slot = document.querySelector('[data-portal-account]');
    if (!slot) return;
    slot.innerHTML =
      '<span class="portal-account-name">' + esc(profile.name) + '</span>' +
      '<button type="button" class="nav-login portal-signout">Sign out</button>';
    slot.querySelector('.portal-signout').addEventListener('click', async () => {
      await sb.auth.signOut();
      location.href = 'login.html';
    });
  }

  /* The stage line, shared by the client page and Steve's project page. */
  function stageLineHTML(project) {
    const fill = Math.min(1, (project.current_stage + 0.5) / (STAGES.length - 1));
    const items = STAGES.map((s, i) => {
      const state = i < project.current_stage ? 'is-done' : i === project.current_stage ? 'is-current' : 'is-upcoming';
      const status = state === 'is-done' ? 'Complete' : state === 'is-current' ? 'In progress' : 'Upcoming';
      return '<li class="stage ' + state + '"' + (state === 'is-current' ? ' aria-current="step"' : '') + '>' +
        '<span class="stage-dot" aria-hidden="true"></span>' +
        '<span class="stage-name">' + esc(s.name) + '</span>' +
        '<span class="stage-status">' + status + '</span>' +
      '</li>';
    }).join('');
    return '<div class="stage-line" style="--stage-count:' + STAGES.length + '; --fill:' + (fill * 100).toFixed(1) + '%;">' +
      '<div class="stage-track" aria-hidden="true"><span class="stage-fill"></span></div>' +
      '<ol class="stage-list">' + items + '</ol>' +
    '</div>';
  }

  /* Signed links for private update photos (valid for an hour). */
  async function photoUrls(updates) {
    const paths = updates.map(u => u.image_path).filter(Boolean);
    if (!paths.length) return {};
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    const map = {};
    (data || []).forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  }

  /* ========================================================
     login.html
     ======================================================== */
  async function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const error = document.getElementById('loginError');
    const showError = (msg) => { error.textContent = msg; error.hidden = false; };
    if (!sb) { showError('Sign-in isn’t available yet. Please contact Steve directly.'); return; }

    const existing = await currentProfile();
    const resume = document.getElementById('loginResume');
    if (existing && resume) {
      resume.hidden = false;
      resume.querySelector('[data-resume-name]').textContent = existing.name;
      resume.querySelector('a').href = homeFor(existing);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const label = btn.textContent;
      btn.textContent = 'Signing in…';
      btn.disabled = true;
      error.hidden = true;
      const { error: err } = await sb.auth.signInWithPassword({ email: emailFor(form.lusername.value), password: form.lpassword.value });
      if (err) {
        btn.textContent = label; btn.disabled = false;
        showError('That username and password don’t match an account. Check both and try again.');
        form.lpassword.value = '';
        form.lpassword.focus();
        return;
      }
      const profile = await currentProfile();
      if (!profile) {
        await sb.auth.signOut();
        btn.textContent = label; btn.disabled = false;
        showError('This login isn’t linked to a project yet. Please contact Steve.');
        return;
      }
      location.href = homeFor(profile);
    });
  }

  /* ========================================================
     portal.html (client, read-only)
     ======================================================== */
  async function initClient() {
    const root = document.getElementById('clientPortal');
    if (!root) return;
    if (!sb) { notConnected(root); return; }
    const profile = await currentProfile();
    if (!profile) { location.replace('login.html'); return; }
    mountAccountBar(profile);

    const isAdmin = profile.role === 'admin';
    const wanted = new URLSearchParams(location.search).get('project');
    let q = sb.from('projects').select('*, client:profiles(id, username, name)');
    q = isAdmin && wanted ? q.eq('id', wanted) : q.eq('client_id', profile.id);
    const { data: projects } = await q.limit(1);
    const project = projects && projects[0];
    if (!project) {
      root.innerHTML = isAdmin
        ? '<p class="portal-empty">Project not found. <a href="studio.html#projects">Back to projects</a></p>'
        : '<p class="portal-empty">Your project isn’t set up yet. Steve will let you know when it is.</p>';
      return;
    }
    const { data: updates } = await sb.from('updates').select('*').eq('project_id', project.id).order('date', { ascending: false }).order('created_at', { ascending: false });
    const urls = await photoUrls(updates || []);

    const current = STAGES[project.current_stage];
    const visitIn = daysUntil(project.visit_date);
    const items = (project.visit_items || []).filter(Boolean);
    const clientName = project.client ? project.client.name : 'the client';
    const hello = isAdmin ? 'Previewing as ' + esc(clientName) : greeting() + ', ' + esc(firstName(profile.name));

    const updatesHTML = (updates && updates.length) ? updates.map(u =>
      '<article class="update">' +
        '<time class="update-date" datetime="' + esc(u.date) + '">' + fmtDate(u.date, { day: 'numeric', month: 'short' }) + '</time>' +
        '<div class="update-body">' +
          '<h3 class="update-title">' + esc(u.title) + '</h3>' +
          '<p>' + esc(u.body) + '</p>' +
          (u.image_path && urls[u.image_path] ? '<img class="update-img" loading="lazy" src="' + esc(urls[u.image_path]) + '" alt="' + esc(u.title) + '"/>' : '') +
        '</div>' +
      '</article>'
    ).join('') : '<p class="portal-empty">Updates from site will appear here as work progresses.</p>';

    root.innerHTML =
      (isAdmin ? '<div class="portal-preview-bar">This is what ' + esc(clientName) + ' sees. <a href="studio.html#project/' + esc(project.id) + '">Back to editing</a></div>' : '') +
      '<header class="portal-hero">' +
        '<div class="portal-hero-text">' +
          '<p class="portal-hello">' + hello + '</p>' +
          '<h1 class="headline portal-title">' + esc(project.name) + '</h1>' +
          (project.address ? '<p class="portal-address">' + esc(project.address) + '</p>' : '') +
          '<p class="portal-dates">' + fmtDate(project.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) + ' to ' + fmtDate(project.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) + '</p>' +
          '<p class="portal-pct"><span class="portal-pct-num">' + overallPercent(project) + '%</span> of the way to completion</p>' +
        '</div>' +
      '</header>' +

      '<section class="portal-stage" aria-label="Project stages">' +
        stageLineHTML(project) +
        '<p class="portal-now"><strong>Now: ' + esc(current.name) + '.</strong> ' + esc(current.desc) + '</p>' +
      '</section>' +

      '<div class="portal-grid">' +
        '<section class="portal-updates" aria-labelledby="updatesHeading">' +
          '<h2 id="updatesHeading" class="portal-h2">Updates from the studio</h2>' +
          updatesHTML +
        '</section>' +
        '<aside class="portal-side">' +
          (project.visit_date ?
            '<div class="side-block side-visit">' +
              '<h2 class="portal-h2">Next site visit</h2>' +
              '<p class="side-big">' + fmtDate(project.visit_date, { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
              (visitIn != null && visitIn >= 0 ? '<p class="side-sub">' + (visitIn === 0 ? 'Today' : visitIn === 1 ? 'Tomorrow' : 'In ' + visitIn + ' days') + '</p>' : '') +
              (items.length ? '<ul class="side-list">' + items.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
            '</div>' : '') +
          '<div class="side-block">' +
            '<h2 class="portal-h2">Key dates</h2>' +
            '<dl class="side-dates">' +
              '<dt>Start date</dt><dd>' + fmtDate(project.start_date) + '</dd>' +
              '<dt>End date</dt><dd>' + fmtDate(project.end_date) + '</dd>' +
            '</dl>' +
          '</div>' +
          '<div class="side-block">' +
            '<h2 class="portal-h2">Questions?</h2>' +
            '<p class="side-note">Steve looks after your project personally.</p>' +
            '<a class="plain side-link" href="https://wa.me/6596950765" target="_blank" rel="noopener">WhatsApp Steve</a>' +
            '<a class="plain side-link" href="mailto:steve@justbuild.com.sg">steve@justbuild.com.sg</a>' +
          '</div>' +
        '</aside>' +
      '</div>';
    document.title = project.name + ' | Just Build';
  }

  /* ========================================================
     studio.html (Steve only)
       (none)          home: Create a client / View projects / View enquiries
       #new            create a client login and their project
       #projects       every project
       #project/<id>   one project
       #enquiries      contact-form enquiries
     ======================================================== */
  async function initStudio() {
    const root = document.getElementById('studioDashboard');
    if (!root) return;
    if (!sb) { notConnected(root); return; }
    const me = await currentProfile();
    if (!me) { location.replace('login.html'); return; }
    if (me.role !== 'admin') { location.replace(homeFor(me)); return; }
    mountAccountBar(me);

    const toast = document.getElementById('studioToast');
    let toastTimer;
    const notify = (msg) => {
      toast.textContent = msg;
      toast.classList.add('is-shown');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 3200);
    };
    const failed = (err, what) => { console.error(err); notify('Couldn’t ' + what + '. Check the connection and try again.'); };
    const back = (href, label) => '<a class="studio-back" href="' + href + '">‹ ' + label + '</a>';
    const loading = () => { root.innerHTML = '<p class="portal-empty">Loading…</p>'; };
    const go = (hash) => { location.hash = hash; };

    /* ---------- Home ---------- */
    async function viewHome() {
      loading();
      const [{ count: projectCount }, { count: newCount }] = await Promise.all([
        sb.from('projects').select('id', { count: 'exact', head: true }),
        sb.from('enquiries').select('id', { count: 'exact', head: true }).eq('is_read', false)
      ]);
      root.innerHTML =
        '<p class="portal-hello">' + greeting() + ', ' + esc(firstName(me.name)) + '</p>' +
        '<h1 class="headline studio-title">What would you like to do?</h1>' +
        '<div class="studio-choices">' +
          '<a class="studio-choice" href="#new"><span class="studio-choice-title">Create a client</span><span class="studio-choice-sub">Give a new client a username and password, and set up their project.</span></a>' +
          '<a class="studio-choice" href="#projects"><span class="studio-choice-title">View projects</span><span class="studio-choice-sub">' + (projectCount || 0) + ' project' + (projectCount === 1 ? '' : 's') + '. Post updates, photos and site visits.</span></a>' +
          '<a class="studio-choice" href="#enquiries"><span class="studio-choice-title">View enquiries' + (newCount ? ' <span class="studio-badge">' + newCount + ' new</span>' : '') + '</span><span class="studio-choice-sub">Messages sent from the Contact page.</span></a>' +
        '</div>';
    }

    /* ---------- Create a client ---------- */
    function viewNew() {
      root.innerHTML = back('#', 'Home') +
        '<h1 class="headline studio-title">Create a client</h1>' +
        '<form class="studio-card" data-form="new">' +
          '<h2 class="portal-h2">The client</h2>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="nName">Client name</label><input id="nName" name="name" type="text" required placeholder="e.g. Daniel & Mei Lim"/></div>' +
            '<div class="field"><label for="nUser">Username</label><input id="nUser" name="username" type="text" required autocomplete="off" autocapitalize="none" spellcheck="false" pattern="[A-Za-z0-9._-]{3,30}" title="3 to 30 letters, numbers, dots, dashes or underscores" placeholder="e.g. limfamily"/></div>' +
          '</div>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="nPass">Password</label><input id="nPass" name="password" type="text" required minlength="8" autocomplete="off" value="' + randomPassword() + '"/></div>' +
            '<div class="field studio-field-note"><p class="studio-hint">A password is filled in for you. You can change it (at least 8 characters).</p></div>' +
          '</div>' +
          '<h2 class="portal-h2">Their project</h2>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="nProj">Project name</label><input id="nProj" name="project" type="text" required placeholder="e.g. Holland Grove Residence"/></div>' +
            '<div class="field"><label for="nAddr">Address</label><input id="nAddr" name="address" type="text" placeholder="e.g. Holland Grove Road"/></div>' +
          '</div>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="nStart">Start date</label><input id="nStart" name="start" type="date" value="' + todayISO() + '"/></div>' +
            '<div class="field"><label for="nEnd">End date</label><input id="nEnd" name="end" type="date"/></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-fill">Create client</button>' +
        '</form>';
      const f = root.querySelector('[data-form="new"]');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Creating…';
        const username = norm(f.username.value);
        const password = f.password.value;
        const done = (msg) => { btn.disabled = false; btn.textContent = 'Create client'; if (msg) notify(msg); };

        const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
        if (taken) { done('That username is taken. Try another.'); f.username.focus(); return; }

        // A second, throwaway connection creates the client's login, so
        // Steve stays signed in as himself.
        const tmp = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'jb-create-client' } });
        const { data: su, error: suErr } = await tmp.auth.signUp({ email: emailFor(username), password });
        if (suErr || !su.user) { console.error(suErr); done(suErr && /registered/i.test(suErr.message) ? 'That username is taken. Try another.' : 'Couldn’t create the login: ' + (suErr ? suErr.message : 'unknown error')); return; }

        const { error: pErr } = await sb.from('profiles').insert({ id: su.user.id, username, name: f.name.value.trim(), role: 'client' });
        if (pErr) { failed(pErr, 'save the client'); done(); return; }
        const { data: proj, error: jErr } = await sb.from('projects').insert({
          name: f.project.value.trim(), address: f.address.value.trim(),
          start_date: f.start.value || null, end_date: f.end.value || null, client_id: su.user.id
        }).select('id').single();
        if (jErr) { failed(jErr, 'create the project'); done(); return; }

        root.innerHTML = back('#projects', 'All projects') +
          '<h1 class="headline studio-title">Client created</h1>' +
          '<div class="studio-card studio-created">' +
            '<p class="studio-hint">Give these to ' + esc(f.name.value.trim()) + '. They sign in on the Log In page.</p>' +
            '<dl class="studio-creds"><dt>Username</dt><dd>' + esc(username) + '</dd><dt>Password</dt><dd>' + esc(password) + '</dd></dl>' +
            '<p class="studio-hint">Write the password down now: for privacy it isn’t shown again. You can set a new one any time from the project page.</p>' +
            '<a class="btn btn-fill" href="#project/' + esc(proj.id) + '">Go to the project</a>' +
          '</div>';
      });
    }

    /* ---------- All projects ---------- */
    async function viewProjects() {
      loading();
      const { data, error } = await sb.from('projects').select('id, name, start_date, end_date, current_stage, client:profiles(name, username)').order('created_at', { ascending: false });
      if (error) { failed(error, 'load projects'); return; }
      root.innerHTML = back('#', 'Home') +
        '<div class="studio-head-row"><h1 class="headline studio-title">Projects</h1><a class="btn" href="#new">Create a client</a></div>' +
        (data.length ? '<ul class="studio-list">' + data.map(p =>
          '<li><a class="studio-proj" href="#project/' + esc(p.id) + '">' +
            '<span class="studio-proj-name">' + esc(p.name) + '</span>' +
            '<span class="studio-proj-meta">' + esc(p.client ? p.client.name + ' (' + p.client.username + ')' : 'No client login') + '</span>' +
            '<span class="studio-proj-meta">' + esc(STAGES[p.current_stage].name) + ' · ' + fmtDate(p.start_date, { day: 'numeric', month: 'short' }) + ' to ' + fmtDate(p.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>' +
          '</a></li>'
        ).join('') + '</ul>' : '<p class="portal-empty">No projects yet. Create a client to start one.</p>');
    }

    /* ---------- Enquiries ---------- */
    async function viewEnquiries() {
      loading();
      const { data, error } = await sb.from('enquiries').select('*').order('created_at', { ascending: false });
      if (error) { failed(error, 'load enquiries'); return; }
      root.innerHTML = back('#', 'Home') +
        '<h1 class="headline studio-title">Enquiries</h1>' +
        (data.length ? '<ul class="studio-enquiries">' + data.map(q =>
          '<li class="studio-card studio-enquiry' + (q.is_read ? '' : ' is-new') + '">' +
            '<div class="studio-enquiry-head">' +
              '<div><strong>' + esc(q.name) + '</strong>' + (q.is_read ? '' : ' <span class="studio-badge">New</span>') +
                '<span class="studio-enquiry-meta">' + new Date(q.created_at).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + (q.project_type ? ' · ' + esc(q.project_type) : '') + '</span></div>' +
              '<a class="text-link" href="mailto:' + esc(q.email) + '?subject=' + encodeURIComponent('Your enquiry to Just Build') + '">Reply to ' + esc(q.email) + '</a>' +
            '</div>' +
            (q.message ? '<p class="studio-enquiry-msg">' + esc(q.message) + '</p>' : '') +
            '<div class="studio-enquiry-actions">' +
              '<button type="button" class="studio-link-btn" data-read="' + esc(q.id) + '" data-val="' + (!q.is_read) + '">' + (q.is_read ? 'Mark as new' : 'Mark as read') + '</button>' +
              '<button type="button" class="studio-delete" data-del-enq="' + esc(q.id) + '">Delete</button>' +
            '</div>' +
          '</li>'
        ).join('') + '</ul>' : '<p class="portal-empty">No enquiries yet. Messages from the Contact page will appear here.</p>');
      root.querySelectorAll('[data-read]').forEach(b => b.addEventListener('click', async () => {
        const { error: err } = await sb.from('enquiries').update({ is_read: b.dataset.val === 'true' }).eq('id', b.dataset.read);
        if (err) failed(err, 'update the enquiry'); else viewEnquiries();
      }));
      root.querySelectorAll('[data-del-enq]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Delete this enquiry? This can’t be undone.')) return;
        const { error: err } = await sb.from('enquiries').delete().eq('id', b.dataset.delEnq);
        if (err) failed(err, 'delete the enquiry'); else { notify('Enquiry deleted'); viewEnquiries(); }
      }));
    }

    /* ---------- One project ---------- */
    async function viewProject(id) {
      loading();
      const { data: p, error } = await sb.from('projects').select('*, client:profiles(id, username, name)').eq('id', id).maybeSingle();
      if (error || !p) { go('projects'); return; }
      const { data: updates } = await sb.from('updates').select('*').eq('project_id', id).order('date', { ascending: false }).order('created_at', { ascending: false });
      const c = p.client || { name: '', username: '' };
      const items = (p.visit_items || []).slice();
      while (items.length < 3) items.push('');
      const visitInput = (val, n) => '<input type="text" name="item" value="' + esc(val) + '" placeholder="' + (n === 0 ? 'e.g. Kitchen joinery walk-through' : 'Another point') + '" aria-label="Visit point ' + (n + 1) + '"/>';
      const save = async (patch, msg) => {
        const { error: err } = await sb.from('projects').update(patch).eq('id', id);
        if (err) { failed(err, 'save'); return false; }
        Object.assign(p, patch); notify(msg); return true;
      };

      root.innerHTML = back('#projects', 'All projects') +
        '<div class="studio-editor-head">' +
          '<div>' +
            '<h1 class="headline studio-title">' + esc(p.name) + '</h1>' +
            '<div class="studio-dates">' +
              '<label>Start date <input type="date" data-date="start_date" value="' + esc(p.start_date || '') + '"/></label>' +
              '<label>End date <input type="date" data-date="end_date" value="' + esc(p.end_date || '') + '"/></label>' +
            '</div>' +
          '</div>' +
          '<a class="text-link" href="portal.html?project=' + esc(p.id) + '">View as client</a>' +
        '</div>' +

        '<div class="studio-preview">' + stageLineHTML(p) + '</div>' +

        '<form class="studio-card" data-form="update">' +
          '<h2 class="portal-h2">Post an update</h2>' +
          '<div class="field"><label for="fUTitle">Headline</label><input id="fUTitle" name="title" type="text" required placeholder="e.g. Kitchen stone installed"/></div>' +
          '<div class="field"><label for="fUBody">What happened</label><textarea id="fUBody" name="body" rows="3" required placeholder="A few plain sentences for the client."></textarea></div>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="fUDate">Date</label><input id="fUDate" name="date" type="date" value="' + todayISO() + '" required/></div>' +
            '<div class="field"><span class="studio-label">Photo (optional)</span>' +
              '<div class="studio-photo">' +
                '<label class="btn studio-photo-add" for="fUFile">Add photo</label>' +
                '<input id="fUFile" class="visually-hidden" type="file" accept="image/*"/>' +
                '<span class="studio-photo-preview" hidden><img alt="Selected photo"/><button type="button" class="studio-delete studio-photo-remove">Remove</button></span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button type="submit" class="btn btn-fill">Post update</button>' +
        '</form>' +

        '<section class="studio-card">' +
          '<h2 class="portal-h2">Which stage is the project in?</h2>' +
          '<p class="studio-hint">Tap the stage. The client sees it straight away.</p>' +
          '<div class="studio-stages" role="group" aria-label="Current stage">' +
            STAGES.map((s, i) => '<button type="button" class="studio-stage' + (i === p.current_stage ? ' is-current' : '') + '" data-stage="' + i + '" aria-pressed="' + (i === p.current_stage) + '"><span>' + (i + 1) + '</span>' + esc(s.name) + '</button>').join('') +
          '</div>' +
        '</section>' +

        '<form class="studio-card" data-form="visit">' +
          '<h2 class="portal-h2">Next site visit</h2>' +
          '<div class="field studio-visit-date"><label for="fVisit">Date</label><input id="fVisit" name="visitDate" type="date" value="' + esc(p.visit_date || '') + '"/></div>' +
          '<div class="field"><span class="studio-label">What the visit is for (the client sees these as a list)</span>' +
            '<div class="studio-visit-items">' + items.map(visitInput).join('') + '</div>' +
            '<button type="button" class="studio-add-more">+ Add more</button>' +
          '</div>' +
          '<button type="submit" class="btn btn-fill">Save visit</button>' +
        '</form>' +

        '<section class="studio-card">' +
          '<h2 class="portal-h2">Posted updates</h2>' +
          ((updates && updates.length) ? '<ul class="studio-updates">' + updates.map(u =>
            '<li><div><time>' + fmtDate(u.date, { day: 'numeric', month: 'short', year: 'numeric' }) + '</time><strong>' + esc(u.title) + '</strong>' + (u.image_path ? ' <span class="studio-proj-meta">(with photo)</span>' : '') + '</div>' +
            '<button type="button" class="studio-delete" data-del="' + esc(u.id) + '" data-path="' + esc(u.image_path || '') + '">Delete</button></li>'
          ).join('') + '</ul>' : '<p class="portal-empty">No updates yet. The client sees whatever you post above.</p>') +
        '</section>' +

        '<form class="studio-card" data-form="details">' +
          '<h2 class="portal-h2">Project details</h2>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="fName">Project name</label><input id="fName" name="name" type="text" required value="' + esc(p.name) + '"/></div>' +
            '<div class="field"><label for="fAddr">Address</label><input id="fAddr" name="address" type="text" value="' + esc(p.address) + '"/></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-fill">Save details</button>' +
        '</form>' +

        (p.client ?
          '<form class="studio-card" data-form="password">' +
            '<h2 class="portal-h2">Client login</h2>' +
            '<p class="studio-hint">' + esc(c.name) + ' signs in with the username <strong>' + esc(c.username) + '</strong>. To give them a new password, type it below.</p>' +
            '<div class="studio-row"><div class="field"><label for="fNewPass">New password</label><input id="fNewPass" name="pw" type="text" minlength="8" required autocomplete="off" value="' + randomPassword() + '"/></div></div>' +
            '<button type="submit" class="btn">Set new password</button>' +
          '</form>' : '');

      root.querySelectorAll('[data-date]').forEach(inp => inp.addEventListener('change', () =>
        save({ [inp.dataset.date]: inp.value || null }, inp.dataset.date === 'start_date' ? 'Start date saved' : 'End date saved')));

      const preview = root.querySelector('.studio-preview');
      root.querySelectorAll('[data-stage]').forEach(btn => btn.addEventListener('click', async () => {
        const n = +btn.dataset.stage;
        if (!(await save({ current_stage: n }, 'Stage updated: ' + STAGES[n].name))) return;
        root.querySelectorAll('[data-stage]').forEach(b2 => {
          const on = b2 === btn;
          b2.classList.toggle('is-current', on);
          b2.setAttribute('aria-pressed', on);
        });
        preview.innerHTML = stageLineHTML(p);
      }));

      const visitForm = root.querySelector('[data-form="visit"]');
      const itemsWrap = visitForm.querySelector('.studio-visit-items');
      visitForm.querySelector('.studio-add-more').addEventListener('click', () => {
        itemsWrap.insertAdjacentHTML('beforeend', visitInput('', itemsWrap.querySelectorAll('input').length));
        itemsWrap.lastElementChild.focus();
      });
      visitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const list = Array.from(itemsWrap.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean);
        save({ visit_date: visitForm.visitDate.value || null, visit_items: list }, 'Visit saved');
      });

      // Photo: shrunk to at most 1600px on its long side before upload.
      const updateForm = root.querySelector('[data-form="update"]');
      const fileInput = updateForm.querySelector('#fUFile');
      const previewWrap = updateForm.querySelector('.studio-photo-preview');
      const previewImg = previewWrap.querySelector('img');
      const addLabel = updateForm.querySelector('.studio-photo-add');
      let photoBlob = null;
      const setPhoto = (blob) => {
        photoBlob = blob;
        previewWrap.hidden = !blob;
        addLabel.textContent = blob ? 'Change photo' : 'Add photo';
        if (blob) previewImg.src = URL.createObjectURL(blob);
      };
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b => setPhoto(b), 'image/jpeg', 0.82);
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => notify('That file isn’t a photo we can use. Try a JPG or PNG.');
        img.src = URL.createObjectURL(file);
        fileInput.value = '';
      });
      updateForm.querySelector('.studio-photo-remove').addEventListener('click', () => setPhoto(null));
      updateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = updateForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Posting…';
        let image_path = null;
        if (photoBlob) {
          image_path = id + '/' + Date.now() + '.jpg';
          const { error: upErr } = await sb.storage.from(BUCKET).upload(image_path, photoBlob, { contentType: 'image/jpeg' });
          if (upErr) { failed(upErr, 'upload the photo'); btn.disabled = false; btn.textContent = 'Post update'; return; }
        }
        const { error: insErr } = await sb.from('updates').insert({
          project_id: id, date: updateForm.date.value, title: updateForm.title.value.trim(), body: updateForm.body.value.trim(), image_path
        });
        if (insErr) { failed(insErr, 'post the update'); btn.disabled = false; btn.textContent = 'Post update'; return; }
        notify('Update posted');
        viewProject(id);
      });

      root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Delete this update? The client will no longer see it.')) return;
        const { error: err } = await sb.from('updates').delete().eq('id', b.dataset.del);
        if (err) { failed(err, 'delete the update'); return; }
        if (b.dataset.path) await sb.storage.from(BUCKET).remove([b.dataset.path]);
        notify('Update deleted');
        viewProject(id);
      }));

      const detailsForm = root.querySelector('[data-form="details"]');
      detailsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (await save({ name: detailsForm.name.value.trim(), address: detailsForm.address.value.trim() }, 'Details saved')) {
          root.querySelector('.studio-title').textContent = p.name;
        }
      });

      const pwForm = root.querySelector('[data-form="password"]');
      if (pwForm) pwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error: err } = await sb.rpc('admin_set_password', { target: c.id, new_password: pwForm.pw.value });
        if (err) { failed(err, 'set the password'); return; }
        notify('New password set. Give it to ' + c.name + ': ' + pwForm.pw.value);
      });
    }

    /* ---------- Router ---------- */
    function route() {
      const h = location.hash.replace(/^#/, '');
      window.scrollTo(0, 0);
      if (h === 'new') viewNew();
      else if (h === 'projects') viewProjects();
      else if (h === 'enquiries') viewEnquiries();
      else if (h.indexOf('project/') === 0) viewProject(decodeURIComponent(h.slice(8)));
      else viewHome();
    }
    window.addEventListener('hashchange', route);
    route();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initClient();
    initStudio();
  });
})();
