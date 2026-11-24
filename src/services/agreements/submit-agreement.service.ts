export interface AgreementAttachment {
  filename: string;
  content: string;
}

export interface SubmitAgreementPayload {
  company: string;
  country: string;
  name: string;
  title: string;
  email_address: string;
  date: string;
  attachments: AgreementAttachment[];
}

export interface SubmitAgreementServiceResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}

export async function submitAgreementService(
  payload: SubmitAgreementPayload
): Promise<SubmitAgreementServiceResponse> {
  const rawBaseUrl =
    import.meta.env.BACKEND_API_URL ?? process.env.BACKEND_API_URL ?? '';
  const apiKey =
    import.meta.env.BACKEND_API_KEY ?? process.env.BACKEND_API_KEY ?? '';

  if (!rawBaseUrl || !apiKey) {
    throw new Error(
      'Missing BACKEND_API_URL or BACKEND_API_KEY environment variables.'
    );
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/forms/confidentiality-agreement/submit`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsedBody = responseText;
  }

  if (!response.ok) {
    const errorMessage =
      typeof parsedBody === 'object' &&
      parsedBody !== null &&
      'message' in parsedBody &&
      typeof (parsedBody as { message?: unknown }).message === 'string'
        ? (parsedBody as { message: string }).message
        : `Backend submission failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return {
    success: true,
    data: parsedBody,
    message: 'Agreement submitted successfully',
  };
}
