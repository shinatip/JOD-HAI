const supabase = require('../config/supabase');

async function getCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

async function getCategory(categoryId) {
  const { data, error } = await supabase.from('categories').select('*').eq('id', categoryId).single();
  if (error) throw error;
  return data;
}

module.exports = { getCategories, getCategory };
