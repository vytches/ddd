## Basic Use Case: User Registration

This example shows how to use a domain service for a simple user registration workflow:

```typescript
// app.ts
import { UserManagementService } from './services/user-management.service';
import { CreateUserCommand } from './types';

async function registerNewUser() {
  const userService = new UserManagementService();
  
  const command: CreateUserCommand = {
    email: 'john.doe@example.com',
    name: 'John Doe',
    password: 'securePassword123'
  };

  const result = await userService.createUser(command);
  
  if (result.isSuccess()) {
    console.log('User created successfully:', result.value);
    // Continue with login flow, send welcome email, etc.
  } else {
    console.error('Registration failed:', result.error.message);
    // Handle specific error cases
  }
}
```

## Error Handling Example

```typescript
async function handleRegistration(userData: CreateUserCommand) {
  const userService = new UserManagementService();
  const result = await userService.createUser(userData);
  
  if (result.isFailure()) {
    // Check specific error types
    const error = result.error;
    
    if (error.message.includes('email')) {
      return { 
        status: 400, 
        message: 'Invalid email address provided' 
      };
    }
    
    if (error.message.includes('duplicate')) {
      return { 
        status: 409, 
        message: 'User already exists' 
      };
    }
    
    // Generic error
    return { 
      status: 500, 
      message: 'Registration failed' 
    };
  }
  
  return { 
    status: 201, 
    data: result.value 
  };
}
```

## Integration with Controllers

```typescript
// In a REST API controller
app.post('/users', async (req, res) => {
  const result = await handleRegistration(req.body);
  res.status(result.status).json(result);
});
```