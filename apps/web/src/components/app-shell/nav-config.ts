import {
  LayoutDashboard,
  Users,
  HardHat,
  Building2,
  BarChart3,
  ShieldCheck,
  Megaphone,
  Eye,
  Activity,
  Sparkles,
  Shield,
  Settings as SettingsIcon,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavLeaf {
  href: string;
  i18nKey: string;
  /** Optional short label override; otherwise i18nKey value is used */
  label?: string;
  icon?: LucideIcon;
  /** Filter by user role (any one match grants access) — empty = all roles */
  roles?: string[];
  /** Render a numerical badge fetched at runtime — key looked up by AppShell */
  badgeKey?: string;
}

export interface NavSection {
  i18nKey: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

/**
 * Single source of truth for sidebar + command palette + breadcrumbs.
 * Adding a route is one diff here — no other change required.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    i18nKey: 'nav.dashboard',
    icon: LayoutDashboard,
    items: [{ href: '/', i18nKey: 'nav.dashboard' }],
  },
  {
    i18nKey: 'nav.visitors',
    icon: Users,
    items: [
      { href: '/check-in', i18nKey: 'nav.checkIn' },
      { href: '/visitors-list', i18nKey: 'nav.visitorsDirectory' },
      { href: '/approvals', i18nKey: 'nav.approvals', badgeKey: 'approvals' },
    ],
  },
  {
    i18nKey: 'nav.workforce',
    icon: HardHat,
    items: [
      { href: '/contractors', i18nKey: 'nav.contractors' },
      { href: '/workers', i18nKey: 'nav.workers' },
      { href: '/shifts', i18nKey: 'nav.shifts' },
    ],
  },
  {
    i18nKey: 'nav.operations',
    icon: Building2,
    items: [
      { href: '/parking', i18nKey: 'nav.parking' },
      { href: '/vehicles', i18nKey: 'nav.vehicles' },
      { href: '/material-pass', i18nKey: 'nav.materials' },
    ],
  },
  {
    i18nKey: 'nav.intelligence',
    icon: Sparkles,
    items: [
      { href: '/incidents', i18nKey: 'nav.incidents', badgeKey: 'incidents' },
      { href: '/anomalies', i18nKey: 'nav.anomalies' },
      { href: '/risk', i18nKey: 'nav.risk' },
    ],
  },
  {
    i18nKey: 'nav.surveillance',
    icon: Eye,
    items: [
      { href: '/command-center', i18nKey: 'nav.commandCenter' },
      { href: '/cameras', i18nKey: 'nav.cameras' },
      { href: '/zones', i18nKey: 'nav.zones' },
    ],
  },
  {
    i18nKey: 'nav.insights',
    icon: BarChart3,
    items: [
      { href: '/executive', i18nKey: 'nav.executive' },
      { href: '/reports', i18nKey: 'nav.reports' },
      { href: '/audit', i18nKey: 'nav.audit' },
      { href: '/notices', i18nKey: 'nav.notices' },
    ],
  },
  {
    i18nKey: 'nav.admin',
    icon: ShieldCheck,
    items: [
      { href: '/admin/users', i18nKey: 'nav.users' },
      { href: '/admin/branches', i18nKey: 'nav.branches' },
      { href: '/admin/roles', i18nKey: 'nav.roles' },
      { href: '/about', i18nKey: 'nav.about' },
    ],
  },
];

export const FOOTER_ITEMS: NavLeaf[] = [
  { href: '/settings', i18nKey: 'nav.settings', icon: SettingsIcon },
  { href: '/help', i18nKey: 'nav.help', icon: HelpCircle },
];

/** All leaves, flat — for command palette search. */
export const ALL_NAV_LEAVES: NavLeaf[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items),
  ...FOOTER_ITEMS,
];
