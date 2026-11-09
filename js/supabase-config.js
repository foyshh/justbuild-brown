/* Supabase connection for the client portal and the contact form.
   Both values come from the Supabase dashboard: Project Settings ->
   API. The "anon public" key is designed to sit in website code; the
   database's row-level security rules (supabase/setup.sql) are what
   keep each client's data private. Never put the "service_role" key
   here. */
window.JB_SUPABASE = {
  url: 'PASTE_PROJECT_URL_HERE',
  anonKey: 'PASTE_ANON_PUBLIC_KEY_HERE'
};
