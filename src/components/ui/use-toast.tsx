"use client";

interface ToastInput {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

function showToast({ title, description, variant = "default" }: ToastInput) {
  if (typeof document === "undefined") return;

  const element = document.createElement("div");
  element.setAttribute("role", "status");
  element.style.position = "fixed";
  element.style.bottom = "1.5rem";
  element.style.right = "1.5rem";
  element.style.zIndex = "60";
  element.style.maxWidth = "22rem";
  element.style.padding = "0.75rem 1rem";
  element.style.borderRadius = "0.75rem";
  element.style.boxShadow = "0 12px 28px -18px rgb(22 18 15 / 0.45)";
  element.style.fontSize = "0.875rem";
  element.style.lineHeight = "1.35";
  element.style.background = variant === "destructive" ? "#b4392f" : "#1a1613";
  element.style.color = "#f7f4ee";

  const heading = document.createElement("strong");
  heading.style.display = "block";
  heading.style.marginBottom = description ? "0.25rem" : "0";
  heading.textContent = title ?? "";

  element.appendChild(heading);
  if (description) {
    const body = document.createElement("span");
    body.textContent = description;
    element.appendChild(body);
  }

  document.body.appendChild(element);
  window.setTimeout(() => element.remove(), 4500);
}

type Toast = (input: ToastInput) => void;

/**
 * Returns a toast helper. Supports both `const [toast] = useToast()` and
 * `const { toast } = useToast()` so existing call sites keep working.
 */
export function useToast(): [Toast] & { toast: Toast } {
  return Object.assign([showToast] as unknown as [Toast], { toast: showToast });
}

export { showToast };
