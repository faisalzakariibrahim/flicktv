import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { count: total } = await supabase.from('channels').select('id', { count: 'exact', head: true });
const { count: system } = await supabase.from('channels').select('id', { count: 'exact', head: true }).is('user_id', null);
const { count: user } = await supabase.from('channels').select('id', { count: 'exact', head: true }).not('user_id', 'is', null);
const { data: cats } = await supabase.from('channels').select('category').not('category', 'is', null);
const categories = {};
cats?.forEach(c => { categories[c.category] = (categories[c.category]||0)+1; });
const { data: latest } = await supabase.from('channels').select('name, category, country, created_at').order('created_at', { ascending: false }).limit(5);
const { count: recs } = await supabase.from('recommendations').select('id', { count: 'exact', head: true });
const { count: history } = await supabase.from('watch_history').select('id', { count: 'exact', head: true });
const { count: users } = await supabase.from('users').select('id', { count: 'exact', head: true });

console.log(JSON.stringify({ total, system, user, categories, recs, history, users, latestChannels: latest }, null, 2));
