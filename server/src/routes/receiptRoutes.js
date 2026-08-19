const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken } = require('../middleware/auth');
const { generateAndStoreReceipt, RECEIPTS_DIR } = require('../services/receiptService');

// 1. GET /api/receipts/document/:documentId - Get receipt info and QR Code for document
router.get('/document/:documentId', authenticateToken, async (req, res) => {
  const { documentId } = req.params;

  try {
    let receipt = await db.get(
      `SELECT r.*, d.reference as document_reference, d.title as document_title, d.status as document_status, d.document_type
       FROM document_receipts r
       JOIN documents d ON r.document_id = d.id
       WHERE r.document_id = ?`,
      [documentId]
    );

    // If not found, auto-generate it if the document exists
    if (!receipt) {
      const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
      if (!doc) {
        return res.status(404).json({ error: 'Document introuvable.' });
      }
      const type = doc.document_type === 'MISSION_ORDER' ? 'MISSION_ORDER' : 'INCOMING_MAIL';
      await generateAndStoreReceipt(documentId, type, req);
      
      receipt = await db.get(
        `SELECT r.*, d.reference as document_reference, d.title as document_title, d.status as document_status, d.document_type
         FROM document_receipts r
         JOIN documents d ON r.document_id = d.id
         WHERE r.document_id = ?`,
        [documentId]
      );
    }

    res.json({
      success: true,
      receipt: {
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        receipt_type: receipt.receipt_type,
        document_id: receipt.document_id,
        document_reference: receipt.document_reference,
        document_title: receipt.document_title,
        document_status: receipt.document_status,
        qr_code_data: receipt.qr_code_data,
        verification_url: receipt.verification_url,
        created_at: receipt.created_at,
        pdf_url: `/api/receipts/${receipt.id}/pdf`
      }
    });
  } catch (err) {
    console.error('Fetch receipt error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du reçu officiel.' });
  }
});

// 2. GET /api/receipts/:id/pdf - Stream / Download PDF Receipt
router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;

  try {
    const receipt = await db.get('SELECT * FROM document_receipts WHERE id = ? OR receipt_number = ?', [id, id]);
    if (!receipt) {
      return res.status(404).json({ error: 'Reçu introuvable.' });
    }

    let filePath = path.join(UPLOAD_DIR, receipt.file_path);
    if (!fs.existsSync(filePath)) {
      // Regenerate if missing on disk
      await generateAndStoreReceipt(receipt.document_id, receipt.receipt_type, req);
      const updated = await db.get('SELECT * FROM document_receipts WHERE id = ?', [receipt.id]);
      filePath = path.join(UPLOAD_DIR, updated.file_path);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier PDF du reçu introuvable.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(receipt.receipt_number)}.pdf"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Download receipt PDF error:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement du reçu PDF.' });
  }
});

// 2b. GET /api/receipts/document/:documentId/pdf - Direct stream by document ID
router.get('/document/:documentId/pdf', async (req, res) => {
  const { documentId } = req.params;

  try {
    let receipt = await db.get('SELECT * FROM document_receipts WHERE document_id = ? ORDER BY id DESC LIMIT 1', [documentId]);
    if (!receipt) {
      const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
      if (!doc) {
        return res.status(404).json({ error: 'Document introuvable.' });
      }
      const type = doc.document_type === 'MISSION_ORDER' ? 'MISSION_ORDER' : 'INCOMING_MAIL';
      await generateAndStoreReceipt(documentId, type, req);
      receipt = await db.get('SELECT * FROM document_receipts WHERE document_id = ? ORDER BY id DESC LIMIT 1', [documentId]);
    }

    if (!receipt) {
      return res.status(404).json({ error: 'Impossible de générer le reçu pour ce document.' });
    }

    let filePath = path.join(UPLOAD_DIR, receipt.file_path);
    if (!fs.existsSync(filePath)) {
      await generateAndStoreReceipt(receipt.document_id, receipt.receipt_type, req);
      const updated = await db.get('SELECT * FROM document_receipts WHERE id = ?', [receipt.id]);
      filePath = path.join(UPLOAD_DIR, updated.file_path);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier PDF du reçu introuvable sur le disque.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(receipt.receipt_number)}.pdf"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Download document receipt PDF error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du reçu PDF.' });
  }
});

// 3. POST /api/receipts/regenerate/:documentId - Force regenerate receipt
router.post('/regenerate/:documentId', authenticateToken, async (req, res) => {
  const { documentId } = req.params;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const type = doc.document_type === 'MISSION_ORDER' ? 'MISSION_ORDER' : 'INCOMING_MAIL';
    const result = await generateAndStoreReceipt(documentId, type, req);

    res.json({
      success: true,
      message: 'Reçu officiel régénéré avec succès.',
      receipt: result
    });
  } catch (err) {
    console.error('Regenerate receipt error:', err);
    res.status(500).json({ error: 'Erreur lors de la régénération du reçu.' });
  }
});

module.exports = router;
