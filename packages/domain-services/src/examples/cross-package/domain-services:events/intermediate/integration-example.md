// Domain Service with Event Integration import { BaseDomainService } from
'@vytches-ddd/domain-services'; import { IEventBus, DomainEvent } from
'@vytches-ddd/events'; import { Result } from '@vytches-ddd/utils'; import {
User, UserCreatedEvent, UserUpdatedEvent } from '../types';

export class UserManagementService extends BaseDomainService { constructor(
private readonly eventBus: IEventBus ) { super('UserManagementService'); }

async createUser(userData: { name: string; email: string }):
Promise<Result<User, Error>> { try { // Step 1: Create user const user =
User.create(userData);

      // Step 2: Create domain event
      const userCreatedEvent = new UserCreatedEvent({
        userId: user.id,
        name: user.name,
        email: user.email,
        createdAt: new Date()
      });

      // Step 3: Publish event
      await this.eventBus.publish(userCreatedEvent);

      return Result.success(user);

    } catch (error) {
      return Result.failure(new Error(`User creation failed: ${error.message}`));
    }

}

async updateUser(userId: string, updates: Partial<User>): Promise<Result<User,
Error>> { try { // Step 1: Load and update user const user = await
this.loadUser(userId); const updatedUser = user.update(updates);

      // Step 2: Create and publish event
      const userUpdatedEvent = new UserUpdatedEvent({
        userId: updatedUser.id,
        changes: updates,
        updatedAt: new Date()
      });

      await this.eventBus.publish(userUpdatedEvent);

      return Result.success(updatedUser);

    } catch (error) {
      return Result.failure(new Error(`User update failed: ${error.message}`));
    }

}

async orchestrateUserWorkflow(userId: string, workflowData: any):
Promise<Result<void, Error>> { try { // Step 1: Start workflow await
this.eventBus.publish(new WorkflowStartedEvent({ userId, workflowData }));

      // Step 2: Process user data
      const userResult = await this.processUserData(userId, workflowData);
      if (userResult.isFailure()) {
        await this.eventBus.publish(new WorkflowFailedEvent({ userId, error: userResult.error }));
        return Result.failure(userResult.error);
      }

      // Step 3: Complete workflow
      await this.eventBus.publish(new WorkflowCompletedEvent({ userId }));

      return Result.success(undefined);

    } catch (error) {
      await this.eventBus.publish(new WorkflowFailedEvent({ userId, error }));
      return Result.failure(new Error(`Workflow orchestration failed: ${error.message}`));
    }

}

private async loadUser(userId: string): Promise<User> { // Load user logic here
return User.create({ id: userId, name: 'Test', email: 'test@example.com' }); }

private async processUserData(userId: string, data: any): Promise<Result<void,
Error>> { // Process user data logic here return Result.success(undefined); } }
