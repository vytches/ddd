# Plan Standaryzacji Konfiguracji Monorepo

## Podsumowanie Analizy

### Obecny Stan Konfiguracji

#### 1. vite.config.mts - Problemy zidentyfikowane:

- **Niespójne aliasy**: Niektóre pakiety mają różne zestawy aliasów (event-store
  vs core vs domain-primitives)
- **Duplikacja konfiguracji**: Podstawowe ustawienia są powielane w każdym
  pakiecie
- **Ręczne zarządzanie zależnościami**: Konieczność ręcznego dodawania aliasów
  dla każdej zależności
- **Brak automatycznej detekcji typu pakietu**: Meta-pakiety vs regularne
  pakiety mają różne potrzeby

#### 2. tsconfig.json - Stan dobry:

- ✅ **Spójność**: Wszystkie pakiety używają identycznej konfiguracji
- ✅ **Dziedziczenie**: Prawidłowe rozszerzanie z tsconfig.base.json
- ✅ **Struktura**: Poprawne include/exclude patterns

#### 3. project.json - Znaczne różnice:

- **Niespójne executory**: @nx/js:tsc vs @nx/vite:test vs nx:run-commands
- **Różne outputs**: Niektóre pakiety mają różne ścieżki outputów
- **Brak standardowych targets**: Nie wszystkie pakiety mają type-check target
- **Różne tags**: Niespójne tagowanie pakietów

#### 4. package.json - Częściowe różnice:

- **Różne wersje**: 0.0.1 vs 0.1.0
- **Niespójne exports**: Niektóre pakiety mają dodatowe export paths
- **Różne dependencies**: Różne podejścia do peer vs regular dependencies
- **Niespójne scripts**: Różne zestawy npm scripts

## Unified Configuration Solution

### Kluczowe Zalety Proponowanego Rozwiązania

#### 1. **Inteligentna Detekcja Typu Pakietu**

```javascript
const isMetaPackage =
  packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0;
```

- Automatycznie rozpoznaje meta-pakiety (jak `core`) vs regularne pakiety
- Różne strategie budowania dla różnych typów

#### 2. **Architekturalne Warstwy Dependency Management**

```javascript
// Foundation packages (tylko utils + contracts)
const foundationPackages = [
  'domain-primitives',
  'value-objects',
  'repositories',
  'aggregates',
  'contracts',
];

// Higher-level packages (core + specific dependencies)
```

- Zgodność z architekturą opisaną w CLAUDE.md
- Automatyczne zarządzanie zależnościami według warstw

#### 3. **Unified Alias Strategy**

- **Build aliasy**: Minimalne, tylko potrzebne zależności
- **Test aliasy**: Wszystkie common aliasy dla maksymalnej elastyczności testów
- **Auto-detection**: Automatyczne dodawanie self-import aliases

#### 4. **Layer-Based Configuration**

```javascript
const PACKAGE_LAYERS = {
  // Foundation Layer
  contracts: 'foundation',
  'domain-primitives': 'foundation',
  // ...
};
```

- Mapowanie pakietów do warstw architektonicznych
- Automatyczne określanie zależności na podstawie warstwy

## Plan Implementacji

### Faza 1: Przygotowanie (1-2 dni)

1. **Walidacja szablonów**

   ```bash
   # Test generatora na przykładowych pakietach
   node scripts/generate-package-config.js event-store --dry-run
   node scripts/generate-package-config.js core --dry-run
   ```

2. **Backup obecnych konfiguracji**
   ```bash
   # Utworzenie backup branch
   git checkout -b backup/current-configs
   git add . && git commit -m "backup: current package configurations"
   git checkout main
   ```

### Faza 2: Pilotażowa Implementacja (2-3 dni)

1. **Pilotaż na 3 reprezentatywnych pakietach**:

   - `event-store` (Infrastructure layer, complex dependencies)
   - `domain-primitives` (Foundation layer, minimal dependencies)
   - `core` (Meta-package, special handling)

2. **Validation workflow**:

   ```bash
   # Dla każdego pilotażowego pakietu
   cd packages/[package-name]

   # Backup current config
   cp vite.config.mts vite.config.mts.backup
   cp package.json package.json.backup

   # Generate new config
   node ../../scripts/generate-package-config.js [package-name]

   # Test new configuration
   pnpm build
   pnpm test
   pnpm lint
   pnpm type-check
   ```

### Faza 3: Pełna Standaryzacja (3-5 dni)

1. **Batch generation dla wszystkich pakietów**:

   ```bash
   # Generate configs for all packages
   node scripts/generate-package-config.js --all --dry-run

   # Po walidacji, pełna implementacja
   node scripts/generate-package-config.js --all
   ```

2. **Validation matrix** - Test każdego pakietu:
   ```bash
   # Automatyczna walidacja wszystkich pakietów
   for package in packages/*/; do
     echo "Testing $(basename $package)..."
     cd $package
     pnpm build && pnpm test && pnpm lint
     cd ../..
   done
   ```

### Faza 4: Documentation & Automation (1-2 dni)

1. **Update CLAUDE.md** z nową strategią konfiguracji
2. **GitHub Actions workflow** dla automatycznej walidacji
3. **Pre-commit hooks** dla sprawdzania spójności konfiguracji

## Najlepsze Praktyki z Research

### 1. **Modern Nx + Vite Integration**

- Użycie `@nx/vite:build` i `@nx/vite:test` executors
- Unified cache directory structure
- TypeScript project references optimization

### 2. **Bundle Strategy Optimization**

- ES + CJS formats dla kompatybilności
- Tree-shaking friendly external declarations
- Optimized build targets (ES2020)

### 3. **Development Experience**

- Hot reload podczas development
- Incremental builds przez TypeScript project references
- Unified test configuration z coverage

### 4. **Enterprise-Grade Features**

- Proper sourcemap handling (disabled for production)
- Type declaration generation z DTS plugin
- Module resolution optimization

## Risk Mitigation

### 1. **Rollback Strategy**

```bash
# Jeśli coś pójdzie nie tak, łatwy rollback
git checkout backup/current-configs -- packages/
```

### 2. **Incremental Testing**

- Pilotaż przed pełną implementacją
- Automated validation na każdym kroku
- Dry-run mode dla bezpiecznego testowania

### 3. **Compatibility Checks**

- Sprawdzenie backward compatibility
- Validation CI/CD pipelines
- Integration tests przed merge

## Expected Benefits

### 1. **Developer Experience**

- 🚀 **Jednolita konfiguracja** - łatwiejsza konfiguracja nowych pakietów
- 🔧 **Automated tooling** - generator automatyzuje setup
- 🎯 **Smart dependencies** - automatyczne zarządzanie na podstawie architektury

### 2. **Maintenance**

- 📦 **DRY principle** - eliminacja duplikacji konfiguracji
- 🏗️ **Architecture compliance** - wymuszona zgodność z warstwami DDD
- 🔄 **Easy updates** - centralne zarządzanie template'ami

### 3. **Quality Assurance**

- ✅ **Consistent builds** - identyczne ustawienia dla wszystkich pakietów
- 🧪 **Reliable testing** - unified test environment
- 📊 **Better tooling** - optimized dla modern bundlers i IDE

## Next Steps

1. **Przejrzyj i zatwierdź** szablony konfiguracji
2. **Uruchom pilotaż** na wybranych pakietach
3. **Walidacja** rezultatów przed pełną implementacją
4. **Full rollout** z automated validation

Ten plan zapewnia bezpieczną, incrementalną standaryzację wszystkich
konfiguracji monorepo przy zachowaniu backward compatibility i minimalizacji
ryzyka.
