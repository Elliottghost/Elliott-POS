import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
  </Base>
);

export const PosIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 8h5M7 12h3M16 9.5v5" />
    <path d="M13.5 17h6" />
  </Base>
);

export const ReceiptIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 3h12v17.5l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6L6 20.5V3z" />
    <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
  </Base>
);

export const MenuBookIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
    <path d="M8.5 7.5h7M8.5 11h4.5" />
  </Base>
);

export const KitchenIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 17h16M5 17a7 7 0 0 1 14 0" />
    <path d="M8 11.5V9M12 10V7M16 11.5V9" />
    <path d="M4 20h16" />
  </Base>
);

export const RestaurantIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3" />
    <path d="M8.5 10v11" />
    <path d="M17 3c-1.6 1.4-2.5 3.4-2.5 5.5 0 1.7.9 3 2.5 3.5V21" />
    <path d="M17 3v9" />
  </Base>
);

export const TableIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="7" width="18" height="4" rx="1.4" />
    <path d="M6 11v9M18 11v9M8.5 11v4.5h7V11" />
  </Base>
);

export const ReservationIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M8 14h3M8 17.5h6" />
  </Base>
);

export const BranchIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 21V8.5L12 3l8 5.5V21" />
    <path d="M9 21v-6h6v6" />
    <path d="M8.5 11h.01M15.5 11h.01" />
  </Base>
);

export const StaffIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16 4.8a3 3 0 0 1 0 6M17.6 14.6a5.4 5.4 0 0 1 3.6 5" />
  </Base>
);

export const ShieldIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3l7 3v5.2c0 4.4-2.9 8.3-7 9.8-4.1-1.5-7-5.4-7-9.8V6l7-3z" />
    <path d="m9.2 12.2 2 2 3.6-3.7" />
  </Base>
);

export const ScrollIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 3h10a2 2 0 0 1 2 2v13a3 3 0 0 0 3 3H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M9 8h7M9 12h7M9 16h4" />
  </Base>
);

export const SettingsIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10 3.04V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
  </Base>
);

export const UserIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20.2a7 7 0 0 1 14 0" />
  </Base>
);

export const LogoutIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Base>
);

export const MenuIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const CloseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Base>
);

export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const AlertIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16.2h.01" />
  </Base>
);

export const MailIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Base>
);

export const LockIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </Base>
);

export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Base>
);
