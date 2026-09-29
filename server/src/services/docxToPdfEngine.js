const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFile, execFileSync } = require('child_process');
const jwt = require('jsonwebtoken');
const { UPLOAD_DIR } = require('../config/constants');

// ONLYOFFICE Configuration
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'uk_ged_onlyoffice_secret_2026';
const ONLYOFFICE_DOCUMENT_SERVER_URL = process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || 'http://localhost:80';
const ONLYOFFICE_INTERNAL_SERVER_URL = process.env.ONLYOFFICE_INTERNAL_SERVER_URL || ONLYOFFICE_DOCUMENT_SERVER_URL;
const ONLYOFFICE_CALLBACK_URL = process.env.ONLYOFFICE_CALLBACK_URL || process.env.APP_URL || 'http://host.docker.internal:5000';

/**
 * Finds the local LibreOffice / soffice binary on Windows / Linux
 */
function findLibreOfficeExecutable() {
  const customPath = process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH;
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const standardPaths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 24\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/local/bin/libreoffice'
  ];

  for (const p of standardPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Check PATH
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? 'where.exe' : 'which';
    const result = execFileSync(checkCmd, ['soffice'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const firstLine = result.trim().split(/\r?\n/)[0];
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch (e) {}

  return null;
}

/**
 * Converts a DOCX file to PDF using headless LibreOffice.
 * Preserves 100% of OpenXML fonts, tables, layouts, watermarks, headers, footers and images.
 */
async function convertViaLibreOffice(inputDocxPath, outputDir = null) {
  const sofficePath = findLibreOfficeExecutable();
  if (!sofficePath) {
    throw new Error('LibreOffice (soffice) n’est pas disponible sur ce système.');
  }

  const resolvedInputPath = path.resolve(inputDocxPath);
  const targetDir = path.resolve(outputDir || path.dirname(resolvedInputPath));
  const baseName = path.basename(resolvedInputPath, path.extname(resolvedInputPath));
  const expectedPdfPath = path.join(targetDir, `${baseName}.pdf`);

  // Create an isolated profile directory in tmp to prevent concurrency locks
  const profileDir = path.join(require('os').tmpdir(), `lo_profile_${process.pid}_${Date.now()}`);

  return new Promise((resolve, reject) => {
    const args = [
      `-env:UserInstallation=file:///${profileDir.replace(/\\/g, '/')}`,
      '--headless',
      '--invisible',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      targetDir,
      resolvedInputPath
    ];

    execFile(sofficePath, args, { timeout: 45000 }, (error, stdout, stderr) => {
      // Clean up temporary profile asynchronously
      try {
        if (fs.existsSync(profileDir)) {
          fs.rmSync(profileDir, { recursive: true, force: true });
        }
      } catch (e) {}

      if (error) {
        return reject(new Error(`Erreur conversion LibreOffice: ${error.message} - ${stderr || stdout}`));
      }

      if (fs.existsSync(expectedPdfPath)) {
        const pdfBytes = fs.readFileSync(expectedPdfPath);
        return resolve({ pdfBytes, pdfPath: expectedPdfPath, engine: 'LibreOffice' });
      }

      // Sometimes soffice creates uppercase/lowercase variations
      const found = fs.readdirSync(targetDir).find(f => f.toLowerCase() === `${baseName.toLowerCase()}.pdf`);
      if (found) {
        const actualPath = path.join(targetDir, found);
        const pdfBytes = fs.readFileSync(actualPath);
        return resolve({ pdfBytes, pdfPath: actualPath, engine: 'LibreOffice' });
      }

      return reject(new Error(`LibreOffice a terminé mais le fichier PDF attendu est introuvable : ${expectedPdfPath}`));
    });
  });
}

/**
 * Converts a DOCX file to PDF using ONLYOFFICE Document Server Conversion API.
 * Endpoint: POST /ConvertService.ashx
 */
async function convertViaOnlyoffice(inputDocxPath, options = {}) {
  const fileName = path.basename(inputDocxPath);
  const fileExt = path.extname(inputDocxPath).replace('.', '').toLowerCase();
  
  // Accessible URL for ONLYOFFICE container to download the source DOCX
  let fileUrl = options.file_url;
  if (!fileUrl) {
    const relativeUpload = path.relative(UPLOAD_DIR, inputDocxPath).replace(/\\/g, '/');
    fileUrl = `${ONLYOFFICE_CALLBACK_URL}/uploads/${encodeURIComponent(relativeUpload)}`;
  }

  const docKey = `${fileName}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

  const payload = {
    async: false,
    filetype: fileExt || 'docx',
    key: docKey,
    outputtype: 'pdf',
    title: fileName,
    url: fileUrl
  };

  const token = jwt.sign(payload, ONLYOFFICE_JWT_SECRET, { expiresIn: '10m' });
  payload.token = token;

  const requestData = JSON.stringify(payload);
  const convertUrl = new URL('/ConvertService.ashx', ONLYOFFICE_INTERNAL_SERVER_URL);

  return new Promise((resolve, reject) => {
    const isHttps = convertUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(convertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 30000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', async () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`ONLYOFFICE ConvertService status HTTP ${res.statusCode}: ${body}`));
          }

          let jsonResp;
          try {
            jsonResp = JSON.parse(body);
          } catch (pe) {
            // Handle XML response fallback from ONLYOFFICE
            const fileUrlMatch = body.match(/<FileUrl>(.*?)<\/FileUrl>/i);
            if (fileUrlMatch && fileUrlMatch[1]) {
              jsonResp = { fileUrl: fileUrlMatch[1], endConvert: true };
            } else {
              return reject(new Error(`Réponse ONLYOFFICE ConvertService invalide: ${body}`));
            }
          }

          if (jsonResp.error) {
            return reject(new Error(`Erreur ONLYOFFICE Conversion (Code ${jsonResp.error})`));
          }

          if (!jsonResp.fileUrl) {
            return reject(new Error(`ONLYOFFICE n'a pas retourné d'URL de téléchargement PDF: ${body}`));
          }

          // Fetch the converted PDF from ONLYOFFICE
          let downloadUrlStr = jsonResp.fileUrl;
          // If ONLYOFFICE returned localhost URL from inside container, translate to internal URL
          const parsedDownloadUrl = new URL(downloadUrlStr);
          if (['localhost', '127.0.0.1'].includes(parsedDownloadUrl.hostname)) {
            parsedDownloadUrl.host = new URL(ONLYOFFICE_INTERNAL_SERVER_URL).host;
            downloadUrlStr = parsedDownloadUrl.toString();
          }

          const pdfDownloadReq = (downloadUrlStr.startsWith('https:') ? https : http).get(downloadUrlStr, (dlRes) => {
            if (dlRes.statusCode !== 200) {
              return reject(new Error(`Échec du téléchargement du PDF converti depuis ONLYOFFICE: HTTP ${dlRes.statusCode}`));
            }
            const chunks = [];
            dlRes.on('data', c => chunks.push(c));
            dlRes.on('end', () => {
              const pdfBytes = Buffer.concat(chunks);
              resolve({ pdfBytes, engine: 'ONLYOFFICE' });
            });
          });

          pdfDownloadReq.on('error', reject);
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

/**
 * Universal High-Fidelity DOCX-to-PDF Conversion Engine.
 * Automatically tries available native office engines (ONLYOFFICE, LibreOffice)
 * to guarantee 100% faithful representation of Word typography, watermarks, tables, and colors.
 * 
 * NEVER reconstructs or hardcodes layout manually.
 */
async function convertDocxToPdf(docxBufferOrPath, options = {}) {
  let tempDocxPath = null;
  let isTemp = false;

  try {
    let sourcePath;
    if (typeof docxBufferOrPath === 'string') {
      sourcePath = docxBufferOrPath;
    } else {
      isTemp = true;
      const tempFilename = `temp_conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.docx`;
      tempDocxPath = path.join(UPLOAD_DIR, tempFilename);
      fs.writeFileSync(tempDocxPath, docxBufferOrPath);
      sourcePath = tempDocxPath;
    }

    let lastError = null;

    // 1. Try LibreOffice Headless (Fastest, 100% local, zero-network latency)
    const sofficeBin = findLibreOfficeExecutable();
    if (sofficeBin) {
      try {
        const result = await convertViaLibreOffice(sourcePath);
        console.log(`[DOCX_TO_PDF] ✓ Converti avec succès via LibreOffice (${path.basename(sourcePath)})`);
        return result.pdfBytes;
      } catch (loErr) {
        console.warn(`[DOCX_TO_PDF] Tentative LibreOffice échouée: ${loErr.message}, tentative via ONLYOFFICE...`);
        lastError = loErr;
      }
    }

    // 2. Try ONLYOFFICE Document Server Conversion API
    try {
      const result = await convertViaOnlyoffice(sourcePath, options);
      console.log(`[DOCX_TO_PDF] ✓ Converti avec succès via ONLYOFFICE Document Server (${path.basename(sourcePath)})`);
      return result.pdfBytes;
    } catch (ooErr) {
      console.warn(`[DOCX_TO_PDF] Tentative ONLYOFFICE échouée: ${ooErr.message}`);
      lastError = ooErr;
    }

    throw new Error(
      `Impossible de convertir le DOCX en PDF : aucun moteur de conversion bureautique valide n'est actif. ` +
      `Détails : ${lastError ? lastError.message : 'LibreOffice et ONLYOFFICE indisponibles'}`
    );
  } finally {
    if (isTemp && tempDocxPath && fs.existsSync(tempDocxPath)) {
      try { fs.unlinkSync(tempDocxPath); } catch (e) {}
    }
  }
}

