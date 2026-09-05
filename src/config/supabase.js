const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

// Node.js < 22 has no native WebSocket global, which @supabase/supabase-js's
// realtime module requires even though this project never uses realtime
// features. Passing `ws` as the transport avoids the "no native WebSocket
// support" crash on startup. Safe to remove once running on Node 22+.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

module.exports = supabase;
