import 'dotenv/config';
console.log('URL:', process.env.SUPABASE_URL || 'NOT SET');
console.log('KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);
console.log('ANON exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('ANTHROPIC exists:', !!process.env.ANTHROPIC_API_KEY);
