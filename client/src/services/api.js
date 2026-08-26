const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('uk_ged_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export const api = {
  // Auth
  async login(identity, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.user;
  },

  // Documents
  async getDocuments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/documents?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentsToSign() {
    const res = await fetch(`${API_BASE}/documents/to-sign`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentDetail(id) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocument(id) {
    return this.getDocumentDetail(id);
  },

  async previewReference(type = 'INCOMING_MAIL') {
    const res = await fetch(`${API_BASE}/documents/preview-reference?type=${encodeURIComponent(type)}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération de la référence.');
    return data.reference;
  },

  async downloadDocumentOrAttachment(docId, defaultFilename = 'document.pdf') {
    const token = localStorage.getItem('uk_ged_token') || '';
    const url = `${API_BASE}/documents/${docId}/view?token=${encodeURIComponent(token)}`;
    const headers = getAuthHeader();
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Impossible de télécharger le document.');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },

  async createIncomingMail(formData) {
    const res = await fetch(`${API_BASE}/documents/incoming`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createOutgoingMail(formData) {
    const res = await fetch(`${API_BASE}/documents/outgoing`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createAdministrativeDocument(formData) {
    const isFormData = formData instanceof FormData;
    const res = await fetch(`${API_BASE}/documents/administrative`, {
      method: 'POST',
      headers: isFormData ? getAuthHeader() : { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: isFormData ? formData : JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création document administratif');
    return data;
  },

  async archiveServiceDocument(formData) {
    const res = await fetch(`${API_BASE}/documents/service-archive`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async diffuseDocument(id, payload) {
    const res = await fetch(`${API_BASE}/documents/${id}/diffuse`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async archiveDocument(id) {
    const res = await fetch(`${API_BASE}/documents/${id}/archive`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async archiveDirectDocument(id) {
    const res = await fetch(`${API_BASE}/documents/${id}/archive-direct`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentTypes() {
    const res = await fetch(`${API_BASE}/document-types`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateDocumentTypeConfig(code, allow_direct_archive) {
    const res = await fetch(`${API_BASE}/document-types/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_direct_archive })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Workflows
  async orientDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/orient`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async sgOrientDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/sg-orient`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async transmitDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/transmit`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createDocument(formData) {
    const res = await fetch(`${API_BASE}/documents/administrative`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createAdministrativeDocument(formData) {
    const res = await fetch(`${API_BASE}/documents/administrative`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async returnDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/return`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async signAndReturnDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/sign-and-return`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentCircuit(id) {
    const res = await fetch(`${API_BASE}/workflow/circuit/${id}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Mission Orders
  async getMissionOrders() {
    const res = await fetch(`${API_BASE}/missions`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getMyMissionRequests() {
    const res = await fetch(`${API_BASE}/missions/my-requests`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async submitMissionRequest(payload) {
    const res = await fetch(`${API_BASE}/missions/request`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getPendingMissionsToSign() {
    const res = await fetch(`${API_BASE}/missions/to-sign`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createMissionOrder(payload) {
    const res = await fetch(`${API_BASE}/missions`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async signMissionOrder(id) {
    const res = await fetch(`${API_BASE}/missions/${id}/sign`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async requestMissionCorrection(id, notes) {
    const res = await fetch(`${API_BASE}/missions/${id}/request-correction`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async rejectMissionOrder(id, reason) {
    const res = await fetch(`${API_BASE}/missions/${id}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getMySignature() {
    const res = await fetch(`${API_BASE}/signatures/my-signature`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getSignatures() {
    const res = await fetch(`${API_BASE}/signatures`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Services & Users Admin
  async getServices() {
    const res = await fetch(`${API_BASE}/services`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getServiceHierarchy() {
    const res = await fetch(`${API_BASE}/services/hierarchy`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getServiceDetails(id) {
    const res = await fetch(`${API_BASE}/services/${id}/details`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async assignServiceHead(serviceId, payload) {
    const res = await fetch(`${API_BASE}/services/${serviceId}/assign-head`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async uploadServiceStamp(serviceId, formData) {
    const res = await fetch(`${API_BASE}/services/${serviceId}/stamp`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getAvailableTemplates() {
    const res = await fetch(`${API_BASE}/templates/available-for-user`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentTypes() {
    const res = await fetch(`${API_BASE}/documents/types`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getServiceSpace(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/documents/service-space?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentVersions(docId) {
    const res = await fetch(`${API_BASE}/documents/${docId}/versions`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateDraftDocument(docId, payload) {
    const res = await fetch(`${API_BASE}/documents/${docId}/draft`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async resubmitDocument(docId, formData) {
    const res = await fetch(`${API_BASE}/documents/${docId}/resubmit`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async returnDocumentForCorrection(payload) {
    const res = await fetch(`${API_BASE}/workflow/return-for-correction`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getWorkflowRules() {
    const res = await fetch(`${API_BASE}/workflow/rules`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getArchives(params = {}) {
    let query = '';
    if (typeof params === 'object' && params !== null) {
      query = new URLSearchParams(params).toString();
    } else if (params) {
      query = `service_id=${encodeURIComponent(params)}`;
    }
    const res = await fetch(`${API_BASE}/documents/archives${query ? `?${query}` : ''}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async classifyDocument(docId, payload) {
    const res = await fetch(`${API_BASE}/documents/${docId}/classify`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Archive Categories Management API
  async getArchiveCategories(params = {}) {
    let query = '';
    if (typeof params === 'object' && params !== null) {
      query = new URLSearchParams(params).toString();
    } else if (params) {
      query = `service_id=${encodeURIComponent(params)}`;
    }
    const res = await fetch(`${API_BASE}/archive-categories${query ? `?${query}` : ''}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createArchiveCategory(payload) {
    const res = await fetch(`${API_BASE}/archive-categories`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateArchiveCategory(id, payload) {
    const res = await fetch(`${API_BASE}/archive-categories/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteArchiveCategory(id) {
    const res = await fetch(`${API_BASE}/archive-categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async moveCategoryDocuments(id, payload) {
    const res = await fetch(`${API_BASE}/archive-categories/${id}/move-documents`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getServicesArchiveSummary() {
    const res = await fetch(`${API_BASE}/archive-categories/admin/services-summary`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Service Document Settings & Customization
  async getServiceDocumentSettings(serviceId = null) {
    const url = serviceId 
      ? `${API_BASE}/service-settings/document-settings?service_id=${serviceId}`
      : `${API_BASE}/service-settings/document-settings`;
    const res = await fetch(url, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateServiceDocumentSettings(payload) {
    const res = await fetch(`${API_BASE}/service-settings/document-settings`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async previewServiceReference(payload) {
    const res = await fetch(`${API_BASE}/service-settings/preview-reference`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getServiceSettingsHistory(serviceId = null) {
    const url = serviceId 
      ? `${API_BASE}/service-settings/history?service_id=${serviceId}`
      : `${API_BASE}/service-settings/history`;
    const res = await fetch(url, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async archiveInService(docId, payload = {}) {
    const res = await fetch(`${API_BASE}/documents/${docId}/archive-service`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async transmitToCentralArchive(docId, payload = {}) {
    const res = await fetch(`${API_BASE}/documents/${docId}/transmit-to-central-archive`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async archiveInCentral(docId) {
    const res = await fetch(`${API_BASE}/documents/${docId}/archive-central`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async shareArchive(docId, payload = {}) {
    const res = await fetch(`${API_BASE}/documents/${docId}/share-archive`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createWorkflowRule(payload) {
    const res = await fetch(`${API_BASE}/workflow/rules`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getUsers() {
    const res = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getRoles() {
    const res = await fetch(`${API_BASE}/roles`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createService(payload) {
    const res = await fetch(`${API_BASE}/services`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateService(id, payload) {
    const res = await fetch(`${API_BASE}/services/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createUser(payload) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async toggleUserStatus(id, status) {
    const res = await fetch(`${API_BASE}/users/${id}/status`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteUser(id) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression de l’utilisateur.');
    return data;
  },

  // Notifications & Dashboard & Audit
  async getNotifications() {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async markNotificationRead(id) {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    return res.json();
  },

  async getDashboard() {
    const res = await fetch(`${API_BASE}/reports/dashboard`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/audit`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async acceptDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/accept`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async rejectDocument(payload) {
    const res = await fetch(`${API_BASE}/workflow/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateUser(id, payload) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Public Tracking API
  async trackDocument(reference) {
    const res = await fetch(`${API_BASE}/tracking/document/${encodeURIComponent(reference)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Document introuvable.');
    return data;
  },

  async scanQRCode(payload) {
    const res = await fetch(`${API_BASE}/tracking/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'QR Code invalide.');
    return data;
  },

  async verifyDocument(reference) {
    const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(reference)}`);
    const data = await res.json();
    return data;
  },

  // Rendez-vous & Agenda API
  async getAppointmentResponsibles() {
    const res = await fetch(`${API_BASE}/appointments/responsibles`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async verifyAppointmentDocument(reference) {
    const res = await fetch(`${API_BASE}/appointments/verify-document/${encodeURIComponent(reference)}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    return data;
  },

  async createAppointment(payload) {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getAppointments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/appointments?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getAppointmentDetail(id) {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async acceptAppointment(id) {
    const res = await fetch(`${API_BASE}/appointments/${id}/accept`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async rejectAppointment(id, payload) {
    const res = await fetch(`${API_BASE}/appointments/${id}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async rescheduleAppointment(id, payload) {
    const res = await fetch(`${API_BASE}/appointments/${id}/reschedule`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async respondRescheduleAppointment(id, payload) {
    const res = await fetch(`${API_BASE}/appointments/${id}/respond-reschedule`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async cancelAppointment(id, payload) {
    const res = await fetch(`${API_BASE}/appointments/${id}/cancel`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async checkInAppointment(id) {
    const res = await fetch(`${API_BASE}/appointments/${id}/check-in`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async completeAppointment(id, payload = {}) {
    const res = await fetch(`${API_BASE}/appointments/${id}/complete`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getAppointmentCalendar(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/appointments/calendar?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getAppointmentStats() {
    const res = await fetch(`${API_BASE}/appointments/stats`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getPublicAppointmentResponsibles() {
    const res = await fetch(`${API_BASE}/appointments/public/responsibles`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createPublicAppointment(payload) {
    const res = await fetch(`${API_BASE}/appointments/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async scanAppointmentQR(payload) {
    const res = await fetch(`${API_BASE}/appointments/scan-qr`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async toggleUserReceiveAppointments(id, can_receive) {
    const res = await fetch(`${API_BASE}/appointments/users/${id}/toggle-receive`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ can_receive })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getCalendarBlocks() {
    const res = await fetch(`${API_BASE}/appointments/blocks`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createCalendarBlock(payload) {
    const res = await fetch(`${API_BASE}/appointments/blocks`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteCalendarBlock(id) {
    const res = await fetch(`${API_BASE}/appointments/blocks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getInstitutionSettings() {
    const res = await fetch(`${API_BASE}/settings/institution`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateInstitutionSettings(payload) {
    const res = await fetch(`${API_BASE}/settings/institution`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async uploadUniversityLogo(formData) {
    const res = await fetch(`${API_BASE}/settings/upload-logo`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async previewReference(payload) {
    const type = typeof payload === 'string' ? payload : (payload && payload.type ? payload.type : 'INCOMING_MAIL');
    const res = await fetch(`${API_BASE}/documents/preview-reference?type=${encodeURIComponent(type)}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération de la référence.');
    return data.reference || data;
  },

  // Document Templates Customization
  async getDocumentTemplates() {
    const res = await fetch(`${API_BASE}/templates`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentTemplates() {
    const res = await fetch(`${API_BASE}/templates`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getDocumentTemplate(code) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createDocumentTemplate(payload) {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async uploadTemplateFile(code, formData) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}/upload`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async saveTemplateFields(code, fields) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}/fields`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async toggleTemplateStatus(code) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}/toggle-status`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateDocumentTemplate(code, payload) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createSoitTransmis(formData) {
    const res = await fetch(`${API_BASE}/documents/soit-transmis`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Electronic Signatures Management
  async getElectronicSignatures() {
    const res = await fetch(`${API_BASE}/signatures`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createElectronicSignature(formData) {
    const res = await fetch(`${API_BASE}/signatures`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateElectronicSignature(id, payload) {
    const res = await fetch(`${API_BASE}/signatures/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async toggleElectronicSignature(id) {
    const res = await fetch(`${API_BASE}/signatures/${id}/toggle`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteElectronicSignature(id) {
    const res = await fetch(`${API_BASE}/signatures/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async setDefaultDocumentTemplate(id, force = false) {
    const res = await fetch(`${API_BASE}/templates/${id}/set-default`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ force })
    });
    const data = await res.json();
    if (!res.ok && res.status !== 409) throw new Error(data.error);
    return data;
  },

  async restoreTemplateVersion(id, versionId) {
    const res = await fetch(`${API_BASE}/templates/${id}/versions/${versionId}/restore`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteDocumentTemplate(id) {
    const res = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async customizeDocumentTemplate(id, payload) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(id)}/customize`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { error: text || 'Erreur inattendue du serveur' };
    }
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’enregistrement de la personnalisation du modèle.');
    return data;
  },

  async customizeTemplate(id, payload) {
    return this.customizeDocumentTemplate(id, payload);
  },

  async duplicateDocumentTemplate(id) {
    const res = await fetch(`${API_BASE}/templates/${id}/duplicate`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async uploadTemplateLogo(id, formData) {
    const res = await fetch(`${API_BASE}/templates/${id}/logo`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getTestPreviewPDF(id) {
    const res = await fetch(`${API_BASE}/templates/${id}/test-preview`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async downloadTemplateDocx(id) {
    const res = await fetch(`${API_BASE}/templates/${id}/download-docx`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Erreur lors du téléchargement du fichier Word DOCX.');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `modele_word_${id}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  async generateTemplateDocx(id, dataMap) {
    const res = await fetch(`${API_BASE}/templates/${id}/generate-docx`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(dataMap)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération du document Word.');
    return data;
  },

  async uploadTemplateDocxRevision(id, formData) {
    const res = await fetch(`${API_BASE}/templates/${id}/upload-docx-revision`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’importation de la révision Word.');
    return data;
  },

  getTemplateVersionFileUrl(templateId, versionId = 'current') {
    return `${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/file`;
  },

  async fetchTemplateVersionBlob(templateId, versionId = 'current') {
    const url = this.getTemplateVersionFileUrl(templateId, versionId);
    const res = await fetch(url, { headers: getAuthHeader() });
    if (!res.ok) {
      let errText = 'Impossible de charger le fichier de prévisualisation.';
      try {
        const errJson = await res.json();
        if (errJson.error) errText = errJson.error;
      } catch (e) {}
      throw new Error(errText);
    }
    return await res.blob();
  },

  async downloadTemplateVersionFile(templateId, versionId = 'current') {
    const url = `${this.getTemplateVersionFileUrl(templateId, versionId)}?download=1`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (!res.ok) {
      throw new Error('Erreur lors du téléchargement du fichier.');
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `template_${templateId}_v${versionId}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  async getTemplateVersionODTPreview(templateId, versionId = 'current') {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/preview-odt`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de rendu du fichier ODT.');
    return data;
  },

  async getTemplateVersionHTML(templateId, versionId = 'current') {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/html`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’extraction du contenu éditable.');
    return data;
  },

  async getTemplateVersionFile(templateId, versionId = 'current') {
    const detailData = await this.getDocumentTemplate(templateId);
    const template = detailData.template;
    const versions = detailData.versions || [];
    
    let selectedVersion = null;
    if (versionId && versionId !== 'current' && versionId !== 'latest') {
      selectedVersion = versions.find(v => String(v.id) === String(versionId) || String(v.version_number) === String(versionId));
    }

    const versionNum = selectedVersion?.version_number || selectedVersion?.version || template?.version || 1;
    const format = (selectedVersion?.file_type || template?.format || 'DOCX').toUpperCase();
    const fileUrl = this.getTemplateVersionFileUrl(templateId, selectedVersion?.id || 'current');

    return {
      template,
      version: selectedVersion,
      templateId: template?.id || templateId,
      templateCode: template?.code || templateId,
      templateName: template?.name || 'Modèle Officiel',
      versionId: selectedVersion?.id || 'current',
      versionNumber: versionNum,
      format,
      fileUrl,
      fields: detailData.fields || [],
      allVersions: versions
    };
  },

  // Personnel Directory (Rule 1 & 14)
  async getStaff(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/staff?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async checkDuplicateStaff(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/staff/check-duplicate?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getStaffDetail(id) {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createStaff(payload) {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateStaff(id, payload) {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async toggleStaffStatus(id) {
    const res = await fetch(`${API_BASE}/staff/${id}/toggle-status`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteStaff(id, payload = {}) {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression.');
    return data;
  },

  // Mission Delivery & Rejection Workflow
  async rejectMissionOrder(id, reason) {
    const res = await fetch(`${API_BASE}/missions/${id}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async requestMissionCorrection(id, notes) {
    const res = await fetch(`${API_BASE}/missions/${id}/request-correction`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async printMissionOrder(id, reason = '') {
    const res = await fetch(`${API_BASE}/missions/${id}/print`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deliverMissionOrder(id, payload = {}) {
    const res = await fetch(`${API_BASE}/missions/${id}/deliver`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Advanced Admin: Trash, Restore, Permanent Delete & DB Maintenance
  async getTrashDocuments() {
    const res = await fetch(`${API_BASE}/documents/trash`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async moveToTrash(id, reason) {
    const res = await fetch(`${API_BASE}/documents/${id}/trash`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async restoreFromTrash(id) {
    const res = await fetch(`${API_BASE}/documents/${id}/restore`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async permanentDeleteDocument(id, reason, confirmText) {
    const res = await fetch(`${API_BASE}/documents/${id}/permanent`, {
      method: 'DELETE',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, confirmText })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getMaintenanceStatus() {
    const res = await fetch(`${API_BASE}/admin/maintenance/status`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async downloadDatabaseBackup() {
    const res = await fetch(`${API_BASE}/admin/maintenance/backup`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors du téléchargement de la sauvegarde.');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uk_ged_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  },

  async cleanupTestData(payload) {
    const res = await fetch(`${API_BASE}/admin/maintenance/cleanup`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Missionnaires Externes
  async getExternalMissionaries(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/external-missionaries?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getExternalMissionariesToSign() {
    const res = await fetch(`${API_BASE}/external-missionaries/to-sign`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getExternalMissionaryById(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getExternalMissionaryHistory(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/history`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async createExternalMissionary(formData) {
    const res = await fetch(`${API_BASE}/external-missionaries`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async transmitExternalMissionaryToSG(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/transmit-to-sg`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async signExternalMissionary(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/sign`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async rejectExternalMissionary(id, rejection_reason) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async printExternalMissionary(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/print`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deliverExternalMissionary(id, payload = {}) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/deliver`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async archiveExternalMissionary(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/archive`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async recordExternalMissionaryArrival(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/check-in`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async recordExternalMissionaryDeparture(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}/check-out`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async deleteExternalMissionary(id) {
    const res = await fetch(`${API_BASE}/external-missionaries/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Demandes d'Ordres de Mission (Interne / Public)
  async submitPublicMissionRequest(formData) {
    const res = await fetch(`${API_BASE}/mission-requests/public`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async trackPublicMissionRequest(payload) {
    const res = await fetch(`${API_BASE}/mission-requests/track-public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async submitMissionRequest(formData) {
    const res = await fetch(`${API_BASE}/mission-requests`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getMissionRequests(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/mission-requests?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getMissionRequestById(id) {
    const res = await fetch(`${API_BASE}/mission-requests/${id}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async requestMissionComplement(id, complement_request_notes) {
    const res = await fetch(`${API_BASE}/mission-requests/${id}/request-complement`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ complement_request_notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async acceptMissionRequest(id) {
    const res = await fetch(`${API_BASE}/mission-requests/${id}/accept`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async rejectMissionRequest(id, rejection_reason) {
    const res = await fetch(`${API_BASE}/mission-requests/${id}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async generateOfficialMissionOrder(id) {
    const res = await fetch(`${API_BASE}/mission-requests/${id}/generate-official-om`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async transmitMissionRequestToSG(id) {
    const res = await fetch(`${API_BASE}/mission-requests/${id}/transmit-to-sg`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ==========================================
  // MODULE DE DISPATCHING & DIFFUSION ADMINISTRATIVE
  // ==========================================
  async createDispatch(payload) {
    const res = await fetch(`${API_BASE}/dispatches`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la création de la diffusion');
    return data;
  },

  async getDispatches(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/dispatches${query ? `?${query}` : ''}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération des diffusions');
    return data;
  },

  async getDispatchDetail(id) {
    const res = await fetch(`${API_BASE}/dispatches/${id}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement de la diffusion');
    return data;
  },

  async getMyServiceDispatchInbox(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/dispatches/inbox/my-service${query ? `?${query}` : ''}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement de la boîte de réception');
    return data;
  },

  async viewDispatchRecipient(recipientId) {
    const res = await fetch(`${API_BASE}/dispatches/recipients/${recipientId}/view`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async acknowledgeDispatch(recipientId) {
    const res = await fetch(`${API_BASE}/dispatches/recipients/${recipientId}/acknowledge`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la prise de connaissance');
    return data;
  },

  async startDispatchAction(recipientId) {
    const res = await fetch(`${API_BASE}/dispatches/recipients/${recipientId}/action/start`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async completeDispatchAction(recipientId, formData) {
    const res = await fetch(`${API_BASE}/dispatches/recipients/${recipientId}/action/complete`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la finalisation de l’action');
    return data;
  },

  async remindDispatch(id) {
    const res = await fetch(`${API_BASE}/dispatches/${id}/remind`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’envoi des rappels');
    return data;
  },

  async downloadDispatchReportPdf(id) {
    const res = await fetch(`${API_BASE}/dispatches/${id}/report-pdf`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Erreur lors du téléchargement du rapport de diffusion.');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Rapport_Diffusion_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  async getDispatchDashboardStats() {
    const res = await fetch(`${API_BASE}/dispatches/stats/dashboard`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur stats dashboard');
    return data;
  },

  // Official Receipts & Verification
  async getReceiptByDocumentId(documentId) {
    const res = await fetch(`${API_BASE}/receipts/document/${documentId}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement du reçu');
    return data;
  },

  async regenerateReceipt(documentId) {
    const res = await fetch(`${API_BASE}/receipts/regenerate/${documentId}`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur régénération reçu');
    return data;
  },

  async verifyDocumentPublic(refOrToken) {
    const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(refOrToken)}`);
    const data = await res.json();
    return data;
  },

  // Document Templates & Word/DOCX Editor API
  async getTemplates(params = {}) {
    return this.getDocumentTemplates(params);
  },

  async getAvailableTemplates() {
    const res = await fetch(`${API_BASE}/templates/available-for-user`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération modèles autorisés');
    return data;
  },

  async extractTemplateFileContent(formData) {
    const res = await fetch(`${API_BASE}/templates/extract-content`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lors de l'extraction du fichier de modèle");
    return data;
  },

  async createCustomTemplate(formDataOrJson) {
    const isFormData = formDataOrJson instanceof FormData;
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: isFormData ? getAuthHeader() : { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création modèle');
    return data;
  },

  async getDocumentTemplates(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/templates?${query}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération modèles');
    return data;
  },

  async getTemplates(params = {}) {
    return this.getDocumentTemplates(params);
  },

  async getDefaultTemplateForType(documentTypeCode) {
    const res = await fetch(`${API_BASE}/templates/default-by-type/${encodeURIComponent(documentTypeCode)}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération modèle par défaut');
    return data;
  },

  async getDocumentTemplate(idOrCode) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(idOrCode)}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement modèle');
    return data;
  },

  async createDocumentTemplate(payload) {
    const isFormData = payload instanceof FormData;
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: isFormData ? getAuthHeader() : { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: isFormData ? payload : JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création modèle');
    return data;
  },

  async updateDocumentTemplate(code, payload) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour modèle');
    return data;
  },

  async customizeTemplate(id, payload) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(id)}/customize`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur personnalisation modèle');
    return data;
  },

  async setDefaultTemplate(id, force = false) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(id)}/set-default`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ force })
    });
    const data = await res.json();
    if (!res.ok && res.status !== 409) throw new Error(data.error || 'Erreur définition modèle par défaut');
    return data;
  },

  async setDefaultDocumentTemplate(id, force = false) {
    return this.setDefaultTemplate(id, force);
  },

  async duplicateTemplate(id) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur duplication modèle');
    return data;
  },

  async duplicateDocumentTemplate(id) {
    return this.duplicateTemplate(id);
  },

  async deleteTemplate(id) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur suppression modèle');
    return data;
  },

  async deleteDocumentTemplate(id) {
    return this.deleteTemplate(id);
  },

  async uploadTemplateFile(id, formData) {
    return this.uploadDocxRevision(id, formData);
  },

  async toggleTemplateStatus(code) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}/toggle-status`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur changement statut');
    return data;
  },

  async saveTemplateFields(code, fields) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(code)}/fields`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement champs');
    return data;
  },

  async fetchTemplateVersionBlob(templateId, versionId = 'current') {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/file`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Impossible de télécharger le fichier de prévisualisation.');
    return await res.blob();
  },

  async getTemplateVersionHTML(templateId, versionId = 'current') {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/html`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur extraction contenu HTML');
    return data;
  },

  async getTemplateVersionFile(templateId, versionId = 'current') {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement version');
    return data;
  },

  async getTemplateVersionODTPreview(templateId, versionId = 'current') {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/preview-odt`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur rendu ODT');
    return data;
  },

  async downloadTemplateVersionFile(templateId, versionId = 'current') {
    const url = `${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/file?download=1`;
    window.open(url, '_blank');
  },

  async restoreTemplateVersion(templateId, versionId) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/restore`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur restauration version');
    return data;
  },

  async uploadDocxRevision(templateId, formData) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/upload-docx-revision`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement révision Word');
    return data;
  },

  async downloadTemplateDocx(templateId) {
    const token = localStorage.getItem('uk_ged_token');
    const url = `${API_BASE}/templates/${encodeURIComponent(templateId)}/download-docx?token=${encodeURIComponent(token || '')}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async testTemplatePreview(templateId) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/test-preview`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur aperçu test');
    return data;
  },

  // ONLYOFFICE Docs Integration API for Templates
  async getTemplateOnlyofficeConfig(templateId, versionId = 'current', mode = 'edit') {
    const query = new URLSearchParams({
      version_id: versionId,
      mode
    });
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/onlyoffice/config?${query.toString()}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération de la configuration ONLYOFFICE Docs.');
    return data;
  },

  async getOnlyofficeConfig(templateId, versionId = 'current', mode = 'edit') {
    return this.getTemplateOnlyofficeConfig(templateId, versionId, mode);
  },

  async manualSaveTemplateOnlyoffice(templateId, payload = {}) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}/onlyoffice/manual-save`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’enregistrement du modèle.');
    return data;
  },

  async manualSaveOnlyoffice(templateId, payload = {}) {
    return this.manualSaveTemplateOnlyoffice(templateId, payload);
  },

  // Official Document / Act Types & Smart Category Suggestions
  async getOfficialDocumentTypes() {
    const res = await fetch(`${API_BASE}/archive-categories/document-types`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement types de documents');
    return data;
  },

  async createOfficialDocumentType(payload) {
    const res = await fetch(`${API_BASE}/archive-categories/document-types`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création type de document');
    return data;
  },

  async suggestArchiveCategory(type, serviceId) {
    const query = new URLSearchParams({ type });
    if (serviceId) query.append('service_id', serviceId);
    const res = await fetch(`${API_BASE}/archive-categories/suggest-category?${query.toString()}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur suggestion catégorie');
    return data;
  },

  // Service Document Settings & Custom Dynamic Fields API (Rules 1-21)
  async getServiceDocumentSettings(serviceId) {
    const query = serviceId ? `?service_id=${encodeURIComponent(serviceId)}` : '';
    const res = await fetch(`${API_BASE}/service-settings/document-settings${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement paramètres documents de service');
    return data;
  },

  async updateServiceDocumentSettings(payload) {
    const res = await fetch(`${API_BASE}/service-settings/document-settings`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement paramètres de service');
    return data;
  },

  async previewServiceReference(payload) {
    const res = await fetch(`${API_BASE}/service-settings/preview-reference`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur calcul aperçu référence');
    return data;
  },

  async getServiceSettingsHistory(serviceId) {
    const query = serviceId ? `?service_id=${encodeURIComponent(serviceId)}` : '';
    const res = await fetch(`${API_BASE}/service-settings/history${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement historique');
    return data;
  },

  async getServiceCustomFields(serviceId) {
    const query = serviceId ? `?service_id=${encodeURIComponent(serviceId)}` : '';
    const res = await fetch(`${API_BASE}/service-settings/custom-fields${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement des champs dynamiques');
    return data;
  },

  async createServiceCustomField(payload) {
    const res = await fetch(`${API_BASE}/service-settings/custom-fields`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création champ dynamique');
    return data;
  },

  async updateServiceCustomField(id, payload) {
    const res = await fetch(`${API_BASE}/service-settings/custom-fields/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour champ dynamique');
    return data;
  },

  async checkServiceCustomFieldUsage(id) {
    const res = await fetch(`${API_BASE}/service-settings/custom-fields/${encodeURIComponent(id)}/usage`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur vérification usage du champ');
    return data;
  },

  async deleteServiceCustomField(id) {
    const res = await fetch(`${API_BASE}/service-settings/custom-fields/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur suppression champ dynamique');
    return data;
  },

  // ==========================================
  // TRANSMISSIONS INTER-SERVICES CONFIDENTIELLES
  // ==========================================
  async createTransmission(payload) {
    const res = await fetch(`${API_BASE}/transmissions`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la transmission du courrier');
    return data;
  },

  async getSentTransmissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/transmissions/sent?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération des courriers envoyés');
    return data;
  },

  async getInboxTransmissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/transmissions/inbox?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération des courriers reçus');
    return data;
  },

  async getReturnedTransmissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/transmissions/returned?${query}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération des courriers retournés');
    return data;
  },

  async getTransmissionDetails(id) {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération des détails de transmission');
    return data;
  },

  async acknowledgeTransmission(id, comments = '') {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’accusé de réception');
    return data;
  },

  async requestTransmissionModification(id, reason, comments = '') {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/request-modification`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, comments })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la demande de modification');
    return data;
  },

  async submitNewTransmissionVersion(id, payload) {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/submit-new-version`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la soumission de la nouvelle version');
    return data;
  },

  async approveTransmission(id, comments = '') {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’approbation du courrier');
    return data;
  },

  async signTransmission(id, payload = {}) {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/sign`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la signature électronique');
    return data;
  },

  async rejectTransmission(id, reason) {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du refus du courrier');
    return data;
  },

  async archiveTransmission(id, payload = {}) {
    const res = await fetch(`${API_BASE}/transmissions/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’archivage du courrier');
    return data;
  },

  // ==========================================
  // GESTION DU COMPTE UTILISATEUR & SÉCURITÉ
  // ==========================================
  async getAccountProfile() {
    const res = await fetch(`${API_BASE}/account/me`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur chargement profil utilisateur');
    return data;
  },

  async updateAccountProfile(payload) {
    const res = await fetch(`${API_BASE}/account/profile`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour profil');
    return data;
  },

  async updateAccountIdentifier(payload) {
    const res = await fetch(`${API_BASE}/account/identifier`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur modification identifiant');
    return data;
  },

  async updateAccountPassword(payload) {
    const res = await fetch(`${API_BASE}/account/password`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur modification mot de passe');
    return data;
  },

  async revokeAccountOtherSessions() {
    const res = await fetch(`${API_BASE}/account/revoke-other-sessions`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur révocation des sessions');
    return data;
  },

  async requestForgotPassword(identity) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur demande de réinitialisation');
    return data;
  },

  async resetPasswordWithToken(token, newPassword) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur réinitialisation du mot de passe');
    return data;
  },

  async forceChangePassword(currentTempPassword, newPassword) {
    const res = await fetch(`${API_BASE}/auth/force-change-password`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_temp_password: currentTempPassword, new_password: newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement nouveau mot de passe');
    return data;
  },

  async adminResetUserPassword(userId, customTempPassword = null) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_temp_password: customTempPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur réinitialisation administrateur');
    return data;
  },

  async adminRevokeUserSessions(userId) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/revoke-sessions`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur révocation sessions utilisateur');
    return data;
  },

  async getUserSecurityInfo(userId) {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/security-info`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération informations de sécurité');
    return data;
  },

  // ==========================================
  // ONLYOFFICE DOCUMENT SERVER INTEGRATION
  // ==========================================
  async getOnlyOfficeConfig(documentId) {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/onlyoffice/config`, {
      headers: getAuthHeader()
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        throw new Error(`Le serveur a retourné une erreur HTTP ${res.status}.`);
      }
      throw new Error(`Réponse inattendue du serveur: ${text.slice(0, 80)}`);
    }
    if (!res.ok) throw new Error(data.error || 'Erreur génération session ONLYOFFICE');
    return data;
  },

  async getOnlyOfficeLockStatus(documentId) {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/onlyoffice/lock-status`, {
      headers: getAuthHeader()
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { locked: false };
    }
    if (!res.ok) throw new Error(data.error || 'Erreur statut verrou ONLYOFFICE');
    return data;
  },

  async unlockOnlyOfficeDocument(documentId) {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/onlyoffice/unlock`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { success: true };
    }
  },

  // ==========================================
  // DOCUMENT TYPES & PERMISSIONS MANAGEMENT
  // ==========================================
  async getCreatableDocumentTypes() {
    const res = await fetch(`${API_BASE}/document-types/creatable`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération types de documents autorisés');
    return data;
  },

  async getDocumentTypes() {
    const res = await fetch(`${API_BASE}/document-types`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération catalogue types de documents');
    return data;
  },

  async getDocumentTypePermissions(code) {
    const res = await fetch(`${API_BASE}/document-types/${encodeURIComponent(code)}/permissions`, {
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur récupération matrice des permissions');
    return data;
  },

  async updateDocumentTypePermissions(code, rules) {
    const res = await fetch(`${API_BASE}/document-types/${encodeURIComponent(code)}/permissions`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour permissions');
    return data;
  },

  async createDocumentType(typeData) {
    const res = await fetch(`${API_BASE}/document-types`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(typeData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création type de document');
    return data;
  },

  async updateDocumentType(code, typeData) {
    const res = await fetch(`${API_BASE}/document-types/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(typeData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour type de document');
    return data;
  },

  async deleteDocumentType(code) {
    const res = await fetch(`${API_BASE}/document-types/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur désactivation type de document');
    return data;
  }
};
