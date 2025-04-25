import { withContentlayer } from 'next-contentlayer'

const derivedUrl =
  process.env.VERCEL_URL && process.env.VERCEL_ENV === "preview"
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL;

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    viewTransition: true,
  },

  env: {
    // pass url here so it's usable on the client and backend
    NEXT_PUBLIC_APP_URL: derivedUrl,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        port: "",
        pathname: "/f/**", // Allow images from the /f/ path on utfs.io
      },
    ],
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withContentlayer(config);
