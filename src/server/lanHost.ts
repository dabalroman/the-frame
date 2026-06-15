/**
 * Resolve the LAN host to bake into the printable QR.
 *
 * The host is configured explicitly via `FRAME_LAN_HOST` (or a CLI arg) — no
 * network auto-detection. Throws if neither is set, so the QR can never silently
 * encode the wrong address.
 */
export function resolveLanHost(override?: string): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  throw new Error(
    'No LAN host configured. Set FRAME_LAN_HOST (e.g. FRAME_LAN_HOST=192.168.1.50) ' +
      'or pass it as an argument: npm run qr -- 192.168.1.50',
  );
}

export function frameUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}
