import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'docs',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        recipe: resolve(__dirname, 'recipe.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        ingredient: resolve(__dirname, 'ingredient.html'),
        holiday: resolve(__dirname, 'holiday.html'),
        holidays: resolve(__dirname, 'holidays.html'),
        setting: resolve(__dirname, 'setting.html'),
        favorites: resolve(__dirname, 'favorites.html'),
        search: resolve(__dirname, 'search.html')
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    },
  },
});
