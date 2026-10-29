import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`          → 배포용(dist/)
// `npm run build:preview`  → 미리보기용 단일 HTML(dist-preview/)
export default defineConfig(({ mode }) => mode === 'preview'
  ? { plugins: [viteSingleFile()], publicDir: false, build: { outDir: 'dist-preview', assetsInlineLimit: 1e8 } }
  : {});
