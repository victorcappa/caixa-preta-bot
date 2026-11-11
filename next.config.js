const nextConfig = {
  distDir: process.env.CAIXA_PRETA_NEXT_DIST_DIR || '.next',
  devIndicators: false,
  outputFileTracingRoot: __dirname
};

module.exports = nextConfig;
