// Lets Node's test runner load app modules written for Vite, which imports relative files
// without the ".js" extension (e.g. '../../routes/paths'). No dependency and no transpiling:
// only plain .js modules can be tested this way.
import { register } from 'node:module';

register('./extensionless-hooks.mjs', import.meta.url);
