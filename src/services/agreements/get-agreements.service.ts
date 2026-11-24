export interface AgreementClause {
  number: string;
  title: string;
  body: string;
}

export interface AgreementParties {
  disclosingLabel: string;
  disclosingDetails: string;
  receivingLabel: string;
  receivingDetails: string;
}

export interface AgreementLocaleContent {
  title: string;
  subtitle: string;
  effectiveDateLabel: string;
  parties: AgreementParties;
  intro: string;
  clauses: AgreementClause[];
}

export interface CadImportSigner {
  company: string;
  jurisdiction: string;
  representativeName: string;
  title: string;
  signatureDataUrl: string;
}

export interface AgreementAttachmentRef {
  filename: string;
  path: string;
}

export interface AgreementData {
  id: string;
  slug: string;
  fileNamePrefix: string;
  attachmentPdf?: AgreementAttachmentRef;
  cadImport: CadImportSigner;
  content: AgreementLocaleContent;
}

interface RemoteAgreementData {
  slug: string;
  file_name_prefix?: string;
  attachment_pdf?: string | { filename?: string; path?: string };
  signature?: string;
  cad_import: {
    company: string;
    jurisdiction: string;
    representative_name: string;
    title: string;
    signature_data_url?: string;
  };
  title: string;
  subtitle: string;
  effective_date_label?: string;
  parties: {
    disclosing_label: string;
    disclosing_details: string;
    receiving_label: string;
    receiving_details: string;
  };
  intro: string;
  clauses: AgreementClause[];
}

interface RemoteContentItem {
  id: string;
  data: RemoteAgreementData;
}

interface RemoteContentResponse {
  status?: string;
  message?: string;
  items?: RemoteContentItem[];
}

function getBackendConfig(): { baseUrl: string; apiKey: string } {
  const rawBaseUrl =
    import.meta.env.BACKEND_API_URL ?? process.env.BACKEND_API_URL ?? '';
  const apiKey =
    import.meta.env.BACKEND_API_KEY ?? process.env.BACKEND_API_KEY ?? '';

  if (!rawBaseUrl || !apiKey) {
    throw new Error(
      'Missing BACKEND_API_URL or BACKEND_API_KEY environment variables.'
    );
  }

  return {
    baseUrl: rawBaseUrl.replace(/\/+$/, ''),
    apiKey,
  };
}

function normalizeAttachmentPdf(
  raw?: string | { filename?: string; path?: string }
): AgreementAttachmentRef | undefined {
  if (!raw) return undefined;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const rawName = trimmed.split('/').pop() || 'attachment.pdf';
    const filename = decodeURIComponent(rawName.split('?')[0]);
    return { filename, path: trimmed };
  }

  const trimmedPath = raw.path?.trim();
  if (!trimmedPath) return undefined;
  return {
    filename: raw.filename?.trim() || 'attachment.pdf',
    path: trimmedPath,
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(source: string): Promise<string> {
  const trimmed = source.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;

  try {
    const response = await fetch(trimmed);
    if (!response.ok) return '';
    const contentType =
      response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
    return `data:${contentType};base64,${base64}`;
  } catch {
    return '';
  }
}

async function mapRemoteItem(item: RemoteContentItem): Promise<AgreementData> {
  const d = item.data;
  const rawSignature =
    d.signature?.trim() || d.cad_import.signature_data_url?.trim() || '';
  const signatureDataUrl = await fetchImageAsDataUrl(rawSignature);

  return {
    id: item.id,
    slug: d.slug,
    fileNamePrefix: d.file_name_prefix || `NDA-${d.slug}`,
    attachmentPdf: normalizeAttachmentPdf(d.attachment_pdf),
    cadImport: {
      company: d.cad_import.company,
      jurisdiction: d.cad_import.jurisdiction,
      representativeName: d.cad_import.representative_name,
      title: d.cad_import.title,
      signatureDataUrl,
    },
    content: {
      title: d.title,
      subtitle: d.subtitle,
      effectiveDateLabel: d.effective_date_label || 'Effective Date',
      parties: {
        disclosingLabel: d.parties.disclosing_label,
        disclosingDetails: d.parties.disclosing_details,
        receivingLabel: d.parties.receiving_label,
        receivingDetails: d.parties.receiving_details,
      },
      intro: d.intro,
      clauses: Array.isArray(d.clauses) ? d.clauses : [],
    },
  };
}

export async function getAgreementsService(
  filters?: Record<string, string>
): Promise<AgreementData[]> {
  const { baseUrl, apiKey } = getBackendConfig();
  const url = new URL(`${baseUrl}/content/confidentiality-agreement`);

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch confidentiality agreements (status ${response.status})`
    );
  }

  const json = (await response.json()) as RemoteContentResponse;
  const items = Array.isArray(json.items) ? json.items : [];
  return Promise.all(items.map(mapRemoteItem));
}

export async function getAgreementBySlugService(
  slug: string
): Promise<AgreementData | null> {
  const items = await getAgreementsService({ slug });
  return items.find((item) => item.slug === slug) ?? null;
}
