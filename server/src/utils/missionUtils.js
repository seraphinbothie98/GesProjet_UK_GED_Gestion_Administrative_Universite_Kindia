const { formatFullName } = require('./userUtils');

/**
 * Validates the participants list for an Ordre de Mission (OM).
 * Enforces the ABSOLUTE RULE: The requester must be present in the participants list!
 * Prevents duplicate participants and ensures mandatory fields.
 * 
 * @param {Array|string} rawParticipants - List of participants or JSON string
 * @param {Object} requester - The connected user / worker submitting the request
 * @returns {Array} sanitizedParticipants - Validated list of participant objects with snapshots
 */
function validateMissionParticipants(rawParticipants, requester) {
  let list = [];
  if (rawParticipants) {
    try {
      list = typeof rawParticipants === 'string' ? JSON.parse(rawParticipants) : rawParticipants;
    } catch (e) {
      throw new Error('Format de la liste des participants invalide.');
    }
  }

  const reqLastName = (requester.last_name || requester.nom || '').trim();
  const reqFirstName = (requester.first_name || requester.prenoms || '').trim();
  const reqMatricule = (requester.matricule || '').trim();
  const reqUserId = requester.id || requester.user_id ? Number(requester.id || requester.user_id) : null;
  const reqStaffId = requester.staff_id ? Number(requester.staff_id) : null;

  // If no participants list was supplied, default to the requester as the sole missionary
  if (!Array.isArray(list) || list.length === 0) {
    list = [{
      user_id: reqUserId,
      staff_id: reqStaffId,
      nom: reqLastName,
      prenoms: reqFirstName,
      titre: requester.titre || 'M.',
      fonction: requester.function_title || requester.fonction || 'Chef de mission',
      matricule: reqMatricule || null,
      service_name: requester.service_name || requester.academic_structure || null,
      telephone: requester.phone || requester.telephone || null,
      email: requester.email || null,
      is_requester: 1
    }];
  }

  if (list.length === 0) {
    throw new Error('La demande doit comporter au moins un missionnaire.');
  }

  // RÈGLE ABSOLUE :
  // Un utilisateur ne peut jamais créer une demande d'OM uniquement pour d'autres personnes.
  // Il doit obligatoirement être lui-même membre de la mission.
  const lowerReqLastName = reqLastName.toLowerCase();
  const lowerReqFirstName = reqFirstName.toLowerCase();
  const lowerReqMatricule = reqMatricule.toLowerCase();

  const requesterFound = list.some(p => {
    if (reqUserId && p.user_id && Number(p.user_id) === reqUserId) return true;
    if (reqStaffId && p.staff_id && Number(p.staff_id) === reqStaffId) return true;
    if (lowerReqMatricule && p.matricule && p.matricule.trim().toLowerCase() === lowerReqMatricule) return true;

    const pNom = (p.nom || '').trim().toLowerCase();
    const pPrenoms = (p.prenoms || '').trim().toLowerCase();
    if (pNom && lowerReqLastName && pNom === lowerReqLastName) {
      if (!pPrenoms || !lowerReqFirstName || pPrenoms === lowerReqFirstName) {
        return true;
      }
    }

    if (p.is_requester) {
      // If marked as requester and name isn't conflicting
      if (!pNom || pNom === lowerReqLastName) return true;
    }

    return false;
  });

  if (!requesterFound) {
    // Exact sentence specified in the prompt:
    throw new Error("Vous devez obligatoirement faire partie des personnes participant à la mission pour soumettre cette demande d'ordre de mission.");
  }

  // Check for duplicates and mandatory fields
  const seen = new Set();
  const sanitized = [];

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const nom = (p.nom || '').trim();
    const prenoms = (p.prenoms || '').trim();
    const fonction = (p.fonction || '').trim();
    const matricule = (p.matricule || '').trim();

    if (!nom) {
      throw new Error(`Le nom est obligatoire pour chaque missionnaire (missionnaire n°${i + 1}).`);
    }
    if (!fonction) {
      throw new Error(`La fonction est obligatoire pour chaque missionnaire (${nom}).`);
    }

    // Uniqueness keys: check user_id, staff_id, matricule, and full name
    const keysToCheck = [];
    if (p.user_id) keysToCheck.push(`USER_${p.user_id}`);
    if (p.staff_id) keysToCheck.push(`STAFF_${p.staff_id}`);
    if (matricule) keysToCheck.push(`MAT_${matricule.toLowerCase()}`);
    if (nom) keysToCheck.push(`NAME_${nom.toLowerCase()}_${prenoms.toLowerCase()}`);

    for (const k of keysToCheck) {
      if (seen.has(k)) {
        throw new Error(`Une personne ne peut pas être ajoutée plusieurs fois au même ordre de mission (${nom} ${prenoms}).`);
      }
    }
    keysToCheck.forEach(k => seen.add(k));

    const isThisRequester = (reqUserId && p.user_id && Number(p.user_id) === reqUserId) ||
      (reqStaffId && p.staff_id && Number(p.staff_id) === reqStaffId) ||
      (lowerReqMatricule && matricule && matricule.toLowerCase() === lowerReqMatricule) ||
      (nom.toLowerCase() === lowerReqLastName && prenoms.toLowerCase() === lowerReqFirstName) ||
      Boolean(p.is_requester);

    sanitized.push({
      user_id: p.user_id || null,
      staff_id: p.staff_id || null,
      nom,
      prenoms,
      titre: p.titre || 'M.',
      fonction,
      matricule,
      service_name: (p.service_name || '').trim(),
      telephone: (p.telephone || '').trim(),
      email: (p.email || '').trim(),
      is_requester: isThisRequester ? 1 : 0
    });
  }

  sanitized.missionType = sanitized.length > 1 ? 'COLLECTIF' : 'INDIVIDUEL';
  sanitized.participantsCount = sanitized.length;
  sanitized.sanitizedParticipants = sanitized;
  return sanitized;
}

module.exports = {
  validateMissionParticipants
};
