/* ========================================================
   Client portal (demo mode)
   --------------------------------------------------------
   Three pages share this file:
     login.html   sign in, then route by role
     portal.html  a client's own project, read-only
     studio.html  Steve's dashboard: every project, editable

   Demo mode keeps everything in the browser: the seed in
   js/portal-data.js is copied into localStorage on first visit, and
   Steve's edits are written back there. That means edits only show up
   in the same browser they were made in. The data layer below (Store,
   Auth) is the only part that changes when the real backend goes in;
   the rendering code just calls Store.get()/Store.save().
   ======================================================== */

(function () {
  const STORE_KEY = 'jb-portal-v1';
  const SESSION_KEY = 'jb-portal-session';
  const seed = window.JB_PORTAL_SEED;

  /* ---------- Data layer ---------- */
  const Store = {
    get() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && data.version === seed.version) return data;
        }
      } catch (e) { /* storage blocked or corrupt: fall back to seed */ }
      return JSON.parse(JSON.stringify(seed));
    },
    save(data) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; }
      catch (e) { return false; }
    },
    reset() {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    }
  };

  const Auth = {
    signIn(email, password) {
      const data = Store.get();
      const user = data.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || user.password !== password) return null;
      try { sessionStorage.setItem(SESSION_KEY, user.email); } catch (e) {}
      return user;
    },
    current() {
      let email = null;
      try { email = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
      if (!email) return null;
      return Store.get().users.find(u => u.email === email) || null;
    },
    signOut() {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    },
    homeFor(user) { return user.role === 'studio' ? 'studio.html' : 'portal.html'; }
  };

  /* ---------- Helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso, opts) => {
    if (!iso) return 'Not set';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-SG', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const todayISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const daysUntil = (iso) => {
    if (!iso) return null;
    const ms = new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00');
    return Math.round(ms / 86400000);
  };
  // Progress is set by stage alone: a project counts as halfway through
  // whichever stage it is in.
  const overallPercent = (p, stageCount) =>
    Math.round(((p.currentStage + 0.5) / stageCount) * 100);
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };
  const firstName = (name) => (name || '').split(/\s|&/)[0];

  /* Signed-in user's name + Sign out, in the nav's right-hand slot. */
  function mountAccountBar(user) {
    const slot = document.querySelector('[data-portal-account]');
    if (!slot) return;
    slot.innerHTML =
      '<span class="portal-account-name">' + esc(user.name) + '</span>' +
      '<button type="button" class="nav-login portal-signout">Sign out</button>';
    slot.querySelector('.portal-signout').addEventListener('click', () => {
      Auth.signOut();
      location.href = 'login.html';
    });
  }

  /* The stage line: the project's six phases drawn as one continuous
     line, filled up to where the project actually is. Shared by the
     client page and Steve's live preview so both always match. */
  function stageLineHTML(project, stages) {
    // The track runs from the first dot to the last; the fill sits
    // halfway between the current stage's dot and the next one.
    const fill = Math.min(1, (project.currentStage + 0.5) / (stages.length - 1));
    const items = stages.map((s, i) => {
      const state = i < project.currentStage ? 'is-done' : i === project.currentStage ? 'is-current' : 'is-upcoming';
      const status = state === 'is-done' ? 'Complete' : state === 'is-current' ? 'In progress' : 'Upcoming';
      return '<li class="stage ' + state + '"' + (state === 'is-current' ? ' aria-current="step"' : '') + '>' +
        '<span class="stage-dot" aria-hidden="true"></span>' +
        '<span class="stage-name">' + esc(s.name) + '</span>' +
        '<span class="stage-status">' + status + '</span>' +
      '</li>';
    }).join('');
    return '<div class="stage-line" style="--stage-count:' + stages.length + '; --fill:' + (fill * 100).toFixed(1) + '%;">' +
      '<div class="stage-track" aria-hidden="true"><span class="stage-fill"></span></div>' +
      '<ol class="stage-list">' + items + '</ol>' +
    '</div>';
  }

  /* ========================================================
     login.html
     ======================================================== */
  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const error = document.getElementById('loginError');
    const existing = Auth.current();
    const resume = document.getElementById('loginResume');
    if (existing && resume) {
      resume.hidden = false;
      resume.querySelector('[data-resume-name]').textContent = existing.name;
      resume.querySelector('a').href = Auth.homeFor(existing);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.lemail.value;
      const password = form.lpassword.value;
      const user = Auth.signIn(email, password);
      if (!user) {
        error.textContent = 'That email and password don’t match an account. Check both and try again.';
        error.hidden = false;
        form.lpassword.value = '';
        form.lpassword.focus();
        return;
      }
      error.hidden = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = 'Signing in…';
      location.href = Auth.homeFor(user);
    });

    // Demo account chips fill the form in one click.
    document.querySelectorAll('[data-demo-email]').forEach(btn => {
      btn.addEventListener('click', () => {
        form.lemail.value = btn.dataset.demoEmail;
        form.lpassword.value = btn.dataset.demoPassword;
        form.querySelector('button[type="submit"]').focus();
      });
    });
  }

  /* ========================================================
     portal.html (client, read-only)
     ======================================================== */
  function initClient() {
    const root = document.getElementById('clientPortal');
    if (!root) return;
    const user = Auth.current();
    const data = Store.get();
    const params = new URLSearchParams(location.search);

    // Steve can open any project here as a preview (?project=id);
    // a client only ever gets their own, whatever the URL says.
    let project = null;
    if (user && user.role === 'studio' && params.get('project')) {
      project = data.projects.find(p => p.id === params.get('project'));
    } else if (user && user.role === 'client') {
      project = data.projects.find(p => p.id === user.projectId);
    }
    if (!user || !project) { location.replace('login.html'); return; }
    mountAccountBar(user);

    const stages = data.stages;
    const pct = overallPercent(project, stages.length);
    const current = stages[project.currentStage];
    const visitIn = project.nextVisit && daysUntil(project.nextVisit.date);
    const isPreview = user.role === 'studio';
    const clientUser = data.users.find(u => u.projectId === project.id);
    const hello = isPreview
      ? 'Previewing as ' + esc(clientUser ? clientUser.name : 'client')
      : greeting() + ', ' + esc(firstName(user.name));

    const updates = (project.updates || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const updatesHTML = updates.length ? updates.map(u =>
      '<article class="update">' +
        '<time class="update-date" datetime="' + esc(u.date) + '">' + fmtDate(u.date, { day: 'numeric', month: 'short' }) + '</time>' +
        '<div class="update-body">' +
          '<h3 class="update-title">' + esc(u.title) + '</h3>' +
          '<p>' + esc(u.body) + '</p>' +
          (u.image ? '<img class="update-img" loading="lazy" src="' + esc(u.image) + '" alt="' + esc(u.title) + '"/>' : '') +
        '</div>' +
      '</article>'
    ).join('') : '<p class="portal-empty">Updates from site will appear here as work progresses.</p>';

    root.innerHTML =
      (isPreview ? '<div class="portal-preview-bar">This is what ' + esc(clientUser ? clientUser.name : 'the client') + ' sees. <a href="studio.html?project=' + esc(project.id) + '">Back to editing</a></div>' : '') +
      '<header class="portal-hero">' +
        '<div class="portal-hero-text">' +
          '<p class="portal-hello">' + hello + '</p>' +
          '<h1 class="headline portal-title">' + esc(project.name) + '</h1>' +
          '<p class="portal-address">' + esc(project.address) + '</p>' +
          '<p class="portal-pct"><span class="portal-pct-num">' + pct + '%</span> of the way to handover' +
            (project.handoverDate ? ', expected ' + fmtDate(project.handoverDate, { day: 'numeric', month: 'long' }) : '') + '</p>' +
        '</div>' +
        (project.cover ? '<figure class="portal-cover img-block in"><img src="' + esc(project.cover) + '" alt=""/></figure>' : '') +
      '</header>' +

      '<section class="portal-stage" aria-label="Project stages">' +
        stageLineHTML(project, stages) +
        '<p class="portal-now"><strong>Now: ' + esc(current.name) + '.</strong> ' + esc(current.desc) + '</p>' +
      '</section>' +

      '<div class="portal-grid">' +
        '<section class="portal-updates" aria-labelledby="updatesHeading">' +
          '<h2 id="updatesHeading" class="portal-h2">Updates from the studio</h2>' +
          updatesHTML +
        '</section>' +
        '<aside class="portal-side">' +
          (project.nextVisit && project.nextVisit.date ?
            '<div class="side-block side-visit">' +
              '<h2 class="portal-h2">Next site visit</h2>' +
              '<p class="side-big">' + fmtDate(project.nextVisit.date, { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
              (visitIn != null && visitIn >= 0 ? '<p class="side-sub">' + (visitIn === 0 ? 'Today' : visitIn === 1 ? 'Tomorrow' : 'In ' + visitIn + ' days') + '</p>' : '') +
              (project.nextVisit.note ? '<p class="side-note">' + esc(project.nextVisit.note) + '</p>' : '') +
            '</div>' : '') +
          '<div class="side-block">' +
            '<h2 class="portal-h2">Key dates</h2>' +
            '<dl class="side-dates">' +
              '<dt>Work started</dt><dd>' + fmtDate(project.startDate) + '</dd>' +
              '<dt>Expected handover</dt><dd>' + fmtDate(project.handoverDate) + '</dd>' +
            '</dl>' +
          '</div>' +
          '<div class="side-block">' +
            '<h2 class="portal-h2">Questions?</h2>' +
            '<p class="side-note">Steve looks after your project personally.</p>' +
            '<a class="plain side-link" href="https://wa.me/6596950765" target="_blank" rel="noopener">WhatsApp Steve</a>' +
            '<a class="plain side-link" href="mailto:steve@justbuildla.sg">steve@justbuildla.sg</a>' +
          '</div>' +
        '</aside>' +
      '</div>';
    document.title = project.name + ' | Just Build';
  }

  /* ========================================================
     studio.html (Steve only)
     ======================================================== */
  function initStudio() {
    const root = document.getElementById('studioDashboard');
    if (!root) return;
    const user = Auth.current();
    if (!user) { location.replace('login.html'); return; }
    if (user.role !== 'studio') { location.replace(Auth.homeFor(user)); return; }
    mountAccountBar(user);

    let data = Store.get();
    const stages = data.stages;
    let selectedId = new URLSearchParams(location.search).get('project') || (data.projects[0] && data.projects[0].id);

    const listEl = root.querySelector('[data-project-list]');
    const editorEl = root.querySelector('[data-editor]');
    const toast = document.getElementById('studioToast');
    let toastTimer;
    const notify = (msg) => {
      toast.textContent = msg;
      toast.classList.add('is-shown');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2600);
    };
    const persist = (msg) => {
      if (Store.save(data)) notify(msg);
      else notify('Couldn’t save: this browser is blocking storage.');
    };

    const clientOf = (pid) => data.users.find(u => u.role === 'client' && u.projectId === pid);

    function renderList() {
      listEl.innerHTML = data.projects.map(p => {
        const c = clientOf(p.id);
        return '<li><button type="button" class="studio-proj' + (p.id === selectedId ? ' is-selected' : '') + '" data-id="' + esc(p.id) + '">' +
          '<span class="studio-proj-name">' + esc(p.name) + '</span>' +
          '<span class="studio-proj-meta">' + esc(c ? c.name : 'No client account') + '</span>' +
          '<span class="studio-proj-stage">' + esc(stages[p.currentStage].name) + ' · ' + overallPercent(p, stages.length) + '%</span>' +
        '</button></li>';
      }).join('');
      listEl.querySelectorAll('.studio-proj').forEach(b => b.addEventListener('click', () => {
        selectedId = b.dataset.id;
        history.replaceState(null, '', '?project=' + encodeURIComponent(selectedId));
        renderList(); renderEditor();
      }));
    }

    function renderEditor() {
      const p = data.projects.find(x => x.id === selectedId);
      if (!p) {
        editorEl.innerHTML = '<p class="portal-empty">Add your first project to start sending updates to a client.</p>';
        return;
      }
      const c = clientOf(p.id) || { name: '', email: '', password: '' };
      const updates = (p.updates || []).map((u, i) => ({ u, i })).sort((a, b) => b.u.date.localeCompare(a.u.date));

      editorEl.innerHTML =
        '<div class="studio-editor-head">' +
          '<h1 class="headline studio-title">' + esc(p.name) + '</h1>' +
          '<a class="text-link" href="portal.html?project=' + esc(p.id) + '">View as client</a>' +
        '</div>' +

        '<div class="studio-preview">' + stageLineHTML(p, stages) + '</div>' +

        /* Post an update: first, since it's what Steve does most */
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

        /* Stage: one tap on the stage the project is in now */
        '<section class="studio-card">' +
          '<h2 class="portal-h2">Which stage is the project in?</h2>' +
          '<p class="studio-hint">Tap the stage. The client sees it straight away.</p>' +
          '<div class="studio-stages" role="group" aria-label="Current stage">' +
            stages.map((s, i) => '<button type="button" class="studio-stage' + (i === p.currentStage ? ' is-current' : '') + '" data-stage="' + i + '" aria-pressed="' + (i === p.currentStage) + '"><span>' + (i + 1) + '</span>' + esc(s.name) + '</button>').join('') +
          '</div>' +
        '</section>' +

        /* Next site visit */
        '<form class="studio-card" data-form="visit">' +
          '<h2 class="portal-h2">Next site visit</h2>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="fVisit">Date</label><input id="fVisit" name="visitDate" type="date" value="' + esc(p.nextVisit ? p.nextVisit.date : '') + '"/></div>' +
            '<div class="field"><label for="fVisitNote">What the visit is for</label><input id="fVisitNote" name="visitNote" type="text" value="' + esc(p.nextVisit ? p.nextVisit.note : '') + '" placeholder="e.g. Kitchen joinery walk-through"/></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-fill">Save visit</button>' +
        '</form>' +

        /* Existing updates */
        '<section class="studio-card">' +
          '<h2 class="portal-h2">Posted updates</h2>' +
          (updates.length ? '<ul class="studio-updates">' + updates.map(({ u, i }) =>
            '<li><div><time>' + fmtDate(u.date, { day: 'numeric', month: 'short', year: 'numeric' }) + '</time><strong>' + esc(u.title) + '</strong></div>' +
            '<button type="button" class="studio-delete" data-del="' + i + '">Delete</button></li>'
          ).join('') + '</ul>' : '<p class="portal-empty">No updates yet. The client sees whatever you post above.</p>') +
        '</section>' +

        /* Project details + client login */
        '<form class="studio-card" data-form="details">' +
          '<h2 class="portal-h2">Project details</h2>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="fName">Project name</label><input id="fName" name="name" type="text" required value="' + esc(p.name) + '"/></div>' +
            '<div class="field"><label for="fAddr">Address</label><input id="fAddr" name="address" type="text" value="' + esc(p.address) + '"/></div>' +
          '</div>' +
          '<div class="studio-row">' +
            '<div class="field"><label for="fStart">Work started</label><input id="fStart" name="startDate" type="date" value="' + esc(p.startDate) + '"/></div>' +
            '<div class="field"><label for="fHand">Expected handover</label><input id="fHand" name="handoverDate" type="date" value="' + esc(p.handoverDate) + '"/></div>' +
          '</div>' +
          '<h3 class="studio-h3">Client login</h3>' +
          '<div class="studio-row studio-row-3">' +
            '<div class="field"><label for="fCName">Client name</label><input id="fCName" name="clientName" type="text" value="' + esc(c.name) + '"/></div>' +
            '<div class="field"><label for="fCEmail">Client email</label><input id="fCEmail" name="clientEmail" type="email" value="' + esc(c.email) + '"/></div>' +
            '<div class="field"><label for="fCPass">Client password</label><input id="fCPass" name="clientPassword" type="text" autocomplete="off" value="' + esc(c.password) + '"/></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-fill">Save details</button>' +
        '</form>';

      const preview = editorEl.querySelector('.studio-preview');
      editorEl.querySelectorAll('[data-stage]').forEach(btn => btn.addEventListener('click', () => {
        p.currentStage = +btn.dataset.stage;
        editorEl.querySelectorAll('[data-stage]').forEach(b2 => {
          const on = b2 === btn;
          b2.classList.toggle('is-current', on);
          b2.setAttribute('aria-pressed', on);
        });
        preview.innerHTML = stageLineHTML(p, stages);
        persist('Stage updated: ' + stages[p.currentStage].name);
        renderList();
      }));

      const visitForm = editorEl.querySelector('[data-form="visit"]');
      visitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        p.nextVisit = { date: visitForm.visitDate.value, note: visitForm.visitNote.value.trim() };
        persist('Visit saved');
      });

      // Photo: picked from the computer or phone, shrunk to at most
      // 1600px on its long side before saving so it stays light.
      const updateForm = editorEl.querySelector('[data-form="update"]');
      const fileInput = updateForm.querySelector('#fUFile');
      const previewWrap = updateForm.querySelector('.studio-photo-preview');
      const previewImg = previewWrap.querySelector('img');
      const addLabel = updateForm.querySelector('.studio-photo-add');
      let photoData = '';
      const setPhoto = (dataUrl) => {
        photoData = dataUrl;
        previewWrap.hidden = !dataUrl;
        addLabel.textContent = dataUrl ? 'Change photo' : 'Add photo';
        if (dataUrl) previewImg.src = dataUrl;
      };
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const MAX = 1600;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            setPhoto(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = () => notify('That file isn\u2019t a photo we can use. Try a JPG or PNG.');
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });
      updateForm.querySelector('.studio-photo-remove').addEventListener('click', () => setPhoto(''));

      updateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        p.updates = p.updates || [];
        p.updates.push({
          date: updateForm.date.value,
          title: updateForm.title.value.trim(),
          body: updateForm.body.value.trim(),
          image: photoData
        });
        if (!Store.save(data)) {
          p.updates.pop();
          notify('Couldn\u2019t save: the photo is too large for preview mode. Try a smaller one.');
          return;
        }
        notify('Update posted');
        renderEditor();
      });

      editorEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
        const u = p.updates[+b.dataset.del];
        if (!confirm('Delete “' + u.title + '”? The client will no longer see it.')) return;
        p.updates.splice(+b.dataset.del, 1);
        persist('Update deleted');
        renderEditor();
      }));

      const detailsForm = editorEl.querySelector('[data-form="details"]');
      detailsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = detailsForm.clientEmail.value.trim();
        const clash = email && data.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.projectId !== p.id);
        if (clash) { notify('That email is already used by another account.'); detailsForm.clientEmail.focus(); return; }
        p.name = detailsForm.name.value.trim();
        p.address = detailsForm.address.value.trim();
        p.startDate = detailsForm.startDate.value;
        p.handoverDate = detailsForm.handoverDate.value;
        let client = clientOf(p.id);
        if (email) {
          if (!client) { client = { role: 'client', projectId: p.id }; data.users.push(client); }
          client.name = detailsForm.clientName.value.trim() || 'Client';
          client.email = email;
          client.password = detailsForm.clientPassword.value;
        }
        persist('Details saved');
        renderList(); renderEditor();
      });
    }

    root.querySelector('[data-new-project]').addEventListener('click', () => {
      const id = 'project-' + Date.now().toString(36);
      data.projects.unshift({
        id, name: 'New project', address: '', cover: '',
        startDate: todayISO(), handoverDate: '', currentStage: 0,
        nextVisit: { date: '', note: '' }, updates: []
      });
      selectedId = id;
      persist('Project added');
      renderList(); renderEditor();
      editorEl.querySelector('#fName').focus();
    });

    root.querySelector('[data-reset]').addEventListener('click', () => {
      if (!confirm('Reset all demo projects and accounts back to the original sample data?')) return;
      Store.reset();
      data = Store.get();
      selectedId = data.projects[0].id;
      renderList(); renderEditor();
      notify('Demo data reset');
    });

    renderList();
    renderEditor();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initClient();
    initStudio();
  });
})();
