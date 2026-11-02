/* ========================================================
   Client portal: DEMO data
   --------------------------------------------------------
   Sample accounts and projects for showing the portal before a real
   backend (Supabase) is connected. Everything here is fictional.

   Demo mode is NOT secure: these passwords ship to every visitor's
   browser, and Steve's edits are saved only in the browser he made
   them in (localStorage). Never put real client details in this file.
   When the real backend goes in, this file is deleted and accounts and
   projects live in the database instead.
   ======================================================== */

window.JB_PORTAL_SEED = {
  version: 1,

  // The six phases every project moves through, in order. Mirrors (and
  // extends into the build) the four-step journey on the About page.
  stages: [
    { key: 'consult',   name: 'Consultation',        desc: 'Site visit, brief and budget agreed.' },
    { key: 'design',    name: 'Design development',  desc: 'Layouts, materials and 3D visuals signed off.' },
    { key: 'approvals', name: 'Approvals & quotation', desc: 'Permits, management approval and final quotation.' },
    { key: 'works',     name: 'Site works',          desc: 'Hacking, electrical, plumbing, ceilings and flooring.' },
    { key: 'fitout',    name: 'Carpentry & fit-out', desc: 'Joinery installed, finishes, lighting and fixtures.' },
    { key: 'handover',  name: 'Handover',            desc: 'Final clean, defects walk-through and keys back to you.' }
  ],

  users: [
    { email: 'steve@justbuildla.sg', password: 'studio-demo', name: 'Steve', role: 'studio' },
    { email: 'lim.family@demo.sg',   password: 'client-demo', name: 'Daniel & Mei Lim', role: 'client', projectId: 'holland-grove' },
    { email: 'rachel.chen@demo.sg',  password: 'client-demo', name: 'Rachel Chen',      role: 'client', projectId: 'tiong-bahru' }
  ],

  projects: [
    {
      id: 'holland-grove',
      name: 'Holland Grove Residence',
      address: 'Holland Grove Road, Singapore',
      cover: 'images/projects/cairnhill/01.jpg',
      startDate: '2026-06-02',
      handoverDate: '2026-12-18',
      currentStage: 4,          // index into stages: Carpentry & fit-out
      stageProgress: 40,        // % through the current stage
      nextVisit: { date: '2026-11-12', note: 'Site walk-through: kitchen joinery and island stone.' },
      updates: [
        { date: '2026-10-29', title: 'Kitchen carcasses installed', body: 'All lower cabinets are in and levelled. Stone templating for the island is booked for next week.', image: 'images/projects/cairnhill/04.jpg' },
        { date: '2026-10-15', title: 'Feature wall panelling started', body: 'Fluted oak panels are going up in the living room. We adjusted the spacing slightly so the joints line up with the window frames.', image: 'images/projects/cairnhill/06.jpg' },
        { date: '2026-09-30', title: 'Ceilings and cove lighting done', body: 'False ceilings are finished and the cove lighting has been tested in every room.', image: '' },
        { date: '2026-08-21', title: 'Electrical and plumbing complete', body: 'First-fix electrical and plumbing passed inspection. Flooring starts on Monday.', image: '' }
      ]
    },
    {
      id: 'tiong-bahru',
      name: 'Tiong Bahru Apartment',
      address: 'Eng Hoon Street, Singapore',
      cover: 'images/projects/cobalt/02.jpg',
      startDate: '2026-09-08',
      handoverDate: '2027-03-05',
      currentStage: 1,          // Design development
      stageProgress: 70,
      nextVisit: { date: '2026-11-07', note: 'Studio meeting: final material board and lighting plan.' },
      updates: [
        { date: '2026-10-27', title: 'Revised layout sent', body: 'We moved the study to the second bedroom as discussed, which frees up the dining wall for the built-in sideboard.', image: 'images/projects/cobalt/05.jpg' },
        { date: '2026-10-09', title: 'First 3D visuals ready', body: 'Living and dining visuals are ready to review. Let us know which of the two flooring tones you prefer.', image: 'images/projects/cobalt/03.jpg' },
        { date: '2026-09-12', title: 'Brief confirmed', body: 'Thank you for the site visit. Brief, scope and budget are confirmed and design work has started.', image: '' }
      ]
    }
  ]
};
