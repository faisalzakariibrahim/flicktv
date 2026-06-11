import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Test basic connection
const { data: testData, error: testErr } = await supabase.from('channels').select('id').limit(1);
if (testErr) {
  console.log('ERROR:', JSON.stringify(testErr, null, 2));
} else {
  console.log('channels table accessible, rows:', testData.length);
}

// Try to get table list via RPC
const { data: tables, error: rpcErr } = await supabase.rpc('get_tables').select('*');
if (rpcErr) {
  console.log('RPC error (expected):', rpcErr.message);
}

// Try direct information_schema
const { data: info, error: infoErr } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public').limit(20);
if (infoErr) {
  console.log('info_schema error:', infoErr.message);
} else {
  console.log('Tables:', info?.map(t => t.table_name));
}
