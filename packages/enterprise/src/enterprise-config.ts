// Enterprise configuration
export interface EnterpriseConfig {
  version: string;
  features: string[];
}

export const defaultEnterpriseConfig: EnterpriseConfig = {
  version: '0.1.0',
  features: ['all'],
};