async function getConversionEngineInfo() {
  const sofficeBin = findLibreOfficeExecutable();
  if (sofficeBin) {
    return {
      engine: 'LibreOffice Headless',
      executable: sofficeBin,
      ready: true,
      details: 'Conversion locale OpenXML ultra-rapide et fidèle'
    };
  }
  return {
    engine: 'ONLYOFFICE Document Server',
    url: ONLYOFFICE_INTERNAL_SERVER_URL,
    ready: false,
    details: 'En attente du conteneur Document Server'
  };
}

/**
 * Generates a clean Master PDF from a DOCX template by sanitizing dynamic tags {{...}}
 * to prevent duplicate / superimposed text before the one-time conversion.
 */
async function convertSanitizedDocxToMasterPdf(inputDocxPath, outputDir = null) {
  const JSZip = require('jszip');
  const resolvedInputPath = path.resolve(inputDocxPath);
  const targetDir = path.resolve(outputDir || path.dirname(resolvedInputPath));
  
  const content = fs.readFileSync(resolvedInputPath);
  const zip = await JSZip.loadAsync(content);
  
  // Clean tags from main document XML
  const docXmlFile = zip.file('word/document.xml');
  if (docXmlFile) {
    let docXml = await docXmlFile.async('string');
    docXml = docXml.replace(/\{\{[^}]+\}\}/g, '          ');
    zip.file('word/document.xml', docXml);
  }

  // Clean tags from headers / footers if any
  for (const filename of Object.keys(zip.files)) {
    if (filename.startsWith('word/header') || filename.startsWith('word/footer')) {
      let xml = await zip.file(filename).async('string');
      xml = xml.replace(/\{\{[^}]+\}\}/g, '          ');
      zip.file(filename, xml);
    }
  }

  const cleanBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const cleanDocxTempPath = path.join(targetDir, `temp_clean_master_${Date.now()}_${path.basename(resolvedInputPath)}`);
  fs.writeFileSync(cleanDocxTempPath, cleanBuffer);

  try {
    const convResult = await convertViaLibreOffice(cleanDocxTempPath, targetDir);
    try { fs.unlinkSync(cleanDocxTempPath); } catch (e) {}
    return convResult;
  } catch (err) {
    try { fs.unlinkSync(cleanDocxTempPath); } catch (e) {}
    throw err;
  }
}

module.exports = {
  convertDocxToPdf,
  convertViaLibreOffice,
  convertSanitizedDocxToMasterPdf,
  convertViaOnlyoffice,
  findLibreOfficeExecutable,
  getConversionEngineInfo
};
