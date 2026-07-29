// Moved to packages/database/src/route-inbound-flow.ts (exported from @eventrax/database)
// as part of E20-53, because worker-service's inbound-event drain needs to call this
// router too, and apps cannot import each other's code in this monorepo — only shared
// packages. This file is intentionally empty; it could not be deleted from this
// environment (permission restriction on this mount).
export {};
