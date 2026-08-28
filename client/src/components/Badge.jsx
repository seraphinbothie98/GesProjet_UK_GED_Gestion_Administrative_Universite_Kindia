import React from 'react';

export function StatusBadge({ status }) {
  const configs = {
    // Statuts d'enregistrement & création
    CREATED: { label: 'Enregistré', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    ENREGISTRÉ: { label: 'Enregistré', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    NOUVEAU: { label: 'Nouveau', bg: 'bg-sky-50 text-sky-700 border-sky-200 font-bold' },
    DRAFT: { label: 'Brouillon', bg: 'bg-slate-100 text-slate-600 border-slate-200' },
    BROUILLON: { label: 'Brouillon', bg: 'bg-slate-100 text-slate-600 border-slate-200' },

    // Statuts d'orientation et d'attente
    PENDING: { label: 'En attente', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    EN_ATTENTE: { label: 'En attente', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    "EN ATTENTE D'ORIENTATION": { label: "En attente d'orientation", bg: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' },
    ORIENTÉ: { label: 'Orienté vers service', bg: 'bg-blue-50 text-blue-800 border-blue-300 font-bold' },
    ORIENTE: { label: 'Orienté vers service', bg: 'bg-blue-50 text-blue-800 border-blue-300 font-bold' },
    'EN ATTENTE DE TRAITEMENT': { label: 'En attente de traitement', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' },
    SOUMIS: { label: 'Soumis', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    TRANSMIS: { label: 'Transmis', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
    REÇU: { label: 'Reçu au service', bg: 'bg-blue-50 text-blue-700 border-blue-200' },

    // Statuts en cours de traitement
    IN_PROGRESS: { label: 'En cours de traitement', bg: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-medium' },
    EN_COURS: { label: 'En cours', bg: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-medium' },
    'EN COURS DE TRAITEMENT': { label: 'En cours de traitement', bg: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold' },

    // Statuts de validation et signatures
    'EN ATTENTE DE VALIDATION': { label: 'En attente de validation', bg: 'bg-purple-50 text-purple-700 border-purple-300 font-semibold' },
    'EN ATTENTE DE SIGNATURE': { label: 'En attente de signature', bg: 'bg-amber-100 text-amber-900 border-amber-400 font-bold' },
    'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE': { label: 'En attente signature SG', bg: 'bg-amber-100 text-amber-900 border-amber-400 font-bold' },

    // Ordres de mission internes & Demandes
    'EN_ATTENTE_SC': { label: 'En attente Secrétariat Central', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' },
    'DEMANDE ENREGISTRÉE': { label: 'Demande enregistrée', bg: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold' },
    'DEMANDE ACCEPTÉE': { label: 'Demande acceptée', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    'ORDRE DE MISSION EN PRÉPARATION': { label: 'En préparation OM', bg: 'bg-sky-50 text-sky-800 border-sky-300 font-bold' },
    'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL': { label: 'En attente signature SG', bg: 'bg-amber-100 text-amber-900 border-amber-400 font-bold' },
    'INFORMATIONS COMPLÉMENTAIRES DEMANDÉES': { label: 'Compléments requis', bg: 'bg-orange-50 text-orange-800 border-orange-300 font-bold' },

    // Ordres de mission externes
    'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG': { label: 'Visa arrivée SG en attente', bg: 'bg-amber-50 text-amber-900 border-amber-300 font-bold' },
    'ARRIVÉE SIGNÉE – MISSION EN COURS': { label: 'Mission en cours', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    'MISSION EN COURS': { label: 'Mission en cours', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG': { label: 'Visa départ SG en attente', bg: 'bg-amber-50 text-amber-900 border-amber-300 font-bold' },
    'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE': { label: 'En attente d’archivage SC', bg: 'bg-teal-50 text-teal-800 border-teal-300 font-bold' },
    'PRÊT POUR ARCHIVAGE': { label: 'En attente d’archivage', bg: 'bg-teal-50 text-teal-800 border-teal-300 font-bold' },

    // Statuts de retour et correction
    RETOUR: { label: 'Retour pour correction', bg: 'bg-rose-50 text-rose-700 border-rose-300 font-bold' },
    A_CORRIGER: { label: 'À corriger', bg: 'bg-rose-50 text-rose-700 border-rose-300 font-bold' },
    'RETOURNÉ AU SECRÉTARIAT CENTRAL': { label: 'Retourné au Secrétariat Central', bg: 'bg-blue-50 text-blue-800 border-blue-300 font-bold' },
    'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL': { label: 'Rejeté par SG', bg: 'bg-red-50 text-red-700 border-red-300 font-bold' },
    REJECTED: { label: 'Rejeté', bg: 'bg-red-50 text-red-700 border-red-200' },
    REJETÉ: { label: 'Rejeté', bg: 'bg-red-50 text-red-700 border-red-200' },
    REJETÉE: { label: 'Rejetée', bg: 'bg-red-50 text-red-700 border-red-200' },

    // Statuts terminaux et succès
    TRAITÉ: { label: 'Traité', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold' },
    TRAITE: { label: 'Traité', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold' },
    VALIDÉ: { label: 'Validé', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold' },
    ACCEPTED: { label: 'Accepté / Validé', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold' },
    SIGNED: { label: 'Signé & Scellé', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' },
    SIGNÉ: { label: 'Signé & Scellé', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' },
    CLÔTURÉ: { label: 'Clôturé', bg: 'bg-slate-100 text-slate-700 border-slate-300 font-medium' },
    CLOTURE: { label: 'Clôturé', bg: 'bg-slate-100 text-slate-700 border-slate-300 font-medium' },
    ARCHIVED: { label: 'Archivé', bg: 'bg-slate-100 text-slate-700 border-slate-300' },
    ARCHIVÉ: { label: 'Archivé', bg: 'bg-slate-100 text-slate-700 border-slate-300' },

    // Rendez-vous Statuses
    ACCEPTE: { label: '🟢 Accepté', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    CONFIRME: { label: '🟢 Confirmé', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    REFUSE: { label: '🔴 Refusé', bg: 'bg-rose-50 text-rose-800 border-rose-300 font-bold' },
    REPROGRAMME: { label: '🔵 Reprogrammé', bg: 'bg-sky-50 text-sky-800 border-sky-300 font-semibold' },
    NOUVELLE_DATE_PROPOSEE: { label: '🔵 Reprogrammé', bg: 'bg-sky-50 text-sky-800 border-sky-300 font-semibold' },
    ANNULE: { label: '⚫ Annulé', bg: 'bg-slate-100 text-slate-700 border-slate-300 font-medium' },
    TERMINE: { label: '🟣 Terminé', bg: 'bg-purple-50 text-purple-800 border-purple-300 font-medium' },
    ABSENCE_DEMANDEUR: { label: '⚠️ Absence demandeur', bg: 'bg-rose-50 text-rose-700 border-rose-300' }
  };

  const config = configs[status] || configs[(status || '').toUpperCase()] || { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg}`}>
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const configs = {
    LOW: { label: 'Basse', bg: 'bg-slate-100 text-slate-600' },
    NORMAL: { label: 'Normale', bg: 'bg-blue-100 text-blue-800' },
    HIGH: { label: 'Haute', bg: 'bg-amber-100 text-amber-800' },
    URGENT: { label: 'URGENT', bg: 'bg-red-600 text-white font-bold animate-pulse' }
  };

  const config = configs[priority] || { label: priority, bg: 'bg-slate-100 text-slate-600' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${config.bg}`}>
      {config.label}
    </span>
  );
}

export function DeadlineBadge({ deadlineDate, status }) {
  if (!deadlineDate || status === 'SIGNED' || status === 'ARCHIVED') return null;

  const today = new Date();
  const deadline = new Date(deadlineDate);
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let label = `Échéance : ${new Date(deadlineDate).toLocaleDateString('fr-FR')}`;

  if (diffDays < 0) {
    bg = 'bg-red-100 text-red-800 border-red-300 font-bold';
    label = `RETARD (${Math.abs(diffDays)} j)`;
  } else if (diffDays <= 2) {
    bg = 'bg-amber-100 text-amber-800 border-amber-300';
    label = `Imminent (${diffDays} j)`;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${bg}`}>
      ⏱️ {label}
    </span>
  );
}
