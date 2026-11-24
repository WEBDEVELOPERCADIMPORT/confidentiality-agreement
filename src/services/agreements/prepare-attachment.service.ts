import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

export interface RecipientMetadata {
  company: string;
  country: string;
  name: string;
  title: string;
  email_address: string;
  date: string;
}

export interface PrepareAttachmentParams {
  fileName: string;
  slug: string;
  recipient: RecipientMetadata;
}

export interface PreparedAttachmentResult {
  filename: string;
  content: string;
  trackingId: string;
}

export async function prepareAgreementAttachmentService({
  fileName,
  slug,
  recipient,
}: PrepareAttachmentParams): Promise<PreparedAttachmentResult> {
  const filePath = resolve(process.cwd(), 'private_assets', fileName);
  const pdfBytes = await readFile(filePath);

  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
  });

  const trackingId = crypto.randomUUID();

  pdfDoc.setSubject(
    `NDA Tracking ID: ${trackingId} | Recipient: ${recipient.company} (${recipient.email_address})`
  );
  pdfDoc.setAuthor(`${recipient.name} - ${recipient.company}`);
  pdfDoc.setCreator('CAD Import Inc. Confidentiality Agreement Portal');
  pdfDoc.setProducer(`CAD-NDA-${trackingId}`);
  pdfDoc.setKeywords([
    `trackingId:${trackingId}`,
    `slug:${slug}`,
    `company:${recipient.company}`,
    `country:${recipient.country}`,
    `recipient:${recipient.name}`,
    `title:${recipient.title}`,
    `email:${recipient.email_address}`,
    `date:${recipient.date}`,
  ]);

  const modifiedBytes = await pdfDoc.save();
  const base64 = Buffer.from(modifiedBytes).toString('base64');

  return {
    filename: fileName,
    content: base64,
    trackingId,
  };
}
