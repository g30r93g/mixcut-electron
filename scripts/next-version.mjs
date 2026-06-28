// Prints the next CalVer app version to stdout, based on package.json's current
// version and today's date. Used by the monthly workflow.
import { readFileSync } from 'node:fs';
import { computeCalVer } from './lib/version.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const now = new Date();
process.stdout.write(computeCalVer(pkg.version, now.getFullYear(), now.getMonth() + 1));
