/* Supabase connection for the client portal and the contact form.
   Both values come from the Supabase dashboard: Project Settings ->
   API. The "anon public" key is designed to sit in website code; the
   database's row-level security rules (supabase/setup.sql) are what
   keep each client's data private. Never put the "service_role" key
   here. */
window.JB_SUPABASE = {
  // Usernames whose login uses a real email address instead of the
  // private <username>@users.justbuild.com.sg one clients get.
  logins: { steve: 'steve@justbuild.com.sg' },
  url: 'https://znakmrkamhoiklfhmoem.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuYWttcmthbWhvaWtsZmhtb2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMDUxNzIsImV4cCI6MjEwOTc4MTE3Mn0.unf-LdBBFkRIa6c05Dpw166b14luq8ImgREa0VI98Wc'
};
