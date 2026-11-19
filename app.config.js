const { execSync } = require('node:child_process');

const PRODUCTION_API_URL = 'https://codrive-api.onrender.com';

/** True only for a local `main` checkout or the main push that publishes the hosted app. */
function onMainBranch() {
  if (process.env.GITHUB_REF === 'refs/heads/main' || process.env.GITHUB_REF_NAME === 'main') return true;
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return branch === 'main';
  } catch {
    return false;
  }
}

module.exports = ({ config }) => {
  const onMain = onMainBranch();
  const hosted = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).trim().replace(/\/$/, '');
  return {
    ...config,
    // Feature branches never check Expo's update server.
    updates: onMain ? config.updates : { enabled: false },
    extra: {
      ...config.extra,
      useProductionApi: onMain,
      apiUrl: onMain ? hosted : '',
    },
  };
};
