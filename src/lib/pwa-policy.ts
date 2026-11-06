export function refuseOfflineRegistration(
  host: string,
  development: boolean,
  framed: boolean,
  off: boolean,
) {
  const hostname = host.toLowerCase();
  return (
    development ||
    framed ||
    off ||
    /^(id-preview|preview)(?:-[a-z0-9]+)?--.+\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(
      hostname,
    ) ||
    /^project--.+-dev\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(hostname) ||
    /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(hostname)
  );
}
