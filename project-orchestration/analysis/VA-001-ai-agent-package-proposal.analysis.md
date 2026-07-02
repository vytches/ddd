---
task: VA-001
status: approved
threat_model: docs/security/threat-models/TM-VA-001.md
patterns: []
patterns_note:
  '.claude/knowledge/patterns/ nie istnieje w tym checkout (symlink martwy mimo
  odwołania w CLAUDE.md) — brak kanonicznych Rule Cards do wstrzyknięcia.
  Analiza oparta na bezpośrednim odczycie kodu istniejących pakietów
  (validation, cqrs, domain-primitives, events) i precedensach w monorepo.'
decisions:
  - id: D1
    title:
      'AIToolDefinition.inputSchema: reuse IValidator<T> zamiast bespoke
      SchemaValidator<T>'
    decision:
      'Zastąpić własny SchemaValidator<T> (parse/safeParse, throw-based,
      type-erasing) istniejącym IValidator<T>
      (Result<T,IValidationErrors>-zwracający). KOREKTA 2026-07-02 (runda 3):
      IValidator<T> jest zdefiniowany i eksportowany z @vytches/ddd-contracts
      (packages/contracts/src/validation/validator.interfaces.ts), NIE z
      @vytches/ddd-validation — packages/validation/src/index.ts w ogóle go nie
      re-eksportuje. Żaden nowy peerDependency nie jest potrzebny: ddd-contracts
      już jest w grafie (Result<T>). @vytches/ddd-validation może wejść co
      najwyżej jako devDependency (przykłady referencyjne z
      BaseValidationAdapter), nigdy jako runtime/peer dep rdzenia.'
    rationale:
      "Zgodny wniosek 3 niezależnych źródeł: (1) ddd-patterns-expert —
      type-erasure gubi TSchema, niespójność z Result<T> idiomem, niepotrzebna
      duplikacja istniejącej abstrakcji; (2) backend-technology-expert (external
      research) — MCP/Anthropic/OpenAI/Vercel AI SDK zawsze potrzebują
      introspekcji oryginalnego schema do zbudowania JSON Schema dla LLM,
      SchemaValidator<T> to uniemożliwia; (3) architecture-guardian —
      packages/validation zależy WYŁĄCZNIE od contracts+domain-primitives+utils
      (layer:patterns), zero zależności na cqrs/events, dodanie jako peer dep
      NIE tworzy cyklu i nie zwiększa 'tier' sprzężenia ponad to co ddd-agent
      już ma (cqrs, events). performance-optimizer potwierdza różnicę narzutu
      jako pomijalną (mikrosekundy vs milisekundy sieciowe
      rate-limitera/permission-checkera), a throw-based parse() może być
      WOLNIEJSZY na ścieżce błędu (capture stack trace) — co jest częstą ścieżką
      przy halucynacjach LLM."
    propose_adr: true
  - id: D2
    title:
      'Dodać opcjonalny hook introspekcji schema (zamyka lukę JSON Schema dla
      MCP/OpenAI/Anthropic)'
    decision:
      'IValidator<T> użyty w AIToolDefinition powinien (przez wąski mixin, np.
      ISchemaIntrospectable<TSchema> { readonly schema: TSchema } — wzorowany na
      już istniejącym BaseValidationAdapter<T,TSchema>.schema) umożliwiać
      konsumentowi odzyskanie oryginalnego schema do serializacji jako JSON
      Schema (zod.toJSONSchema() / zod-to-json-schema jako docs-only recipe, nie
      zależność biblioteki).'
    rationale:
      'External research: MCP tools/list, Anthropic input_schema, OpenAI
      parameters, Vercel AI SDK — wszystkie wymagają JSON Schema na poziomie
      protokołu. Bez tego AIToolDefinition jest niekompletnym kontraktem —
      konsument musiałby trzymać równoległe źródło prawdy (własną kopię zod
      schema) tylko po to, by zbudować tools/list. UWAGA (runda 3, 2026-07-02):
      BaseValidationAdapter.schema jest dziś polem protected
      (packages/validation/src/adapters/base-adapter.ts:6), więc NIE spełnia
      strukturalnie ISchemaIntrospectable — hook wymaga zależnej zmiany w
      ddd-validation (publiczny getter) przed implementacją D2.'
    propose_adr: false
  - id: D3
    title:
      'requiredPermission musi być obowiązkowe, dispatcher fail-closed bez
      IPermissionChecker'
    decision:
      "Zmienić AIToolDefinition.requiredPermission z opcjonalnego na obowiązkowe
      pole typu { action, subject } | 'PUBLIC_NO_AUTH'. IAICommandDispatcher
      implementacje muszą odmówić dispatchu (najlepiej: odmówić konstrukcji)
      jeśli IPermissionChecker nie jest wstrzyknięty, a jakikolwiek
      zarejestrowany tool wymaga uprawnień."
    rationale:
      'Threat model TM-VA-001-E1 (DREAD 35/50, HIGH): opcjonalne pole + brak
      zdefiniowanego zachowania fail-open/fail-closed to confused-deputy /
      elevation-of-privilege o wysokiej szkodliwości i odtwarzalności. To zmiana
      kształtu typu — tańsza teraz (koncept) niż po opublikowaniu v0.1 (breaking
      change).'
    propose_adr: false
  - id: D4
    title:
      'Kanoniczny pipeline dispatchera: cały błąd-boundary przez
      AIErrorTranslator, nie throw-based parse()'
    decision:
      "Dokumentacja/referencyjna implementacja dispatchera musi pokazywać
      Result-returning walidację (zgodnie z D1) i JEDEN zewnętrzny try/catch
      (lub równoważnik Result) obejmujący WSZYSTKIE 5 kroków pipeline'u, nie
      tylko commandBus.execute(). Każdy błąd z dowolnego kroku przechodzi przez
      AIErrorTranslator zanim dotrze do wywołującego (LLM)."
    rationale:
      'TM-VA-001-I1 (DREAD 35/50, HIGH): throw-based parse() w kanonicznym
      przykładzie + błąd-handling tylko wokół execute() ryzykuje wyciek stack
      trace/internals wprost do kontekstu promptu modelu — gorsze niż zwykły
      wyciek do użytkownika, bo model może to powtórzyć lub zinterpretować jako
      instrukcję.'
    propose_adr: false
  - id: D5
    title:
      'Dispatcher konstruuje IActor wewnętrznie z AIDispatchContext; typed
      IAIActor zamiast nietypowanej konwencji metadata'
    decision:
      "IAICommandDispatcher buduje IActor deterministycznie z AIDispatchContext
      (type:'ai_agent', metadata.aiSessionId = context.sessionId) zamiast
      przyjmować actor od wywołującego. Dodać w @vytches/ddd-domain-primitives
      typowany, dyskryminowany interfejs IAIActor extends IActor {
      type:'ai_agent'; aiSessionId: string; modelId?: string } zamiast
      nietypowanej konwencji actor.metadata.aiSessionId."
    rationale:
      "TM-VA-001-R1 (DREAD 28/50, MEDIUM) + niezależna konwergencja
      ddd-patterns-expert: nietypowana konwencja jest łatwa do
      pominięcia/sfałszowania, co podważa kluczową wartość VA-001 ('każdy
      integration event niesie human-vs-agent za darmo'). Tani koszt — jeden
      nowy eksportowany interfejs."
    propose_adr: false
  - id: D6
    title:
      "Template-method base dispatcher (opcjonalnie) wymuszający kolejność
      kroków pipeline'u"
    decision:
      'Rozważyć dostarczenie abstract class (np. AICommandDispatcherTemplate) z
      zahardkodowaną kolejnością 5 kroków, gdzie tylko interfejsy
      (IAIRateLimiter, IPermissionChecker, walidator, fromAI) są punktami
      rozszerzenia — zamiast samego interfejsu IAICommandDispatcher, który
      pozwala dowolnej implementacji pominąć/przestawić kroki.'
    rationale:
      'TM-VA-001-D1 (DREAD 27/50, MEDIUM): kolejność rate-limit→permission→parse
      jest dziś tylko prozą w dokumentacji, nic jej nie wymusza na poziomie
      typów.'
    propose_adr: false
  - id: D7
    title:
      'Domyślny bezpieczny AIErrorTranslator + test helper assertNoLeakage w
      v0.1'
    decision:
      'Dostarczyć w v0.1 domyślną, konserwatywną implementację AIErrorTranslator
      (nigdy nie echo error.message) oraz publiczny test helper
      assertNoLeakage(translator, sampleErrors) w @vytches/ddd-agent/testing.'
    rationale:
      'TM-VA-001-I2 (DREAD 26/50, MEDIUM): leaked:false to gwarancja typu, nie
      runtime. Sam typ nie wystarcza — potrzebny weryfikowalny mechanizm.'
    propose_adr: false
  - id: D8
    title:
      'Brak benchmark harness w v0.1; TODO w docs oznaczający przyszły hot path'
    decision:
      'Nie dodawać dev-only benchmark harness (wzorem VP-006) do v0.1 — pakiet
      to same interfejsy, nie ma jeszcze czego mierzyć. Dodać komentarz/TODO w
      dokumentacji oznaczający handler-resolution + permission-check jako
      perf-sensitive hot path dla przyszłej konkretnej implementacji (v0.2+).'
    rationale:
      "performance-optimizer: brak czerwonych flag w v0.1 (same interfejsy + 1
      abstract class + 1 mock = pomijalny narzut V8). Benchmark bez konkretnej
      implementacji do zmierzenia byłby przedwczesny, niespójny z precedensem
      'no premature optimization without measurement' z VP-006."
    propose_adr: false
  - id: D9
    title: 'Nazwa pakietu potwierdzona: @vytches/ddd-agent'
    decision:
      "Zachować @vytches/ddd-agent (open question #1 z taska — rozstrzygnięte).
      Odrzucić @vytches/ddd-ai (zbyt generyczne, brzmi jak nazwa dostawcy,
      koliduje z 'no LLM-provider SDKs') i @vytches/ddd-ai-boundary (3 słowa
      poza konwencją, 'boundary' myląco kojarzy się z bounded-context)."
    rationale:
      'architecture-guardian: konwencja 21 istniejących pakietów to
      1(-2)-słowowy rzeczownik nazywający wzorzec/koncept DDD (cqrs, events,
      policies, validation), nie technologię. @vytches/ddd-agent jedyna nazwa
      spójna z tym wzorcem i z planowanym przyszłym @vytches/ddd-agent-nestjs.'
    propose_adr: false
  - id: D10
    title:
      'LangChain/LangSmith (i inne frameworki orkiestracji AI) — docs-only
      recipes, zero zależności po stronie biblioteki'
    decision:
      "Potwierdzić i rozszerzyć już przyjętą zasadę (OQ#7 z recenzji 2026-06-12:
      'provider tool-schema converters: out, docs-only recipes') na LangChain i
      LangSmith explicite: (a) LangChain — konsument buduje własny LangChain
      Tool/StructuredTool z AIToolDefinition.{name,description,examples} + JSON
      Schema z hooka D2, bez żadnej zależności ddd-agent na langchain; (b)
      LangSmith — tracing/observability spina się przez subskrypcję na
      IntegrationEvent<AIWorkflowStepTracedPayload> (już planowane, v0.2+) i
      eksport do LangSmith we własnym handlerze konsumenta, analogicznie do
      zasady 'biblioteka loguje tylko wewnętrznie, adaptery loggera są
      docs-only' już obowiązującej w tej bibliotece."
    rationale:
      "Użytkownik explicite zapytał o LangSmith/LangChain w trakcie analizy. Nie
      wymaga to NOWEGO mechanizmu — D2 (introspekcja schema) i istniejący
      IntegrationEvent<T> już dają wszystko czego potrzeba taki adapter;
      wystarczy jawnie wymienić oba w sekcji 'Provider/Framework Recipes
      (docs-only)' przyszłej dokumentacji v0.1/v0.2, żeby nie trzeba było tego
      odkrywać ad-hoc."
    propose_adr: false
  - id: D11
    title:
      'Domyślna topologia wdrożenia: agent AI w tym samym procesie co CommandBus'
    decision:
      'Rekomendowany punkt startowy dla konsumentów (monolit, jak juz-ide-api
      dziś): uruchomić pętlę orkiestracji (LangChain/LangGraph) w TYM SAMYM
      procesie co CommandBus, z InProcessAICommandDispatcher wołającym
      commandBus.execute() jako zwykłe wywołanie funkcji (zero HTTP). Dopiero
      świadome wydzielenie osobnego serwisu AI-gateway (skalowanie, izolacja)
      wymaga RemoteAICommandDispatcher robiącego HTTP/gRPC call — to decyzja
      topologii wdrożenia konsumenta, nie coś wymuszone przez ddd-agent.'
    rationale:
      'IAICommandDispatcher jako port (hexagonal) już to umożliwia bez zmian w
      bibliotece — potwierdzenie, że transport-agnostyczność projektu z
      2026-06-12 rzeczywiście działa dla obu topologii bez zmiany
      AIToolDefinition/walidacji/permission-checkera. Dyskusja z użytkownikiem
      2026-07-01 (jak wdrożyć w juz-ide-api) ujawniła potrzebę jawnego
      udokumentowania tego, żeby konsument nie zakładał niepotrzebnie HTTP tam
      gdzie nie jest wymagane.'
    propose_adr: false
  - id: D12
    title:
      'LangSmith/LangChain tracing: kierunek jednostronny, częściowo
      automatyczny'
    decision:
      "Doprecyzowanie D10: (a) LangChain SDK ma WŁASNE, automatyczne tracing do
      LangSmith (LANGCHAIN_TRACING_V2 + API key) pokrywające widok 'co LLM
      robił' — zero kodu po stronie ddd-agent/konsumenta; (b) widok domenowy
      ('który Command, jaki actor, jaki tier') idzie przez
      IntegrationEvent<AIWorkflowStepTracedPayload> (v0.2+) i własny subskrybent
      konsumenta wysyłający do LangSmith API jako custom run/trace; (c)
      LangSmith jest zawsze pasywnym odbiorcą — nigdy nie inicjuje połączenia do
      API konsumenta, ruch jest wyłącznie wychodzący (consumer → LangSmith)."
    rationale:
      'Użytkownik pytał wprost 2026-07-01 czy LangSmith wysyła zapytania do
      naszego API — nie, to jednokierunkowe. Warto to mieć spisane, żeby nie
      trzeba było tego ustalać ponownie przy implementacji.'
    propose_adr: false
  - id: D13
    title:
      'AIToolCallRecord — provider-neutral kontrakt call-logu (kto/co/kiedy),
      interfejs only, bez storage w bibliotece'
    decision:
      "Sformalizować kontrakt rejestrowania wywołań narzędzi (kto wywołał, jakie
      narzędzie, kiedy, jaki wynik) jako rozszerzenie/doprecyzowanie już
      planowanego AIWorkflowStepTracedPayload (v0.2+), NIE jako nowy równoległy
      mechanizm. Kontrakt jest z definicji provider-neutral — bo normalizacja
      formatu providera (Anthropic tool_use.input vs OpenAI
      function_call.arguments vs MCP) dzieje się PRZED dotarciem do dispatchera
      (to zadanie provider-adaptera/recipe, nie ddd-agent), więc
      IAICommandDispatcher.dispatch(toolName, rawParams, context) i wynikający z
      niego call-record nigdy nie widzą provider-specific kształtu parametrów —
      tylko już znormalizowane rawParams. Biblioteka dostarcza WYŁĄCZNIE
      interfejs/kształt eventu (kontrakt), nie storage ani query API (żadna
      implementacja przechowywania/wyszukiwania historii wywołań) — spójne z
      IPermissionChecker/IAIRateLimiter i wykluczeniem 'AISession aggregate' z
      zakresu. Konsument buduje projekcję/read-model z tych eventów dokładnie
      tak jak każdy inny CQRS read-model w tej bibliotece, jeśli potrzebuje
      query'owalnej historii."
    rationale:
      "Pytanie użytkownika 2026-07-01: czy 'system wywołań (jakie narzędzia,
      kiedy, przez kogo)' powinien być w bibliotece na kontraktach, czy
      zostawiony userom. Odpowiedź: kontrakt TAK (bo to czysto strukturalne,
      provider-neutral z powodu istniejącej architektury boundary),
      implementacja/storage NIE (spójne z resztą filozofii biblioteki —
      interfejsy, nie infrastruktura). To NIE jest AIWorkflowEngine (jawnie
      out-of-scope, OQ#3 z 2026-06-12 — bo to byłaby ORKIESTRACJA/decyzja co
      wywołać dalej) ani pełny AIToolRegistry (OQ4 — statyczna lista dostępnych
      narzędzi) — to trzeci, odrębny koncept: log/audyt HISTORII wywołań,
      którego dotąd nie było jasno nazwanego jako osobna decyzja."
    propose_adr: false
  - id: D14
    title:
      'Ujednolicona sygnatura dispatch(toolName, rawParams, context) —
      rozstrzygnięcie niespójności specyfikacji'
    decision:
      "IAICommandDispatcher.dispatch<T>(toolName: string, rawParams: unknown,
      context: AIDispatchContext): Promise<Result<T, AIDispatchError>>. Wariant
      z głównego dokumentu taska (dispatch(command: object, context)) jest
      odrzucony — dispatcher NIE może przyjmować gotowej instancji komendy, bo
      to on wykonuje kroki 3-4 pipeline'u (walidacja schema + konstrukcja
      komendy przez toCommand). Wpływa na kontrakt
      MockAICommandDispatcher.assertDispatched()."
    rationale:
      "Runda 3 (library-api-guardian): główny dokument i D13 definiowały dwa
      różne kształty centralnego interfejsu pakietu. Wariant toolName+rawParams
      jest jedynym spójnym z pipeline'em (dispatcher woła validate() i
      konstruuje komendę — przyjęcie gotowej komendy ominęłoby kroki 1-3) i z
      D13 (call-record widzi znormalizowane rawParams)."
    propose_adr: false
  - id: D15
    title:
      'AIToolDefinition.toCommand zamiast static fromAI() / AICallableClass
      (rewizja korekty #3 z 2026-06-12)'
    decision:
      'Mapowanie AI→Command jako zwykła funkcja w definicji narzędzia:
      AIToolDefinition.toCommand: (params: TParams) => TCommand. Usunąć
      AICallableClass<TInstance,TParams> i konwencję static fromAI() na klasach
      Command.'
    rationale:
      'Runda 3 (ddd-compliance-guardian, medium-high): ICommand to pusty
      interfejs znacznikowy — Command jest DTO intencji agnostycznym względem
      adaptera; static fromAI() wciąga słownictwo konkretnego adaptera (AI) do
      publicznego kontraktu typu, który powinien być reużywalny z HTTP/CLI.
      Dodatkowo AICallableClass (new (...args: never[]) + static) to krucha
      sztuczka TS wymagająca osobnego testu expect-type (uwaga
      library-api-guardian). toCommand: (1) Command czysty od adaptera, (2)
      enforcement przez zwykły typ funkcyjny, (3) AIToolDefinition staje się
      jedynym, w pełni deklaratywnym artefaktem narzędzia.'
    propose_adr: true
  - id: D16
    title:
      'Strukturalne guardraile przeciw dependency-creep i naruszeniu granic
      (przed v0.1)'
    decision:
      'Przy tworzeniu packages/agent: (a) wpis scope:agent w depConstraints
      .eslintrc.json z tagiem layer:integration (analogicznie do acl),
      onlyDependOnLibsWithTags: [scope:contracts, scope:domain-primitives,
      scope:cqrs, scope:events, scope:testing]; (b) no-restricted-imports
      blokujący zod, langchain*, openai, @anthropic-ai/* jako importy w
      packages/agent; (c) testy expect-type na kluczowe kształty
      (AIToolPermission exhaustiveness, toCommand) przed zamrożeniem v0.1.'
    rationale:
      'Runda 3 (architecture-guardian + ddd-compliance-guardian):
      dependency-creep pojawił się już dwa razy (zod 2026-06-12,
      LangChain/LangSmith 2026-07-01) — dyscyplina recenzji wystarczyła, ale
      przy presji dostawy ~2026-08/09 trzeci raz jest prawdopodobny bez
      mechanizmu strukturalnego. Repo już rezerwuje tagi dla przyszłych pakietów
      (scope:cli, scope:event-store), więc wpis scope:agent jest zgodny z
      precedensem i czyni spec weryfikowalną przez pnpm lint zamiast prozą.'
    propose_adr: false
  - id: D17
    title:
      'Luka ABAC jawnie udokumentowana: instance-level authorization to
      rezydualna odpowiedzialność handlera'
    decision:
      "requiredPermission daje wyłącznie type-level RBAC. Dispatcher
      strukturalnie NIE może wykonać instance-level authorization (ABAC — 'czy
      TEN actor może edytować TĘ encję'), bo nie ma sparsowanych danych przed
      krokiem 3. Dokumentacja v0.1 musi jawnie stwierdzać: handler MUSI nadal
      egzekwować autoryzację na poziomie instancji (defense-in-depth)."
    rationale:
      'Runda 3 (ddd-compliance-guardian, high): bez tego zapisu implementerzy
      uznają dispatcher za pełne pokrycie autoryzacji — ten sam confused-deputy
      z TM-VA-001-E1, tylko warstwę niżej (w handlerze).'
    propose_adr: false
  - id: D18
    title:
      'Domyślny AIErrorTranslator z taksonomią kategorii błędów, nie jednym
      fallback stringiem'
    decision:
      "Domyślna implementacja z D7 rozróżnia kategorie: validation_error /
      permission_denied / rate_limited / internal_error + flaga retryable — przy
      zachowaniu zero-leak (nigdy error.message). Jeden uniwersalny string
      ('Unable to complete the action...') jest niewystarczający."
    rationale:
      'Runda 3 (developer-experience): odbiorcą komunikatu jest LLM w pętli
      agentowej — bez kategorii nie wie, czy retry ma sens, czy pytać usera, czy
      się poddać. Taksonomia to minimalny koszt (mapa kategorii→komunikat), duży
      zysk dla jakości pętli agentowej.'
    propose_adr: false
  - id: D19
    title:
      "Naprawa dryfu dokumentacji DefaultActorType RAZEM z dodaniem 'ai_agent'
      (warunek dla D5)"
    decision:
      "Przed lub razem z rozszerzeniem DefaultActorType o 'ai_agent' (D5)
      naprawić istniejący dryf w @vytches/ddd-domain-primitives: kod
      (actor.interface.ts) ma 7 wartości (USER, SYSTEM, ADMIN, GUEST,
      ORGANIZATION, TEAM, SERVICE), LLMGUIDE.md:57 dokumentuje 4 inne (w tym
      nieistniejące 'agent'), README.md:95 jeszcze inny zestaw 4. Trzy wzajemnie
      sprzeczne źródła."
    rationale:
      "Runda 3 (ddd-compliance-guardian, zweryfikowane w kodzie): dodawanie
      wartości do enuma, którego dokumentacja już jest wewnętrznie sprzeczna,
      utrwala dryf zamiast go naprawiać — a 'ai_agent' vs istniejące widmowe
      'agent' w LLMGUIDE to gotowa przyszła pomyłka."
    propose_adr: false
open_questions:
  - id: OQ1
    question:
      'D1 (reuse IValidator<T>) — import czysto typowy (tylko interfejs
      IValidator<T>, strukturalnie) czy pełne dziedziczenie z
      BaseValidationAdapter (z helperami createValidationError/failWithErrors)?
      architecture-guardian rekomenduje import type-only, by ddd-agent pozostał
      lekkim pakietem granicznym; ddd-patterns-expert był otwarty na oba
      warianty.'
    answer:
      'Type-only: AIToolDefinition.inputSchema: IValidator<TParams> (sam
      interfejs, strukturalnie). ddd-agent NIE importuje/re-eksportuje
      BaseValidationAdapter — konsument sam decyduje, czy budować swój walidator
      przez BaseValidationAdapter (rekomendowane, istniejący wzorzec ZodAdapter)
      czy inaczej. Utrzymuje ddd-agent jako lekki pakiet graniczny, zgodnie z
      rekomendacją architecture-guardian.'
  - id: OQ2
    question:
      "D3 (mandatory requiredPermission) — sentinel string 'PUBLIC_NO_AUTH',
      osobny wariant typu AIToolDefinition (np. PublicAIToolDefinition bez
      pola), czy inny mechanizm? To decyzja kształtu typu zamrażanego w v0.1 pod
      backward-compat — wymaga jednoznacznego rozstrzygnięcia przed
      implementacją."
    answer:
      "ZREWIDOWANE (runda 3, 2026-07-02): płaski dyskryminowany union POLA (nie
      rozdwojenie AIToolDefinition): AIToolPermission = { readonly kind:
      'PUBLIC_NO_AUTH' } | { readonly kind: 'REQUIRED'; readonly action: string;
      readonly subject: string }. Argument (library-api-guardian): przy
      sentinel-stringu dodanie trzeciego wariantu w v0.2 (np. 'REQUIRES_MFA')
      wpada cicho w gałąź typeof x === 'string' — odroczony fail-open z tej
      samej rodziny co TM-VA-001-E1; switch(permission.kind) + assertNever daje
      compile error w każdym niedopasowanym miejscu. Koszt dziś zerowy (zero
      konsumentów), po v0.1 breaking. Rozwiązuje też uwagę DX: JSDoc-ostrzeżenie
      wisi na wariancie typu, widoczne na hover. Pierwotna obawa (rozdwojenie
      AIToolDefinition) nie dotyczy tej formy — union jest na polu,
      AIToolDefinition zostaje jednym typem."
  - id: OQ3
    question:
      "D6 (template-method dispatcher) — wymuszać kolejność kroków przez
      abstract base class (silniejsze, ale dodaje kolejny eksportowany typ do
      v0.1) czy zostawić jako rekomendację w dokumentacji/przykładzie
      referencyjnym (słabsze, ale minimalniejszy v0.1 zgodny z zasadą 'start
      small')?"
    answer:
      "ZREWIDOWANE (runda 3, 2026-07-02): fabryka zamiast abstract class —
      createAICommandDispatcher(deps: { registry: IAIToolRegistry; rateLimiter:
      IAIRateLimiter; permissionChecker: IPermissionChecker; commandBus:
      ICommandBus; errorTranslator: AIErrorTranslator }): IAICommandDispatcher.
      Dwa argumenty rozstrzygające (library-api-guardian, przy 4:1 głosach za
      klasą — ale argument mniejszości merytorycznie najmocniejszy): (1)
      BEZPIECZEŃSTWO — abstract class z protected krokami można obejść
      subclassem nadpisującym krok, więc TM-VA-001-D1 ('kolejność wymuszona
      strukturalnie') byłby spełniony tylko połowicznie; zamknięcie kroków w
      fabryce jest nienaruszalne, rozszerzenia przez dekorację całego
      dispatchera; (2) EWOLUCJA API — protected sygnatury to najdroższy kontrakt
      (6. krok w v0.2 = breaking), dodanie opcjonalnego pola do deps to
      bezpieczny MINOR. Cała zmienność i tak jest we wstrzykiwanych interfejsach
      — nie ma nic do nadpisywania. Perf: brak narzutu, tree-shaking OK w obu
      wariantach. Fallback jeśli zespół świadomie wybierze klasę: nazwa
      BaseAICommandDispatcher (konwencja Base* jak BaseValidationAdapter), nie
      *Template."
  - id: OQ4
    question:
      "Brak AIToolRegistry w v0.1 (świadomie wyłączony w recenzji 2026-06-12) —
      czy w świetle ustalenia z external research (bez registry konsument nie ma
      z czego zbudować tools/list jako jednego źródła prawdy) warto dorzucić do
      v0.1 chociaż minimalny interfejs rejestru (sama lista, bez logiki
      discovery), czy 'konsument trzyma własną tablicę AIToolDefinition[]'
      wystarcza i registry zostaje w v0.2+ jak zaplanowano?"
    answer:
      'ZREWIDOWANE (runda 3, 2026-07-02): registry wchodzi do v0.1, ale jako
      constructed-immutable, bez register() w interfejsie: IAIToolRegistry {
      get(name: string): AIToolDefinition | undefined; list(): readonly
      AIToolDefinition[] } + fabryka createAIToolRegistry(tools: readonly
      AIToolDefinition[]): Result<IAIToolRegistry, AIToolRegistrationError>.
      Cztery uwagi panelu w jednym cięciu: (1) IMMUTABILITY (ddd-compliance) —
      Object.freeze wzorem BaseValueObject; precedens mutowalnego
      ICommandBus.register() nie przenosi się, bo registry nie ma wymogu
      dynamicznej rejestracji; (2) KOLIZJE NAZW (api-guardian) — cichy overwrite
      restrykcyjnego toola przez PUBLIC_NO_AUTH to wektor confused-deputy; przy
      konstrukcji kolizja = jawny Result.fail przy bootstrapie, a problematyczne
      register(): void vs Result znika z API całkowicie; (3) HOT PATH
      (performance) — get(name) przez wewnętrzną Map O(1) zamiast list().find()
      O(n) przy KAŻDYM tool-callu; list() zwraca zmemoizowaną zamrożoną tablicę;
      (4) DX — konkretna implementacja w core (nie sam interfejs), first-tool
      developer nie pisze Map-wrappera. Guardrail (architecture-guardian):
      registry jest WYŁĄCZNIE źródłem metadanych (budowa tools/list + resolve
      nazwy na definicję), nigdy mechanizmem resolvingu zależności/serwisów.
      Dodatkowo: pola AIToolDefinition dostają readonly (mutacja po rejestracji
      omijałaby wszystko zweryfikowane przy konstrukcji). AIWorkflowEngine i
      toGenericToolSchema() zostają w v0.2+ jak ustalono.'
  - id: OQ5
    question:
      'Czy poprawki D1-D7 (z tej analizy) mają być włączone do treści taska
      VA-001 już teraz (jako kolejna runda korekt na bazie istniejącej §
      Multi-Agent Review z 2026-06-12), czy czekają na osobną rundę recenzji w
      momencie spełnienia entry conditions (~2026-08/09, po walidacji
      produkcyjnej w juz-ide-api)?'
    answer:
      "ZREWIDOWANE (runda 3, 2026-07-02): tak, włączyć teraz — ale jako
      RESTRUKTURYZACJĘ pliku taska, NIE jako kolejną (czwartą) warstwę korekt.
      Dowody, że model 'dopisz sekcję korekt' przestał się skalować: pole
      inputSchema przeszło już przez 3 typy w jednym dokumencie (ZodSchema →
      SchemaValidator → IValidator), a runda 3 znalazła błąd faktograficzny (D1:
      zły pakiet źródłowy IValidator) w rundzie, która sama korygowała
      poprzednią. Docelowa struktura: (1) sekcja '§ v0.1 Target Specification'
      na górze — wyłącznie finalne typy, zero ⚠️, punkt startowy implementacji;
      (2) obie sekcje recenzji scalone w '§ Decision Log / Design History' na
      dole (data, decyzja, dlaczego — bez duplikowania kodu, pełne wersje w git
      history); (3) oryginalny 'Proposed Components' usunięty/oznaczony jako
      historyczny. Wykonano 2026-07-02."
  - id: OQ6
    question:
      "D10 (LangChain/LangSmith jako docs-only recipes) — czy dodać do task file
      jawną wzmiankę/sekcję 'Provider & Framework Recipes' wymieniającą
      zod/valibot/arktype (walidacja), Anthropic/OpenAI/MCP (tool schema),
      LangChain (tool wrapping), LangSmith (tracing) jako jeden skonsolidowany
      punkt odniesienia, czy zostawić to bez zmian w taskcu i rozwiązać dopiero
      w dokumentacji v0.1 (po ekstrakcji pakietu)?"
    answer:
      "Tak, dodać sekcję 'Provider & Framework Recipes' do taska przy okazji
      rundy z OQ5 — konsolidacja tego co już ustalono (D2/D10/D12), zero
      dodatkowego ryzyka projektowego, czysta wartość dokumentacyjna dla
      przyszłego implementera."
  - id: OQ7
    question:
      "D13 (AIToolCallRecord) — czy dorzucić ten skonkretyzowany kontrakt do
      v0.1 scope (obok istniejących interfejsów), czy zostawić razem z resztą
      tracingu w v0.2+ jak dotychczas planowano dla AIWorkflowStepTracedPayload?
      I czy nazwa AIWorkflowStepTracedPayload powinna zostać, czy przemianować
      na coś jak AIToolCallRecord, skoro to węższe pojęcie (jedno wywołanie
      narzędzia) niż 'workflow step' (które sugeruje coś
      szerszego/orkiestracyjnego)?"
    answer:
      "CZĘŚCIOWO ZREWIDOWANE (runda 3, 2026-07-02): zamrożenie KSZTAŁTU pól
      zostaje w v0.2+ (jednogłośnie — highest churn risk, freeze last, po
      realnych danych z juz-ide-api), ale NAZWA rozstrzygnięta już teraz jako
      silnie preferowana (non-binding): AIToolCallRecord. Argument
      (ddd-compliance): payload opisuje pojedyncze wywołanie narzędzia z polami
      korelacji (jak span w distributed tracing — span nie nazywa się
      'TraceStep'), a 'Workflow' w nazwie koliduje z jawnie wykluczonym
      AIWorkflowEngine; decyzja nazewnicza nie wymaga danych produkcyjnych, a
      'odłożone nazwy' cicho stają się domyślnymi pod presją dostawy. Dwie
      notatki forward-looking (performance): durationMs liczony przez
      performance.now() (monotoniczny), nie Date.now(); emisja eventu musi być
      tania/no-op przy braku subskrybenta (zweryfikować gwarancje busa w
      ddd-events)."
---

# Analiza: VA-001 — `@vytches/ddd-agent` (AI↔DDD boundary package)

## Kontekst

VA-001 to koncepcja (status `backlog`, kod jeszcze nie istnieje) pakietu
udostępniającego AI jako "trzeciego driving adaptera" obok HTTP/CLI — LLM woła
`CommandBus` przez dedykowaną warstwę graniczną, bez obchodzenia autoryzacji i
audit trail. Specyfikacja była już raz skorygowana przez 5-agentową recenzję
(2026-06-12), która usunęła zależność od `zod`, poprawiła błędne odwołania do
nieistniejących symboli (`ddd-core`, `BaseIntegrationEvent`, `RequestContext`) i
ustaliła zakres v0.1. Ta analiza to **druga runda** — głębsza, na żądanie
właściciela biblioteki, z naciskiem na (1) czy walidacja AI-tooli powinna
reużywać istniejący pakiet `@vytches/ddd-validation` zamiast definiować
równoległą abstrakcję, oraz (2) jakie wzorce z zewnętrznych ekosystemów AI (MCP,
Anthropic, OpenAI, LangChain, Vercel AI SDK, Semantic Kernel, Pydantic-AI,
instructor) warto zaadaptować.

Panel: threat-model (security-audit), external-patterns-research
(backend-technology-expert, z WebSearch), ddd-fit + walidacja-reuse
(ddd-patterns-expert), performance (performance-optimizer), granice
pakietu/zależności (architecture-guardian).

## Werdykt ogólny

**VA-001 jako kierunek architektoniczny pozostaje słuszny — żaden agent panelu
nie zaproponował lepszej alternatywnej architektury granicy.** "AI jako trzeci
driving adapter" to poprawny wzorzec hexagonal/ports-and-adapters, spójny z tym,
jak `CommandBus` już dziś jest adapter-agnostyczny. Próba zrobienia z tego
osobnego bounded context byłaby nadmiarowa.

Jednocześnie panel zidentyfikował **konkretną, naprawialną wadę projektową** w
skorygowanej (2026-06-12) specyfikacji: `SchemaValidator<T>` jako bespoke,
type-erasing interfejs duplikuje to, co `@vytches/ddd-validation` już rozwiązuje
lepiej (zachowuje `TSchema` do introspekcji), oraz **dwa blokujące problemy
bezpieczeństwa** w kanonicznym pipeline (patrz `TM-VA-001`: opcjonalny
`requiredPermission` bez fail-closed, throw-based `parse()` mogący wyciekać dane
do kontekstu LLM). Żadne z tych ustaleń nie zmienia fundamentalnej architektury
— wszystkie da się zaadresować jako korekty kształtu typów, dokładnie w duchu
poprzedniej rundy recenzji.

## Kluczowe ustalenie: walidacja — reuse, nie duplikacja (D1, D2)

To było główne pytanie badawcze tej analizy i trzy niezależne źródła zbiegają
się w tym samym wniosku z różnych kierunków:

- **DDD/spójność biblioteki** (ddd-patterns-expert): `SchemaValidator<T>` to
  drugi, równoległy mentalny model "pluggable validator" obok już istniejącego
  `IValidator<T>` — dokładnie ten rodzaj duplikacji, którego biblioteka unika.
  `BaseValidationAdapter<T,TSchema>` już dziś zachowuje `this.schema` —
  `SchemaValidator<T>` świadomie to gubi.
- **Zewnętrzne ekosystemy AI** (backend-technology-expert): MCP `tools/list`,
  Anthropic `input_schema`, OpenAI `parameters`, Vercel AI SDK — wszystkie
  wymagają JSON Schema na poziomie protokołu, żeby w ogóle pokazać narzędzie
  modelowi. Type-erasing do `parse/safeParse` bez dostępu do oryginalnego schema
  oznacza, że `AIToolDefinition` nie wystarczy do zbudowania `tools/list` —
  konsument musiałby trzymać równoległe źródło prawdy. Vercel AI SDK rozwiązuje
  to dokładnie tak jak rekomenduje panel: zachowuje referencję do schema właśnie
  po to, by je serializować.
- **Granice pakietu** (architecture-guardian, zweryfikowane przez bezpośredni
  odczyt `package.json`): `@vytches/ddd-validation` zależy WYŁĄCZNIE od
  `contracts` + `domain-primitives` + `utils` (tag `layer:patterns`), zero
  zależności na `cqrs`/`events`. Dodanie jej jako peer dep do `ddd-agent` **nie
  tworzy cyklu** i nie zwiększa kategorii sprzężenia ponad to, co `ddd-agent`
  już ma (zależy od `cqrs`, `events`).
- **Performance** (performance-optimizer): różnica narzutu pomijalna wobec
  sieciowych kroków rate-limitera/permission-checkera; throw-based `parse()`
  może być wręcz wolniejszy na ścieżce błędu (capture stack trace), a ścieżka
  błędu jest częsta przy halucynacjach LLM.

**Rekomendacja**: `AIToolDefinition.inputSchema: IValidator<TParams>`
(Result-zwracający), z opcjonalnym wąskim mixinem introspekcji schema (D2),
zamiast bespoke `SchemaValidator<T>`. Konsument buduje `ZodAdapter` dokładnie
tak jak dziś w istniejącym `HOW-TO-validation.md`. Otwarte pytanie do
rozstrzygnięcia przez człowieka: czy to ma być type-only import samego
interfejsu, czy pełne dziedziczenie z `BaseValidationAdapter` (OQ1).

## Bezpieczeństwo (pełny STRIDE/DREAD w `TM-VA-001`)

Dwa ustalenia HIGH wymagają korekty kształtu typów **przed** ewentualnym cięciem
v0.1 (tańsze teraz niż po publikacji, z uwagi na backward-compat): opcjonalny
`requiredPermission` bez zdefiniowanego zachowania fail-closed (D3), oraz
throw-based `parse()` w kanonicznym pipeline mogący wyciekać internals do
kontekstu LLM (D4). Trzy ustalenia MEDIUM (D5, D6, D7) są silnie rekomendowane,
ale nie blokują dalszej pracy koncepcyjnej. _(Ryzyka: pełna lista w TM-VA-001,
niepowtarzana tutaj)_.

## LangChain / LangSmith (pytanie dodane w trakcie analizy)

Nie wymaga nowego mechanizmu. Zasada "docs-only recipes" już przyjęta dla
`toAnthropicTools()`/`toOpenAITools()` (OQ#7 z recenzji 2026-06-12) rozciąga się
wprost na LangChain (konsument buduje własny `Tool`/`StructuredTool` z
`AIToolDefinition` + JSON Schema z hooka introspekcji D2) i LangSmith (tracing
przez subskrypcję na już planowany
`IntegrationEvent<AIWorkflowStepTracedPayload>`, eksport do LangSmith we własnym
handlerze konsumenta — ten sam wzorzec co istniejąca zasada "logger biblioteki
tylko do diagnostyki wewnętrznej, adaptery loggera są docs-only"). Zob. D10 i
OQ6.

### Topologia wdrożenia (dyskusja 2026-07-01, D11)

`IAICommandDispatcher` jest transport-agnostyczny z założenia (peer dep na
`ddd-cqrs`, nie na HTTP) — to oznacza, że pętla orkiestracji
(LangChain/LangGraph) może żyć **w tym samym procesie** co `CommandBus`
(rekomendowany start dla monolitu, np. juz-ide-api dziś):
`InProcessAICommandDispatcher.dispatch()` woła `commandBus.execute()` jako
zwykłe wywołanie funkcji — zero HTTP do własnych handlerów. HTTP/gRPC pojawia
się dopiero, gdy konsument świadomie wydzieli osobny serwis "AI gateway"
(`RemoteAICommandDispatcher`) — to decyzja topologii wdrożenia, nie coś
wymuszone przez pakiet. Ten sam mechanizm (podmiana implementacji portu)
obsługuje też migrację do mikroserwisów bez zmian w `AIToolDefinition`,
walidacji czy permission-checkerze — dispatcher nie musi wiedzieć, czy dany
command wykonuje się lokalnie czy przez sieć.

### LangSmith — kierunek jednostronny (D12)

LangSmith jest zawsze pasywnym odbiorcą (SaaS) — nigdy nie inicjuje połączenia
do API konsumenta, ruch jest wyłącznie wychodzący. Część tracingu jest darmowa:
LangChain SDK ma natywne, automatyczne raportowanie do LangSmith
(`LANGCHAIN_TRACING_V2` + klucz API), pokrywające widok "co LLM robił" bez
udziału `ddd-agent`. Widok domenowy ("który Command, jaki actor, jaki tier")
wymaga własnego mostu: subskrybent konsumenta na
`IntegrationEvent<AIWorkflowStepTracedPayload>` wysyłający custom run/trace do
LangSmith API.

### Call-log narzędzi: kontrakt tak, storage nie (D13)

Pytanie: czy biblioteka powinna mieć system śledzenia "jakie narzędzie, kiedy,
przez kogo"? To odrębny koncept od już wykluczonego `AIWorkflowEngine`
(orkiestracja — decyzja co wywołać dalej, jawnie out-of-scope) i od
`AIToolRegistry` (statyczna lista dostępnych narzędzi, OQ4) — to
**historia/audyt wywołań**. Kluczowa obserwacja: taki kontrakt może być w pełni
provider-neutral, bo normalizacja formatu providera (Anthropic `tool_use.input`
vs OpenAI `function_call.arguments` vs MCP) dzieje się PRZED dotarciem do
dispatchera — to zadanie provider-adaptera (docs-only recipe), nie `ddd-agent`.
`IAICommandDispatcher.dispatch(toolName, rawParams, context)` widzi już tylko
znormalizowane dane, niezależnie od providera, który zainicjował wywołanie.
Rekomendacja: sformalizować to jako kontrakt (rozszerzenie/dookreślenie
`AIWorkflowStepTracedPayload`), ale **bez** implementacji storage/query w
bibliotece — konsument buduje projekcję/read-model z tych eventów, dokładnie jak
każdy inny CQRS read-model w tej bibliotece, jeśli potrzebuje przeszukiwalnej
historii. Zob. D13 i OQ7.

## Performance

Brak blokad. Pipeline zdominowany przez I/O sieciowe (rate-limiter,
permission-checker), nie przez wybór `SchemaValidator` vs `IValidator`.
Cache'owanie permission-check oceniono jako decyzję bezpieczeństwa (okno na
privilege escalation przy odświeżeniu uprawnień mid-sesji), nie domyślną
optymalizację wydajności — jeśli w ogóle, to opt-in z krótkim TTL. Benchmark
harness (wzorem VP-006) przedwczesny dla pakietu bez jeszcze jednej linii
implementacji (D8).

## Granice pakietu i nazewnictwo

Graf zależności pozostaje acykliczny po dodaniu `@vytches/ddd-validation`
(zweryfikowane przez bezpośredni odczyt `packages/validation/package.json:62-66`
vs `packages/cqrs/package.json:62-66` i `packages/events/package.json:45-50` —
żaden z nich nie zależy zwrotnie od `validation`). Nazwa `@vytches/ddd-agent`
potwierdzona jako jedyna spójna z konwencją nazewniczą 21 istniejących pakietów
(D9).

## Runda 3 — Panel weryfikacyjny (2026-07-02)

Na polecenie właściciela biblioteki pięciu agentów (`library-api-guardian`,
`architecture-guardian`, `performance-optimizer`, `developer-experience`,
`ddd-compliance-guardian`) niezależnie zweryfikowało odpowiedzi OQ1-OQ7 z tej
analizy. Wynik: kierunek i większość decyzji potwierdzone, ale:

- **Korekta faktograficzna D1**: `IValidator<T>` żyje w `@vytches/ddd-contracts`
  (`packages/contracts/src/validation/validator.interfaces.ts:15`), nie w
  `@vytches/ddd-validation` (która go nie re-eksportuje) — nowy peerDependency
  zbędny.
- **OQ2 zrewidowane** → dyskryminowany union pola `AIToolPermission`
  (`kind: 'PUBLIC_NO_AUTH' | 'REQUIRED'`) zamiast sentinel-stringa
  (exhaustiveness-checking, trzeci wariant w v0.2 = compile error zamiast
  cichego fail-open).
- **OQ3 zrewidowane** → fabryka `createAICommandDispatcher(deps)` zamiast
  abstract class (subclass mógłby nadpisać protected krok i obejść kolejność
  pipeline'u; protected sygnatury = najdroższy do ewolucji kontrakt API).
- **OQ4 zrewidowane** → registry constructed-immutable
  (`createAIToolRegistry(tools): Result<...>`, interfejs `get(name)` + `list()`,
  bez `register()`); pola `AIToolDefinition` z `readonly`.
- **OQ5 zrewidowane** → restrukturyzacja pliku taska (§ v0.1 Target
  Specification + § Decision Log) zamiast czwartej warstwy korekt. Wykonano
  2026-07-02.
- **OQ7 częściowo** → kształt pól nadal v0.2+, ale nazwa `AIToolCallRecord`
  zapisana jako preferowana już teraz.
- **Nowe decyzje D14-D19**: ujednolicona sygnatura
  `dispatch(toolName, rawParams, context)` (D14, rozstrzyga niespójność spec vs
  D13), `toCommand` w `AIToolDefinition` zamiast
  `static fromAI()`/`AICallableClass` (D15, propose_adr), guardraile ESLint
  (D16), luka ABAC udokumentowana (D17), taksonomia błędów w domyślnym
  translatorze (D18), naprawa dryfu docs `DefaultActorType` razem z D5 (D19).

## Otwarte pytania — ROZSTRZYGNIĘTE (2026-07-01, zrewidowane 2026-07-02)

_(Pełne uzasadnienia każdej odpowiedzi — we frontmatter,
`open_questions[].answer`. Poniżej skrót dla szybkiego przeglądu, stan po
rundzie 3.)_

1. **OQ1** → `IValidator<T>` type-only **z `@vytches/ddd-contracts`** (korekta
   D1); `ddd-validation` co najwyżej devDependency do przykładów.
2. **OQ2** → dyskryminowany union pola `AIToolPermission` (`kind`-warianty), nie
   sentinel-string.
3. **OQ3** → fabryka `createAICommandDispatcher(deps): IAICommandDispatcher`
   (fallback przy świadomym wyborze klasy: nazwa `BaseAICommandDispatcher`).
4. **OQ4** → `IAIToolRegistry` constructed-immutable (`get`/`list`, kolizje nazw
   = błąd przy konstrukcji) + konkretna implementacja w core; v0.2+ bez zmian.
5. **OQ5** → D1-D19 w task file teraz, jako restrukturyzacja (spec + decision
   log), nie kolejna warstwa korekt.
6. **OQ6** → tak, sekcja "Provider & Framework Recipes" jako wklejalne snippety
   (wersja robocza przyszłych docs).
7. **OQ7** → kształt pól v0.2+ (freeze last); nazwa `AIToolCallRecord`
   preferowana już dziś.

## Decyzje — ZATWIERDZONE (2026-07-01; D14-D19 dodane 2026-07-02)

Patrz `decisions[]` we frontmatter (D1–D19) — każda z `rationale` i
`propose_adr` gdzie dotyczy. `propose_adr: true` mają: D1 (reuse
`IValidator<T>`, po korekcie pakietu źródłowego) i D15 (`toCommand` zamiast
`static fromAI()`) — obie zmieniają kształt publicznego API i warto je
udokumentować jako ADR przed implementacją, niezależnie od terminu ekstrakcji
pakietu.

**Status: `approved`.** Odpowiedzi na wszystkie 7 otwartych pytań wypełnione
(2026-07-01), zweryfikowane i zrewidowane przez panel rundy 3 (2026-07-02, na
wyraźne polecenie właściciela biblioteki). Zatwierdzenie tej analizy **nie
uruchamia implementacji samo w sobie** — entry conditions z task file (walidacja
produkcyjna w juz-ide-api, ~2026-08/09) pozostają nienaruszone i nadal blokują
faktyczne cięcie v0.1. `/orchestrate-ddd VA-001` jest technicznie odblokowane
przez bramkę (status: approved), ale realnie powinno poczekać na spełnienie
entry conditions, zgodnie z jawną decyzją w tasku ("Core quality green first —
VA-001 does not jump the queue").
