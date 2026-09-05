const supabase = require('../config/supabase');

async function getOrCreateUser(lineUserId, displayName) {
  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: insertErr } = await supabase
    .from('users')
    .insert({ line_user_id: lineUserId, display_name: displayName || null })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created;
}

module.exports = { getOrCreateUser };
