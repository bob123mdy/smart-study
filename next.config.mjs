/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 输出：为 Docker 部署生成最小自包含产物（.next/standalone）
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverComponentsExternalPackages: ["better-sqlite3", "pdf-parse", "pdfjs-dist"] },
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({ "better-sqlite3": "commonjs better-sqlite3" });
    // pdf-parse 依赖 pdfjs-dist，须走 Node 原生 require，否则 webpack 打包 pdf.mjs 会崩溃
    config.externals.push({ "pdf-parse": "commonjs pdf-parse" });
    config.externals.push({ "pdfjs-dist": "commonjs pdfjs-dist" });
    return config;
  },
};

export default nextConfig;
