import { Logger } from '@vytches-ddd/logging';
import { CLI } from './cli-runner';

const logger = Logger.create('CLI');
const cli = new CLI();
cli.run(process.argv).catch(error => {
  logger.error('CLI Error:', error);
  process.exit(1);
});
