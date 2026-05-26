import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://smjedhzlzulgewlnbycb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtamVkaHpsenVsZ2V3bG5ieWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTcxMDIsImV4cCI6MjA5NTM5MzEwMn0._ZxBuY_b1_BgFkFA5EbK0jLG6bdtRAJDZnizo62Ao8o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
