import type { CommandBuilder } from 'yargs';

export const command = 'examples <command>';
export const describe = 'Manage and work with examples';

export const builder: CommandBuilder = yargs => {
  return yargs
    .commandDir('.', {
      extensions: ['ts', 'js'],
      exclude: /index\.(ts|js)$/,
    })
    .demandCommand(1, 'You must specify a command for examples')
    .help();
};

export { handler } from './list';
