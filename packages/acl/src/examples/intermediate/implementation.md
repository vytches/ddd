// Intermediate ACL Implementation with Multi-Provider Support import {
BaseModelTranslator, EnhancedACLAdapter } from '@vytches/ddd-acl'; import {
DomainService, ServiceLifetime } from '@vytches/ddd-di'; import { Result } from
'@vytches/ddd-utils'; import { Logger } from '@vytches/ddd-logging'; import {
User, ExternalUserData, CreateUserData, UpdateUserData, Provider, UserSyncResult
} from '../types';

// Enhanced ACL Model Translator export class MultiProviderUserTranslator
extends BaseModelTranslator<User, ExternalUserData> { constructor(private
provider: Provider) { super(); }

toDomain(external: ExternalUserData): User { // Provider-specific mapping logic
switch (this.provider) { case 'azure-ad': return this.mapFromAzureAD(external);
case 'okta': return this.mapFromOkta(external); case 'auth0': return
this.mapFromAuth0(external); default: return this.mapFromGeneric(external); } }

toExternal(domain: User): ExternalUserData { // Provider-specific reverse
mapping switch (this.provider) { case 'azure-ad': return
this.mapToAzureAD(domain); case 'okta': return this.mapToOkta(domain); case
'auth0': return this.mapToAuth0(domain); default: return
this.mapToGeneric(domain); } }

private mapFromAzureAD(external: any): User { return { id: external.objectId,
email: external.mail || external.userPrincipalName, firstName:
external.givenName, lastName: external.surname, isActive:
external.accountEnabled, roles: external.memberOf?.map((group: any) =>
group.displayName) || [], createdAt: new Date(external.createdDateTime),
updatedAt: new Date(external.lastModifiedDateTime), provider: 'azure-ad' }; }

private mapFromOkta(external: any): User { return { id: external.id, email:
external.profile.email, firstName: external.profile.firstName, lastName:
external.profile.lastName, isActive: external.status === 'ACTIVE', roles:
external.groups || [], createdAt: new Date(external.created), updatedAt: new
Date(external.lastUpdated), provider: 'okta' }; }

private mapFromAuth0(external: any): User { return { id: external.user_id,
email: external.email, firstName: external.given_name, lastName:
external.family_name, isActive: !external.blocked, roles:
external.app_metadata?.roles || [], createdAt: new Date(external.created_at),
updatedAt: new Date(external.updated_at), provider: 'auth0' }; }

private mapFromGeneric(external: ExternalUserData): User { return { id:
external.user*id, email: external.email_address, firstName: external.first_name,
lastName: external.last_name, isActive: external.status === 'active', roles:
external.groups, createdAt: new Date(external.created_timestamp * 1000),
updatedAt: new Date(external.modified*timestamp * 1000), provider: 'generic' };
}

private mapToAzureAD(domain: User): any { return { objectId: domain.id, mail:
domain.email, givenName: domain.firstName, surname: domain.lastName,
accountEnabled: domain.isActive, memberOf: domain.roles.map(role => ({
displayName: role })) }; }

private mapToOkta(domain: User): any { return { id: domain.id, profile: { email:
domain.email, firstName: domain.firstName, lastName: domain.lastName }, status:
domain.isActive ? 'ACTIVE' : 'SUSPENDED', groups: domain.roles }; }

private mapToAuth0(domain: User): any { return { user_id: domain.id, email:
domain.email, given_name: domain.firstName, family_name: domain.lastName,
blocked: !domain.isActive, app_metadata: { roles: domain.roles } }; }

private mapToGeneric(domain: User): ExternalUserData { return { user_id:
domain.id, email_address: domain.email, first_name: domain.firstName, last_name:
domain.lastName, status: domain.isActive ? 'active' : 'inactive', groups:
domain.roles, created_timestamp: Math.floor(domain.createdAt.getTime() / 1000),
modified_timestamp: Math.floor(domain.updatedAt.getTime() / 1000) }; } }

