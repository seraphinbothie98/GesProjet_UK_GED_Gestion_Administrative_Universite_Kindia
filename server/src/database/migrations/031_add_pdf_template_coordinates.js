/**
 * Migration 031: Add Field Coordinates for Dynamic PDF Mission Templates
 * Adds field_coordinates column to mission_order_templates to support visual mapping of dynamic zones.
 */

const DEFAULT_KINDIA_PDF_COORDINATES = JSON.stringify({
  version: "1.0",
  page_size: {
    width: 595.28,
    height: 841.89,
    orientation: "PORTRAIT"
  },
  fields: [
    {
      id: "f_ref",
      key: "reference",
      type: "text",
      label: "Référence OM",
      x: 275.0,
      y: 712.0,
      width: 260.0,
      height: 18.0,
      font: "Helvetica-Bold",
      fontSize: 11,
      color: "#0B2545",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_grade",
      key: "grade",
      type: "text",
      label: "Titre / Grade",
      x: 180.0,
      y: 625.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica-Bold",
      fontSize: 10.5,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_nom",
      key: "nom_complet",
      type: "text",
      label: "Nom & Prénoms du Missionnaire",
      x: 180.0,
      y: 595.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica-Bold",
      fontSize: 11,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_fonction",
      key: "fonction",
      type: "text",
      label: "Qualité / Fonction",
      x: 180.0,
      y: 565.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_service",
      key: "service",
      type: "text",
      label: "Service / Faculté",
      x: 180.0,
      y: 535.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_matricule",
      key: "matricule",
      type: "text",
      label: "Matricule",
      x: 180.0,
      y: 505.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_dest",
      key: "destination",
      type: "text",
      label: "Destination",
      x: 180.0,
      y: 475.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica-Bold",
      fontSize: 10.5,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_objet",
      key: "objet_mission",
      type: "multiline",
      label: "Objet de la mission",
      x: 180.0,
      y: 435.0,
      width: 350.0,
      height: 32.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_transport",
      key: "moyen_transport",
      type: "text",
      label: "Moyen de transport",
      x: 180.0,
      y: 395.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_dates",
      key: "dates_mission",
      type: "text",
      label: "Dates (Du ... au ...)",
      x: 180.0,
      y: 365.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_chauffeur",
      key: "chauffeur",
      type: "text",
      label: "Chauffeur",
      x: 180.0,
      y: 335.0,
      width: 350.0,
      height: 16.0,
      font: "Helvetica",
      fontSize: 10,
      color: "#1E293B",
      align: "left",
      autoShrink: true
    },
    {
      id: "f_date_doc",
      key: "date_signature",
      type: "text",
      label: "Fait à Kindia le...",
      x: 380.0,
      y: 195.0,
      width: 180.0,
      height: 14.0,
      font: "Helvetica",
      fontSize: 9.5,
      color: "#1E293B",
      align: "center",
      autoShrink: true
    },
    {
      id: "f_sig_role",
      key: "signataire_role",
      type: "text",
      label: "Titre du Signataire (LE SECRÉTAIRE GÉNÉRAL)",
      x: 350.0,
      y: 180.0,
      width: 210.0,
      height: 14.0,
      font: "Helvetica-Bold",
      fontSize: 10.5,
      color: "#0B2545",
      align: "center",
      autoShrink: true
    },
    {
      id: "f_sig_img",
      key: "signature_image",
      type: "signature_image",
      label: "Image Signature SG",
      x: 390.0,
      y: 110.0,
      width: 130.0,
      height: 45.0,
      keepAspectRatio: true
    },
    {
      id: "f_cachet",
      key: "cachet_officiel",
      type: "image",
      label: "Cachet Officiel UK",
      x: 350.0,
      y: 95.0,
      width: 75.0,
      height: 75.0,
      opacity: 0.85
    },
    {
      id: "f_sig_nom",
      key: "signataire_nom",
      type: "text",
      label: "Nom du Signataire",
      x: 350.0,
      y: 85.0,
      width: 210.0,
      height: 14.0,
      font: "Helvetica-Bold",
      fontSize: 9.5,
      color: "#0B2545",
      align: "center",
      autoShrink: true
    },
    {
      id: "f_qr",
      key: "qr_code",
      type: "qrcode",
      label: "QR Code de vérification",
      x: 48.0,
      y: 95.0,
      width: 65.0,
      height: 65.0
    }
  ]
});

module.exports = {
  async up(db) {
    try {
      await db.run(`ALTER TABLE mission_order_templates ADD COLUMN field_coordinates TEXT DEFAULT NULL`);
    } catch (err) {
      // Column might already exist
    }

    try {
      await db.run(`ALTER TABLE mission_order_templates ADD COLUMN document_format TEXT DEFAULT 'WORD_DOCX'`);
    } catch (err) {
      // Column might already exist
    }

    // Set default coordinates on active templates if not already populated
    try {
      await db.run(`
        UPDATE mission_order_templates 
        SET field_coordinates = ? 
        WHERE field_coordinates IS NULL OR field_coordinates = ''
      `, [DEFAULT_KINDIA_PDF_COORDINATES]);
    } catch (err) {
      console.warn('Migration 031 coordinates seeding notice:', err.message);
    }
  },

  async down(db) {
    // SQLite does not require dropping columns in rollback
  }
};
