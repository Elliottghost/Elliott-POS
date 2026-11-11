import QRCode from "qrcode";

/** Renders a QR code as inline SVG so it prints crisply at any size. */
export async function qrCodeSvg(value: string, size = 220): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
    color: { dark: "#1a1613", light: "#ffffff" },
  });
}

/** Absolute table menu URL encoded inside the QR code. */
export function tableMenuUrl(
  origin: string,
  branchSlug: string,
  qrToken: string,
): string {
  return `${origin.replace(/\/$/, "")}/m/${branchSlug}?t=${qrToken}`;
}
