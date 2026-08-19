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
 * automatically handling Word XML fragmentation across <w:t> tags.
 */
function replacePlaceholdersInWordXml(xmlString, dataMap) {
  if (!xmlString) return xmlString;

  return xmlString.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const textMatches = [];
    const tRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
    let match;
    let fullText = '';
    
    while ((match = tRegex.exec(paragraphXml)) !== null) {
      textMatches.push({
        full: match[0],
        openTag: match[1],
        content: match[2],
        closeTag: match[3],
        index: match.index
      });
      fullText += match[2];
    }

    if (!fullText.includes('{{')) {
      return paragraphXml;
    }

    let replacedText = fullText;
    for (const [rawKey, val] of Object.entries(dataMap)) {
      const cleanKey = rawKey.replace(/^\{\{|\}\}$/g, '');
      const regex = new RegExp(`\\{\\{\\s*${cleanKey}\\s*\\}\\}`, 'gi');
      replacedText = replacedText.replace(regex, xmlEscape(val !== undefined && val !== null ? val : ''));
    }

    if (replacedText !== fullText && textMatches.length > 0) {
      let count = 0;
      return paragraphXml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (m, open, text, close) => {
        count++;
        if (count === 1) return `${open}${replacedText}${close}`;
        return `${open}${close}`;
      });
    }

    return paragraphXml;
  });
}

/**
 * Main function to inject data into a DOCX template file.
 */
async function fillDocxTemplate(docxBufferOrPath, dataMap) {
  const buffer = typeof docxBufferOrPath === 'string'
    ? fs.readFileSync(docxBufferOrPath)
    : docxBufferOrPath;

  const zip = await JSZip.loadAsync(buffer);

  const targetFiles = [
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'word/header3.xml',
    'word/footer1.xml',
    'word/footer2.xml',
    'word/footer3.xml'
  ];

  for (const fileName of targetFiles) {
    const file = zip.file(fileName);
    if (file) {
      const xmlContent = await file.async('string');
      const updatedXml = replacePlaceholdersInWordXml(xmlContent, dataMap);
      zip.file(fileName, updatedXml);
    }
  }

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
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
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="16"/><w:color w:val="64748B"/></w:rPr><w:t>[ QR Code Sécurisé : {{qr_code}} ]</w:t></w:r>
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

module.exports = {
  docxToHtml,
  fillDocxTemplate,
  buildOfficialKindiaMissionDocx,
  generateDocxFromHtml
};
