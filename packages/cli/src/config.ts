// CLI configuration
export interface CLIConfig {
  outputDir: string;
  templates: string[];
}

export const defaultCLIConfig: CLIConfig = {
  outputDir: './src',
  templates: [],
};
