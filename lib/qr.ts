import QRCode from "qrcode";

/**
 * Renders a UPI intent string to a PNG data URL.
 *
 * Error correction is set to "M" rather than the default: the QR is displayed
 * on a counter-facing screen and scanned across a desk at an angle, often under
 * fluorescent glare. "M" tolerates ~15% damage, which covers the reflection and
 * still keeps the module count low enough to scan from around 40cm.
 */
export async function renderUpiQr(
  upiUri: string,
  opts?: { size?: number; dark?: boolean },
): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: opts?.size ?? 320,
    color: opts?.dark
      ? { dark: "#f4f4f5ff", light: "#00000000" }
      : { dark: "#121417ff", light: "#00000000" },
  });
}

/** Renders any string to a QR data URL (used for the bill-lookup QR on receipts). */
export async function renderQr(
  value: string,
  opts?: { size?: number; dark?: boolean },
): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: opts?.size ?? 200,
    color: opts?.dark
      ? { dark: "#f4f4f5ff", light: "#00000000" }
      : { dark: "#121417ff", light: "#00000000" },
  });
}
