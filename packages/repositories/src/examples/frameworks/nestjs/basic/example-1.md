# Basic Repository - NestJS Manual Setup

**Focus**: Basic IRepository usage in NestJS with manual instantiation
**Base Example**: [Basic Generic Repository](../../basic/example-1.md)
**Dependencies**: @nestjs/common, @nestjs/typeorm, @vytches-ddd/repositories

## Service Implementation

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@vytches-ddd/repositories';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { User, CreateUserData, UpdateUserData } from './types'; // From your app

@Injectable()
export class UserService {
  private readonly userRepository: BaseRepository<User>;

  constructor(@InjectConnection() private connection: Connection) {
    // ⭐ FOCUS: Manual repository setup (beginner-friendly)
    this.userRepository = new BaseRepository<User>('users', {
      connection: this.connection,
      enableCaching: true,
      cacheTTL: 300000 // 5 minutes
    });
  }

  // ✅ FOCUS: Thin wrapper around library
  async createUser(userData: CreateUserData): Promise<User> {
    return await this.userRepository.save(userData);
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.findAll();
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return await this.userRepository.save({ ...user, ...updates });
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  // ✅ FOCUS: Advanced querying through library
  async findActiveUsers(): Promise<User[]> {
    return await this.userRepository.find({
      where: [{ field: 'isActive', operator: 'eq', value: true }],
      orderBy: [{ field: 'createdAt', direction: 'DESC' }]
    });
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserEntity } from './user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity])
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
```

## Controller Integration

```typescript
// user.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserData, UpdateUserData } from './types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() userData: CreateUserData) {
    return await this.userService.createUser(userData);
  }

  @Get()
  async getAllUsers() {
    return await this.userService.getAllUsers();
  }

  @Get('active')
  async getActiveUsers() {
    return await this.userService.findActiveUsers();
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return await this.userService.getUserById(id);
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updates: UpdateUserData) {
    return await this.userService.updateUser(id, updates);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }
}
```

## Key Points

- Simple manual instantiation for beginners
- Focus on @vytches-ddd/repositories usage, not DI complexity  
- Standard NestJS patterns for framework integration
- Minimal setup required - just inject TypeORM connection
- All business logic delegates to repository methods
- Clean separation between framework concerns and domain logic