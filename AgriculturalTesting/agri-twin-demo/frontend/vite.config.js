import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Open-Meteo 开发代理 —— 避免 CORS 和混合内容警告
// 生产构建不走代理，weatherSource.js 会直接 fetch https://api.open-meteo.com
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api/open-meteo": {
        target: "https://api.open-meteo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/open-meteo/, "/v1"),
        secure: true,
      },
      "/api/air-quality": {
        target: "https://air-quality-api.open-meteo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/air-quality/, ""),
        secure: true,
      },
    },
  },
});
