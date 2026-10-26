import jsPDF from 'jspdf';
import { apiFetch } from '../components/api/apiFetch';
import dejavuSansTtfUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import CESI_logo from '../assets/CESI-logo.jpg';

/**
 * Shared PDF letterhead utilities.
 *
 * Provides a clean, stacked report header (school logo, name, address,
 * contact, motto) with text wrapping and HTML stripping so CMS rich-text
 * fields never leak raw markup (<p>, &nbsp; etc.) into exported PDFs.
 *
 * Usage:
 *   import { drawReportHeader, fetchSchoolInfo, ensurePdfFont, stripHtml } from '.../pdfReportHeader';
 */

export const DEFAULT_SCHOOL_INFO = {
  school_name: 'Caloocan Evangelical School Inc.',
  about_text: 'Quality Christian Education for All',
  address: '#47 P. Zamora St. Caloocan City, Metro Manila',
  phone_number: '(02) 8-285-3702 / 0905-299-6303',
  email: 'caloocanevangelicalschool@gmail.com',
};

// Strip HTML tags and decode entities so CMS rich-text fields render as plain text.
export const stripHtml = (value) => {
  if (!value) return '';
  if (typeof document === 'undefined') {
    return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  const text = div.textContent || div.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
};

export const formatReportDate = (date = new Date()) =>
  date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

let pdfFontReady;
export const ensurePdfFont = async (doc) => {
  if (!pdfFontReady) {
    pdfFontReady = (async () => {
      const response = await fetch(dejavuSansTtfUrl);
      if (!response.ok) throw new Error('Failed to load PDF font');
      const fontBuffer = await response.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(fontBuffer);
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      return btoa(binary);
    })();
  }

  const fontBase64 = await pdfFontReady;
  if (!doc.getFontList().DejaVuSans) {
    doc.addFileToVFS('DejaVuSans.ttf', fontBase64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    // Register bold/italic variants to the same single-weight file so that
    // setFont('DejaVuSans', 'bold'|'italic') never falls back to a broken glyph
    // or throws. Text renders at normal weight but glyphs (é, ñ, ₱) stay correct.
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'bold');
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'italic');
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'bolditalic');
  }
  doc.setFont('DejaVuSans', 'normal');
};

let logoDataUrlPromise;
export const getLogoDataUrl = () => {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = (async () => {
      try {
        const response = await fetch(CESI_logo);
        if (!response.ok) throw new Error('Failed to load logo');
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.warn('Failed to load school logo for report header:', error);
        return null;
      }
    })();
  }
  return logoDataUrlPromise;
};

/**
 * Fetch school identification (name/about + address/contact) from the CMS,
 * falling back to defaults when endpoints are unavailable.
 */
export const fetchSchoolInfo = async () => {
  const info = { ...DEFAULT_SCHOOL_INFO };
  try {
    const [schoolRes, contactRes] = await Promise.all([
      apiFetch('/api/cms/school-info/'),
      apiFetch('/api/cms/contact-inquiry/'),
    ]);
    const schoolData = await schoolRes.json();
    let contactData = {};
    try {
      contactData = await contactRes.json();
    } catch (e) {
      contactData = {};
    }
    info.school_name = stripHtml(schoolData.school_name) || DEFAULT_SCHOOL_INFO.school_name;
    info.about_text = stripHtml(schoolData.about_text) || DEFAULT_SCHOOL_INFO.about_text;
    info.address = stripHtml(contactData.address) || DEFAULT_SCHOOL_INFO.address;
    info.phone_number = stripHtml(contactData.phone_number) || DEFAULT_SCHOOL_INFO.phone_number;
    info.email = stripHtml(contactData.email) || DEFAULT_SCHOOL_INFO.email;
  } catch (error) {
    console.warn('Error fetching school info for report header:', error);
  }
  return info;
};

/**
 * Draw the letterhead (centered logo, school name, address, contact, motto,
 * dividers, report title and generation date) and return the Y position to
 * resume content. `schoolInfo` may be a plain object; `title` is the report
 * heading shown under the letterhead.
 */
