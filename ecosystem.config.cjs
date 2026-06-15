module.exports = {
  apps: [
    {
      // Single app on port 7375. Dev (Vite HMR) during build-out; later swap to
      // the prod block below. No dev/prod port split (unlike random-tools).
      name: 'the-frame',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host',
      cwd: __dirname,
      // port 7375 comes from vite.config.ts (PORT env, default 7375)
    },
    // --- Prod swap (later): comment out the dev app above and use this instead.
    //   Requires `npm run build` first; serves dist/ + /api on the same port.
    // {
    //   name: 'the-frame',
    //   script: 'server.ts',
    //   interpreter: 'node_modules/.bin/tsx',
    //   cwd: __dirname,
    //   env: { PORT: '7375' },
    // },
  ],
};
