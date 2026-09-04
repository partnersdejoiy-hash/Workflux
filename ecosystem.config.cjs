// PM2 ecosystem — production processes for Workflux.
//   workflux-convex : local Convex backend (port 3212) + function sync
//   workflux-web    : static server for the built SPA (port 5173)
module.exports = {
  apps: [
    {
      name: "workflux-convex",
      cwd: "/Workflux",
      script: "/Workflux/node_modules/.bin/convex",
      args: "dev",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: { NODE_ENV: "production" },
    },
    {
      name: "workflux-web",
      cwd: "/Workflux",
      script: "server.mjs",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: { NODE_ENV: "production", PORT: "5173", HOST: "0.0.0.0" },
    },
  ],
};
