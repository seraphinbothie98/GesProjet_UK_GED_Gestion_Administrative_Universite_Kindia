const path = require('path');
const jwt = require('jsonwebtoken');

// Centralized ONLYOFFICE configuration
const ONLYOFFICE_CONFIG = {
  // Document Server Public URL accessible by browser (e.g., http://localhost:80 or https://office.ged.universite.edu)
  DOCUMENT_SERVER_URL: process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || 'http://localhost:80',

  // Internal URL of ONLYOFFICE Document Server accessible by UK-GED backend
  INTERNAL_SERVER_URL: process.env.ONLYOFFICE_INTERNAL_SERVER_URL || process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || 'http://localhost:80',
  
  // JWT Secret key (must match ONLYOFFICE Document Server container environment)
  JWT_SECRET: process.env.ONLYOFFICE_JWT_SECRET || 'uk_ged_onlyoffice_dev_secret',
  
  // JWT Header expected by ONLYOFFICE
  JWT_HEADER: process.env.ONLYOFFICE_JWT_HEADER || 'Authorization',
  
  // URL of UK-GED backend accessible by ONLYOFFICE Document Server (container-to-host or container-to-container)
  BACKEND_URL: process.env.ONLYOFFICE_CALLBACK_URL || process.env.ONLYOFFICE_BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ged.universite.edu' : 'http://host.docker.internal:5000'),
  
  // Tenant default identifier
  TENANT_ID: 'UNIVERSITE_KINDIA'
};

/**
 * Generate a secure short-lived token for ONLYOFFICE to fetch the document file
 */
function generateDocumentAccessToken(templateId, versionId, userId, tenantId = 'UNIVERSITE_KINDIA') {
  return jwt.sign(
    {
      templateId,
      versionId: versionId || 'current',
      userId,
      tenantId,
      purpose: 'ONLYOFFICE_DOC_ACCESS'
    },
    ONLYOFFICE_CONFIG.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

/**
 * Generate a secure callback token for ONLYOFFICE save requests
 */
function generateCallbackToken(templateId, userId, tenantId = 'UNIVERSITE_KINDIA') {
  return jwt.sign(
    {
      templateId,
      userId,
      tenantId,
      purpose: 'ONLYOFFICE_CALLBACK'
    },
    ONLYOFFICE_CONFIG.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

/**
 * Generate the complete ONLYOFFICE Docs configuration object
 */
function buildOnlyofficeDocEditorConfig({
  template,
  version,
  user,
  mode = 'edit',
  tenantId = 'UNIVERSITE_KINDIA'
}) {
  const templateId = template.id;
  const versionNum = version?.version_number || version?.version || template.version || 1;
  const versionId = version?.id || 'current';
  const fileExt = (version?.file_type || template.format || 'docx').toLowerCase();
  
  // Unique document key for ONLYOFFICE caching: format UKGED_TPL_<id>_V<ver>_<timestamp>
  const fileTimestamp = version?.created_at ? new Date(version.created_at).getTime() : (template.updated_at ? new Date(template.updated_at).getTime() : Date.now());
  const documentKey = `UKGED_TPL_${templateId}_V${versionNum}_${fileTimestamp}`;

  const docAccessToken = generateDocumentAccessToken(templateId, versionId, user?.id, tenantId);
  const callbackToken = generateCallbackToken(templateId, user?.id, tenantId);

  const documentUrl = `${ONLYOFFICE_CONFIG.BACKEND_URL}/api/templates/${templateId}/versions/${versionId}/onlyoffice-file?token=${encodeURIComponent(docAccessToken)}`;
  const callbackUrl = `${ONLYOFFICE_CONFIG.BACKEND_URL}/api/templates/${templateId}/onlyoffice/callback?token=${encodeURIComponent(callbackToken)}`;

  const config = {
    document: {
      fileType: fileExt,
      key: documentKey,
      title: `${template.name}_v${versionNum}.${fileExt}`,
      url: documentUrl,
      permissions: {
        download: true,
        edit: mode === 'edit',
        print: true,
        review: false,
        comment: false,
        fillForms: true,
        modifyFilter: true,
        modifyContentControl: true
      }
    },
    documentType: 'word',
    editorConfig: {
      mode: mode,
      lang: 'fr',
      callbackUrl: callbackUrl,
      user: {
        id: user ? `user_${user.id}` : 'user_anonymous',
        name: user ? `${user.first_name || ''} ${user.last_name || user.username || 'Administrateur'}`.trim() : 'Administrateur UK-GED'
      },
      customization: {
        autosave: false,
        forcesave: true,
        comments: false,
        feedback: false,
        help: false,
        hideRightMenu: false,
        toolbarHideFileName: false,
        toolbarNoTabs: false,
        logo: {
          image: `${ONLYOFFICE_CONFIG.BACKEND_URL}/uploads/logos/logo_kindia.png`,
          imageEmbedded: `${ONLYOFFICE_CONFIG.BACKEND_URL}/uploads/logos/logo_kindia.png`,
          url: 'http://localhost:3000'
        },
        customer: {
          name: 'Université de Kindia',
          address: 'Kindia, République de Guinée',
          mail: 'contact@univ-kindia.edu.gn',
          www: 'https://univ-kindia.edu.gn'
        },
        uiTheme: 'theme-classic-light'
      }
    }
  };

  // If JWT is configured, sign the whole config for ONLYOFFICE Document Server
  if (ONLYOFFICE_CONFIG.JWT_SECRET) {
    config.token = jwt.sign(config, ONLYOFFICE_CONFIG.JWT_SECRET);
  }

  return {
    config,
    docServerUrl: ONLYOFFICE_CONFIG.DOCUMENT_SERVER_URL,
    documentKey,
    documentUrl,
    callbackUrl
  };
}

module.exports = {
  ONLYOFFICE_CONFIG,
  generateDocumentAccessToken,
  generateCallbackToken,
  buildOnlyofficeDocEditorConfig
};
