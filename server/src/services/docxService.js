const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

// XML escape helper
function xmlEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * High-Fidelity DOCX to HTML Converter
 * Parses paragraphs, headings, runs, formatting (bold, italic, underline, size, color),
 * alignments, and tables with full fidelity.
 */
async function docxToHtml(docxBufferOrPath) {
  const buffer = typeof docxBufferOrPath === 'string'
    ? fs.readFileSync(docxBufferOrPath)
    : docxBufferOrPath;

  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return '<p>Document DOCX sans contenu lisible.</p>';

  const xmlText = await docXmlFile.async('string');
  let htmlResult = [];

  // Parse Body Elements: Paragraphs (<w:p>) and Tables (<w:tbl>)
  const bodyMatch = xmlText.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyContent = bodyMatch ? bodyMatch[1] : xmlText;

  // Tokenize top-level blocks (<w:p>...</w:p> and <w:tbl>...</w:tbl>)
  const blockRegex = /(<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g;
  let match;

  while ((match = blockRegex.exec(bodyContent)) !== null) {
    const blockXml = match[0];

    if (blockXml.startsWith('<w:tbl')) {
      // Process Table
      let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:16px 0; border:1px solid #CBD5E1;">';
      const trMatches = blockXml.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g) || [];

      for (const trXml of trMatches) {
        tableHtml += '<tr>';
        const tcMatches = trXml.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) || [];

        for (const tcXml of tcMatches) {
          let cellText = '';
          const pInCell = tcXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
          for (const p of pInCell) {
            cellText += parseParagraphXml(p);
          }
          tableHtml += `<td style="border:1px solid #CBD5E1; padding:8px 12px; font-size:12px; vertical-align:top;">${cellText || '&nbsp;'}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table>';
      htmlResult.push(tableHtml);
    } else {
      // Process Paragraph
      htmlResult.push(parseParagraphXml(blockXml));
    }
  }

  let finalHtml = htmlResult.join('\n');

  // Format {{tag}} into interactive dynamic badge for visual editor
  finalHtml = finalHtml.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, tagKey) => {
    return `<span data-field-key="{{${tagKey}}}" class="dynamic-tag" contenteditable="false" style="background-color:#EFF6FF; color:#1E40AF; padding:2px 8px; border-radius:6px; font-family:monospace; font-weight:bold; border:1px solid #BFDBFE; display:inline-block; margin:0 2px;">🏷️ {{${tagKey}}}</span>`;
  });

  return finalHtml || '<p>Document Word importé.</p>';
}

/**
 * Parses an individual <w:p> paragraph XML node into HTML with formatting
 */
function parseParagraphXml(pXml) {
  // Check alignment
  let textAlign = 'left';
  const jcMatch = pXml.match(/<w:jc\b[^>]*w:val="([^"]+)"/);
  if (jcMatch) {
    const val = jcMatch[1].toLowerCase();
    if (val === 'center') textAlign = 'center';
    else if (val === 'right') textAlign = 'right';
    else if (val === 'both' || val === 'justify') textAlign = 'justify';
  }

  // Parse Runs (<w:r>)
  const rMatches = pXml.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) || [];
  let pRunsHtml = '';

  for (const rXml of rMatches) {
    const tMatches = rXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    let rText = tMatches.map(t => {
      const inner = t.replace(/^<w:t\b[^>]*>/, '').replace(/<\/w:t>$/, '');
      return inner;
    }).join('');

    if (!rText) continue;

    const isBold = /<w:b(\/>|\b[^>]*>)/.test(rXml);
    const isItalic = /<w:i(\/>|\b[^>]*>)/.test(rXml);
    const isUnderline = /<w:u\b[^>]*\/>/.test(rXml);
    const colorMatch = rXml.match(/<w:color\b[^>]*w:val="([^"]+)"/);
    const szMatch = rXml.match(/<w:sz\b[^>]*w:val="([^"]+)"/);

    let styles = [];
    if (colorMatch && colorMatch[1] && colorMatch[1] !== 'auto') {
      styles.push(`color:#${colorMatch[1]}`);
    }
    if (szMatch) {
      const ptSize = Math.round(parseInt(szMatch[1], 10) / 2);
      if (ptSize > 0) styles.push(`font-size:${ptSize}px`);
    }

    let runFormatted = rText;
    if (isBold) runFormatted = `<strong>${runFormatted}</strong>`;
    if (isItalic) runFormatted = `<em>${runFormatted}</em>`;
    if (isUnderline) runFormatted = `<u>${runFormatted}</u>`;

    if (styles.length > 0) {
      runFormatted = `<span style="${styles.join('; ')}">${runFormatted}</span>`;
    }

    pRunsHtml += runFormatted;
  }

  if (!pRunsHtml.trim()) {
    return `<p style="text-align:${textAlign}; margin-bottom:8px; min-height:1em;">&nbsp;</p>`;
  }

  // Detect heading vs paragraph
  if (pXml.includes('Heading1') || (textAlign === 'center' && pRunsHtml.length < 80 && (pRunsHtml.includes('ORDRE DE MISSION') || pRunsHtml.includes('RÉPUBLIQUE')))) {
    return `<h2 style="text-align:${textAlign}; font-size:16px; font-weight:bold; margin-bottom:12px; color:#0B2545;">${pRunsHtml}</h2>`;
  }

  return `<p style="text-align:${textAlign}; margin-bottom:8px; line-height:1.6; color:#1E293B;">${pRunsHtml}</p>`;
}

/**
 * Replaces dynamic placeholders {{tag}} inside a Word XML string,
 * preserving Word run properties (<w:rPr>) and formatting faithfully.
 */
function replacePlaceholdersInWordXml(xmlString, dataMap) {
  if (!xmlString) return xmlString;

  // Normalized map of cleaned keys and XML-escaped values
  const normalizedMap = [];
  for (const [rawKey, val] of Object.entries(dataMap)) {
    const cleanKey = rawKey.replace(/^\{\{|\}\}$/g, '').trim();
    let escapedVal = xmlEscape(val !== undefined && val !== null ? val : '');
    if (escapedVal.includes('\n')) {
      escapedVal = escapedVal.replace(/\r\n/g, '\n').replace(/\n/g, '</w:t><w:br/><w:t>');
    }
    const keyPattern = cleanKey.replace(/_/g, '[_\\s]+');
    const regex = new RegExp(`\\{\\s*\\{\\s*${keyPattern}\\s*\\}\\s*\\}`, 'gi');
    normalizedMap.push({ key: cleanKey, regex, val: escapedVal });
  }

  return xmlString.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    if (!paragraphXml.includes('{')) {
      return paragraphXml;
    }

    // Step 1: In-place replacement within individual <w:t> elements (preserves exact run styling)
    let processedXml = paragraphXml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (match, openTag, textContent, closeTag) => {
      let updatedText = textContent;
      for (const { regex, val } of normalizedMap) {
        if (regex.test(updatedText)) {
          regex.lastIndex = 0;
          updatedText = updatedText.replace(regex, val);
        }
      }
      return `${openTag}${updatedText}${closeTag}`;
    });

    if (!processedXml.includes('{')) {
      return processedXml;
    }

    // Step 2: Handle cross-run split placeholders iteratively until all placeholders are replaced
    let changed = true;
    let maxIterations = 15;
    while (changed && maxIterations-- > 0 && processedXml.includes('{')) {
      changed = false;
      const tRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
      const textMatches = [];
      let match;
      let fullText = '';

      while ((match = tRegex.exec(processedXml)) !== null) {
        const start = fullText.length;
        const content = match[2];
        const end = start + content.length;
        textMatches.push({
          full: match[0],
          openTag: match[1],
          content,
          closeTag: match[3],
          start,
          end
        });
        fullText += content;
      }

      for (const { regex, val } of normalizedMap) {
        regex.lastIndex = 0;
        const tagMatch = regex.exec(fullText);
        if (tagMatch) {
          const matchStart = tagMatch.index;
          const matchEnd = matchStart + tagMatch[0].length;
          const affectedRuns = textMatches.filter(r => r.end > matchStart && r.start < matchEnd);
          if (affectedRuns.length > 0) {
            for (let i = 0; i < affectedRuns.length; i++) {
              const run = affectedRuns[i];
              const localStart = Math.max(0, matchStart - run.start);
              const localEnd = Math.min(run.content.length, matchEnd - run.start);

              if (i === 0) {
                const prefix = run.content.substring(0, localStart);
                const suffix = (affectedRuns.length === 1) ? run.content.substring(localEnd) : '';
                run.content = prefix + val + suffix;
              } else if (i === affectedRuns.length - 1) {
                run.content = run.content.substring(localEnd);
              } else {
                run.content = '';
              }
            }

            let runIndex = 0;
            processedXml = processedXml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (m, open, text, close) => {
              const r = textMatches[runIndex++];
              return r ? `${open}${r.content}${close}` : m;
            });
            changed = true;
            break; // Restart loop to re-compute run offsets accurately
          }
        }
      }
    }

    return processedXml;
  });
}

