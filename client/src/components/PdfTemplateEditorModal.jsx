import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, Eye, Move, Sliders, Plus, Trash2, CheckCircle, 
  AlertCircle, RefreshCw, ZoomIn, ZoomOut, Maximize2, RotateCcw, 
  Sparkles, FileText, QrCode, Award, ShieldCheck, ArrowRight, Layers,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette, Type,
  Copy, Check, Search, Info, HelpCircle, ChevronLeft, ChevronRight, Crosshair, Target
} from 'lucide-react';
import { api } from '../services/api';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker to reliable CDN matching pdfjs-dist version
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
} catch (e) {
  console.warn('pdfjs worker configuration note:', e);
}

// Complete Official Field Catalog for Kindia Mission Orders
export const AVAILABLE_FIELDS_CATALOG = [
  // 1. Identité & Agent
  { id: 'f_ref', key: 'reference', tag: '{{reference}}', label: 'Référence OM', category: 'Identité & Agent', type: 'text', defaultWidth: 260, defaultHeight: 18, defaultFontSize: 11, font: 'Arial', color: '#0B2545', align: 'left', bold: true },
  { id: 'f_grade', key: 'titre_grade', tag: '{{titre_grade}}', label: 'Titre / Grade', category: 'Identité & Agent', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10.5, font: 'Arial', color: '#1E293B', align: 'left', bold: true },
  { id: 'f_prenoms', key: 'prenoms', tag: '{{prenoms}}', label: 'Prénoms', category: 'Identité & Agent', type: 'text', defaultWidth: 200, defaultHeight: 16, defaultFontSize: 10.5, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_nom_seul', key: 'nom', tag: '{{nom}}', label: 'Nom de famille', category: 'Identité & Agent', type: 'text', defaultWidth: 200, defaultHeight: 16, defaultFontSize: 10.5, font: 'Arial', color: '#1E293B', align: 'left', bold: true },
  { id: 'f_nom', key: 'nom_complet', tag: '{{nom_complet}}', label: 'Nom & Prénoms (Complet)', category: 'Identité & Agent', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 11, font: 'Arial', color: '#1E293B', align: 'left', bold: true },
  { id: 'f_nat', key: 'nationalite', tag: '{{nationalite}}', label: 'Nationalité', category: 'Identité & Agent', type: 'text', defaultWidth: 220, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_fonction', key: 'fonction', tag: '{{fonction}}', label: 'Qualité / Fonction', category: 'Identité & Agent', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_service', key: 'service', tag: '{{service}}', label: 'Service / Faculté', category: 'Identité & Agent', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_matricule', key: 'matricule', tag: '{{matricule}}', label: 'Matricule', category: 'Identité & Agent', type: 'text', defaultWidth: 220, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },

  // 2. Mission & Déplacement
  { id: 'f_dest', key: 'destination', tag: '{{destination}}', label: 'Destination', category: 'Mission & Déplacement', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10.5, font: 'Arial', color: '#1E293B', align: 'left', bold: true },
  { id: 'f_objet', key: 'objet_mission', tag: '{{objet_mission}}', label: 'Objet de la mission', category: 'Mission & Déplacement', type: 'multiline', defaultWidth: 350, defaultHeight: 32, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_transport', key: 'moyen_transport', tag: '{{moyen_transport}}', label: 'Moyen de transport', category: 'Mission & Déplacement', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_date_dep', key: 'date_depart', tag: '{{date_depart}}', label: 'Date de départ', category: 'Mission & Déplacement', type: 'date', defaultWidth: 150, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_date_ret', key: 'date_retour', tag: '{{date_retour}}', label: 'Date de retour', category: 'Mission & Déplacement', type: 'date', defaultWidth: 150, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_dates', key: 'dates_mission', tag: '{{dates_mission}}', label: 'Dates (Du ... au ...)', category: 'Mission & Déplacement', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },
  { id: 'f_chauffeur', key: 'chauffeur', tag: '{{chauffeur}}', label: 'Chauffeur / Conduite', category: 'Mission & Déplacement', type: 'text', defaultWidth: 350, defaultHeight: 16, defaultFontSize: 10, font: 'Arial', color: '#1E293B', align: 'left' },

  // 3. Signature & Validation (Eléments Indépendants)
  { id: 'f_date_doc', key: 'date_document', tag: '{{date_document}}', label: 'Date d’émission (Kindia)', category: 'Signataire & Validation', type: 'date', defaultWidth: 200, defaultHeight: 14, defaultFontSize: 9.5, font: 'Arial', color: '#1E293B', align: 'center' },
  { id: 'f_sig_role', key: 'signataire_role', tag: '{{signataire_role}}', label: 'Fonction du Signataire (SG)', category: 'Signataire & Validation', type: 'text', defaultWidth: 210, defaultHeight: 14, defaultFontSize: 10.5, font: 'Arial', color: '#0B2545', align: 'center', bold: true },
  { id: 'f_sig_nom', key: 'signataire_nom', tag: '{{signataire_nom}}', label: 'Nom du Signataire (SG)', category: 'Signataire & Validation', type: 'text', defaultWidth: 210, defaultHeight: 14, defaultFontSize: 9.5, font: 'Arial', color: '#0B2545', align: 'center', bold: true },
  { id: 'f_sig_img', key: 'signature', tag: '{{signature}}', label: 'Image Signature du SG', category: 'Signataire & Validation', type: 'signature_image', defaultWidth: 130, defaultHeight: 45, keepAspectRatio: true },
  { id: 'f_cachet', key: 'cachet', tag: '{{cachet}}', label: 'Cachet Officiel UK', category: 'Signataire & Validation', type: 'image', defaultWidth: 75, defaultHeight: 75, opacity: 0.85 },
  { id: 'f_qr', key: 'qr_code', tag: '{{qr_code}}', label: 'QR Code de Suivi & Sécurité', category: 'Signataire & Validation', type: 'qrcode', defaultWidth: 65, defaultHeight: 65 }
];

export default function PdfTemplateEditorModal({ isOpen, onClose, template, onSaveSuccess }) {
  if (!isOpen || !template) return null;

  // A4 Standard points (595.28 x 841.89 pt)
  const A4_WIDTH_PT = 595.28;
  const A4_HEIGHT_PT = 841.89;

  // State: Fields & Selection
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [scale, setScale] = useState(0.85); // Canvas scale zoom
  const [showFieldGuides, setShowFieldGuides] = useState(true); // Toggle labels on canvas
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [duplicateConfirmItem, setDuplicateConfirmItem] = useState(null);

  // State: PDF In-Browser Rendering & Multipage
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfRenderError, setPdfRenderError] = useState(null);

  // State: Placement Mode ("Click to Place")
  const [placementModeField, setPlacementModeField] = useState(null);

  // State: Custom Field Creator Modal
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldTag, setCustomFieldTag] = useState('');
  const [customFieldType, setCustomFieldType] = useState('text');

  // State: Saving & Preview
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showRealPreviewModal, setShowRealPreviewModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Dragging & Resizing state
  const [draggingFieldId, setDraggingFieldId] = useState(null);
  const [resizingFieldId, setResizingFieldId] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null); // 'se', 'e', 's'
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [initialFieldGeom, setInitialFieldGeom] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Refs
  const canvasRef = useRef(null);
  const pdfCanvasRef = useRef(null);

  // 1. Fetch and Load the Exact Imported PDF File
  useEffect(() => {
    let isCancelled = false;

    async function loadPdfFile() {
      setPdfLoading(true);
      setPdfRenderError(null);

      try {
        const token = localStorage.getItem('token');
        const fileUrl = `/api/mission-template/${template.id}/file`;
        
        const response = await fetch(fileUrl, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error(`Impossible de récupérer le fichier (statut HTTP ${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (isCancelled) return;

        // Check if buffer starts with %PDF
        const header = new Uint8Array(arrayBuffer.slice(0, 5));
        const isPdf = String.fromCharCode(...header).startsWith('%PDF');

        if (!isPdf) {
          // If it's a DOCX template rather than PDF
          setPdfRenderError("Ce modèle est au format Word (DOCX). Le Studio affiche la grille de positionnement officielle.");
          setPdfLoading(false);
          return;
        }

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const loadedPdf = await loadingTask.promise;

        if (isCancelled) return;
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.warn('PDF.js loading note:', err);
        if (!isCancelled) {
          setPdfRenderError("Rendu en direct du PDF : " + (err.message || "Erreur de chargement. Grille de secours activée."));
        }
      } finally {
        if (!isCancelled) setPdfLoading(false);
      }
    }

    if (template?.id) {
      loadPdfFile();
    }

    return () => {
      isCancelled = true;
    };
  }, [template?.id]);

  // 2. Render Active PDF Page to Canvas whenever pdfDoc, currentPage or scale changes
  useEffect(() => {
    let renderTask = null;

    async function renderPage() {
      if (!pdfDoc || !pdfCanvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: scale * 1.5 }); // High-DPI crisp rendering

        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${A4_WIDTH_PT * scale}px`;
        canvas.style.height = `${A4_HEIGHT_PT * scale}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF Page render note:', err);
        }
      }
    }

    renderPage();

    return () => {
      if (renderTask) {
        try { renderTask.cancel(); } catch (e) {}
      }
    };
  }, [pdfDoc, currentPage, scale]);

  // 3. Initialize fields on open
  useEffect(() => {
    let initialFields = [];
    try {
      if (template.field_coordinates) {
        const parsed = typeof template.field_coordinates === 'string' 
          ? JSON.parse(template.field_coordinates) 
          : template.field_coordinates;
        if (Array.isArray(parsed.fields) && parsed.fields.length > 0) {
          initialFields = parsed.fields;
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          initialFields = parsed;
        }
      }
    } catch (e) {
      console.warn('Coordinates parsing error:', e);
    }

    if (initialFields.length === 0) {
      // Default Kindia standard positions
      initialFields = AVAILABLE_FIELDS_CATALOG.map((item, idx) => ({
        id: item.id,
        key: item.key,
        tag: item.tag,
        label: item.label,
        type: item.type,
        page: 1,
        x: item.type === 'qrcode' ? 48.0 : (item.id === 'f_date_doc' || item.id === 'f_sig_role' || item.id === 'f_sig_nom' ? 350.0 : (item.id === 'f_sig_img' ? 390.0 : (item.id === 'f_cachet' ? 350.0 : (item.id === 'f_ref' ? 275.0 : 180.0)))),
        y: item.id === 'f_ref' ? 712.0 :
           item.id === 'f_grade' ? 625.0 :
           item.id === 'f_prenoms' ? 610.0 :
           item.id === 'f_nom_seul' ? 610.0 :
           item.id === 'f_nom' ? 595.0 :
           item.id === 'f_nat' ? 580.0 :
           item.id === 'f_fonction' ? 565.0 :
           item.id === 'f_service' ? 535.0 :
           item.id === 'f_matricule' ? 505.0 :
           item.id === 'f_dest' ? 475.0 :
           item.id === 'f_objet' ? 435.0 :
           item.id === 'f_transport' ? 395.0 :
           item.id === 'f_date_dep' ? 380.0 :
           item.id === 'f_date_ret' ? 380.0 :
           item.id === 'f_dates' ? 365.0 :
           item.id === 'f_chauffeur' ? 335.0 :
           item.id === 'f_date_doc' ? 195.0 :
           item.id === 'f_sig_role' ? 180.0 :
           item.id === 'f_sig_img' ? 110.0 :
           item.id === 'f_cachet' ? 95.0 :
           item.id === 'f_sig_nom' ? 85.0 : 95.0,
        width: item.defaultWidth,
        height: item.defaultHeight,
        fontSize: item.defaultFontSize || 10.5,
        font: item.font || 'Arial',
        color: item.color || '#1E293B',
        align: item.align || 'left',
        bold: Boolean(item.bold),
        italic: false,
        underline: false,
        autoShrink: true,
        opacity: item.opacity ?? 0.85
      }));
    } else {
      // Ensure all fields have label and tag matching catalog if missing
      initialFields = initialFields.map(f => {
        const cat = AVAILABLE_FIELDS_CATALOG.find(c => c.key === f.key || c.id === f.id);
        return {
          ...f,
          label: f.label || cat?.label || f.key,
          tag: f.tag || cat?.tag || `{{${f.key}}}`,
          type: f.type || cat?.type || 'text',
          page: f.page || 1,
          font: f.font || cat?.font || 'Arial',
          color: f.color || cat?.color || '#1E293B',
          align: f.align || cat?.align || 'left',
          bold: Boolean(f.bold || (f.font && f.font.includes('Bold'))),
          italic: Boolean(f.italic || (f.font && (f.font.includes('Italic') || f.font.includes('Oblique')))),
          underline: Boolean(f.underline),
          autoShrink: f.autoShrink !== false
        };
      });
    }

    setFields(initialFields);
    if (initialFields.length > 0) {
      setSelectedFieldId(initialFields[0].id);
    }
  }, [template]);

  // Selected Field
  const selectedField = fields.find(f => f.id === selectedFieldId) || null;

  // Convert PDF Pt (0 at bottom) to Screen Pixels (0 at top)
  const ptToScreen = (xPt, yPt, hPt) => {
    const xScreen = xPt * scale;
    const yScreen = (A4_HEIGHT_PT - yPt - hPt) * scale;
    return { x: xScreen, y: yScreen };
  };

  // Convert Screen Pixels back to PDF Pt
  const screenToPt = (xScreen, yScreen, hPt) => {
    const xPt = Math.round((xScreen / scale) * 10) / 10;
    const yPt = Math.round((A4_HEIGHT_PT - (yScreen / scale) - hPt) * 10) / 10;
    return { x: xPt, y: yPt };
  };

  // Click on Canvas Handler (Handles "Click to Place" mode)
  const handleCanvasClick = (e) => {
    if (!placementModeField) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickXScreen = e.clientX - rect.left;
    const clickYScreen = e.clientY - rect.top;

    const targetWidth = placementModeField.defaultWidth || 200;
    const targetHeight = placementModeField.defaultHeight || 18;

    const { x: newXPt, y: newYPt } = screenToPt(clickXScreen, clickYScreen, targetHeight);

    const clampedX = Math.max(0, Math.min(A4_WIDTH_PT - targetWidth, newXPt));
    const clampedY = Math.max(0, Math.min(A4_HEIGHT_PT - targetHeight, newYPt));

    const newId = `f_${placementModeField.key}_${Date.now()}`;
    const newField = {
      id: newId,
      key: placementModeField.key,
      tag: placementModeField.tag || `{{${placementModeField.key}}}`,
      label: placementModeField.label,
      type: placementModeField.type,
      page: currentPage,
      x: clampedX,
      y: clampedY,
      width: targetWidth,
      height: targetHeight,
      fontSize: placementModeField.defaultFontSize || 10.5,
      font: placementModeField.font || 'Arial',
      color: placementModeField.color || '#1E293B',
      align: placementModeField.align || 'left',
      bold: Boolean(placementModeField.bold),
      italic: false,
      underline: false,
      autoShrink: true,
      opacity: placementModeField.opacity ?? 0.85
    };

    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newId);
    setPlacementModeField(null); // Exit placement mode
    setMessage(`✓ Champ « ${placementModeField.label} » positionné avec succès sur la Page ${currentPage}.`);
    setTimeout(() => setMessage(''), 3000);
  };

  // Drag handling (Moving field)
  const handleMouseDown = (e, field) => {
    e.stopPropagation();
    if (placementModeField) return; // Prevent drag if in placement mode

    setSelectedFieldId(field.id);
    setDraggingFieldId(field.id);
    setResizingFieldId(null);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialFieldGeom({ x: field.x, y: field.y, width: field.width || 120, height: field.height || 18 });
  };

  // Resize handling (Dragging corner or edge handles)
  const handleResizeHandleMouseDown = (e, field, handle) => {
    e.stopPropagation();
    if (placementModeField) return;

    setSelectedFieldId(field.id);
    setResizingFieldId(field.id);
    setResizeHandle(handle);
    setDraggingFieldId(null);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialFieldGeom({ x: field.x, y: field.y, width: field.width || 120, height: field.height || 18 });
  };

  const handleMouseMove = (e) => {
    if (draggingFieldId) {
      const dxScreen = e.clientX - dragStartPos.x;
      const dyScreen = e.clientY - dragStartPos.y;

      const dxPt = dxScreen / scale;
      const dyPt = -dyScreen / scale; // PDF Y is inverted (0 at bottom)

      const newX = Math.max(0, Math.min(A4_WIDTH_PT - (initialFieldGeom.width || 40), Math.round((initialFieldGeom.x + dxPt) * 2) / 2));
      const newY = Math.max(0, Math.min(A4_HEIGHT_PT - (initialFieldGeom.height || 16), Math.round((initialFieldGeom.y + dyPt) * 2) / 2));

      setFields(prev => prev.map(f => f.id === draggingFieldId ? { ...f, x: newX, y: newY } : f));
    } else if (resizingFieldId) {
      const dxScreen = e.clientX - dragStartPos.x;
      const dyScreen = e.clientY - dragStartPos.y;

      const dxPt = dxScreen / scale;
      const dyPt = dyScreen / scale;

      let newWidth = initialFieldGeom.width;
      let newHeight = initialFieldGeom.height;
      let newY = initialFieldGeom.y;

      if (resizeHandle === 'e' || resizeHandle === 'se') {
        newWidth = Math.max(30, Math.min(A4_WIDTH_PT - initialFieldGeom.x, Math.round((initialFieldGeom.width + dxPt) * 2) / 2));
      }
      if (resizeHandle === 's' || resizeHandle === 'se') {
        newHeight = Math.max(10, Math.min(A4_HEIGHT_PT, Math.round((initialFieldGeom.height + dyPt) * 2) / 2));
        newY = Math.max(0, Math.round((initialFieldGeom.y - (newHeight - initialFieldGeom.height)) * 2) / 2);
      }

      setFields(prev => prev.map(f => f.id === resizingFieldId ? { ...f, width: newWidth, height: newHeight, y: newY } : f));
    }
  };

  const handleMouseUp = () => {
    setDraggingFieldId(null);
    setResizingFieldId(null);
    setResizeHandle(null);
  };

  // Update selected field properties
  const handleUpdateProperty = (prop, value) => {
    if (!selectedFieldId) return;
    setFields(prev => prev.map(f => {
      if (f.id === selectedFieldId) {
        return { ...f, [prop]: value };
      }
      return f;
    }));
  };

  // Enter placement mode or prompt duplicate
  const handleSelectFieldForPlacement = (catalogItem) => {
    const existingCount = fields.filter(f => f.key === catalogItem.key && f.page === currentPage).length;
    if (existingCount > 0) {
      setDuplicateConfirmItem(catalogItem);
    } else {
      setPlacementModeField(catalogItem);
      setMessage(`🎯 Cliquez sur le document PDF à l'endroit précis où placer « ${catalogItem.label} »`);
    }
  };

  // Add field with direct default placement
  const executeAddField = (catalogItem) => {
    const newId = `f_${catalogItem.key}_${Date.now()}`;
    const offsetCount = fields.filter(f => f.key === catalogItem.key).length;
    const newField = {
      id: newId,
      key: catalogItem.key,
      tag: catalogItem.tag || `{{${catalogItem.key}}}`,
      label: catalogItem.label,
      type: catalogItem.type,
      page: currentPage,
      x: Math.min(A4_WIDTH_PT - (catalogItem.defaultWidth || 200), (catalogItem.type === 'qrcode' ? 48.0 : 180.0) + (offsetCount * 15)),
      y: Math.max(50, 450.0 - (offsetCount * 25)),
      width: catalogItem.defaultWidth || 200,
      height: catalogItem.defaultHeight || 18,
      fontSize: catalogItem.defaultFontSize || 10.5,
      font: catalogItem.font || 'Arial',
      color: catalogItem.color || '#1E293B',
      align: catalogItem.align || 'left',
      bold: Boolean(catalogItem.bold),
      italic: false,
      underline: false,
      autoShrink: true,
      opacity: catalogItem.opacity ?? 0.85
    };

    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newId);
    setDuplicateConfirmItem(null);
    setMessage(`✓ Zone « ${catalogItem.label} » ajoutée sur la page ${currentPage}.`);
    setTimeout(() => setMessage(''), 3000);
  };

  // Add custom field created by administrator
  const handleCreateCustomField = () => {
    if (!customFieldName.trim()) {
      setError('Veuillez saisir un nom lisible pour le champ.');
      return;
    }
    const cleanKey = (customFieldTag || customFieldName)
      .toLowerCase()
      .replace(/[\{\}]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    const customItem = {
      id: `custom_${cleanKey}_${Date.now()}`,
      key: cleanKey,
      tag: `{{${cleanKey}}}`,
      label: customFieldName.trim(),
      type: customFieldType,
      defaultWidth: customFieldType === 'qrcode' ? 65 : 220,
      defaultHeight: customFieldType === 'qrcode' ? 65 : (customFieldType === 'signature' ? 45 : 18),
      defaultFontSize: 10.5,
      font: 'Arial',
      color: '#1E293B',
      align: 'left'
    };

    setShowCustomFieldModal(false);
    setCustomFieldName('');
    setCustomFieldTag('');
    setPlacementModeField(customItem);
    setMessage(`🎯 Cliquez sur le PDF pour positionner votre nouveau champ « ${customItem.label} »`);
  };

  // Remove field
  const handleRemoveField = (id) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  // Restore Default Kindia Coordinates
  const handleRestoreDefaults = () => {
    if (window.confirm('Voulez-vous réinitialiser toutes les zones aux positions et polices officielles par défaut de l’Université de Kindia ?')) {
      const defaultFields = AVAILABLE_FIELDS_CATALOG.map((item) => ({
        id: item.id,
        key: item.key,
        tag: item.tag,
        label: item.label,
        type: item.type,
        page: 1,
        x: item.type === 'qrcode' ? 48.0 : (item.id === 'f_date_doc' || item.id === 'f_sig_role' || item.id === 'f_sig_nom' ? 350.0 : (item.id === 'f_sig_img' ? 390.0 : (item.id === 'f_cachet' ? 350.0 : (item.id === 'f_ref' ? 275.0 : 180.0)))),
        y: item.id === 'f_ref' ? 712.0 :
           item.id === 'f_grade' ? 625.0 :
           item.id === 'f_prenoms' ? 610.0 :
           item.id === 'f_nom_seul' ? 610.0 :
           item.id === 'f_nom' ? 595.0 :
           item.id === 'f_nat' ? 580.0 :
           item.id === 'f_fonction' ? 565.0 :
           item.id === 'f_service' ? 535.0 :
           item.id === 'f_matricule' ? 505.0 :
           item.id === 'f_dest' ? 475.0 :
           item.id === 'f_objet' ? 435.0 :
           item.id === 'f_transport' ? 395.0 :
           item.id === 'f_date_dep' ? 380.0 :
           item.id === 'f_date_ret' ? 380.0 :
           item.id === 'f_dates' ? 365.0 :
           item.id === 'f_chauffeur' ? 335.0 :
           item.id === 'f_date_doc' ? 195.0 :
           item.id === 'f_sig_role' ? 180.0 :
           item.id === 'f_sig_img' ? 110.0 :
           item.id === 'f_cachet' ? 95.0 :
           item.id === 'f_sig_nom' ? 85.0 : 95.0,
        width: item.defaultWidth,
        height: item.defaultHeight,
        fontSize: item.defaultFontSize || 10.5,
        font: item.font || 'Arial',
        color: item.color || '#1E293B',
        align: item.align || 'left',
        bold: Boolean(item.bold),
        italic: false,
        underline: false,
        autoShrink: true,
        opacity: item.opacity ?? 0.85
      }));
      setFields(defaultFields);
      setSelectedFieldId(defaultFields[0]?.id || null);
      setMessage('Positions par défaut réinitialisées.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Save coordinates to backend
  const handleSaveCoordinates = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    // Strict Validation
    for (const f of fields) {
      if (isNaN(f.x) || isNaN(f.y) || isNaN(f.width) || isNaN(f.height)) {
        setError(`Erreur : Les coordonnées de la zone « ${f.label || f.key} » sont invalides (NaN).`);
        setSaving(false);
        return;
      }
      if (f.width <= 0 || f.height <= 0) {
        setError(`Erreur : La largeur et hauteur de « ${f.label || f.key} » doivent être supérieures à 0.`);
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        version: "1.0",
        page_size: {
          width: A4_WIDTH_PT,
          height: A4_HEIGHT_PT,
          orientation: "portrait"
        },
        fields: fields.map(f => ({
          id: f.id,
          key: f.key,
          tag: f.tag || `{{${f.key}}}`,
          label: f.label || f.key,
          type: f.type || 'text',
          page: f.page || 1,
          x: Math.round(f.x * 10) / 10,
          y: Math.round(f.y * 10) / 10,
          width: Math.round(f.width * 10) / 10,
          height: Math.round(f.height * 10) / 10,
          font: f.font || 'Arial',
          fontSize: f.fontSize || 10.5,
          color: f.color || '#1E293B',
          align: f.align || 'left',
          bold: Boolean(f.bold),
          italic: Boolean(f.italic),
          underline: Boolean(f.underline),
          autoShrink: f.autoShrink !== false,
          multiline: Boolean(f.multiline),
          hideIfEmpty: Boolean(f.hideIfEmpty),
          opacity: f.opacity
        }))
      };

      const res = await api.updateMissionTemplateCoordinates(template.id, payload);
      setMessage(res.message || 'Cartographie des zones enregistrée avec succès !');
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Save coordinates error:', err);
      setError(err.message || 'Erreur lors de l’enregistrement de la configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Preview with Real / Mock Simulation Data
  const handlePreviewDirectPdf = async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const coordinatesPayload = {
        version: "1.0",
        page_size: { width: A4_WIDTH_PT, height: A4_HEIGHT_PT, orientation: "portrait" },
        fields
      };

      const blob = await api.previewDirectPdfTemplate(template.id, coordinatesPayload, {
        reference: 'UK/OM/2026/042',
        missionary_name: 'CAMARA',
        missionary_firstnames: 'Mohamed Sékou',
        titre_grade: 'Dr. • Maître de Conférences',
        fonction: 'Enseignant-Chercheur • Département de Physique',
        matricule: 'UK-ENS-1084',
        service_name: 'Faculté des Sciences et Techniques',
        destination: 'Conakry (Ministère de l’Enseignement Supérieur)',
        object_of_mission: 'Participation à l’atelier national sur la gouvernance numérique des universités.',
        transport_mode: 'Véhicule de service (VA-1042-UK)',
        departure_date: '2026-10-05',
        return_date: '2026-10-12',
        signataire_role: 'LE SECRÉTAIRE GÉNÉRAL',
        signataire_nom: 'Pr. Alpha Kabinet Kaba'
      });

      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
      const newUrl = window.URL.createObjectURL(blob);
      setPreviewUrl(newUrl);
      setShowRealPreviewModal(true);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message || 'Erreur lors de la génération de l’aperçu.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Filter catalog
  const filteredCatalog = AVAILABLE_FIELDS_CATALOG.filter(item => 
    item.label.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
    item.tag.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
    item.key.toLowerCase().includes(searchCatalogQuery.toLowerCase())
  );

  // Group catalog by category
  const categories = Array.from(new Set(AVAILABLE_FIELDS_CATALOG.map(c => c.category || 'Général')));

  // Fields on current page
  const pageFields = fields.filter(f => (f.page || 1) === currentPage);

  return (
    <div 
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex flex-col select-none overflow-hidden animate-fadeIn"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* ========================================================================= */}
      {/* TOP HEADER BAR */}
      {/* ========================================================================= */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shrink-0 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kindia-blue to-emerald-700 flex items-center justify-center text-kindia-gold shadow-md">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-heading font-extrabold text-sm text-white tracking-wide">
                STUDIO GRAPHIQUE • ZONE PDF
              </h2>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                {template.file_type || 'PDF'}
              </span>
              <span className="text-xs text-slate-400">
                v{template.version_number || 1} • {template.file_name || template.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Modèle sélectionné : <strong>{template.file_name || template.name}</strong> ({fields.length} zones configurées)
            </p>
          </div>
        </div>

        {/* Multipage Controls */}
        <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1 space-x-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-300"
            title="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-200 px-1">
            Page {currentPage} / {numPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-300"
            title="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Canvas Display Controls */}
        <div className="flex items-center space-x-4">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 space-x-1">
            <button 
              type="button"
              onClick={() => setScale(s => Math.max(0.25, Math.round((s - 0.1) * 10) / 10))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 transition"
              title="Zoom arrière (25% min)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold px-2 text-slate-200 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button 
              type="button"
              onClick={() => setScale(s => Math.min(1.5, Math.round((s + 0.1) * 10) / 10))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 transition"
              title="Zoom avant (150% max)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Guide Labels Toggle */}
          <button
            type="button"
            onClick={() => setShowFieldGuides(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
              showFieldGuides 
                ? 'bg-kindia-blue text-white border-kindia-gold/50 shadow-sm' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Afficher ou masquer les intitulés lisibles au-dessus des zones"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Repères Studio</span>
          </button>

          {/* Reset to defaults */}
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
            title="Réinitialiser les zones aux positions officielles de base"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Défaut</span>
          </button>

          {/* Live Preview Button */}
          <button
            type="button"
            onClick={handlePreviewDirectPdf}
            disabled={previewLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-kindia-gold border border-kindia-gold/40 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm"
            title="Générer un aperçu PDF direct avec les données fictives officielles"
          >
            {previewLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            <span>Prévisualiser</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveCoordinates}
            disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition flex items-center space-x-2 shadow-lg shadow-emerald-900/30"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Enregistrer le Gabarit</span>
          </button>

          {/* Close Studio */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Fermer le studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* PLACEMENT MODE BANNER (When user selects a field to place on canvas) */}
      {/* ========================================================================= */}
      {placementModeField && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-md font-bold text-xs animate-bounce">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span>
              MODE POSITIONNEMENT ACTIF : Cliquez à l'endroit souhaité sur le document PDF pour placer <strong>« {placementModeField.label} »</strong> ({placementModeField.tag || `{{${placementModeField.key}}}`}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPlacementModeField(null)}
            className="px-3 py-1 bg-slate-900 text-white hover:bg-black rounded-lg text-xs transition cursor-pointer"
          >
            Annuler le placement
          </button>
        </div>
      )}

      {/* Alert / Notification bar */}
      {(message || error) && (
        <div className={`px-6 py-2 text-xs font-bold flex items-center justify-between shrink-0 ${
          error ? 'bg-red-900/90 text-red-100 border-b border-red-700' : 'bg-emerald-900/90 text-emerald-100 border-b border-emerald-700'
        }`}>
          <div className="flex items-center space-x-2">
            {error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span>{error || message}</span>
          </div>
          <button onClick={() => { setMessage(''); setError(''); }} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN STUDIO BODY (3 Columns) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================================= */}
        {/* 1. LEFT PANEL: Dynamic Fields Catalog */}
        {/* ======================================================================= */}
        <aside className="w-80 bg-slate-900/95 border-r border-slate-800 p-4 flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-kindia-gold" />
              <h3 className="font-heading font-extrabold text-xs text-white uppercase tracking-wider">
                Champs Disponibles
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomFieldModal(true)}
              className="px-2 py-1 bg-kindia-blue hover:bg-kindia-lightBlue text-kindia-gold hover:text-white rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
              title="Créer un nouveau champ personnalisé"
            >
              <Plus className="w-3 h-3" />
              <span>Nouveau</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchCatalogQuery}
              onChange={(e) => setSearchCatalogQuery(e.target.value)}
              placeholder="Rechercher un champ (ex: destination)..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-kindia-gold transition"
            />
          </div>

          {/* Catalog List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {categories.map(cat => {
              const catItems = filteredCatalog.filter(c => (c.category || 'Général') === cat);
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="space-y-1.5">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1 pt-1 flex items-center justify-between">
                    <span>{cat}</span>
                    <span className="text-[9px] text-slate-500 font-mono">({catItems.length})</span>
                  </h4>

                  {catItems.map(item => {
                    const placedCount = fields.filter(f => f.key === item.key).length;
                    const isPlacingThis = placementModeField?.key === item.key;

                    return (
                      <div
                        key={item.id}
                        className={`p-2 rounded-xl text-xs border transition flex items-center justify-between ${
                          isPlacingThis
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm'
                            : placedCount > 0 
                              ? 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:border-slate-600' 
                              : 'bg-slate-850/50 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <div className="truncate pr-2 flex-1 cursor-pointer" onClick={() => handleSelectFieldForPlacement(item)}>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-white block truncate text-[11px]">
                              {item.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5">
                            {item.tag || `{{${item.key}}}`}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {placedCount > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              placedCount === 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {placedCount === 1 ? '✓ Placé' : `${placedCount} zones`}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectFieldForPlacement(item)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center shadow-xs cursor-pointer ${
                              isPlacingThis
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'bg-kindia-blue hover:bg-kindia-lightBlue text-kindia-gold hover:text-white'
                            }`}
                            title={`Positionner ${item.label} sur le document`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Zones Actives List on Current Page */}
          <div className="pt-3 border-t border-slate-800 flex-1 flex flex-col min-h-0">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Zones Page {currentPage} ({pageFields.length}) :</span>
              <span className="text-[10px] font-normal text-slate-500">Total {fields.length}</span>
            </h4>
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {pageFields.map(f => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition ${
                    selectedFieldId === f.id
                      ? 'bg-kindia-blue text-white font-bold ring-1 ring-kindia-gold shadow-md'
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="block truncate font-bold text-white">{f.label || f.key}</span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      {f.tag || `{{${f.key}}}`} • X:{Math.round(f.x)}, Y:{Math.round(f.y)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemoveField(f.id); }}
                      className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-red-950/40 transition"
                      title="Supprimer cette zone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* 2. CENTER PANEL: Visual A4 Canvas with Exact In-Browser PDF Rendering */}
        {/* ========================================================================= */}
        <main 
          className="flex-1 bg-slate-950 p-6 overflow-auto flex items-center justify-center relative"
        >
          <div 
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              width: `${A4_WIDTH_PT * scale}px`,
              height: `${A4_HEIGHT_PT * scale}px`
            }}
            className={`bg-white rounded shadow-2xl relative border-2 overflow-hidden select-none ${
              placementModeField 
                ? 'cursor-crosshair border-amber-500 ring-4 ring-amber-500/30' 
                : 'border-slate-400'
            }`}
          >
            {/* Real In-Browser PDF Render Canvas */}
            <canvas 
              ref={pdfCanvasRef}
              className="absolute inset-0 pointer-events-none z-0"
            />

            {/* Fallback layout background if PDF rendering failed or template is DOCX */}
            {pdfRenderError && (
              <div className="absolute inset-0 pointer-events-none opacity-40 flex flex-col justify-between p-8 border border-slate-200 z-0">
                <div className="text-center space-y-1">
                  <p className="font-bold text-[11px] text-slate-600">RÉPUBLIQUE DE GUINÉE • UNIVERSITÉ DE KINDIA</p>
                  <div className="w-full h-0.5 bg-slate-300 my-2" />
                  <h1 className="font-black text-base text-slate-800 tracking-wider">ORDRE DE MISSION</h1>
                </div>

                <div className="space-y-3 opacity-30 text-[10px] font-mono">
                  <p>Titre / Grade : ....................................................................................</p>
                  <p>Nom & Prénoms : ....................................................................................</p>
                  <p>Qualité / Fonction : ................................................................................</p>
                  <p>Destination : ......................................................................................</p>
                  <p>Objet de la mission : ..............................................................................</p>
                  <p>Moyen de transport : ...............................................................................</p>
                  <p>Période : ..........................................................................................</p>
                </div>

                <div className="flex justify-between items-end text-[9px] text-slate-500 pt-8">
                  <div className="border border-dashed border-slate-400 p-2 text-center w-20 h-20 flex items-center justify-center">
                    [ Emplacement QR ]
                  </div>
                  <div className="border border-dashed border-slate-400 p-2 text-center w-40 h-24 flex flex-col items-center justify-center">
                    <p className="font-bold">LE SECRÉTAIRE GÉNÉRAL</p>
                    <p className="text-[8px] italic">[ Signature & Cachet ]</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {pdfLoading && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 text-white space-x-2">
                <RefreshCw className="w-6 h-6 animate-spin text-kindia-gold" />
                <span className="text-xs font-bold">Chargement du document PDF réel...</span>
              </div>
            )}

            {/* Dynamic Draggable & Resizable Overlays on Current Page */}
            {pageFields.map(field => {
              const isSelected = selectedFieldId === field.id;
              const { x, y } = ptToScreen(field.x, field.y, field.height || 16);
              const w = (field.width || 120) * scale;
              const h = (field.height || 18) * scale;

              const isSpecial = field.type === 'qrcode' || field.type === 'signature_image' || field.type === 'image';

              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleMouseDown(e, field)}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${w}px`,
                    height: `${h}px`
                  }}
                  className={`absolute cursor-move rounded transition-shadow flex flex-col justify-center px-1.5 ${
                    isSelected 
                      ? 'border-2 border-indigo-600 bg-indigo-500/25 shadow-xl ring-2 ring-indigo-400/50 z-30' 
                      : 'border border-blue-400/90 bg-blue-100/45 hover:bg-blue-100/70 z-10'
                  }`}
                  title={`${field.label} — Tag: ${field.tag || `{{${field.key}}}`} (X: ${field.x} pt, Y: ${field.y} pt, L: ${field.width} pt, H: ${field.height} pt)`}
                >
                  {/* Field Header & Label (Visible in Studio when showFieldGuides is on) */}
                  {showFieldGuides && (
                    <div className="flex items-center justify-between overflow-hidden pointer-events-none mb-0.5 leading-none">
                      <span className="text-[9px] font-black text-indigo-950 bg-indigo-100/90 px-1 py-0.5 rounded truncate">
                        {isSpecial ? (
                          field.type === 'qrcode' ? '⬛ QR CODE' :
                          field.type === 'signature_image' ? '✍️ SIGNATURE SG' : '🔴 CACHET UK'
                        ) : (
                          `📍 ${field.label || field.key}`
                        )}
                      </span>
                      <span className="text-[8px] font-mono text-slate-600 bg-white/90 px-1 rounded ml-1 shrink-0">
                        {Math.round(field.x)},{Math.round(field.y)}
                      </span>
                    </div>
                  )}

                  {/* Field Dynamic Tag Text Display */}
                  <div className="w-full flex items-center justify-between overflow-hidden pointer-events-none">
                    <span 
                      style={{
                        fontSize: `${Math.max(8, (field.fontSize || 10) * scale * 0.9)}px`,
                        fontFamily: field.font || 'Arial, sans-serif',
                        fontWeight: field.bold || (field.font && field.font.includes('Bold')) ? 'bold' : 'normal',
                        fontStyle: field.italic || (field.font && (field.font.includes('Italic') || field.font.includes('Oblique'))) ? 'italic' : 'normal',
                        textDecoration: field.underline ? 'underline' : 'none',
                        color: field.color || '#1E293B',
                        textAlign: field.align || 'left'
                      }}
                      className="truncate block w-full leading-tight select-none"
                    >
                      {field.tag || `{{${field.key}}}`}
                    </span>
                  </div>

                  {/* Interactive Resize Handles (Only on Selected Field) */}
                  {isSelected && (
                    <>
                      {/* South-East (Corner) Handle */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, field, 'se')}
                        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-se-resize shadow-md hover:scale-125 transition-transform z-40"
                        title="Redimensionner Largeur et Hauteur"
                      />
                      {/* East (Right edge) Handle */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, field, 'e')}
                        className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-4 bg-indigo-600 border border-white rounded cursor-e-resize shadow-md hover:scale-125 transition-transform z-40"
                        title="Ajuster la Largeur"
                      />
                      {/* South (Bottom edge) Handle */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, field, 's')}
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-indigo-600 border border-white rounded cursor-s-resize shadow-md hover:scale-125 transition-transform z-40"
                        title="Ajuster la Hauteur"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* ======================================================================= */}
        {/* 3. RIGHT PANEL: Property Inspector */}
        {/* ======================================================================= */}
        <aside className="w-88 bg-slate-900/95 border-l border-slate-800 p-5 flex flex-col shrink-0 overflow-y-auto text-white">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800 mb-4">
            <Sliders className="w-4 h-4 text-kindia-gold" />
            <h3 className="font-heading font-extrabold text-xs text-white uppercase tracking-wider">
              Propriétés de la Zone
            </h3>
          </div>

          {selectedField ? (
            <div className="space-y-5">
              {/* Field Identity Header */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-kindia-gold tracking-wider">
                    Zone Sélectionnée
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                    Page {selectedField.page || 1}
                  </span>
                </div>
                <h4 className="font-heading font-extrabold text-sm text-white truncate">
                  {selectedField.label}
                </h4>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Tag : <strong className="text-emerald-400">{selectedField.tag || `{{${selectedField.key}}}`}</strong></span>
                  <span className="capitalize text-slate-400">Type: {selectedField.type}</span>
                </div>
              </div>

              {/* 1. Dimensions & Coordinates (PDF Points) */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Position & Dimensions (Points PDF)</span>
                  <span className="text-[9px] text-slate-500 font-normal">A4: 595.28 x 841.89</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">X (Gauche) :</span>
                    <input 
                      type="number"
                      step="0.5"
                      value={selectedField.x}
                      onChange={(e) => handleUpdateProperty('x', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-kindia-gold focus:outline-hidden"
                    />
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Y (Hauteur PDF) :</span>
                    <input 
                      type="number"
                      step="0.5"
                      value={selectedField.y}
                      onChange={(e) => handleUpdateProperty('y', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-kindia-gold focus:outline-hidden"
                    />
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Largeur (W) :</span>
                    <input 
                      type="number"
                      step="1"
                      min="10"
                      value={selectedField.width || 120}
                      onChange={(e) => handleUpdateProperty('width', Math.max(10, parseFloat(e.target.value) || 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-kindia-gold focus:outline-hidden"
                    />
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Hauteur (H) :</span>
                    <input 
                      type="number"
                      step="1"
                      min="8"
                      value={selectedField.height || 18}
                      onChange={(e) => handleUpdateProperty('height', Math.max(8, parseFloat(e.target.value) || 8))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-kindia-gold focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Typography & Fonts */}
              {selectedField.type !== 'qrcode' && selectedField.type !== 'signature_image' && selectedField.type !== 'image' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                    Typographie & Style
                  </label>

                  {/* Police de caractère */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">Police système :</span>
                    <select
                      value={selectedField.font || 'Arial'}
                      onChange={(e) => handleUpdateProperty('font', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-kindia-gold focus:outline-hidden font-medium"
                    >
                      <option value="Arial">Arial (Sans-serif par défaut)</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Cambria">Cambria (Titres)</option>
                      <option value="Times New Roman">Times New Roman (Serif Officiel)</option>
                      <option value="Segoe UI">Segoe UI</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Tahoma">Tahoma</option>
                      <option value="Trebuchet MS">Trebuchet MS</option>
                      <option value="Garamond">Garamond</option>
                      <option value="Courier New">Courier New (Monospace)</option>
                      <option value="Consolas">Consolas</option>
                    </select>
                  </div>

                  {/* Taille de Police */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400">Taille :</span>
                      <span className="text-xs font-mono font-bold text-kindia-gold">{selectedField.fontSize || 10} pt</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        type="button"
                        onClick={() => handleUpdateProperty('fontSize', Math.max(6, Math.round(((selectedField.fontSize || 10) - 0.5) * 10) / 10))}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold border border-slate-700"
                      >
                        -
                      </button>
                      <input 
                        type="range"
                        min="6"
                        max="24"
                        step="0.5"
                        value={selectedField.fontSize || 10}
                        onChange={(e) => handleUpdateProperty('fontSize', parseFloat(e.target.value))}
                        className="flex-1 accent-kindia-blue"
                      />
                      <button 
                        type="button"
                        onClick={() => handleUpdateProperty('fontSize', Math.min(28, Math.round(((selectedField.fontSize || 10) + 0.5) * 10) / 10))}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold border border-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Boutons Gras, Italique, Souligné */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">Mise en forme :</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateProperty('bold', !selectedField.bold)}
                        className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1 transition ${
                          selectedField.bold ? 'bg-kindia-blue text-white border-kindia-gold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Mettre en gras"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        <span>Gras</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateProperty('italic', !selectedField.italic)}
                        className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1 transition ${
                          selectedField.italic ? 'bg-kindia-blue text-white border-kindia-gold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Mettre en italique"
                      >
                        <Italic className="w-3.5 h-3.5" />
                        <span>Italique</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateProperty('underline', !selectedField.underline)}
                        className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1 transition ${
                          selectedField.underline ? 'bg-kindia-blue text-white border-kindia-gold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Souligner le texte"
                      >
                        <Underline className="w-3.5 h-3.5" />
                        <span>Souligné</span>
                      </button>
                    </div>
                  </div>

                  {/* Alignement */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">Alignement :</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateProperty('align', 'left')}
                        className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1 transition ${
                          (selectedField.align || 'left') === 'left' ? 'bg-kindia-blue text-white border-kindia-gold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                        <span>Gauche</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateProperty('align', 'center')}
                        className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1 transition ${
                          selectedField.align === 'center' ? 'bg-kindia-blue text-white border-kindia-gold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                        <span>Centre</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateProperty('align', 'right')}
                        className={`py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1 transition ${
                          selectedField.align === 'right' ? 'bg-kindia-blue text-white border-kindia-gold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                        <span>Droite</span>
                      </button>
                    </div>
                  </div>

                  {/* Couleur */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1.5">Couleur du texte :</span>
                    <div className="flex items-center space-x-2">
                      {['#0F172A', '#1E293B', '#0B2545', '#166534', '#991B1B', '#1E3A8A', '#475569'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleUpdateProperty('color', c)}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 ${
                            selectedField.color === c ? 'border-kindia-gold ring-2 ring-kindia-gold/40 scale-110' : 'border-slate-600'
                          }`}
                        />
                      ))}
                      <input 
                        type="color"
                        value={selectedField.color || '#1E293B'}
                        onChange={(e) => handleUpdateProperty('color', e.target.value)}
                        className="w-7 h-7 bg-transparent rounded cursor-pointer border-0 p-0"
                        title="Choisir une couleur personnalisée"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Behavior & Overflow Options */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                  Comportement & Débordement
                </label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer bg-slate-800/60 p-2 rounded-xl border border-slate-700/60 hover:bg-slate-800">
                    <input 
                      type="checkbox"
                      checked={selectedField.autoShrink !== false}
                      onChange={(e) => handleUpdateProperty('autoShrink', e.target.checked)}
                      className="rounded text-kindia-blue focus:ring-kindia-gold"
                    />
                    <span className="text-slate-300">Réduire automatiquement si trop long</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer bg-slate-800/60 p-2 rounded-xl border border-slate-700/60 hover:bg-slate-800">
                    <input 
                      type="checkbox"
                      checked={Boolean(selectedField.multiline)}
                      onChange={(e) => handleUpdateProperty('multiline', e.target.checked)}
                      className="rounded text-kindia-blue focus:ring-kindia-gold"
                    />
                    <span className="text-slate-300">Retour à la ligne automatique (Multiligne)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer bg-slate-800/60 p-2 rounded-xl border border-slate-700/60 hover:bg-slate-800">
                    <input 
                      type="checkbox"
                      checked={Boolean(selectedField.hideIfEmpty)}
                      onChange={(e) => handleUpdateProperty('hideIfEmpty', e.target.checked)}
                      className="rounded text-kindia-blue focus:ring-kindia-gold"
                    />
                    <span className="text-slate-300">Masquer si valeur vide</span>
                  </label>
                </div>
              </div>

              {/* 4. Action Buttons for Selected Field */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const newId = `f_${selectedField.key}_${Date.now()}`;
                    const dup = {
                      ...selectedField,
                      id: newId,
                      x: Math.min(A4_WIDTH_PT - selectedField.width, selectedField.x + 10),
                      y: Math.max(10, selectedField.y - 15)
                    };
                    setFields(prev => [...prev, dup]);
                    setSelectedFieldId(newId);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5 text-kindia-gold" />
                  <span>Dupliquer cette zone</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRemoveField(selectedField.id)}
                  className="w-full py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Supprimer cette zone</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-500">
              <Move className="w-10 h-10 stroke-1 text-slate-600" />
              <p className="text-xs font-bold text-slate-400">Aucune zone sélectionnée</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Cliquez sur une zone sur le document PDF ou choisissez un champ dans la colonne de gauche pour le positionner.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: DUPLICATE FIELD CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      {duplicateConfirmItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4 text-white">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-heading font-extrabold text-sm text-white">
                Champ déjà positionné
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Le champ <strong>« {duplicateConfirmItem.label} »</strong> ({duplicateConfirmItem.tag || `{{${duplicateConfirmItem.key}}}`}) est déjà présent sur le document. Souhaitez-vous créer une zone supplémentaire ?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDuplicateConfirmItem(null)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => executeAddField(duplicateConfirmItem)}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-lg shadow-emerald-900/30"
              >
                Créer une nouvelle zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE CUSTOM FIELD */}
      {/* ========================================================================= */}
      {showCustomFieldModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading font-extrabold text-sm text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-kindia-gold" />
                <span>Créer un champ personnalisé</span>
              </h3>
              <button onClick={() => setShowCustomFieldModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nom lisible du champ :</label>
                <input 
                  type="text"
                  value={customFieldName}
                  onChange={(e) => {
                    setCustomFieldName(e.target.value);
                    if (!customFieldTag) {
                      setCustomFieldTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  placeholder="Ex: Numéro de vol, Observation..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-kindia-gold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Balise technique :</label>
                <input 
                  type="text"
                  value={customFieldTag}
                  onChange={(e) => setCustomFieldTag(e.target.value)}
                  placeholder="Ex: {{numero_vol}}"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono focus:border-kindia-gold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Type de champ :</label>
                <select
                  value={customFieldType}
                  onChange={(e) => setCustomFieldType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-kindia-gold focus:outline-hidden"
                >
                  <option value="text">Texte Standard</option>
                  <option value="multiline">Texte Multiligne</option>
                  <option value="date">Date</option>
                  <option value="signature_image">Signature</option>
                  <option value="image">Image / Cachet</option>
                  <option value="qrcode">QR Code</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCustomFieldModal(false)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateCustomField}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-lg shadow-emerald-900/30"
              >
                Ajouter et positionner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REAL HIGH-FIDELITY PDF PREVIEW */}
      {/* ========================================================================= */}
      {showRealPreviewModal && previewUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white bg-slate-900 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Aperçu Haute Fidélité du Modèle PDF
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Généré en appliquant les coordonnées configurées avec les données de simulation officielles
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRealPreviewModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950 p-4 overflow-hidden flex items-center justify-center">
              <iframe
                src={previewUrl}
                title="Aperçu PDF Direct"
                className="w-full h-full rounded-2xl border border-slate-800 bg-white"
              />
            </div>
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>Vérifiez l'alignement précis du texte, de la signature et du QR Code sur le PDF.</span>
              <button
                onClick={() => setShowRealPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
              >
                Fermer l'aperçu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
