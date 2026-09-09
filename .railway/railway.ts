import { defineRailway, project, service } from "railway/iac";

// Last resort for a per-service CaC repo. Prefer one .railway file for the
// project and drop this if you later combine services into that file.
export const partial = "Orktoverdeiro";

export default defineRailway(() => {
  const Orktoverdeiro = service("Orktoverdeiro", {
    build: "npm run build",
    start: "npm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    // builder from CaC: "NIXPACKS"
  });
  return project("striking-integrity", {
    resources: [Orktoverdeiro],
  });
});