// ⭐ Enhanced ACL with Multi-Provider Support
@DomainService('multiProviderUserACL', { lifetime: ServiceLifetime.Singleton,
context: 'UserManagement', dependencies: ['cacheService', 'auditService'] })
export class MultiProviderUserACL extends EnhancedACLAdapter<User,
ExternalUserData> { private logger = Logger.forContext('MultiProviderUserACL');
private providers: Map<Provider, IProviderAdapter> = new Map(); private
primaryProvider: Provider;

constructor() { super();

    // Initialize providers
    this.initializeProviders();
    this.primaryProvider = this.determinePrimaryProvider();

}

async getUser(userId: string, provider?: Provider): Promise<Result<User, Error>>
{ try { const targetProvider = provider || this.primaryProvider; const
providerAdapter = this.providers.get(targetProvider);

      if (!providerAdapter) {
        return Result.failure(new Error(`Provider ${targetProvider} not configured`));
      }

      this.logger.info('Fetching user from provider', {
        userId,
        provider: targetProvider
      });

      const externalUser = await providerAdapter.getUser(userId);
      const translator = new MultiProviderUserTranslator(targetProvider);
      const domainUser = translator.toDomain(externalUser);

      // Cache the result
      await this.cacheUser(domainUser);

      return Result.success(domainUser);
    } catch (error) {
      this.logger.error('Failed to get user', {
        userId,
        provider,
        error: error.message
      });

      return Result.failure(new Error(`Failed to get user: ${error.message}`));
    }

}

async createUser(userData: CreateUserData, provider?: Provider):
Promise<Result<User, Error>> { try { const targetProvider = provider ||
this.primaryProvider; const providerAdapter =
this.providers.get(targetProvider);

      if (!providerAdapter) {
        return Result.failure(new Error(`Provider ${targetProvider} not configured`));
      }

      this.logger.info('Creating user in provider', {
        email: userData.email,
        provider: targetProvider
      });

      const translator = new MultiProviderUserTranslator(targetProvider);
      const externalData = translator.toExternal({
        ...userData,
        id: this.generateUserId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: targetProvider
      } as User);

      const createdUser = await providerAdapter.createUser(externalData);
      const domainUser = translator.toDomain(createdUser);

      // Cache and audit
      await this.cacheUser(domainUser);
      await this.auditUserCreation(domainUser);

      return Result.success(domainUser);
    } catch (error) {
      this.logger.error('Failed to create user', {
        email: userData.email,
        provider,
        error: error.message
      });

      return Result.failure(new Error(`Failed to create user: ${error.message}`));
    }

}

async syncUser(userId: string, sourceProvider: Provider, targetProvider:
Provider): Promise<Result<UserSyncResult, Error>> { try {
this.logger.info('Synchronizing user between providers', { userId,
sourceProvider, targetProvider });

      // Get user from source provider
      const sourceResult = await this.getUser(userId, sourceProvider);
      if (sourceResult.isFailure()) {
        return Result.failure(sourceResult.error);
      }

      const user = sourceResult.value!;

      // Check if user exists in target provider
      const targetResult = await this.getUser(userId, targetProvider);

      if (targetResult.isSuccess()) {
        // Update existing user
        const updateResult = await this.updateUser(userId, {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          roles: user.roles
        }, targetProvider);

        if (updateResult.isFailure()) {
          return Result.failure(updateResult.error);
        }

        return Result.success({
          operation: 'update',
          userId: userId,
          sourceProvider,
          targetProvider,
          user: updateResult.value!
        });
      } else {
        // Create new user
        const createResult = await this.createUser({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles
        }, targetProvider);

        if (createResult.isFailure()) {
          return Result.failure(createResult.error);
        }

        return Result.success({
          operation: 'create',
          userId: userId,
          sourceProvider,
          targetProvider,
          user: createResult.value!
        });
      }
    } catch (error) {
      this.logger.error('User synchronization failed', {
        userId,
        sourceProvider,
        targetProvider,
        error: error.message
      });

      return Result.failure(new Error(`User sync failed: ${error.message}`));
    }

}

async updateUser(userId: string, userData: UpdateUserData, provider?: Provider):
Promise<Result<User, Error>> { try { const targetProvider = provider ||
this.primaryProvider; const providerAdapter =
this.providers.get(targetProvider);

      if (!providerAdapter) {
        return Result.failure(new Error(`Provider ${targetProvider} not configured`));
      }

      this.logger.info('Updating user in provider', {
        userId,
        provider: targetProvider
      });

      const translator = new MultiProviderUserTranslator(targetProvider);
      const updateData = translator.toExternal({
        ...userData,
        updatedAt: new Date()
      } as User);

      const updatedUser = await providerAdapter.updateUser(userId, updateData);
      const domainUser = translator.toDomain(updatedUser);

      // Update cache and audit
      await this.cacheUser(domainUser);
      await this.auditUserUpdate(domainUser);

      return Result.success(domainUser);
    } catch (error) {
      this.logger.error('Failed to update user', {
        userId,
        provider,
        error: error.message
      });

      return Result.failure(new Error(`Failed to update user: ${error.message}`));
    }

}

private initializeProviders(): void { // Initialize Azure AD provider if
(process.env.AZURE_AD_TENANT_ID) { this.providers.set('azure-ad', new
AzureADAdapter({ tenantId: process.env.AZURE_AD_TENANT_ID, clientId:
process.env.AZURE_AD_CLIENT_ID, clientSecret: process.env.AZURE_AD_CLIENT_SECRET
})); }

    // Initialize Okta provider
    if (process.env.OKTA_DOMAIN) {
      this.providers.set('okta', new OktaAdapter({
        domain: process.env.OKTA_DOMAIN,
        token: process.env.OKTA_TOKEN
      }));
    }

    // Initialize Auth0 provider
    if (process.env.AUTH0_DOMAIN) {
      this.providers.set('auth0', new Auth0Adapter({
        domain: process.env.AUTH0_DOMAIN,
        clientId: process.env.AUTH0_CLIENT_ID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET
      }));
    }

    // Initialize Generic provider as fallback
    this.providers.set('generic', new GenericAPIAdapter({
      baseUrl: process.env.GENERIC_API_URL,
      apiKey: process.env.GENERIC_API_KEY
    }));

}

private determinePrimaryProvider(): Provider { if
(this.providers.has('azure-ad')) return 'azure-ad'; if
(this.providers.has('okta')) return 'okta'; if (this.providers.has('auth0'))
return 'auth0'; return 'generic'; }

private async cacheUser(user: User): Promise<void> { const cacheKey =
`user:${user.id}:${user.provider}`; await this.cacheService.set(cacheKey, user,
300000); // 5 minutes }

private async auditUserCreation(user: User): Promise<void> { await
this.auditService.log({ action: 'USER_CREATED', userId: user.id, provider:
user.provider, details: { email: user.email, provider: user.provider } }); }

private async auditUserUpdate(user: User): Promise<void> { await
this.auditService.log({ action: 'USER_UPDATED', userId: user.id, provider:
user.provider, details: { email: user.email, updatedAt: user.updatedAt } }); }

private generateUserId(): string { return
`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; } }
