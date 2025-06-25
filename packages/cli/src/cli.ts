import { CLI } from './cli-runner';

const cli = new CLI();
cli.run(process.argv).catch(error => {
  console.error('CLI Error:', error);
  process.exit(1);
});
