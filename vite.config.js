import { defineConfig } from 'vite';

/**
 * Keep generated asset URLs relative so the same build works under the
 * GitHub Pages project path (/IQbasket2/) and remains portable to a future
 * custom domain without provider-specific rewrites.
 */
export default defineConfig({
  base: './',
});
