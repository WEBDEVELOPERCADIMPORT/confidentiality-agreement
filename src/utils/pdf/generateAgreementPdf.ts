import { jsPDF } from 'jspdf';
import type { AgreementData } from '../../actions/agreements/get-agreement-by-slug.action';

export interface RecipientSignaturePayload {
  companyName: string;
  country: string;
  representativeName: string;
  title: string;
  email: string;
  date: string;
  signatureDataUrl: string;
}

export interface AgreementPdfLabels {
  disclosingPartyTitle: string;
  receivingPartyTitle: string;
  companyLabel: string;
  countryLabel: string;
  representativeLabel: string;
  titleLabel: string;
  emailLabel: string;
  dateLabel: string;
  signatureLabel: string;
  authorizedSignatureLine: string;
  pageLabel: string;
  ofLabel: string;
}

export interface GenerateAgreementPdfParams {
  agreement: AgreementData;
  recipient: RecipientSignaturePayload;
  labels: AgreementPdfLabels;
  logoUrl?: string;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function sanitizeFileSegment(value: string): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'Recipient';
}

export interface GeneratedAgreementPdf {
  fileName: string;
  base64: string;
}

async function optimizeImageForPdf(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  format: 'JPEG' | 'PNG'
): Promise<string> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = dataUrl;
    });

    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    if (format === 'JPEG') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return format === 'JPEG'
      ? canvas.toDataURL('image/jpeg', 0.82)
      : canvas.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
}

