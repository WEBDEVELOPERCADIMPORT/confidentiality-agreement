import { getAgreementBySlug } from './agreements/get-agreement-by-slug.action';
import { submitAgreement } from './agreements/submit-agreement.action';

export const server = {
  agreements: {
    getAgreementBySlug,
    submitAgreement,
  },
};
