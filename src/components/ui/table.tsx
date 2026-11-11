import type { ComponentProps, ReactNode } from "react";

export function Table({ className = "", ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`table-base ${className}`.trim()} {...props} />
    </div>
  );
}

export function TableHeader({ className = "", ...props }: ComponentProps<"thead">) {
  return <thead className={className} {...props} />;
}

export function TableBody({ className = "", ...props }: ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className = "", ...props }: ComponentProps<"tr">) {
  return <tr className={className} {...props} />;
}

export function TableCell({ className = "", ...props }: ComponentProps<"td">) {
  return <td className={className} {...props} />;
}

export function TableHead({ className = "", children, ...props }: ComponentProps<"th"> & { children?: ReactNode }) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  );
}
