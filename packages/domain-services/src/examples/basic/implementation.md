// Basic Domain Service Implementation import { BaseDomainService } from
'@vytches/ddd-domain-services'; import { Result } from '@vytches/ddd-utils';
import { User, CreateUserCommand } from '../types';

export class UserManagementService extends BaseDomainService { constructor() {
super('UserManagementService'); }

async createUser(command: CreateUserCommand): Promise<Result<User, Error>> { try
{ // Validate if (!command.email?.includes('@')) { return Result.failure(new
Error('Invalid email')); }

      // Create user
      const user: User = {
        id: `user-${Date.now()}`,
        email: command.email,
        name: command.name,
        status: 'active',
        createdAt: new Date()
      };

      // Save (placeholder - use repository in real app)
      console.log('Saving user:', user.id);

      // Return success
      return Result.success(user);

    } catch (error) {
      return Result.failure(new Error(`Failed to create user: ${error.message}`));
    }

} }
