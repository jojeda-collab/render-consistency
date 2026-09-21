/* Supabase connection for the review notes.

   Fill both in from your Supabase project under Settings -> API, then run
   review-schema.sql once in the SQL editor.

   The anon key is meant to be public. It is not a secret: it only reaches
   the review_notes table, and only in the ways the row-level policies in
   review-schema.sql allow. Never put the service_role key here.

   While these are blank the review notes fall back to saving in each
   reviewer's own browser, so the page still works - it just is not shared. */
window.RC_REVIEW = {
  url: '',      /* e.g. https://abcdefghijkl.supabase.co  (no trailing slash) */
  anonKey: ''   /* the key labelled "anon public" */
};
