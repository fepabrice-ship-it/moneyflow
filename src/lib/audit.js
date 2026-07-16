import { supabase } from './supabase';

// Émet un évènement dans activity_log. On absorbe les erreurs (un échec de log
// ne doit jamais bloquer l'action utilisateur).
export const logActivity = async ({ projectId, action, entityType, entityId, summary, before = null, after = null }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !projectId) return;
    await supabase.from('activity_log').insert([{
      project_id: projectId,
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
      before,
      after,
    }]);
  } catch (err) {
    console.warn('[audit] log failed', err);
  }
};

// Résumé court d'une transaction pour affichage dans le journal.
export const summarizeTransaction = (tx) => {
  if (!tx) return '';
  const amt = new Intl.NumberFormat('fr-FR').format(Number(tx.amount || 0));
  const sign = tx.type === 'income' ? '+' : '-';
  return `${sign}${amt} F • ${tx.description || '(sans description)'}`;
};
