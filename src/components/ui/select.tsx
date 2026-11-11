"use client";

import {
  Children,
  isValidElement,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * A small, dependency-free select.
 *
 * It supports both the composed API used by the public pages
 * (`<Select><SelectTrigger/><SelectContent><SelectItem/></SelectContent></Select>`)
 * and plain form usage (`<Select name="paymentMethod" defaultValue="cash">`).
 * Options are collected from the composed children and rendered as a native
 * `<select>`, which keeps form submission and accessibility working.
 */

interface Option {
  value: string;
  label: ReactNode;
}

function collectOptions(node: ReactNode, found: Option[] = []): Option[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ value?: unknown; children?: ReactNode }>;
    if (element.type === SelectItem) {
      found.push({ value: String(element.props.value ?? ""), label: element.props.children });
      return;
    }
    if (element.props?.children) collectOptions(element.props.children, found);
  });
  return found;
}

interface SelectProps {
  children?: ReactNode;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Select({
  children,
  name,
  value,
  defaultValue,
  onValueChange,
  className = "",
  triggerClassName = "",
  required,
  disabled,
  ...rest
}: SelectProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const options = collectOptions(children);
  const current = value ?? internal;

  return (
    <select
      name={name}
      value={current}
      required={required}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      onChange={(event) => {
        setInternal(event.target.value);
        onValueChange?.(event.target.value);
      }}
      className={`h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink transition focus:border-ember focus:ring-2 focus:ring-ember/20 focus:outline-none ${triggerClassName} ${className}`.trim()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {typeof option.label === "string" ? option.label : option.value}
        </option>
      ))}
    </select>
  );
}

export function SelectTrigger(_props: { children?: ReactNode; className?: string }) {
  return null;
}

export function SelectValue(_props: { children?: ReactNode; className?: string; placeholder?: string }) {
  return null;
}

export function SelectContent(_props: { children?: ReactNode; className?: string }) {
  return null;
}

export function SelectItem(_props: ComponentProps<"option">) {
  return null;
}
