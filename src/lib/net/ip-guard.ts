import "server-only";
import dns from "node:dns";
import ipaddr from "ipaddr.js";

/**
 * The core SSRF defense: is this a real, routable public address, not
 * loopback/private/link-local/unique-local/multicast/reserved? Rejects
 * everything ipaddr.js doesn't classify as plain `unicast` — including
 * the cloud metadata address (169.254.169.254, `linkLocal`) and an
 * IPv4-mapped IPv6 address wrapping a private IPv4 (`::ffff:127.0.0.1`),
 * which is unwrapped and re-checked against its real embedded address
 * rather than trusted at face value.
 */
export function isPublicAddress(address: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(address);
  } catch {
    return false;
  }

  let range = addr.range();
  if (range === "ipv4Mapped" && "toIPv4Address" in addr) {
    addr = (addr as ipaddr.IPv6).toIPv4Address();
    range = addr.range();
  }
  return range === "unicast";
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * A drop-in replacement for `dns.lookup` (the same signature Node's
 * `net`/`tls` `connect()` — and, through it, undici's `Agent` — accept
 * as a `lookup` option) that resolves the hostname and only ever hands
 * back public addresses.
 *
 * This is what actually closes the DNS-rebinding gap: validating a
 * hostname's IP *before* opening a connection and then connecting
 * separately is not enough — a rebinding attacker returns a public IP to
 * whichever check runs first and a private one to the connection itself,
 * since they're two different DNS lookups. Here there is only one lookup
 * per connection attempt, and its result — already validated — is
 * exactly what the socket connects to; there's no second resolution left
 * for an attacker's DNS server to answer differently.
 */
export function createSsrfSafeLookup() {
  return function ssrfSafeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) {
        callback(err, "", 0);
        return;
      }

      const resolved = addresses as unknown as dns.LookupAddress[];
      const safe = resolved.filter((entry) => isPublicAddress(entry.address));

      if (safe.length === 0) {
        callback(new Error(`SSRF_BLOCKED: no public address for "${hostname}"`), "", 0);
        return;
      }

      if (options.all) {
        callback(null, safe);
      } else {
        callback(null, safe[0].address, safe[0].family);
      }
    });
  };
}
