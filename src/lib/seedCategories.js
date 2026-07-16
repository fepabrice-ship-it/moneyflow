import { supabase } from './supabase';

export const seedMissingCategories = async () => {
  const requiredCategories = [
    { name: 'Investissement', type: 'income' },
    { name: 'Expédition', type: 'expense' },
    { name: 'Transport produits', type: 'expense' },
    { name: 'Publicité', type: 'expense' }
  ];

  try {
    console.log('Starting category seeding check...');
    // 1. Get existing categories
    const { data: existing, error: fetchError } = await supabase.from('categories').select('name');
    if (fetchError) throw fetchError;
    
    const existingNames = existing?.map(c => c.name) || [];
    console.log('Existing categories in DB:', existingNames);

    // 2. Filter out categories that already exist
    const toInsert = requiredCategories.filter(cat => !existingNames.includes(cat.name));

    if (toInsert.length > 0) {
      console.log('Attempting to insert:', toInsert);
      
      // Insert one by one to see which one fails if any
      for (const cat of toInsert) {
        const { error: insertError } = await supabase.from('categories').insert([cat]);
        if (insertError) {
          console.error(`Failed to insert category "${cat.name}":`, insertError);
        } else {
          console.log(`Successfully inserted category "${cat.name}"`);
        }
      }
    } else {
      console.log('All required categories are already present.');
    }
  } catch (err) {
    console.error('Critical error during category seeding:', err);
  }
};
