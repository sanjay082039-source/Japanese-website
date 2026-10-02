/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/.prisma/client/**/*', './prisma/**/*'],
    },
  },
};

module.exports = nextConfig;
