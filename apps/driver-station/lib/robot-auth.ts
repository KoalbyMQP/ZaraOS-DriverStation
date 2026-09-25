/**
 * Derive the shared pairing token from the 6-digit code and salt per RobotAPI (Cortex):
 * token = hex(HMAC-SHA256(key=code, message=salt))
 * Salt is used as the UTF-8 string (same as Cortex), not hex-decoded.
 */
export async function derivePairingToken(
  code: string,
  salt: string
): Promise<string> {
  const codeKey = new TextEncoder().encode(code);
  const saltBytes = new TextEncoder().encode(salt);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    codeKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, saltBytes);
  return arrayBufferToHex(signature);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
