import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const routes = ['', 'image-compress', 'image-resize', 'image-to-webp', 'image-under-100kb', 'image-metadata-remove', 'excel-analyze', 'excel-optimize', 'guide', 'about', 'privacy', 'terms', 'contact'];
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        ...Object.fromEntries(routes.map(route => [route || 'home', resolve(import.meta.dirname, route, 'index.html')])),
        notFound: resolve(import.meta.dirname, '404.html')
      }
    }
  }
});
