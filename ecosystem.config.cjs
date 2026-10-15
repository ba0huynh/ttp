// PM2 process file. Start with `pm2 start ecosystem.config.cjs`.
// Node loads .env itself (--env-file), so PORT and the DB_* variables are the
// same ones `npm run start` uses; PM2 does not read .env on its own.
module.exports = {
  apps: [
    {
      name: 'moto-ttp',
      script: 'dist/server/index.mjs',
      node_args: '--env-file-if-exists=.env',
      env: { NODE_ENV: 'production' },
    },
  ],
}
