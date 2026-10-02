// Config file bodies the e2e tests write into a sandbox.

/** A valid config whose evaluation leaves a live timer behind, keeping the event loop alive. */
export const LEAVES_LIVE_HANDLE = `setInterval(() => {}, 1000);\nexport default { name: "live-handle", claude: true };\n`;
