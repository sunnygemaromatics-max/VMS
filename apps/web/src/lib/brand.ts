/**
 * Brand resolution. Same codebase serves two products today:
 *   - VMS    (vms.thestudioinfinito.com)         — legacy, default
 *   - AEGIS  (intel.thestudioinfinito.com)       — new positioning
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
  tagline: 'The Studio Infinito',
  description:
    'Enterprise Visitor & Workforce Management — built by Personify Crafters for The Studio Infinito.',
  ogTitle: 'VMS — Visitor Management System | TSI',
  logoSrc: '/logo.png',
  faviconSrc: '/favicon.png',
};

const AEGIS_BRAND: BrandConfig = {
  code: 'aegis',
  shortName: 'AEGIS',
  productName: 'AEGIS — AI Security & Visitor Intelligence',
  tagline: 'by The Studio Infinito',
  description:
    'AI Security Monitoring & Visitor Intelligence Platform — built by Personify Crafters for The Studio Infinito.',
  ogTitle: 'AEGIS — AI Security & Visitor Intelligence',
  logoSrc: '/logo.png',
  faviconSrc: '/favicon.png',
};

const BRANDS: Record<BrandCode, BrandConfig> = {
  vms: VMS_BRAND,
  aegis: AEGIS_BRAND,
};

export function getBrand(): BrandConfig {
  const code = (process.env.NEXT_PUBLIC_BRAND_CODE || 'vms').toLowerCase() as BrandCode;
  return BRANDS[code] ?? VMS_BRAND;
}
