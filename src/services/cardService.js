const supabase = require('../config/supabase');

async function createCard(userId, name, creditLimit, cutoffDay) {
  const { data, error } = await supabase
    .from('cards')
    .insert({ user_id: userId, name, credit_limit: creditLimit, cutoff_day: cutoffDay })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getCards(userId) {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function getCard(cardId) {
  const { data, error } = await supabase.from('cards').select('*').eq('id', cardId).single();
  if (error) throw error;
  return data;
}

async function updateLimit(cardId, newLimit) {
  const { data, error } = await supabase
    .from('cards')
    .update({ credit_limit: newLimit })
    .eq('id', cardId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { createCard, getCards, getCard, updateLimit };
