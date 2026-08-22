const path = require('path');

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'uk_ged_kindia_secret_key_2026_super_secure',
  JWT_EXPIRES_IN: '24h',
  UPLOAD_DIR: path.join(__dirname, '../../uploads'),
  DB_PATH: path.join(__dirname, '../../data/uk_ged.db'),

  // Predefined Roles
  ROLES: {
    ADMIN: 'ADMINISTRATEUR',
    AGENT_SC: 'AGENT_SECRÉTARIAT_CENTRAL',
    CHEF_SERVICE: 'CHEF_SERVICE',
    RESPONSABLE_ADMIN: 'RESPONSABLE_ADMINISTRATIF',
    SG: 'SECRÉTAIRE_GÉNÉRAL',
    RECTEUR: 'RECTEUR',
    STANDARD: 'UTILISATEUR_STANDARD'
  },

  // List of 30 Preconfigured Services for Université de Kindia
  INITIAL_SERVICES: [
    { code: 'RECT', name: 'Recteur' },
    { code: 'VR_ETU', name: 'Vice-Rectorat / Études' },
    { code: 'VR_REC', name: 'Vice-Rectorat / Recherche' },
    { code: 'SG', name: 'Secrétariat Général' },
    { code: 'SC', name: 'Secrétariat Central' },
    { code: 'DAF', name: 'Division des Affaires Financières' },
    { code: 'CF', name: 'Contrôle Financier' },
    { code: 'AC', name: 'Agence Comptable' },
    { code: 'REL_EXT', name: 'Relations Extérieures des Coopérations Universitaire, Scientifique et Technique' },
    { code: 'DRH', name: 'Division des Ressources Humaines' },
    { code: 'RD', name: 'Recherche et Développement' },
    { code: 'SCOL', name: 'Scolarité' },
    { code: 'INF', name: 'Infirmerie' },
    { code: 'SEA', name: 'Service des Études Avancées' },
    { code: 'PAM', name: 'PA Militaire' },
    { code: 'PLAN', name: 'Planification et Projet' },
    { code: 'CIAQ', name: 'Cellule Interne Assurance Qualité (CIAQ)' },
    { code: 'CNEU', name: 'Centre Numérique et d’Éditions Universitaires' },
    { code: 'UNESCO', name: 'Chaire UNESCO' },
    { code: 'ST', name: 'Service Technique' },
    { code: 'SAC', name: 'Service Sports, Arts et Culture' },
    { code: 'SIC', name: 'Service Informations et Communication' },
    { code: 'CGE', name: 'Cellule Genre et Équité' },
    { code: 'ACITE', name: 'Administration de la Cité' },
    { code: 'LARSSHE', name: 'Laboratoire de Recherche LARSSHE' },
    { code: 'FSS', name: 'Faculté des Sciences Sociales' },
    { code: 'FLL', name: 'Faculté des Langues et Lettres' },
    { code: 'FS', name: 'Faculté des Sciences' },
    { code: 'FSEG', name: 'Faculté des Sciences Économiques et de Gestion' },
    { code: 'PV', name: 'Pôle-Vie' }
  ],

  // Granular Permissions
  PERMISSIONS: [
    { code: 'documents.create', category: 'Documents', description: 'Créer des documents' },
    { code: 'documents.read', category: 'Documents', description: 'Consulter des documents autorisés' },
    { code: 'documents.update', category: 'Documents', description: 'Modifier des documents' },
    { code: 'documents.delete', category: 'Documents', description: 'Supprimer des documents' },
    { code: 'documents.transmit', category: 'Documents', description: 'Transmettre un document' },
    { code: 'documents.orient', category: 'Documents', description: 'Orienter un document avec instructions' },
    { code: 'documents.return', category: 'Documents', description: 'Retourner un document à un service' },
    { code: 'documents.download', category: 'Documents', description: 'Télécharger les pièces jointes' },
    { code: 'documents.archive', category: 'Documents', description: 'Archiver des documents' },
    { code: 'documents.archive_direct', category: 'Documents', description: 'Archiver directement des documents officiels' },
    { code: 'documents.manage_service_settings', category: 'Documents', description: 'Gérer les paramètres des documents du service (références, en-tête, pied de page)' },
    
    // Permissions Archivage Électronique Hiérarchique & Sécurisé
    { code: 'archives.view_service', category: 'Archives', description: 'Consulter les archives de son propre service/département' },
    { code: 'archives.view_faculty', category: 'Archives', description: 'Consulter les archives décanales et de faculté' },
    { code: 'archives.view_central', category: 'Archives', description: 'Consulter les archives centrales de l’Université (Secrétariat Central)' },
    { code: 'archives.archive_service', category: 'Archives', description: 'Archiver un document dans les archives de son service' },
    { code: 'archives.transmit_to_central', category: 'Archives', description: 'Transmettre un document au Secrétariat Central pour archivage central' },
    { code: 'archives.archive_central', category: 'Archives', description: 'Acter le versement d’un document dans les archives centrales' },
    { code: 'archives.share', category: 'Archives', description: 'Partager un document archivé avec un autre service' },
    { code: 'archives.unarchive', category: 'Archives', description: 'Désarchiver un document (Restaurer dans le circuit actif)' },
    { code: 'archives.manage_categories', category: 'Archives', description: 'Gérer les catégories d’archivage du service' },

    { code: 'incoming_mail.create', category: 'Courriers Entrants', description: 'Créer un courrier entrant' },
    { code: 'incoming_mail.read', category: 'Courriers Entrants', description: 'Lire les courriers entrants' },
    { code: 'incoming_mail.update', category: 'Courriers Entrants', description: 'Mettre à jour les courriers entrants' },

    { code: 'outgoing_mail.create', category: 'Courriers Sortants', description: 'Créer un courrier sortant' },
    { code: 'outgoing_mail.read', category: 'Courriers Sortants', description: 'Lire les courriers sortants' },
    { code: 'outgoing_mail.validate', category: 'Courriers Sortants', description: 'Valider un courrier sortant' },
    { code: 'outgoing_mail.send', category: 'Courriers Sortants', description: 'Expédier un courrier sortant' },

    { code: 'mission.create', category: 'Ordres de Mission', description: 'Créer un ordre de mission' },
    { code: 'mission.read', category: 'Ordres de Mission', description: 'Consulter un ordre de mission' },
    { code: 'mission.update', category: 'Ordres de Mission', description: 'Modifier un ordre de mission' },
    { code: 'mission.validate', category: 'Ordres de Mission', description: 'Valider un ordre de mission' },
    { code: 'mission.sign', category: 'Ordres de Mission', description: 'Signer numériquement un ordre de mission' },
    { code: 'mission.reject', category: 'Ordres de Mission', description: 'Rejeter un ordre de mission' },

    { code: 'mission_orders.create', category: 'Ordres de Mission', description: 'Créer un ordre de mission (Secrétariat Central)' },
    { code: 'mission_orders.view', category: 'Ordres de Mission', description: 'Consulter les ordres de mission' },
    { code: 'mission_orders.edit', category: 'Ordres de Mission', description: 'Editer un ordre de mission' },
    { code: 'mission_orders.sign', category: 'Ordres de Mission', description: 'Signer un ordre de mission' },
    { code: 'mission_orders.archive', category: 'Ordres de Mission', description: 'Archiver un ordre de mission (Secrétariat Central)' },
    { code: 'mission_order.print', category: 'Ordres de Mission', description: 'Imprimer / Réimprimer un ordre de mission' },
    { code: 'mission_order.deliver', category: 'Ordres de Mission', description: 'Remettre un ordre de mission au demandeur' },

    { code: 'personnel.view', category: 'Gestion Personnel', description: 'Consulter le répertoire du personnel' },
    { code: 'personnel.create', category: 'Gestion Personnel', description: 'Ajouter un membre du personnel' },
    { code: 'personnel.edit', category: 'Gestion Personnel', description: 'Modifier la fiche du personnel' },
    { code: 'personnel.deactivate', category: 'Gestion Personnel', description: 'Désactiver un membre du personnel' },
    { code: 'personnel.view_mission_history', category: 'Gestion Personnel', description: 'Consulter l’historique des ordres de mission d’un agent' },

    { code: 'templates.manage', category: 'Administration', description: 'Gérer et personnaliser les modèles de documents' },
    { code: 'templates.view', category: 'Administration', description: 'Consulter les modèles de documents' },
    { code: 'templates.create', category: 'Administration', description: 'Créer un nouveau modèle de document' },
    { code: 'templates.edit', category: 'Administration', description: 'Modifier un modèle de document' },
    { code: 'templates.delete', category: 'Administration', description: 'Supprimer un modèle non utilisé' },
    { code: 'templates.set_default', category: 'Administration', description: 'Définir un modèle par défaut' },
    { code: 'templates.manage_versions', category: 'Administration', description: 'Gérer les versions des modèles' },

    { code: 'signatures.manage', category: 'Administration', description: 'Gérer les signatures électroniques des responsables' },
    { code: 'signatures.view', category: 'Administration', description: 'Consulter les signatures électroniques' },
    { code: 'signatures.create', category: 'Administration', description: 'Enregistrer une nouvelle signature électronique' },
    { code: 'signatures.edit', category: 'Administration', description: 'Modifier une signature électronique' },
    { code: 'signatures.activate', category: 'Administration', description: 'Activer une signature électronique' },
    { code: 'signatures.deactivate', category: 'Administration', description: 'Désactiver une signature électronique' },
    { code: 'signatures.delete', category: 'Administration', description: 'Supprimer une signature non utilisée' },
    { code: 'signatures.manage_versions', category: 'Administration', description: 'Gérer les versions des signatures' },
    { code: 'institution.manage', category: 'Administration', description: 'Gérer l’identité visuelle et les informations de l’Université' },
    { code: 'external_missionaries.manage', category: 'Missionnaires Externes', description: 'Gérer les missionnaires externes (enregistrer arrivée, départ, visa)' },
    { code: 'external_missionaries.view', category: 'Missionnaires Externes', description: 'Consulter le registre des missionnaires externes' },

    { code: 'documents.accept', category: 'Documents', description: 'Accepter un document dans le circuit' },
    { code: 'documents.reject', category: 'Documents', description: 'Rejeter un document avec motif obligatoire' },

    { code: 'users.create', category: 'Gestion Utilisateurs', description: 'Créer des utilisateurs' },
    { code: 'users.read', category: 'Gestion Utilisateurs', description: 'Voir les utilisateurs' },
    { code: 'users.update', category: 'Gestion Utilisateurs', description: 'Modifier les utilisateurs' },
    { code: 'users.disable', category: 'Gestion Utilisateurs', description: 'Activer/Désactiver des utilisateurs' },
    { code: 'users.manage_service_heads', category: 'Gestion Utilisateurs', description: 'Gérer les informations et réaffectations des chefs de service' },

    { code: 'services.create', category: 'Gestion Services', description: 'Créer des services' },
    { code: 'services.read', category: 'Gestion Services', description: 'Consulter la liste des services' },
    { code: 'services.update', category: 'Gestion Services', description: 'Modifier un service' },
    { code: 'services.disable', category: 'Gestion Services', description: 'Désactiver un service' },

    { code: 'roles.create', category: 'Sécurité & RBAC', description: 'Créer de nouveaux rôles' },
    { code: 'roles.update', category: 'Sécurité & RBAC', description: 'Modifier des rôles' },
    { code: 'permissions.manage', category: 'Sécurité & RBAC', description: 'Gérer la matrice de permissions' },

    { code: 'reports.read', category: 'Statistiques', description: 'Voir les rapports et statistiques' },
    { code: 'audit.read', category: 'Audit', description: 'Consulter le journal d’audit' },
    { code: 'settings.manage', category: 'Paramètres', description: 'Gérer les configurations du système' },

    // Rendez-vous & Agenda
    { code: 'appointments.view', category: 'Rendez-vous & Agenda', description: 'Consulter les rendez-vous' },
    { code: 'appointments.create', category: 'Rendez-vous & Agenda', description: 'Demander un rendez-vous' },
    { code: 'appointments.update', category: 'Rendez-vous & Agenda', description: 'Modifier un rendez-vous' },
    { code: 'appointments.cancel', category: 'Rendez-vous & Agenda', description: 'Annuler un rendez-vous' },
    { code: 'appointments.accept', category: 'Rendez-vous & Agenda', description: 'Accepter une demande de rendez-vous' },
    { code: 'appointments.reject', category: 'Rendez-vous & Agenda', description: 'Refuser une demande de rendez-vous' },
    { code: 'appointments.reschedule', category: 'Rendez-vous & Agenda', description: 'Proposer un autre créneau' },
    { code: 'appointments.manage_availability', category: 'Rendez-vous & Agenda', description: 'Gérer ses disponibilités' },
    { code: 'appointments.manage_calendar', category: 'Rendez-vous & Agenda', description: 'Gérer les indisponibilités et calendrier' },
    { code: 'appointments.manage_settings', category: 'Rendez-vous & Agenda', description: 'Gérer la configuration globale des RDV' },
    { code: 'appointments.view_history', category: 'Rendez-vous & Agenda', description: 'Voir l’historique des rendez-vous' },
    { code: 'appointments.check_in', category: 'Rendez-vous & Agenda', description: 'Scanner et marquer l’arrivée d’un demandeur' },
    { code: 'appointments.complete', category: 'Rendez-vous & Agenda', description: 'Clôturer un rendez-vous' },
    { code: 'appointments.receive', category: 'Rendez-vous & Agenda', description: 'Recevoir des demandes de rendez-vous' },

    // Dispatching & Diffusion Administrative
    { code: 'dispatching.view', category: 'Dispatching & Diffusion', description: 'Consulter les diffusions et son espace de réception' },
    { code: 'dispatching.create', category: 'Dispatching & Diffusion', description: 'Initier et préparer une diffusion administrative' },
    { code: 'dispatching.send', category: 'Dispatching & Diffusion', description: 'Diffuser un document à tous les services ou une sélection' },
    { code: 'dispatching.tracking', category: 'Dispatching & Diffusion', description: 'Suivre l’émargement, relancer et superviser les diffusions' },
    { code: 'dispatching.acknowledge', category: 'Dispatching & Diffusion', description: 'Valider la prise de connaissance obligatoire pour son service' },
    { code: 'dispatching.action', category: 'Dispatching & Diffusion', description: 'Exécuter et clôturer l’action requise' },
    { code: 'dispatching.export', category: 'Dispatching & Diffusion', description: 'Exporter les rapports et preuves de diffusion PDF/Excel' }
  ],

  // Public Tracking Display Statuses
  TRACKING_STATUSES: {
    RECEIVED: { label: 'DOCUMENT REÇU', emoji: '📥', color: 'blue' },
    REGISTERED: { label: 'DOCUMENT ENREGISTRÉ', emoji: '📝', color: 'indigo' },
    IN_PROGRESS: { label: 'EN COURS DE TRAITEMENT', emoji: '🔄', color: 'amber' },
    UNDER_REVIEW: { label: 'EN COURS D’EXAMEN', emoji: '👤', color: 'sky' },
    PENDING_DECISION: { label: 'EN ATTENTE DE DÉCISION', emoji: '⏳', color: 'orange' },
    PENDING_SIGNATURE: { label: 'EN ATTENTE DE SIGNATURE', emoji: '✍️', color: 'purple' },
    ACCEPTED: { label: 'ACCEPTÉ', emoji: '✅', color: 'emerald' },
    REJECTED: { label: 'REJETÉ', emoji: '❌', color: 'red' },
    CORRECTION_REQUESTED: { label: 'CORRECTION DEMANDÉE', emoji: '↩', color: 'rose' },
    COMPLETED: { label: 'TRAITEMENT TERMINÉ', emoji: '📤', color: 'teal' },
    ARCHIVED: { label: 'ARCHIVÉ', emoji: '📁', color: 'slate' }
  }
};
