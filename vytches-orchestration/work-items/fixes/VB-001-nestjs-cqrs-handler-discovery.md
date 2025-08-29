# VB-001: Fix NestJS CQRS Handler Discovery

**Priority**: 95/100 (CRITICAL)  
**Complexity**: High  
**Estimated Time**: 4-6 hours  
**Package**: @vytches/ddd-nestjs  
**Domain**: Framework Integration  
**Assigned**: library-expert  
**Status**: Ready for Implementation

## Business Impact

**Revenue Risk**: HIGH - Blocking enterprise NestJS adoption

- Affects 40% of potential enterprise customers using NestJS
- Core advertised feature (auto-discovery) not working
- User experience degradation forcing manual workarounds

**Strategic Alignment**: CRITICAL

- NestJS is primary enterprise framework target
- Auto-discovery is key differentiator vs competitors
- Integration reliability affects library credibility

## Technical Context

### Root Cause Analysis

The VytchesDDDModule.forRoot() auto-discovery system fails to properly register
CQRS handlers that use the dual decorator pattern:

```typescript
// FAILING PATTERN - Not discovered
@Injectable()
@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler extends BaseCommandHandler<...> {
  async execute(command: RegisterUserCommand): Promise<void> {
    // Implementation
  }
}

// Configuration that should work but doesn't
VytchesDDDModule.forRoot({
  autoDiscovery: { enabled: true },
  discovery: { enabled: true },
  cqrs: { autoRegisterHandlers: true },
  events: { eventBus: { type: 'unified' } },
})
```

### Discovery Service Gaps

1. **Metadata Extraction**: Discovery service doesn't properly extract CQRS
   metadata from dual decorators
2. **Registration Sync**: Handler registration doesn't sync between NestJS DI
   container and VytchesDDD service locator
3. **Inheritance Handling**: BaseCommandHandler inheritance pattern not properly
   detected

### Files Requiring Modification

**Primary Files**:

- `packages/nestjs/src/discovery/vytches-discovery.service.ts` - Main discovery
  service
- `packages/nestjs/src/discovery/cqrs-handler-discovery.service.ts` - CQRS
  handler discovery
- `packages/nestjs/src/vytches-ddd.module.ts` - Module configuration
- `packages/nestjs/src/providers/command-bus.provider.ts` - Command bus provider
- `packages/nestjs/src/providers/query-bus.provider.ts` - Query bus provider

**Test Files**:

- `packages/nestjs/tests/discovery/cqrs-handler-discovery.service.test.ts`
- `packages/nestjs/tests/integration/auto-discovery.test.ts`

## Requirements

### Acceptance Criteria

1. **Dual Decorator Support**

   - [ ] Handlers with @Injectable() + @CommandHandler() are discovered
   - [ ] Handlers with @Injectable() + @QueryHandler() are discovered
   - [ ] Handler registration works with BaseCommandHandler inheritance

2. **Auto-Discovery Integration**

   - [ ] VytchesDDDModule.forRoot({ autoDiscovery: { enabled: true } }) works
   - [ ] Handlers are registered in both NestJS and VytchesDDD containers
   - [ ] No manual registration required for standard patterns

3. **Configuration Validation**
   - [ ] Clear error messages for misconfigured handlers
   - [ ] Validation warnings for unsupported handler patterns
   - [ ] Debug logging for discovery process

### Technical Requirements

1. **Discovery Service Enhancement**

   ```typescript
   // Must detect this pattern:
   @Injectable()
   @CommandHandler(SomeCommand)
   export class SomeHandler extends BaseCommandHandler<...> {}
   ```

2. **Container Synchronization**

   ```typescript
   // Both containers must have the handler:
   nestjsContainer.get(SomeHandler); // Works
   VytchesDDD.resolve<SomeHandler>('someHandler'); // Works
   ```

3. **Metadata Processing**
   - Extract command/query types from decorators
   - Maintain handler-to-command/query mappings
   - Support inheritance chains

## Implementation Plan

### Phase 1: Discovery Service Fix (2 hours)

