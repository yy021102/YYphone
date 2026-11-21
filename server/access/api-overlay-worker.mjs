import clientWorker from './client-worker.mjs';
export default {
  fetch(request, env) {
    // Preserve the currently published phone while GitHub tests new versions.
    return clientWorker.fetch(request, { ...env, API_ONLY: 'true', LEGACY_ASSET_ORIGIN: 'https://6de26fb7.yyphone.pages.dev' });
  }
};
