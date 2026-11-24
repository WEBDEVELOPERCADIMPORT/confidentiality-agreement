import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import {
  getAgreementBySlugService,
  type AgreementData,
  type AgreementClause,
  type AgreementParties,
  type AgreementLocaleContent,
  type CadImportSigner,
} from '../../services/agreements/get-agreements.service';

export type {
  AgreementData,
  AgreementClause,
  AgreementParties,
  AgreementLocaleContent,
  CadImportSigner,
};

export interface GetAgreementBySlugResult {
  message: string;
  data: AgreementData;
}

export const getAgreementBySlug = defineAction({
  input: z.object({
    slug: z.string().min(1, 'Agreement slug is required'),
  }),
  handler: async ({ slug }): Promise<GetAgreementBySlugResult> => {
    try {
      const found = await getAgreementBySlugService(slug);

      if (!found) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: `Agreement with slug "${slug}" not found`,
        });
      }

      return {
        message: 'Agreement retrieved successfully',
        data: found,
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
            : 'Failed to retrieve agreement',
      });
    }
  },
});
