import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: WebSocket } }
);

const channels = JSON.parse(readFileSync('./scripts/working_channels.json', 'utf8'));
console.log(`Inserting ${channels.length} verified channels…`);

const { data, error } = await supabase.from('channels').insert(channels).select('id');
if (error) {
  console.error('Insert error:', error.message);
  process.exit(1);
}
console.log(`✓ Inserted ${data.length} channels`);
