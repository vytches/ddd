// Basic ACL Implementation
import { BaseModelTranslator, SimpleACLAdapter } from '@vytches-ddd/acl';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Result } from '@vytches-ddd/utils';
import { User, ExternalUserData, CreateUserData } from '../types';

// ACL Model Translator
export class UserModelTranslator extends BaseModelTranslator<User, ExternalUserData> {
  toDomain(external: ExternalUserData): User {
    return {
      id: external.user_id,
      email: external.email_address,
      firstName: external.first_name,
      lastName: external.last_name,
      isActive: external.status === 'active',
      roles: external.groups,
      createdAt: new Date(external.created_timestamp * 1000),
      updatedAt: new Date(external.modified_timestamp * 1000)
    };
  }

  toExternal(domain: User): ExternalUserData {
    return {
      user_id: domain.id,
      email_address: domain.email,
      first_name: domain.firstName,
      last_name: domain.lastName,
      status: domain.isActive ? 'active' : 'inactive',
      groups: domain.roles,
      created_timestamp: Math.floor(domain.createdAt.getTime() / 1000),
      modified_timestamp: Math.floor(domain.updatedAt.getTime() / 1000)
    };
  }
}

// ⭐ ACL with Domain Service registration
@DomainService('userManagementACL', {
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement'
})
export class UserManagementACL extends SimpleACLAdapter<User, ExternalUserData> {
  private readonly externalAPI: IExternalUserAPI;

  constructor() {
    const translator = new UserModelTranslator();
    super(translator);
    
    // Configure external API client
    this.externalAPI = new ExternalUserAPIClient({
      baseUrl: process.env.IDENTITY_API_URL,
      apiKey: process.env.IDENTITY_API_KEY,
      timeout: 30000
    });
  }

  async getUser(userId: string): Promise<Result<User, Error>> {
    try {
      const externalUser = await this.externalAPI.getUser(userId);
      const domainUser = this.translator.toDomain(externalUser);
      return Result.success(domainUser);
    } catch (error) {
      return Result.failure(new Error(`Failed to get user: ${error.message}`));
    }
  }

  async createUser(userData: CreateUserData): Promise<Result<User, Error>> {
    try {
      const externalData = this.prepareUserForCreation(userData);
      const createdUser = await this.externalAPI.createUser(externalData);
      const domainUser = this.translator.toDomain(createdUser);
      return Result.success(domainUser);
    } catch (error) {
      return Result.failure(new Error(`Failed to create user: ${error.message}`));
    }
  }

  private prepareUserForCreation(userData: CreateUserData): ExternalUserData {
    return {
      user_id: this.generateUserId(),
      email_address: userData.email,
      first_name: userData.firstName,
      last_name: userData.lastName,
      status: 'active',
      groups: userData.roles || [],
      created_timestamp: Math.floor(Date.now() / 1000),
      modified_timestamp: Math.floor(Date.now() / 1000)
    };
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}