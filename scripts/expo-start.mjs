import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

const onMain = onMainBranch();
const expoCli = fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url));
const args = ['start', ...process.argv.slice(2)];
if (!onMain && !args.includes('--offline')) args.push('--offline');

if (onMain) {
  console.log('On main: Expo can reach its servers, and the app uses the production database.');
} else {
  console.log('Not on main: Expo stays offline and the app uses the local database.');
}

const child = spawn(process.execPath, [expoCli, ...args], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => {
  process.exit(code ?? 0);
});
