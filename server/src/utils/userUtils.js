/**
 * Standard User and Personnel Name Formatter for Université de Kindia (UK-GED) - Server Side
 * 
 * Standard Format: [Titre/Grade] [Prénoms] [NOM]
 * Examples:
 * - "Pr Mamadou Samba BARRY"
 * - "M. Fodé SYLLA"
 * - "Dr Mamadou Pathé DIALLO"
 * - "Mme Fatoumata BINTA"
 */

function normalizeTitle(titre) {
  if (!titre || typeof titre !== 'string') return '';
  const trimmed = titre.trim();
  if (!trimmed) return '';

  if (/^Pr(\.|\s|$|\()/i.test(trimmed) || /^Prof/i.test(trimmed)) {
    return trimmed.toLowerCase().includes('titulaire') ? 'Pr Titulaire' : 'Pr';
  }
  if (/^Dre(\.|\s|$|\()/i.test(trimmed) || /^Docteure/i.test(trimmed)) {
    return 'Dre';
  }
  if (/^Dr(\.|\s|$|\()/i.test(trimmed) || /^Docteur/i.test(trimmed)) {
    return 'Dr';
  }
  if (/^Mme(\.|\s|$|\()/i.test(trimmed) || /^Madame/i.test(trimmed)) {
    return 'Mme';
  }
  if (/^Mlle(\.|\s|$|\()/i.test(trimmed) || /^Mademoiselle/i.test(trimmed)) {
    return 'Mlle';
  }
  if (/^M(\.|\s|$|\()/i.test(trimmed) || /^Monsieur/i.test(trimmed)) {
    return 'M.';
  }
  if (/^MCF/i.test(trimmed)) {
    return 'MCF';
  }
  if (/^MA(\.|\s|$|\()/i.test(trimmed) || /^Maître-Assistant/i.test(trimmed)) {
    return 'MA';
  }
  if (/^Ing/i.test(trimmed)) {
    return 'Ing.';
  }
  return trimmed;
}

function formatFullName(person, fallback = '') {
  if (!person) return fallback;

  if (typeof person === 'string') {
    const trimmed = person.trim();
    if (!trimmed) return fallback;
    
    const match = trimmed.match(/^(Pr\s+Titulaire|Pr\.|Pr|Prof\.|Professeur|Dr\.|Dr|Dre\.|Dre|M\.|Mme|Mlle|MCF|MA|Ing\.|Monsieur|Madame)\s+(.*)$/i);
    if (match) {
      const rawTitle = match[1];
      const rest = match[2].trim();
      const parts = rest.split(/\s+/);
      if (parts.length === 1) {
        return `${normalizeTitle(rawTitle)} ${parts[0].toUpperCase()}`.trim();
      }
      const lastName = parts[parts.length - 1].toUpperCase();
      const firstNames = parts.slice(0, -1).join(' ');
      return `${normalizeTitle(rawTitle)} ${firstNames} ${lastName}`.trim();
    }
    
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const lastName = parts[parts.length - 1].toUpperCase();
    const firstNames = parts.slice(0, -1).join(' ');
    return `${firstNames} ${lastName}`.trim();
  }

  let rawTitle = person.titre || person.title || person.grade || person.grade_titre || person.salutation || person.civilite || '';
  let prenoms = person.prenoms || person.prenom || person.first_name || person.firstName || person.first_names || person.applicant_first_names || person.requester_first_name || person.resp_first_name || person.from_user_first_name || person.to_user_first_name || '';
  let nom = person.nom || person.last_name || person.lastName || person.applicant_last_name || person.requester_last_name || person.resp_last_name || person.from_user_last_name || person.to_user_last_name || '';

  if (!nom && !prenoms) {
    if (person.full_name) return formatFullName(person.full_name, fallback);
    if (person.name) return formatFullName(person.name, fallback);
    if (person.missionary_name) return formatFullName(person.missionary_name, fallback);
    return fallback;
  }

  if (!rawTitle && prenoms) {
    const match = prenoms.match(/^(Pr\s+Titulaire|Pr\.|Pr|Prof\.|Professeur|Dr\.|Dr|Dre\.|Dre|M\.|Mme|Mlle|MCF|MA|Ing\.|Monsieur|Madame)\s+(.*)$/i);
    if (match) {
      rawTitle = match[1];
      prenoms = match[2];
    }
  }

  if (prenoms) {
    prenoms = prenoms.replace(/^(Pr\s+Titulaire|Pr\.|Pr|Prof\.|Professeur|Dr\.|Dr|Dre\.|Dre|M\.|Mme|Mlle|MCF|MA|Ing\.|Monsieur|Madame)\s+/i, '').trim();
  }

  const cleanTitle = normalizeTitle(rawTitle);
  const cleanPrenoms = prenoms ? prenoms.trim() : '';
  const cleanNom = nom ? nom.trim().toUpperCase() : '';

  const parts = [];
  if (cleanTitle) parts.push(cleanTitle);
  if (cleanPrenoms) parts.push(cleanPrenoms);
  if (cleanNom) parts.push(cleanNom);

  const result = parts.join(' ').trim();
  return result || fallback;
}

function formatTransportDisplay(transportMode, vehicleReg) {
  const mode = (transportMode || '').trim();
  const reg = (vehicleReg || '').trim();
  const modeLower = mode.toLowerCase();

  // If flight
  if (modeLower.includes('avion') || modeLower.includes('vol')) {
    return 'Avion';
  }

  // If public transit
  if (modeLower.includes('commun') || modeLower.includes('bus') || modeLower.includes('taxi')) {
    return 'Transport en commun';
  }

  // If vehicle (personal or service): strictly display registration directly without "Véhicule personnel" or explanatory text
  if (reg) {
    return reg;
  }

  if (modeLower.includes('personnel') || modeLower.includes('service') || modeLower.includes('véhicule') || modeLower.includes('vehicule')) {
    return reg || '//';
  }

  return mode || reg || '//';
}

function formatDriverDisplay(transportMode, driverName, driverOption, missionaryName) {
  const mode = (transportMode || '').trim().toLowerCase();

  // Airplane and public transit strictly get //
  if (mode.includes('avion') || mode.includes('vol') || mode.includes('commun') || mode.includes('bus') || mode.includes('taxi')) {
    return '//';
  }

  const dOption = (driverOption || '').trim().toLowerCase();
  const dName = (driverName || '').trim();

  if (dOption === 'missionary' || dOption === 'lui-même' || dOption === 'lui_meme' || dOption === 'self') {
    return 'Lui-même';
  }

  if (dName && dName !== '//') {
    return dName;
  }

  return dName || 'Lui-même';
}

module.exports = {
  normalizeTitle,
  formatFullName,
  formatTransportDisplay,
  formatDriverDisplay
};