export const drawReportHeader = async (doc, { title, period, schoolInfo, pageWidth }) => {
  const width = pageWidth || doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentWidth = width - marginX * 2;
  const centerX = width / 2;
  const logoDataUrl = await getLogoDataUrl();

  const schoolName = stripHtml(schoolInfo?.school_name) || DEFAULT_SCHOOL_INFO.school_name;
  const address = stripHtml(schoolInfo?.address) || DEFAULT_SCHOOL_INFO.address;
  const contact = [stripHtml(schoolInfo?.phone_number), stripHtml(schoolInfo?.email)]
    .filter(Boolean)
    .join('  •  ');
  const motto = stripHtml(schoolInfo?.about_text);

  let y = 10;

  if (logoDataUrl) {
    try {
      const logoSize = 18;
      doc.addImage(logoDataUrl, 'JPEG', centerX - logoSize / 2, y, logoSize, logoSize);
      y += logoSize + 4;
    } catch (err) {
      console.warn('Failed to embed logo in header:', err);
    }
  }

  doc.setFontSize(16);
  doc.setTextColor(33, 37, 41);
  doc.setFont('DejaVuSans', 'normal');
  const nameLines = doc.splitTextToSize(schoolName, contentWidth);
  doc.text(nameLines, centerX, y + 4, { align: 'center' });
  y += nameLines.length * 6 + 6;

  if (address) {
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    const addressLines = doc.splitTextToSize(address, contentWidth);
    doc.text(addressLines, centerX, y, { align: 'center' });
    y += addressLines.length * 4.5 + 3;
  }

  if (contact) {
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    const contactLines = doc.splitTextToSize(contact, contentWidth);
    doc.text(contactLines, centerX, y, { align: 'center' });
    y += contactLines.length * 4.5 + 3;
  }

  if (motto) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const mottoLines = doc.splitTextToSize(motto, contentWidth);
    doc.text(mottoLines, centerX, y, { align: 'center' });
    y += mottoLines.length * 4 + 3;
  }

  doc.setDrawColor(79, 110, 247);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, width - marginX, y);
  y += 8;

  if (title) {
    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    const titleLines = doc.splitTextToSize(title, contentWidth);
    doc.text(titleLines, centerX, y + 4, { align: 'center' });
    y += titleLines.length * 6 + 6;
  }

  doc.setFontSize(8.5);
  doc.setTextColor(108, 117, 125);
  const metaText = `Generated: ${formatReportDate()}${period ? `     •     Report Period: ${period}` : ''}`;
  const metaLines = doc.splitTextToSize(metaText, contentWidth);
  doc.text(metaLines, centerX, y, { align: 'center' });
  y += metaLines.length * 4.5 + 4;

  doc.line(marginX, y, width - marginX, y);
  y += 8;

  return y;
};

/**
 * Build the school letterhead values for an Excel worksheet.
 * Returns an array of { text, font } rows meant to be written as the top rows
 * of the sheet. The caller decides merge/alignment based on its column count.
 */
export const buildExcelHeaderRows = (schoolInfo, { title, period } = {}) => {
  const info = schoolInfo || DEFAULT_SCHOOL_INFO;
  const rows = [];

  rows.push({ text: stripHtml(info.school_name), size: 14, bold: true });

  const addressBits = [stripHtml(info.address), stripHtml(info.phone_number), stripHtml(info.email)]
    .filter(Boolean);
  if (addressBits.length) {
    rows.push({ text: addressBits.join('  •  '), size: 9, bold: false });
  }

  const motto = stripHtml(info.about_text);
  if (motto) {
    rows.push({ text: motto, size: 8, bold: false, italic: true });
  }

  rows.push({ text: '', size: 9, bold: false }); // spacer

  if (title) {
    rows.push({ text: title, size: 12, bold: true });
  }

  const meta = `Generated: ${formatReportDate()}${period ? `  •  ${period}` : ''}`;
  rows.push({ text: meta, size: 9, bold: false });

  rows.push({ text: '', size: 9, bold: false }); // spacer before table header

  return rows;
};

/**
 * Write letterhead rows onto an ExcelJS worksheet and return the next row
 * number (1-based) where table content should begin.
 * `columnCount` is used to merge the single-cell header lines across the table.
 */
export const writeExcelHeader = (worksheet, schoolInfo, { title, period, columnCount } = {}) => {
  const rows = buildExcelHeaderRows(schoolInfo, { title, period });
  let rowNum = 1;

  rows.forEach((row, idx) => {
    const rowRef = worksheet.getRow(rowNum);
    const cell = rowRef.getCell(1);
    cell.value = row.text;
    cell.font = {
      bold: !!row.bold,
      italic: !!row.italic,
      size: row.size || 9,
      color: { argb: idx === 0 ? 'FF1F2937' : 'FF6B7280' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (columnCount && columnCount > 1) {
      worksheet.mergeCells(rowNum, 1, rowNum, columnCount);
      for (let c = 2; c <= columnCount; c++) {
        rowRef.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
    rowNum += 1;
  });

  return rowNum;
};

export { jsPDF };