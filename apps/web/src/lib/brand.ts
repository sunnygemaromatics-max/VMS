/**
 * Brand resolution. Same codebase serves two products today:
 *   - VMS    (vms.gemaromatics.com)              — visitor management
 *   - AEGIS  (aegis.gemaromatics.com)            — security intelligence
 *
 * Switched at build time by NEXT_PUBLIC_BRAND_CODE. Add a brand by
 * extending the BRANDS map — no other code change needed.
 */

export type BrandCode = 'vms' | 'aegis';

export interface BrandConfig {
  code: BrandCode;
  /** Short product mark shown in the wordmark */
  shortName: string;
  /** Full product line shown in metadata + about pages */
  productName: string;
  /** Subtitle under the wordmark in the header */
  tagline: string;
  /** Operator-facing description for <meta name="description"> */
  description: string;
  /** OpenGraph title */
  ogTitle: string;
  /** Path to logo image under /public */
  logoSrc: string;
  /** Path to favicon under /public */
  faviconSrc: string;
}

const VMS_BRAND: BrandConfig = {
  code: 'vms',
  shortName: 'VMS',
  productName: 'VMS — Visitor Management System',
  tagline: 'Gem Aromatics Group',
  description:
    'Enterprise Visitor & Workforce Management for Gem Aromatics Group.',
  ogTitle: 'VMS — Visitor Management System | Gem Aromatics',
  logoSrc: '/gem-logo.webp',
  faviconSrc: '/gem-logo.webp',
};

const AEGIS_BRAND: BrandConfig = {
  code: 'aegis',
  shortName: 'AEGIS',
  productName: 'AEGIS — AI Security & Visitor Intelligence',
  tagline: 'Gem Aromatics Group',
  description:
    'AI Security Monitoring & Visitor Intelligence Platform for Gem Aromatics Group.',
  ogTitle: 'AEGIS — AI Security & Visitor Intelligence',
  logoSrc: '/gem-logo.webp',
  faviconSrc: '/gem-logo.webp',
};

const BRANDS: Record<BrandCode, BrandConfig> = {
  vms: VMS_BRAND,
  aegis: AEGIS_BRAND,
};

export function getBrand(): BrandConfig {
  const code = (process.env.NEXT_PUBLIC_BRAND_CODE || 'vms').toLowerCase() as BrandCode;
  return BRANDS[code] ?? VMS_BRAND;
}
