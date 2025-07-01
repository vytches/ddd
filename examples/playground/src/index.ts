/**
 * VytchesDDD Playground
 *
 * Test your features here!
 */

import { Logger } from '@vytches-ddd/logging';

// import { coreVersion } from '@vytches-ddd/core';

const logger = Logger.create('Playground');
logger.info('🎮 VytchesDDD Playground Active!');
// logger.info('Core version:', { version: coreVersion });

// Add your test code here
export const playground = {
  version: '0.1.0',
  active: true,
};
