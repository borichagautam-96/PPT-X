/**
 * footer-defaults.ts
 *
 * Single source of truth for the built-in L&T footer text/logo, used as the
 * fallback whenever a presentation doesn't set `presentation.footer` (i.e.
 * every deck created before footer editing existed).
 */

import type { FooterConfig } from './schema.ts';

export const DEFAULT_FOOTER: Required<FooterConfig> = {
  deliverableText: '<Deliverable_No_RevNo> | All rights reserved with Larsen & Toubro Limited.',
  orgLine: 'Aerospace | Electronics | Land & Marine – Platforms & Systems',
  copyrightText: '© Larsen & Toubro Limited: Restricted',
  logoUrl: '/lt_logo.jpeg',
};

export function resolveFooter(footer: FooterConfig | undefined): Required<FooterConfig> {
  return {
    deliverableText: footer?.deliverableText ?? DEFAULT_FOOTER.deliverableText,
    orgLine: footer?.orgLine ?? DEFAULT_FOOTER.orgLine,
    copyrightText: footer?.copyrightText ?? DEFAULT_FOOTER.copyrightText,
    logoUrl: footer?.logoUrl ?? DEFAULT_FOOTER.logoUrl,
  };
}
