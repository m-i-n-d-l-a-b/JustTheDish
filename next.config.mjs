/** @type {import('next').NextConfig} */
const nextConfig = {
  // Environment variables are validated in lib/env.ts

  // Enable strict mode for better development experience
  reactStrictMode: true,

  // Optimize for production
  swcMinify: true,

  experimental: {
    // Ensure pdfkit loads its bundled AFM data files from node_modules at runtime
    serverComponentsExternalPackages: ["pdfkit"],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
