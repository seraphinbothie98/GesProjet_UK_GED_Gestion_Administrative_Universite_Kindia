import React from 'react';

export function StatusBadge({ status }) {
  const configs = {
    CREATED: { label: 'Enregistré', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    PENDING: { label: 'En attente', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    IN_PROGRESS: { label: 'En cours', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    SIGNED: { label: 'Signé & Scellé', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    REJECTED: { label: 'Rejeté', bg: 'bg-red-50 text-red-700 border-red-200' },
    ARCHIVED: { label: 'Archivé', bg: 'bg-slate-100 text-slate-700 border-slate-300' },

    // Rendez-vous Statuses
    EN_ATTENTE: { label: '🟠 En attente', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' },
    ACCEPTE: { label: '🟢 Accepté', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    CONFIRME: { label: '🟢 Accepté', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    REFUSE: { label: '🔴 Refusé', bg: 'bg-rose-50 text-rose-800 border-rose-300 font-bold' },
    REPROGRAMME: { label: '🔵 Reprogrammé', bg: 'bg-sky-50 text-sky-800 border-sky-300 font-semibold' },
    NOUVELLE_DATE_PROPOSEE: { label: '🔵 Reprogrammé', bg: 'bg-sky-50 text-sky-800 border-sky-300 font-semibold' },
    ANNULE: { label: '⚫ Annulé', bg: 'bg-slate-100 text-slate-700 border-slate-300 font-medium' },
    EN_COURS: { label: '👤 Demandeur arrivé', bg: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-medium' },
    TERMINE: { label: '🟣 Terminé', bg: 'bg-purple-50 text-purple-800 border-purple-300 font-medium' },
    ABSENCE_DEMANDEUR: { label: '⚠️ Absence demandeur', bg: 'bg-rose-50 text-rose-700 border-rose-300' }
  };

  const config = configs[status] || { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };

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
