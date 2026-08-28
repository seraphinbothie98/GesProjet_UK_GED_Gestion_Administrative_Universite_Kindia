/**
 * actionFormatter.js
 * Utilitaires de conversion et traduction humaine des événements administratifs UK-GED
 * Transforme les codes techniques et statuts en libellés clairs, professionnels et lisibles.
 */

const ACTION_DICTIONARY = {
  // Demandes & Ordres de mission internes
  'SUBMIT_REQUEST': "Demande d'ordre de mission déposée",
  'REQUEST_COMPLEMENT': "Compléments d'informations demandés",
  'ACCEPT_REQUEST': "Demande d'ordre de mission acceptée",
  'REJECT_REQUEST': "Demande d'ordre de mission rejetée",
  'PREPARE_OFFICIAL_OM': "Ordre de mission officiel préparé",
  'TRANSMIT_TO_SG': "Transmis au Secrétaire Général pour signature",

  // Ordres de mission externes & visas
  'REGISTRATION_AND_ARRIVAL_RECORDED': 'Enregistrement et arrivée enregistrés par le Secrétariat Central',
  'ARRIVAL_RECORDED': 'Arrivée enregistrée par le Secrétariat Central',
  'ARRIVAL_SIGNED_BY_SG': "Visa d'arrivée signé par le Secrétaire Général",
  'SG_ARRIVAL_SIGNED': "Visa d'arrivée signé par le Secrétaire Général",
  'DEPART_RECORDED': 'Départ enregistré par le Secrétariat Central',
  'DEPART_SIGNED_BY_SG': 'Visa de départ signé par le Secrétaire Général',
  'SG_DEPARTURE_SIGNED': 'Visa de départ signé par le Secrétaire Général',
  'MISSION_STARTED': 'Mission en cours',
  
  // Workflow des courriers & documents
  'DOCUMENT_FORWARDED': 'Document orienté vers le service',
  'FORWARD': 'Document orienté vers le service',
  'ORIENT': 'Document orienté vers le service',
  'DOCUMENT_RECEIVED': 'Document reçu par le service',
  'RECEIVE': 'Document reçu par le service',
  'DOCUMENT_TREATED': 'Document pris en charge pour traitement',
  'TREAT': 'Document pris en charge pour traitement',
  'PROCESSING': 'Dossier pris en charge pour traitement',
  'IN_PROGRESS': 'En cours de traitement',
  'DOCUMENT_COMPLETED': 'Traitement du dossier terminé',
  'COMPLETED': 'Traitement du dossier terminé',
  'DOCUMENT_RETURNED': 'Document retourné au Secrétariat Central',
  'RETURN': 'Document retourné au Secrétariat Central',
  'RETOUR': 'Document retourné pour correction',
  'RETURN_FOR_CORRECTION': 'Document retourné pour correction',
  'A_CORRIGER': 'Document à corriger',
  'DOCUMENT_REJECTED': 'Document rejeté',
  'REJECT': 'Document rejeté',
  'DOCUMENT_ARCHIVED': 'Document archivé définitivement',
  'ARCHIVE': 'Document archivé définitivement',
  'ARCHIVED': 'Document archivé définitivement',
  'ARCHIVE_DIRECT': 'Document officiel classé aux archives',
  'VALIDATED': 'Document validé',
  'VALIDATE': 'Document validé',
  'ACCEPTED': 'Document validé et accepté',
  'SIGNED': 'Document signé électroniquement',
  'SIGN': 'Document signé électroniquement',
  'CREATE': 'Enregistrement initial du document',
  'CREATED': 'Document enregistré dans UK-GED',
  'UPDATE': 'Mise à jour du document',
  'PENDING_SIGNATURE': 'En attente de signature',
  'PENDING_PROCESSING': 'En attente de traitement',
  'TRANSMIS': 'Document transmis pour avis',
  'TRANSMIT': 'Document transmis pour avis',
  'DIFFUSE': 'Document diffusé aux services',
  'ANNOTATE': 'Annotation administrative ajoutée'
};

/**
 * Traduit un événement / code d'action technique en objet clair { title, mention }
 */