export async function generateAgreementPdf({
  agreement,
  recipient,
  labels,
  logoUrl = '/images/home/logo.png',
}: GenerateAgreementPdfParams): Promise<GeneratedAgreementPdf> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginTop = 20;
  const marginBottom = 22;
  const contentWidth = pageWidth - marginX * 2;
  let y = marginTop;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  // Optional header logo
  const rawLogoDataUrl = await loadImageAsDataUrl(logoUrl);
  const logoDataUrl = rawLogoDataUrl
    ? await optimizeImageForPdf(rawLogoDataUrl, 220, 220, 'JPEG')
    : null;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'JPEG', marginX, y, 22, 22, undefined, 'FAST');
    } catch {
      // Ignore invalid image format silently
    }
  }

  // Institutional header text
  const headerTextX = logoDataUrl ? marginX + 27 : marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(agreement.cadImport.company.toUpperCase(), headerTextX, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(agreement.cadImport.jurisdiction, headerTextX, y + 11.5);
  doc.text(
    `${agreement.content.effectiveDateLabel}: ${recipient.date}`,
    headerTextX,
    y + 17
  );

  y += logoDataUrl ? 26 : 21;

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 9;

  // Document Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(agreement.content.title, pageWidth / 2, y, { align: 'center' });
  y += 6.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  const subtitleLines = doc.splitTextToSize(
    agreement.content.subtitle,
    contentWidth
  );
  doc.text(subtitleLines, pageWidth / 2, y, { align: 'center' });
  y += subtitleLines.length * 5 + 6;

  // Parties box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  const disclosingLines = doc.splitTextToSize(
    `${agreement.content.parties.disclosingLabel}: ${agreement.content.parties.disclosingDetails}`,
    contentWidth - 8
  );
  const receivingLines = doc.splitTextToSize(
    `${agreement.content.parties.receivingLabel}: ${recipient.companyName} (${recipient.country})`,
    contentWidth - 8
  );
  const partiesBoxHeight =
    (disclosingLines.length + receivingLines.length) * 4.6 + 10;

  ensureSpace(partiesBoxHeight + 4);
  doc.roundedRect(marginX, y, contentWidth, partiesBoxHeight, 2, 2, 'FD');

  let boxY = y + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(disclosingLines, marginX + 4, boxY);
  boxY += disclosingLines.length * 4.6 + 2.5;
  doc.text(receivingLines, marginX + 4, boxY);

  y += partiesBoxHeight + 8;

  // Intro
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const introLines = doc.splitTextToSize(agreement.content.intro, contentWidth);
  for (const line of introLines) {
    ensureSpace(5.2);
    doc.text(line, marginX, y);
    y += 5;
  }
  y += 5;

  // Clauses 1..9
  for (const clause of agreement.content.clauses) {
    const heading = `${clause.number}. ${clause.title}`;
    const bodyLines = doc.splitTextToSize(clause.body, contentWidth);

    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(heading, marginX, y);
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.8);
    doc.setTextColor(51, 65, 85);
    for (const line of bodyLines) {
      ensureSpace(5);
      doc.text(line, marginX, y);
      y += 4.8;
    }
    y += 4.5;
  }

  // Signature Blocks
  ensureSpace(78);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  const colGap = 10;
  const colWidth = (contentWidth - colGap) / 2;
  const leftX = marginX;
  const rightX = marginX + colWidth + colGap;
  const sigStartY = y;

  // Left Column: Disclosing Party (CAD Import Inc. - hardcoded from JSON)
  let leftY = sigStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(labels.disclosingPartyTitle, leftX, leftY);
  leftY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`${labels.companyLabel}: ${agreement.cadImport.company}`, leftX, leftY);
  leftY += 5;
  doc.text(
    `${labels.representativeLabel}: ${agreement.cadImport.representativeName}`,
    leftX,
    leftY
  );
  leftY += 5;
  const cadTitleLines = doc.splitTextToSize(
    `${labels.titleLabel}: ${agreement.cadImport.title}`,
    colWidth
  );
  doc.text(cadTitleLines, leftX, leftY);
  leftY += cadTitleLines.length * 4.5 + 2;
  doc.text(`${labels.dateLabel}: ${recipient.date}`, leftX, leftY);
  leftY += 6;

  // CAD Import Signature area
  if (agreement.cadImport.signatureDataUrl) {
    try {
      const rawCadSig = agreement.cadImport.signatureDataUrl.startsWith('data:')
        ? agreement.cadImport.signatureDataUrl
        : await loadImageAsDataUrl(agreement.cadImport.signatureDataUrl);

      if (rawCadSig) {
        const optimizedCadSig = await optimizeImageForPdf(
          rawCadSig,
          420,
          160,
          'JPEG'
        );
        doc.addImage(
          optimizedCadSig,
          'JPEG',
          leftX,
          leftY,
          48,
          18,
          undefined,
          'FAST'
        );
      }
    } catch {
      // Fallback to line only
    }
  }
  const cadLineY = leftY + 20;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(leftX, cadLineY, leftX + colWidth - 4, cadLineY);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(labels.authorizedSignatureLine, leftX, cadLineY + 4);

  // Right Column: Receiving Party (Recipient)
  let rightY = sigStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(labels.receivingPartyTitle, rightX, rightY);
  rightY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const recCompanyLines = doc.splitTextToSize(
    `${labels.companyLabel}: ${recipient.companyName}`,
    colWidth
  );
  doc.text(recCompanyLines, rightX, rightY);
  rightY += recCompanyLines.length * 4.5 + 0.5;

  doc.text(`${labels.countryLabel}: ${recipient.country}`, rightX, rightY);
  rightY += 5;

  const recRepLines = doc.splitTextToSize(
    `${labels.representativeLabel}: ${recipient.representativeName}`,
    colWidth
  );
  doc.text(recRepLines, rightX, rightY);
  rightY += recRepLines.length * 4.5 + 0.5;

  const recTitleLines = doc.splitTextToSize(
    `${labels.titleLabel}: ${recipient.title}`,
    colWidth
  );
  doc.text(recTitleLines, rightX, rightY);
  rightY += recTitleLines.length * 4.5 + 0.5;

  doc.text(`${labels.emailLabel}: ${recipient.email}`, rightX, rightY);
  rightY += 5;
  doc.text(`${labels.dateLabel}: ${recipient.date}`, rightX, rightY);
  rightY += 5;

  // Recipient signature image
  const recSigBoxY = Math.max(rightY, leftY);
  if (recipient.signatureDataUrl) {
    try {
      const optimizedSig = await optimizeImageForPdf(
        recipient.signatureDataUrl,
        420,
        160,
        'JPEG'
      );
      doc.addImage(
        optimizedSig,
        'JPEG',
        rightX,
        recSigBoxY,
        48,
        18,
        undefined,
        'FAST'
      );
    } catch {
      // Ignore if image fails
    }
  }
  const recLineY = recSigBoxY + 20;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(rightX, recLineY, rightX + colWidth - 4, recLineY);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(labels.signatureLabel, rightX, recLineY + 4);

  // Page numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${labels.pageLabel} ${i} ${labels.ofLabel} ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const fileName = `${agreement.fileNamePrefix}-${sanitizeFileSegment(recipient.companyName)}.pdf`;
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split('base64,')[1] ?? '';
  return { fileName, base64 };
}
