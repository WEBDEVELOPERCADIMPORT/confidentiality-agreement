import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { getAgreementBySlugService } from '../../services/agreements/get-agreements.service';
import {
  submitAgreementService,
  type AgreementAttachment,
} from '../../services/agreements/submit-agreement.service';

export interface SubmitAgreementResult {
  message: string;
  data: {
    email: string;
    submitted: boolean;
  };
}

export const submitAgreement = defineAction({
  input: z.object({
    slug: z.string().min(1, 'Agreement slug is required'),
    company: z.string().min(1, 'Company name is required'),
    country: z.string().min(1, 'Country is required'),
    name: z.string().min(1, 'Authorized representative name is required'),
    title: z.string().min(1, 'Title is required'),
    email_address: z.string().email('Invalid email address'),
    date: z.string().min(1, 'Date is required'),
    filename: z.string().min(1, 'PDF filename is required'),
    pdfBase64: z.string().min(1, 'PDF content is required'),
  }),
  handler: async (input): Promise<SubmitAgreementResult> => {
    try {
      const found = await getAgreementBySlugService(input.slug);

      if (!found) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: `Agreement with slug "${input.slug}" not found`,
        });
      }

      const attachments: AgreementAttachment[] = [
        {
          filename: input.filename,
          content: input.pdfBase64,
        },
      ];

      if (found.attachmentPdf?.path) {
        attachments.push({
          filename: found.attachmentPdf.filename,
          path: found.attachmentPdf.path,
        });
      }

      await submitAgreementService({
        company: input.company,
        country: input.country,
        name: input.name,
        title: input.title,
        email_address: input.email_address,
        date: input.date,
        attachments,
      });

      return {
        message: 'Confidentiality agreement submitted successfully',
        data: {
          email: input.email_address,
          submitted: true,
        },
      };
    } catch (error) {
      if (error instanceof ActionError) {
        throw error;
      }
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit confidentiality agreement',
      });
    }
  },
});
