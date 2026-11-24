import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import agreementsData from '../../data/agreements/agreements.data.json';

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

export interface AgreementData {
  slug: string;
  fileNamePrefix: string;
  cadImport: CadImportSigner;
  content: AgreementLocaleContent;
}

export interface GetAgreementBySlugResult {
  message: string;
  data: AgreementData;
}

interface RawAgreementEntry {
  slug: string;
  fileNamePrefix: string;
  cadImport: CadImportSigner;
  en: AgreementLocaleContent;
}

export const getAgreementBySlug = defineAction({
  input: z.object({
    slug: z.string().min(1, 'Agreement slug is required'),
  }),
  handler: async ({ slug }): Promise<GetAgreementBySlugResult> => {
    const entries = (agreementsData.agreements ?? []) as RawAgreementEntry[];
    const found = entries.find((item) => item.slug === slug);

    if (!found) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: `Agreement with slug "${slug}" not found`,
      });
    }

    return {
      message: 'Agreement retrieved successfully',
      data: {
        slug: found.slug,
        fileNamePrefix: found.fileNamePrefix,
        cadImport: found.cadImport,
        content: found.en,
      },
    };
  },
});
