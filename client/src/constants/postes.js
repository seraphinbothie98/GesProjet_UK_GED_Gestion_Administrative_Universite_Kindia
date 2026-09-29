// Standard positions list for Université de Kindia
export const STANDARD_POSTES = [
  { value: 'Chef de Service', label: '⭐ Chef de Service (Responsable hiérarchique)', isChef: true },
  { value: 'Chef de Service Adjoint', label: 'Chef de Service Adjoint', isChef: false },
  { value: 'Doyen de Faculté', label: '⭐ Doyen de Faculté', isChef: true },
  { value: 'Vice-Doyen', label: 'Vice-Doyen (Pédagogie / Recherche)', isChef: false },
  { value: 'Chef de Département', label: '⭐ Chef de Département', isChef: true },
  { value: 'Chef de Département Adjoint', label: 'Chef de Département Adjoint', isChef: false },
  { value: 'Directeur de Programme', label: 'Directeur de Programme / Master', isChef: false },
  { value: 'Secrétaire Général', label: '⭐ Secrétaire Général', isChef: true },
  { value: 'Secrétaire Principal(e)', label: 'Secrétaire Principal(e)', isChef: false },
  { value: 'Secrétaire de Direction', label: 'Secrétaire de Direction', isChef: false },
  { value: 'Agent du Secrétariat Central', label: 'Agent du Secrétariat Central', isChef: false },
  { value: 'Agent d’Accueil & Orientation', label: 'Agent d’Accueil & Orientation', isChef: false },
  { value: 'Directeur Administratif et Financier (DAF)', label: '⭐ Directeur Administratif et Financier (DAF)', isChef: true },
  { value: 'Chef Comptable', label: 'Chef Comptable', isChef: false },
  { value: 'Comptable / Gestionnaire', label: 'Comptable / Gestionnaire', isChef: false },
  { value: 'Chef de Division', label: '⭐ Chef de Division', isChef: true },
  { value: 'Agent Administratif', label: 'Agent Administratif', isChef: false },
  { value: 'Enseignant-Chercheur', label: 'Enseignant-Chercheur / Maître de Conférences', isChef: false },
  { value: 'Archiviste / Documentaliste', label: 'Archiviste / Documentaliste', isChef: false },
  { value: 'Responsable Scolarité', label: 'Responsable de la Scolarité', isChef: false },
  { value: 'Responsable Logistique & Patrimoine', label: 'Responsable Logistique & Patrimoine', isChef: false },
  { value: 'Chauffeur de Mission', label: 'Chauffeur de Mission / Parc Auto', isChef: false },
  { value: 'Agent de Sécurité & Surveillance', label: 'Agent de Sécurité & Surveillance', isChef: false },
  { value: 'AUTRE', label: '✍️ Autre fonction (Personnalisée)', isChef: false },
];

/**
 * Checks if a given position title or role code corresponds to a Chef de Service position.
 */
export function isChefPosition(positionTitle, roleCode, isChefFlag = false) {
  if (isChefFlag) return true;
  if (roleCode === 'CHEF_SERVICE' || roleCode === 'RESPONSABLE_SERVICE') return true;
  if (!positionTitle) return false;
  const p = positionTitle.trim().toLowerCase();
  return (
    p.startsWith('chef de service') ||
    p.startsWith('chef de département') ||
    p.startsWith('chef de departement') ||
    p.startsWith('chef de division') ||
    p.startsWith('doyen') ||
    p.startsWith('directeur administratif et financier') ||
    p.startsWith('secrétaire général') ||
    p.startsWith('secretaire general')
  );
}
