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
      // 本地开发把业务接口与上传资源代理到 FastAPI，生产由 FastAPI 同源托管
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
