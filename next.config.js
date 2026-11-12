const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => ({
  distDir: process.env.CAIXA_PRETA_NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
  devIndicators: false,
  outputFileTracingRoot: __dirname
});
