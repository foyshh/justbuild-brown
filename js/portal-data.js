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

   Accounts sign in with a username Steve assigns (no email needed).
   ======================================================== */

window.JB_PORTAL_SEED = {
  version: 2,

  // The eight stages of the build, in order.
  stages: [
    { key: 'demolition', name: 'Demolition',    desc: 'Hacking and clearing the existing space, with common areas protected.' },
    { key: 'wet',        name: 'Wet works',     desc: 'Masonry, plastering, screeding and waterproofing for the wet areas.' },
    { key: 'tiling',     name: 'Tiling works',  desc: 'Floor and wall tiles laid, levelled and grouted.' },
    { key: 'me',         name: 'M&E',           desc: 'Electrical, plumbing and air-con piping run and tested.' },
    { key: 'partition',  name: 'Partition',     desc: 'Partition walls, false ceilings and boxing-up.' },
    { key: 'painting',   name: 'Painting',      desc: 'Walls and ceilings primed and painted.' },
    { key: 'carpentry',  name: 'Carpentry',     desc: 'Built-in cabinets, wardrobes and joinery installed.' },
    { key: 'defects',    name: 'Defects',       desc: 'Final walk-through with you, touch-ups, then handover.' }
  ],

  users: [
    { username: 'steve',      password: 'studio-demo', name: 'Steve', role: 'studio' },
    { username: 'limfamily',  password: 'client-demo', name: 'Daniel & Mei Lim', role: 'client', projectId: 'holland-grove' },
    { username: 'rachelchen', password: 'client-demo', name: 'Rachel Chen',      role: 'client', projectId: 'tiong-bahru' }
  ],

  projects: [
    {
      id: 'holland-grove',
      name: 'Holland Grove Residence',
      address: 'Holland Grove Road, Singapore',
      cover: 'images/projects/cairnhill/01.jpg',
      startDate: '2026-06-02',
      endDate: '2026-12-18',
      currentStage: 6,          // Carpentry
      nextVisit: {
        date: '2026-11-12',
        items: ['Kitchen joinery walk-through', 'Confirm island stone slab', 'Check wardrobe internal fittings']
      },
      updates: [
        { date: '2026-10-29', title: 'Kitchen carcasses installed', body: 'All lower cabinets are in and levelled. Stone templating for the island is booked for next week.', image: 'images/projects/cairnhill/04.jpg' },
        { date: '2026-10-15', title: 'Feature wall panelling started', body: 'Fluted oak panels are going up in the living room. We adjusted the spacing slightly so the joints line up with the window frames.', image: 'images/projects/cairnhill/06.jpg' },
        { date: '2026-09-30', title: 'Painting complete', body: 'All walls and ceilings are painted. Carpentry starts on Monday.', image: '' },
        { date: '2026-08-21', title: 'M&E complete', body: 'Electrical and plumbing passed inspection. Partition and ceiling works start next.', image: '' }
      ]
    },
    {
      id: 'tiong-bahru',
      name: 'Tiong Bahru Apartment',
      address: 'Eng Hoon Street, Singapore',
      cover: 'images/projects/cobalt/02.jpg',
      startDate: '2026-10-05',
      endDate: '2027-03-05',
      currentStage: 1,          // Wet works
      nextVisit: {
        date: '2026-11-07',
        items: ['Check bathroom waterproofing', 'Mark out kitchen layout on site']
      },
      updates: [
        { date: '2026-10-27', title: 'Waterproofing underway', body: 'Both bathrooms have their first waterproofing coat. The flood test is booked for Friday.', image: 'images/projects/cobalt/05.jpg' },
        { date: '2026-10-09', title: 'Demolition complete', body: 'Old flooring and the kitchen wall are cleared. Wet works start this week.', image: 'images/projects/cobalt/03.jpg' }
      ]
    }
  ]
};
