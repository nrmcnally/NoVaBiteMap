// Error classes for the Cloudflare D1 account/trip modules, kept in their own
// module so route handlers can `instanceof`-check them WITHOUT statically
// importing the D1 code (which imports `cloudflare:workers` and therefore
// cannot be loaded by the Node runtime used in the self-hosted / Docker
// api-backend deployment). The heavy D1 logic stays behind dynamic imports.

export class D1TripError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