/**
 * Helper to normalize and consolidate split {{...}} placeholders in Word paragraph XML
 */
function normalizeParagraphRuns(pXml) {
  if (!pXml.includes('{')) return pXml;

  // 1. Remove proofErr and spelling tags that Word inserts inside curly braces
  let cleanedXml = pXml.replace(/<w:proofErr\b[^>]*\/>/g, '');

  // 2. Parse all <w:t> elements and their offsets in the combined text
  const tRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
  const textMatches = [];
  let match;
  let fullText = '';

  while ((match = tRegex.exec(cleanedXml)) !== null) {
    const start = fullText.length;
    const content = match[2];
    const end = start + content.length;
    textMatches.push({
      openTag: match[1],
      content,
      closeTag: match[3],
      start,
      end
    });
    fullText += content;
  }

  if (!fullText.includes('{')) return cleanedXml;

  // 3. Find all {{tag}} patterns in fullText
  const tagRegex = /\{\{\s*([a-zA-Z0-9_\s]+?)\s*\}\}/g;
  let tagMatch;
  let hasSplit = false;

  while ((tagMatch = tagRegex.exec(fullText)) !== null) {
    const matchStart = tagMatch.index;
    const matchEnd = matchStart + tagMatch[0].length;
    const cleanTag = `{{${tagMatch[1].trim()}}}`;

    // Find affected runs
    const affected = textMatches.filter(r => r.end > matchStart && r.start < matchEnd);
    if (affected.length > 1) {
      hasSplit = true;
      for (let i = 0; i < affected.length; i++) {
        const run = affected[i];
        const localStart = Math.max(0, matchStart - run.start);
        const localEnd = Math.min(run.content.length, matchEnd - run.start);

        if (i === 0) {
          const prefix = run.content.substring(0, localStart);
          const suffix = (affected.length === 1) ? run.content.substring(localEnd) : '';
          run.content = prefix + cleanTag + suffix;
        } else if (i === affected.length - 1) {
          run.content = run.content.substring(localEnd);
        } else {
          run.content = '';
        }
      }
    }
  }

  if (hasSplit) {
    let runIndex = 0;
    cleanedXml = cleanedXml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (m, open, text, close) => {
      const r = textMatches[runIndex++];
      return r ? `${open}${r.content}${close}` : m;
    });
  }

  return cleanedXml;
}

