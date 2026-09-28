// Supabase Client Initialization
const supabaseUrl = 'https://gqxacwybumcroargnwkq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeGFjd3lidW1jcm9hcmdud2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTc1MzksImV4cCI6MjEwNjE5MzUzOX0.Pkkn23-mVDyQLppov0Ad9L1ZqoxoSiG9E-DKZhOFIKI';

// Wait for the library to load from CDN
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

window.supabaseClient = supabaseClient;
