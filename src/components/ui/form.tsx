import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  errors?: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
      {errors && errors.length > 0 ? (
        <p className="field-error">{errors[0]}</p>
      ) : null}
    </div>
  );
}