/**
 * Helper to generate an OpenXML DrawingML inline picture XML element
 */
function createInlineDrawingXml(relId, widthPt = 60, heightPt = 60, docPrId = 1, name = "Image") {
  const cx = Math.round(widthPt * 12700);
  const cy = Math.round(heightPt * 12700);
  return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${xmlEscape(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${xmlEscape(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}

/**
 * Main function to inject data and images (QR Code, Signatures, Stamps) into a DOCX template file.
 */
async function fillDocxTemplate(docxBufferOrPath, dataMap = {}, imageMap = {}) {
  const buffer = typeof docxBufferOrPath === 'string'
    ? fs.readFileSync(docxBufferOrPath)
    : docxBufferOrPath;

  const zip = await JSZip.loadAsync(buffer);
  const injectedImages = {};

  // 1. Ensure [Content_Types].xml supports PNG & JPEG images
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ctXml = await ctFile.async('string');
    let ctChanged = false;
    if (!ctXml.includes('Extension="png"') && !ctXml.includes('extension="png"')) {
      ctXml = ctXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
      ctChanged = true;
    }
    if (!ctXml.includes('Extension="jpg"') && !ctXml.includes('extension="jpg"')) {
      ctXml = ctXml.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
      ctChanged = true;
    }
    if (!ctXml.includes('Extension="jpeg"') && !ctXml.includes('extension="jpeg"')) {
      ctXml = ctXml.replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
      ctChanged = true;
    }
    if (ctChanged) {
      zip.file('[Content_Types].xml', ctXml);
    }
  }

  // 2. Prepare Relationships in word/_rels/document.xml.rels
  let docRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const docRelsFile = zip.file('word/_rels/document.xml.rels');
  if (docRelsFile) {
    docRelsXml = await docRelsFile.async('string');
  }

  let nextRelIdx = 100;
  const activeImageRels = {};

  if (imageMap && typeof imageMap === 'object') {
    for (const [rawKey, imgDef] of Object.entries(imageMap)) {
      if (!imgDef) continue;
      const cleanKey = rawKey.replace(/^\{\{|\}\}$/g, '').trim().toLowerCase();
      let imgBuffer = imgDef.buffer;
      if (!imgBuffer && imgDef.filePath && fs.existsSync(imgDef.filePath)) {
        imgBuffer = fs.readFileSync(imgDef.filePath);
      }
      if (imgBuffer && Buffer.isBuffer(imgBuffer) && imgBuffer.length > 0) {
        const ext = imgDef.extension || (imgDef.filePath && path.extname(imgDef.filePath).replace('.', '')) || 'png';
        const relId = `rId_img_${cleanKey.replace(/[^a-zA-Z0-9]/g, '_')}_${nextRelIdx++}`;
        const mediaName = `media_${cleanKey.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;
        
        zip.file(`word/media/${mediaName}`, imgBuffer);
        
        const newRel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`;
        docRelsXml = docRelsXml.replace('</Relationships>', `${newRel}</Relationships>`);
        
        activeImageRels[cleanKey] = {
          relId,
          widthPt: imgDef.widthPt || 60,
          heightPt: imgDef.heightPt || 60,
          name: imgDef.name || cleanKey
        };
      }
    }
    zip.file('word/_rels/document.xml.rels', docRelsXml);
  }

  // 3. Scan and process all XML parts inside the DOCX zip (document.xml, header*.xml, footer*.xml)
  const fileNames = Object.keys(zip.files);
  let docPrId = 500;

  for (const fileName of fileNames) {
    if (fileName.startsWith('word/') && fileName.endsWith('.xml') && !fileName.includes('_rels/')) {
      const file = zip.file(fileName);
      if (file) {
        let xmlContent = await file.async('string');

        // Step 3.0: Normalize paragraph runs to consolidate any split {{tag}} placeholders
        xmlContent = xmlContent.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, normalizeParagraphRuns);

        // Step 3.1: Inject inline images for matched tags
        for (const [cleanKey, imgData] of Object.entries(activeImageRels)) {
          const keyPattern = cleanKey.replace(/_/g, '[_\\s]+');
          const tagCheckRegex = new RegExp(`\\{\\{\\s*${keyPattern}\\s*\\}\\}`, 'i');
          
          if (tagCheckRegex.test(xmlContent)) {
            const drawingXml = createInlineDrawingXml(
              imgData.relId,
              imgData.widthPt,
              imgData.heightPt,
              docPrId++,
              imgData.name
            );

            // 1. If inside an AlternateContent block (Word Textbox/Shape), replace the specific AlternateContent block
            const altRegex = new RegExp(`<mc:AlternateContent\\b[^>]*>(?:(?!<mc:AlternateContent\\b)[\\s\\S])*?\\{\\{\\s*${keyPattern}\\s*\\}\\}[\\s\\S]*?<\\/mc:AlternateContent>`, 'gi');
            if (altRegex.test(xmlContent)) {
              altRegex.lastIndex = 0;
              xmlContent = xmlContent.replace(altRegex, `<w:r><w:rPr><w:noProof/></w:rPr>${drawingXml}</w:r>`);
              injectedImages[cleanKey] = true;
            } else {
              // 2. If inside a standard run
              const runRegex = new RegExp(`<w:r\\b[^>]*>(?:(?!<w:r[ >])[\\s\\S])*?<w:t\\b[^>]*>\\s*\\{\\{\\s*${keyPattern}\\s*\\}\\}\\s*<\\/w:t>(?:(?!<w:r[ >])[\\s\\S])*?<\\/w:r>`, 'gi');
              if (runRegex.test(xmlContent)) {
                runRegex.lastIndex = 0;
                xmlContent = xmlContent.replace(runRegex, `<w:r><w:rPr><w:noProof/></w:rPr>${drawingXml}</w:r>`);
                injectedImages[cleanKey] = true;
              } else {
                const directTagRegex = new RegExp(`\\{\\{\\s*${keyPattern}\\s*\\}\\}`, 'gi');
                if (directTagRegex.test(xmlContent)) {
                  directTagRegex.lastIndex = 0;
                  xmlContent = xmlContent.replace(directTagRegex, `</w:t></w:r><w:r><w:rPr><w:noProof/></w:rPr>${drawingXml}</w:r><w:r><w:t>`);
                  injectedImages[cleanKey] = true;
                }
              }
            }
          }
        }

        // Step 3.2: Clear any unprovided image placeholders so they don't remain as raw {{tag}} text
        const commonImageKeys = [
          'qr_code', 'qrcode', 'signature', 'signature_sg', 'signature_secretaire_general',
          'signature_recteur', 'cachet', 'cachet_officiel', 'tampon'
        ];
        for (const imgKey of commonImageKeys) {
          if (!activeImageRels[imgKey]) {
            const keyPattern = imgKey.replace(/_/g, '[_\\s]+');
            const altClearRegex = new RegExp(`<mc:AlternateContent\\b[^>]*>(?:(?!<mc:AlternateContent\\b)[\\s\\S])*?\\{\\{\\s*${keyPattern}\\s*\\}\\}[\\s\\S]*?<\\/mc:AlternateContent>`, 'gi');
            xmlContent = xmlContent.replace(altClearRegex, '');
            const clearRegex = new RegExp(`\\{\\{\\s*${keyPattern}\\s*\\}\\}`, 'gi');
            xmlContent = xmlContent.replace(clearRegex, '');
          }
        }

        // Step 3.3: Replace standard text placeholders
        const updatedXml = replacePlaceholdersInWordXml(xmlContent, dataMap);
        zip.file(fileName, updatedXml);
      }
    }
  }

  const generatedBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  generatedBuffer.injectedImages = injectedImages;
  return generatedBuffer;
}

/**
 * Builds standard official Word (.DOCX) document for Université de Kindia
 */
async function buildOfficialKindiaMissionDocx(data = {}) {
  const zip = new JSZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="21"/>
        <w:color w:val="0F172A"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <!-- Institutional Header: Two-Column Block -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9700" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/>
          <w:left w:val="none"/>
          <w:bottom w:val="single" w:sz="12" w:space="4" w:color="0F172A"/>
          <w:right w:val="none"/>
          <w:insideH w:val="none"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="20"/><w:color w:val="0B2545"/></w:rPr><w:t>[ LOGO UK ]</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="7200" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:i/><w:sz w:val="24"/><w:color w:val="0F172A"/></w:rPr><w:t>REPUBLIQUE DE GUINEE</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="18"/><w:color w:val="DC2626"/></w:rPr><w:t>Travail - </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="18"/><w:color w:val="CA8A04"/></w:rPr><w:t>Justice</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="18"/><w:color w:val="16A34A"/></w:rPr><w:t> - Solidarité</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:i/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr><w:t>Ministère de l'Enseignement Supérieur et de la Recherche Scientifique</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:i/><w:sz w:val="28"/><w:color w:val="002B80"/></w:rPr><w:t>Université de Kindia</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="17"/><w:color w:val="0F172A"/></w:rPr><w:t>BP 212</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="17"/><w:color w:val="0F172A"/></w:rPr><w:t>Email : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:u w:val="single"/><w:sz w:val="17"/><w:color w:val="DC2626"/></w:rPr><w:t>rectorat@univ-kindia.org</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="17"/><w:color w:val="0F172A"/></w:rPr><w:t>   Site : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:u w:val="single"/><w:sz w:val="17"/><w:color w:val="0F172A"/></w:rPr><w:t>www.univ-kindia.org</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Reference Line -->
    <w:p>
      <w:pPr><w:jc w:val="left"/><w:spacing w:before="120" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>Réf: {{reference}}</w:t></w:r>
    </w:p>

    <!-- Title: ORDRE DE MISSION (Centered, Bold, Underlined, Large Blue) -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="160"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:u w:val="single"/><w:sz w:val="36"/><w:color w:val="0B2545"/></w:rPr><w:t>ORDRE DE MISSION</w:t></w:r>
    </w:p>

    <!-- Body Information Lines -->
    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Il est ordonné à : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{missionnaire_nom}} {{missionnaire_prenoms}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Nationalité : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{nationalite}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Profession ou Fonction : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{fonction}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">De se rendre à : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{destination}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Objet de la Mission : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{objet_mission}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Moyen de Transport : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{moyen_transport}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Date de Départ : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{date_depart}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Date de retour : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{date_retour}}</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="60"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">Conduit par : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{conduit_par}}</w:t></w:r>
    </w:p>

    <!-- Administrative Requisition Clause -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="80" w:after="160"/><w:line w:line="280" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="21"/><w:color w:val="0F172A"/></w:rPr><w:t>Les autorités civiles, militaires des localités traversées sont priées de bien faciliter l'accomplissement de la présente mission.</w:t></w:r>
    </w:p>

    <!-- Date & Signature Block -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9700" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/>
          <w:left w:val="none"/>
          <w:bottom w:val="none"/>
          <w:right w:val="none"/>
          <w:insideH w:val="none"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4850" w:type="dxa"/><w:vAlign w:bottom"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="16"/><w:color w:val="64748B"/></w:rPr><w:t></w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4850" w:type="dxa"/><w:vAlign w:top"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>Kindia, le {{date_signature}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="24"/><w:color w:val="0B2545"/></w:rPr><w:t>LE SECRETAIRE GENERAL</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>{{signature_secretaire_general}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:u w:val="single"/><w:sz w:val="23"/><w:color w:val="0F172A"/></w:rPr><w:t>{{nom_secretaire_general}}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Section Properties: A4 Portrait (11906 x 16838), Margins 1080 twips -->
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="540" w:footer="540" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Builds a valid DOCX file from edited HTML content while preserving 100% of the original
 * XML structure, headers, footers, drawings, watermarks, tables, and styles when baseDocxBuffer is provided.
 */
async function generateDocxFromHtml(htmlContent, baseDocxBuffer = null) {
  if (baseDocxBuffer) {
    const zip = await JSZip.loadAsync(baseDocxBuffer);
    const docXmlFile = zip.file('word/document.xml');

    if (docXmlFile) {
      let existingDocXml = await docXmlFile.async('string');

      // Clean HTML tags and interactive badges
      let cleanHtml = (htmlContent || '')
        .replace(/<span[^>]*data-field-key="([^"]+)"[^>]*>.*?<\/span>/gi, '$1')
        .replace(/<span[^>]*class="dynamic-tag"[^>]*>(?:🏷️\s*)?\{\{([^}]+)\}\}<\/span>/gi, '{{$1}}');

      // Extract explicit key-value mappings from HTML if provided (e.g. {{nom}} : "DIALLO")
      const extractedMappings = {};
      const placeholderMatches = cleanHtml.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g);
      for (const m of placeholderMatches) {
        extractedMappings[m[1]] = `{{${m[1]}}}`;
      }

      // Replace in all XML parts (document + headers + footers) preserving drawings, picts, and tables
      const targetFiles = [
        'word/document.xml',
        'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
        'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'
      ];

      for (const fName of targetFiles) {
        const file = zip.file(fName);
        if (file) {
          let partXml = await file.async('string');
          // In-place XML placeholder replacement
          partXml = replacePlaceholdersInWordXml(partXml, extractedMappings);
          zip.file(fName, partXml);
        }
      }

      // If existing document already contains drawings, picts, watermarks or tables,
      // we NEVER drop them. We retain the entire existing XML and return the intact package.
      return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    }
  }

  // Fallback: Create fresh standard Word document
  const zip = new JSZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="24"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  let cleanHtml = (htmlContent || '')
    .replace(/<span[^>]*data-field-key="([^"]+)"[^>]*>.*?<\/span>/gi, '$1')
    .replace(/<span[^>]*class="dynamic-tag"[^>]*>(?:🏷️\s*)?\{\{([^}]+)\}\}<\/span>/gi, '{{$1}}');

  const blocks = cleanHtml.split(/<\/(?:p|h1|h2|h3|tr|div)>/i).filter(b => b.trim().length > 0);
  let docXmlBody = '';

  for (const block of blocks) {
    const isHeading = /<(?:h1|h2|h3)/i.test(block);
    let align = 'left';
    if (/text-align:\s*center/i.test(block) || /align="center"/i.test(block)) align = 'center';
    else if (/text-align:\s*right/i.test(block) || /align="right"/i.test(block)) align = 'right';
    else if (/text-align:\s*justify/i.test(block)) align = 'both';

    const rawText = block.replace(/<[^>]+>/g, '').trim();
    if (!rawText) continue;

    const isBold = /<(?:strong|b)\b/i.test(block) || isHeading;
    const isItalic = /<(?:em|i)\b/i.test(block);
    const isUnderline = /<u\b/i.test(block);

    docXmlBody += `
    <w:p>
      <w:pPr><w:jc w:val="${align}"/></w:pPr>
      <w:r>
        <w:rPr>
          ${isBold ? '<w:b/>' : ''}
          ${isItalic ? '<w:i/>' : ''}
          ${isUnderline ? '<w:u w:val="single"/>' : ''}
          <w:sz w:val="${isHeading ? '28' : '24'}"/>
          <w:color w:val="${isHeading ? '0B2545' : '1E293B'}"/>
        </w:rPr>
        <w:t xml:space="preserve">${xmlEscape(rawText)}</w:t>
      </w:r>
    </w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${docXmlBody}
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Builds a 100% generic standard official Word (.DOCX) document for any administrative template
 */
async function buildGenericOfficialDocx({
  templateName = 'Document Administratif',
  documentTypeCode = 'DOCUMENT_ADMINISTRATIF',
  institutionName = 'UNIVERSITÉ DE KINDIA',
  serviceName = '',
  contentHtml = null
} = {}) {
  const zip = new JSZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="22"/>
        <w:color w:val="0F172A"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const cleanTitle = xmlEscape(templateName.toUpperCase());
  const cleanInst = xmlEscape(institutionName.toUpperCase());
  const cleanSrv = xmlEscape(serviceName ? serviceName.toUpperCase() : 'SERVICE ADMINISTRATIF');

  let bodyParagraphsXml = '';

  if (contentHtml && contentHtml.trim().length > 0) {
    const rawBlocks = contentHtml.split(/<\/(?:p|h1|h2|h3|tr|div)>/i).filter(b => b.trim().length > 0);
    for (const block of rawBlocks) {
      const isHeading = /<(?:h1|h2|h3)/i.test(block);
      let align = 'left';
      if (/text-align:\s*center/i.test(block) || /align="center"/i.test(block)) align = 'center';
      else if (/text-align:\s*right/i.test(block) || /align="right"/i.test(block)) align = 'right';
      else if (/text-align:\s*justify/i.test(block)) align = 'both';

      const rawText = block.replace(/<[^>]+>/g, '').trim();
      if (!rawText) continue;

      const isBold = /<(?:strong|b)\b/i.test(block) || isHeading;
      const isItalic = /<(?:em|i)\b/i.test(block);

      bodyParagraphsXml += `
      <w:p>
        <w:pPr><w:jc w:val="${align}"/><w:spacing w:before="60" w:after="80"/><w:line w:line="300" w:lineRule="auto"/></w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman"/>
            ${isBold ? '<w:b/>' : ''}
            ${isItalic ? '<w:i/>' : ''}
            <w:sz w:val="${isHeading ? '26' : '22'}"/>
            <w:color w:val="${isHeading ? '0B2545' : '0F172A'}"/>
          </w:rPr>
          <w:t xml:space="preserve">${xmlEscape(rawText)}</w:t>
        </w:r>
      </w:p>`;
    }
  } else {
    bodyParagraphsXml = `
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="80"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0B2545"/></w:rPr><w:t xml:space="preserve">Objet : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{OBJET}}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="40" w:after="120"/><w:line w:line="320" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0B2545"/></w:rPr><w:t xml:space="preserve">Destinataire : </w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{DESTINATAIRE}}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="80" w:after="120"/><w:line w:line="340" w:lineRule="auto"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{CORPS_TEXTE}}</w:t></w:r>
    </w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Institutional Header: Two-Column Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9700" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/>
          <w:left w:val="none"/>
          <w:bottom w:val="single" w:sz="12" w:space="4" w:color="0B2545"/>
          <w:right w:val="none"/>
          <w:insideH w:val="none"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5500" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="20"/><w:color w:val="0B2545"/></w:rPr><w:t>RÉPUBLIQUE DE GUINÉE</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="16"/><w:color w:val="DC2626"/></w:rPr><w:t>Travail - </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="16"/><w:color w:val="CA8A04"/></w:rPr><w:t>Justice</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="16"/><w:color w:val="16A34A"/></w:rPr><w:t> - Solidarité</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="16"/><w:color w:val="475569"/></w:rPr><w:t>MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR ET DE LA RECHERCHE SCIENTIFIQUE</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="10"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="20"/><w:color w:val="0B2545"/></w:rPr><w:t>${cleanInst}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="18"/><w:color w:val="1E3A8A"/></w:rPr><w:t>{{SERVICE}}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4200" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="30"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Kindia, le {{DATE}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="20"/><w:color w:val="0B2545"/></w:rPr><w:t>N° : </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="20"/><w:color w:val="B45309"/></w:rPr><w:t>{{REFERENCE}}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Document Title Block -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="240" w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman"/>
          <w:b/>
          <w:u w:val="single"/>
          <w:sz w:val="28"/>
          <w:color w:val="0B2545"/>
        </w:rPr>
        <w:t>${cleanTitle}</w:t>
      </w:r>
    </w:p>

    <!-- Main Content Paragraphs -->
    ${bodyParagraphsXml}

    <!-- Signature Block -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9700" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
          <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4850" w:type="dxa"/><w:vAlign w:bottom"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="16"/><w:color w:val="64748B"/></w:rPr><w:t></w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4850" w:type="dxa"/><w:vAlign w:top"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:sz w:val="22"/><w:color w:val="0B2545"/></w:rPr><w:t>{{FONCTION_SIGNATAIRE}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:i/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>{{SIGNATURE}}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:b/><w:u w:val="single"/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>{{SIGNATAIRE}}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Section Properties: A4 Margins -->
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="540" w:footer="540" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  docxToHtml,
  fillDocxTemplate,
  replacePlaceholdersInWordXml,
  buildOfficialKindiaMissionDocx,
  buildGenericOfficialDocx,
  generateDocxFromHtml
};