1. **Enhance Handler Detection in vytches-discovery.service.ts**

   - Fix metadata extraction for dual decorators
   - Add proper CQRS metadata constants check
   - Support BaseCommandHandler inheritance pattern

2. **Metadata Processing**
   - Extract command types from @CommandHandler()
   - Extract query types from @QueryHandler()
   - Handle inheritance metadata properly

### Phase 2: Container Integration (2 hours)

1. **Sync Registration**

   - Register handlers in VytchesDDD container
   - Maintain NestJS DI registration
   - Create bridge between containers

2. **Handler Resolution**
   - Ensure CommandBus can resolve handlers
   - Support both resolution methods
   - Maintain handler lifecycle

### Phase 3: Validation & Testing (2 hours)

1. **Error Handling**

   - Clear error messages for discovery failures
   - Validation for handler patterns
   - Debug logging for discovery process

2. **Integration Tests**
   - Test dual decorator pattern
   - Test BaseCommandHandler inheritance
   - Test auto-discovery configuration

## Temporary Workarounds (Currently Available)

### Option 1: Manual Registration with forFeature()

```typescript
@Module({
  imports: [
    VytchesDDDModule.forRoot({...}),
    VytchesDDDModule.forFeature({
      handlers: [RegisterUserHandler],
    }),
  ],
  providers: [RegisterUserHandler],
})
export class AppModule {}
```

### Option 2: Direct CommandBus Registration

```typescript
@Injectable()
export class RegisterUserHandler extends BaseCommandHandler<
  RegisterUserCommand,
  void
> {
  // Implementation without @CommandHandler decorator
}

// In module
@Module({
  providers: [
    RegisterUserHandler,
    {
      provide: 'COMMAND_HANDLERS',
      useFactory: (handler: RegisterUserHandler, bus: CommandBus) => {
        bus.register(RegisterUserCommand, handler);
        return handler;
      },
      inject: [RegisterUserHandler, CommandBus],
    },
  ],
})
export class UserModule {}
```

## Verification Steps

1. **Manual Verification**

   ```bash
   # Test dual decorator handler registration
   cd packages/nestjs
   pnpm test -- --grep "dual decorator"

   # Test auto-discovery integration
   pnpm test -- --grep "auto-discovery"
   ```

2. **Integration Test**

   ```typescript
   // Verify this works:
   @Injectable()
   @CommandHandler(TestCommand)
   class TestHandler extends BaseCommandHandler<TestCommand, void> {
     async execute(command: TestCommand): Promise<void> {}
   }

   // In module:
   VytchesDDDModule.forRoot({ autoDiscovery: { enabled: true } });

   // Should work:
   await commandBus.execute(new TestCommand());
   ```

## Progress Tracking

- [ ] **Phase 1**: Discovery service enhancement
- [ ] **Phase 2**: Container integration
- [ ] **Phase 3**: Validation & testing
- [ ] **Verification**: Manual and automated testing
- [ ] **Documentation**: Update integration examples

## Success Metrics

- **Functionality**: Auto-discovery works for dual decorator pattern
- **Performance**: No regression in discovery speed (<100ms for 50 handlers)
- **Documentation**: Clear examples for users
- **Testing**: 100% test coverage for discovery scenarios
- **User Feedback**: Confirmation from reporter that issue is resolved

## Related Tasks

- **VD-001**: Update NestJS integration documentation (Priority: 75)
- **VF-001**: Enhance NestJS module configuration options (Priority: 60)
- **VI-001**: Add discovery debugging tools (Priority: 40)

## Domain Links

- **Bounded Context**: Framework Integration
- **Aggregates**: None (infrastructure concern)
- **Events**: Handler registration events
- **Policies**: Discovery validation policies

## Notes

This is a critical blocker for NestJS enterprise adoption. The fix should be
straightforward but requires careful testing to ensure both manual and
auto-discovery patterns work correctly.

The discovery service already has partial implementation (lines 149-161 in
vytches-discovery.service.ts) but needs enhancement for proper dual decorator
support.

## Lessons Learned

- Framework integration requires careful handling of multiple decorator patterns
- Auto-discovery needs comprehensive metadata extraction
- Container synchronization is critical for dual-DI scenarios
