// vitest.config.mts aliases the real "server-only" package to this file.
// The real package unconditionally throws on import — it relies on
// Next.js's own webpack config to alias it to a no-op for the server
// compilation target and only actually throw for the client target,
// which is the guard it exists to provide. Outside that build pipeline
// (i.e. under Vitest), there's no "client bundle" for it to guard
// against, so importing it here is a deliberate no-op rather than a
// weakened check.
export {};
