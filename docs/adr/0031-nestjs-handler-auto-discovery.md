# ADR-0031: NestJS Handler Auto-Discovery

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**:
Reduce NestJS handler registration boilerplate from ~100 LOC to ~10 LOC
**Implementation**: VF-019

## Problem Statement

Consumer project wymaga recznej rejestracji kazdego handlera w `onModuleInit()`.
Przy 200+ commands i 100+ queries to tysiace linii boilerplate'u. Dodanie nowego
handlera wymaga edycji 2-3 plikow. Timing issues powoduja ze eventy sa gubione
jesli handler zarejestrowany za pozno.

## Decision

**Stworzyc `VytchesDddModule` base class ktory automatycznie odkrywa i
rejestruje handlery.**

### Podejscie: Decorator Metadata Scanning

Wykorzystac istniejace dekoratory NestJS (`@Injectable()`) + nowe dekoratory
VytchesDDD:

```typescript
@CommandHandler(CreateOrderCommand)
@Injectable()
class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> { ... }

@Module({
  providers: [CreateOrderHandler, CancelOrderHandler],
})
class OrderModule extends VytchesDddModule {
  // Zero manual registration needed
  // VytchesDddModule.onModuleInit() skanuje providers
  // i rejestruje handlery automatycznie
}
```

### Jak to dziala

1. `VytchesDddModule` implementuje `OnModuleInit`
2. W `onModuleInit()` iteruje po providers modulu
3. Sprawdza metadata dekoratorow (@CommandHandler, @QueryHandler, @EventHandler)
4. Automatycznie rejestruje w odpowiednim busie
5. Gwarantuje kolejnosc: wszystkie handlery zarejestrowane przed pierwszym
   eventem

### Backward Compatibility

```typescript
// Stary pattern nadal dziala
class OrderModule implements OnModuleInit {
  onModuleInit() {
    this.commandBus.register([...]); // manual, jak dotad
  }
}

// Nowy pattern (opt-in)
class OrderModule extends VytchesDddModule {
  // automatic
}
```

## Benefits

- 1 plik zamiast 3 przy dodawaniu handlera
- Zero timing issues (framework gwarantuje kolejnosc)
- Mniej boilerplate'u w consumer project
- Backward compatible (opt-in)

## Risks & Mitigations

**Risk**: NestJS internal metadata API sie zmieni. **Mitigation**: Wrapowac
metadata access, nie uzywac NestJS internals bezposrednio.

**Risk**: Circular dependency miedzy modulami przy discovery. **Mitigation**:
Discovery dziala tylko na providers wlasnego modulu, nie skanuje innych.

## Alternatives Considered

### Alternative 1: Convention-based (interface scanning)

**Rejected**: Wymaga `instanceof` checks w runtime, wolniejsze, mniej explicit.

### Alternative 2: Registration DSL

**Rejected**: Nadal wymaga manual registration, tylko ładniejsza składnia.

---

**Author**: VytchesDDD Team **Approval**: Pending