export function formatAction(actionRaw, detailsRaw, status, docType) {
  let title = '';
  let mention = '';

  if (!actionRaw && !detailsRaw) {
    return {
      title: 'Dossier enregistré dans UK-GED',
      mention: ''
    };
  }

  let codeCandidate = '';
  let detailsText = detailsRaw || '';

  // Si actionRaw contient "CODE : details", on sépare
  if (typeof actionRaw === 'string' && actionRaw.includes(' : ')) {
    const parts = actionRaw.split(' : ');
    codeCandidate = parts[0].trim().toUpperCase();
    if (!detailsText) {
      detailsText = parts.slice(1).join(' : ').trim();
    }
  } else if (typeof actionRaw === 'string') {
    codeCandidate = actionRaw.trim().toUpperCase();
  }

  // 1. Recherche dans le dictionnaire
  if (ACTION_DICTIONARY[codeCandidate]) {
    title = ACTION_DICTIONARY[codeCandidate];
  } else {
    // Nettoyage générique si code avec des underscores
    if (codeCandidate && /^[A-Z0-9_]+$/.test(codeCandidate)) {
      title = codeCandidate
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
    } else if (codeCandidate) {
      title = codeCandidate;
    } else {
      title = 'Action administrative enregistrée';
    }
  }

  // 2. Traitement et nettoyage des mentions additionnelles
  if (detailsText) {
    // Si detailsText contient lui-même un code technique au début, le nettoyer
    let cleanDetails = detailsText.replace(/^[A-Z0-9_]+\s*:\s*/i, '').trim();

    // Extraire les mentions clés utiles sans surcharge
    if (cleanDetails.toLowerCase().includes('retour au secrétariat central')) {
      mention = 'Retour au Secrétariat Central';
    } else if (cleanDetails.toLowerCase().includes('en attente de visa') || cleanDetails.toLowerCase().includes('en attente de signature')) {
      mention = 'Transmis pour signature';
    } else if (cleanDetails.toLowerCase().includes('orienté') || cleanDetails.toLowerCase().includes('transmis')) {
      const matchTo = cleanDetails.match(/(?:vers|à)\s+([^.\n]+)/i);
      if (matchTo && matchTo[1]) {
        mention = `Transmis vers ${matchTo[1].trim()}`;
      }
    } else if (cleanDetails.length > 0 && cleanDetails.length <= 60 && !cleanDetails.includes('\n')) {
      mention = cleanDetails;
    }
  }

  // Contexte spécifique Ordre de Mission Externe
  if (codeCandidate === 'ARRIVAL_SIGNED_BY_SG' || codeCandidate === 'SG_ARRIVAL_SIGNED') {
    title = "Visa d'arrivée signé par le Secrétaire Général";
    mention = 'Retour au Secrétariat Central — Mission en cours';
  } else if (codeCandidate === 'DEPART_SIGNED_BY_SG' || codeCandidate === 'SG_DEPARTURE_SIGNED') {
    title = 'Visa de départ signé par le Secrétaire Général';
    mention = 'Retour au Secrétariat Central pour archivage';
  } else if (codeCandidate === 'REGISTRATION_AND_ARRIVAL_RECORDED') {
    title = 'Arrivée enregistrée par le Secrétariat Central';
    mention = 'En attente du visa du Secrétaire Général';
  }

  return { title, mention };
}

/**
 * Traduit la prochaine action attendue en libellé lisible selon le statut et le rôle
 */
export function formatNextAction(nextActionRaw, statusRaw, isSG = false, isSC = false) {
  const st = (statusRaw || '').toUpperCase();
  const raw = (nextActionRaw || '').toUpperCase();

  // Ordres de mission externes
  if (st.includes('ARRIVÉE ENREGISTRÉE') || raw.includes('WAITING_SG_ARRIVAL') || raw.includes('VISA ARRIVÉE')) {
    return isSG 
      ? "Signature du visa d'arrivée" 
      : "En attente de signature du visa d'arrivée par le SG";
  }
  if (st.includes('ARRIVÉE SIGNÉE') || st.includes('MISSION EN COURS') || raw.includes('MISSION EN COURS')) {
    return "Mission en cours — Enregistrement du départ en fin de mission";
  }
  if (st.includes('DÉPART ENREGISTRÉ') || raw.includes('WAITING_SG_DEPART') || raw.includes('VISA FINAL DÉPART')) {
    return isSG 
      ? "Signature du visa final de départ" 
      : "En attente de signature du visa de départ par le SG";
  }
  if (st.includes('DÉPART SIGNÉ') || st.includes('PRÊT POUR ARCHIVAGE') || raw.includes('WAITING_ARCHIVE')) {
    return "Retour au Secrétariat Central pour archivage définitif";
  }
  if (st.includes('ARCHIV')) {
    return "Dossier clôturé et archivé définitivement";
  }

  // Documents, Courriers & Demandes
  if (st.includes('ORIENTATION') || st === 'PENDING' || st === 'CREATED' || st === 'ENREGISTRÉ') {
    return "Orientation vers le service compétent";
  }
  if (st.includes('TRAITEMENT') || st === 'IN_PROGRESS' || st === 'ORIENTÉ' || st === 'TRANSMIS') {
    return "Traitement par le service responsable";
  }
  if (st.includes('SIGNATURE') || st === 'EN ATTENTE DE SIGNATURE') {
    return isSG ? "Signature du document" : "En attente de signature de l'autorité habilitée";
  }
  if (st.includes('RETOUR') || st === 'A_CORRIGER') {
    return "Correction par le service émetteur";
  }
  if (st.includes('VALIDÉ') || st === 'ACCEPTED') {
    return "Clôture et remise au demandeur";
  }
  if (st.includes('SIGNÉ') || st === 'SIGNED') {
    return "Archivage définitif au Secrétariat Central";
  }
  if (st.includes('TRAITÉ') || st.includes('CLÔTURÉ')) {
    return "Dossier traité et clôturé";
  }

  // Si du texte existe sans code technique, le retourner nettoyé
  if (nextActionRaw && !nextActionRaw.includes('_')) {
    return nextActionRaw;
  }

  return "Action administrative requise";
}

/**
 * Formate une date en format français convivial : "26/08/2026 à 22:44"
 */
export function formatActionDate(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${datePart} à ${timePart}`;
  } catch (e) {
    return '';
  }
}
