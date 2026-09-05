const supabase = require('../config/supabase');

async function getSession(lineUserId) {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { line_user_id: lineUserId, state: 'IDLE', data: {} };
  return data;
}

async function setSession(lineUserId, state, data = {}) {
  const { error } = await supabase
    .from('user_sessions')
    .upsert({ line_user_id: lineUserId, state, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function clearSession(lineUserId) {
  await setSession(lineUserId, 'IDLE', {});
}

module.exports = { getSession, setSession, clearSession };
