const supabase = require('../config/supabase');

async function createSubscription({ userId, cardId, categoryId, name, amount, billingDay }) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      card_id: cardId,
      category_id: categoryId,
      name,
      amount,
      billing_day: billingDay,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getActiveSubscriptions(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, cards(name), categories(name)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function getActiveSubscriptionsForCard(cardId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, categories(name)')
    .eq('card_id', cardId)
    .eq('is_active', true);
  if (error) throw error;
  return data;
}

async function cancelSubscription(subscriptionId) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ is_active: false })
    .eq('id', subscriptionId);
  if (error) throw error;
}

module.exports = { createSubscription, getActiveSubscriptions, getActiveSubscriptionsForCard, cancelSubscription };
