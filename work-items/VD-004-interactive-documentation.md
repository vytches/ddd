# VD-004: Interactive Documentation System

**Priority**: 77/100  
**Category**: Documentation  
**Pillar**: Developer Experience  
**Estimated Time**: 20 hours  
**Dependencies**: VI-001  
**Status**: Ready for Implementation

## 📋 Context

Current documentation lacks interactivity and discovery features:

- Static markdown files difficult to navigate
- No search functionality across examples
- Missing live code playground
- No categorization system for examples
- Progressive disclosure not implemented
- Visual architecture diagrams missing
- No video tutorial integration
- Poor mobile experience

**Business Impact**: 80% faster documentation discovery and learning experience

## 🎯 Objectives

1. Design and implement interactive documentation architecture
2. Create powerful search functionality across all content
3. Build live code playground for examples
4. Add comprehensive example categorization system
5. Implement progressive disclosure in documentation
6. Create visual architecture diagrams
7. Integrate video tutorial system
8. Document contribution guidelines for community

## 📊 Current Documentation Challenges

```text
Current state:
- 200+ markdown files scattered across packages
- No central search or discovery
- Static examples without interaction
- Complex navigation paths
- No visual learning aids
- Limited onboarding flow

Target state:
- Interactive documentation portal
- Instant search across all content
- Live code playground
- Visual learning paths
- Mobile-friendly experience
- Video integration
```

## ✅ Implementation Tasks

### Phase 1: Documentation Architecture (4 hours)

#### Task 1.1: Interactive Documentation Framework

```typescript
// docs/interactive-docs/src/core/documentation-engine.ts
import { SearchEngine } from './search-engine';
import { PlaygroundEngine } from './playground-engine';
import { NavigationEngine } from './navigation-engine';

export interface DocumentationNode {
  id: string;
  title: string;
  type: 'category' | 'example' | 'guide' | 'api';
  content: string;
  metadata: {
    complexity: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
    framework?: string;
    package: string;
    lastUpdated: Date;
    estimatedReadTime: number;
  };
  children?: DocumentationNode[];
  playground?: PlaygroundConfig;
  relatedNodes?: string[];
}

export class InteractiveDocumentationEngine {
  private searchEngine: SearchEngine;
  private playground: PlaygroundEngine;
  private navigation: NavigationEngine;
  private documentationTree: DocumentationNode[];

  constructor() {
    this.searchEngine = new SearchEngine();
    this.playground = new PlaygroundEngine();
    this.navigation = new NavigationEngine();
    this.documentationTree = [];
  }

  async initialize(): Promise<void> {
    // Load all documentation
    this.documentationTree = await this.loadDocumentationTree();

    // Index for search
    await this.searchEngine.indexDocuments(this.documentationTree);

    // Initialize playground
    await this.playground.initialize();

    // Setup navigation
    this.navigation.buildNavigationTree(this.documentationTree);
  }

  async search(
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    return await this.searchEngine.search(query, filters);
  }

  getNode(nodeId: string): DocumentationNode | undefined {
    return this.findNodeById(this.documentationTree, nodeId);
  }

  getRelatedNodes(nodeId: string): DocumentationNode[] {
    const node = this.getNode(nodeId);
    if (!node?.relatedNodes) return [];

    return node.relatedNodes
      .map(id => this.getNode(id))
      .filter(Boolean) as DocumentationNode[];
  }

  getLearningPath(
    startNodeId: string,
    goalNodeId: string
  ): LearningPath | null {
    return this.navigation.findLearningPath(startNodeId, goalNodeId);
  }

  async executePlayground(
    code: string,
    context: PlaygroundContext
  ): Promise<PlaygroundResult> {
    return await this.playground.execute(code, context);
  }

  private async loadDocumentationTree(): Promise<DocumentationNode[]> {
    const mdFiles = await this.findAllMarkdownFiles();
    const nodes: DocumentationNode[] = [];

    for (const file of mdFiles) {
      const content = await fs.readFile(file, 'utf8');
      const node = await this.parseMarkdownToNode(file, content);
      nodes.push(node);
    }

    return this.buildHierarchy(nodes);
  }

  private async parseMarkdownToNode(
    filePath: string,
    content: string
  ): Promise<DocumentationNode> {
    const metadata = this.extractMetadata(content);
    const processedContent = await this.processMarkdown(content);

    return {
      id: this.generateNodeId(filePath),
      title: metadata.title || this.extractTitle(content),
      type: this.inferNodeType(filePath),
      content: processedContent,
      metadata: {
        complexity: metadata.complexity || 'intermediate',
        tags: metadata.tags || this.generateTags(content),
        package: this.extractPackage(filePath),
        lastUpdated: await this.getFileModificationDate(filePath),
        estimatedReadTime: this.calculateReadTime(content),
        framework: metadata.framework,
      },
      playground: metadata.playground
        ? this.createPlaygroundConfig(metadata.playground)
        : undefined,
      relatedNodes: metadata.relatedNodes || this.findRelatedNodes(content),
    };
  }
}
```

#### Task 1.2: Search Engine Implementation

```typescript
// docs/interactive-docs/src/core/search-engine.ts
import Fuse from 'fuse.js';
import lunr from 'lunr';

export interface SearchFilters {
  complexity?: string[];
  tags?: string[];
  packages?: string[];
  frameworks?: string[];
  types?: string[];
}

export interface SearchResult {
  node: DocumentationNode;
  score: number;
  matches: SearchMatch[];
  highlights: string[];
}

export class SearchEngine {
  private fuseIndex: Fuse<DocumentationNode>;
  private lunrIndex: lunr.Index;
  private documents: DocumentationNode[] = [];

  async indexDocuments(documents: DocumentationNode[]): Promise<void> {
    this.documents = documents;

    // Initialize Fuse.js for fuzzy search
    this.fuseIndex = new Fuse(documents, {
      keys: [
        { name: 'title', weight: 0.7 },
        { name: 'content', weight: 0.3 },
        { name: 'metadata.tags', weight: 0.5 },
        { name: 'metadata.package', weight: 0.4 },
      ],
      includeScore: true,
      includeMatches: true,
      threshold: 0.3,
      minMatchCharLength: 2,
    });

    // Initialize Lunr for full-text search
    this.lunrIndex = lunr(function () {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('content');
      this.field('tags', { boost: 5 });
      this.field('package', { boost: 3 });

      documents.forEach(doc => {
        this.add({
          id: doc.id,
          title: doc.title,
          content: doc.content.replace(/<[^>]*>/g, ''), // Strip HTML
          tags: doc.metadata.tags.join(' '),
          package: doc.metadata.package,
        });
      });
    });
  }

  async search(
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let results: SearchResult[] = [];

    // Combine fuzzy and exact search results
    const fuseResults = this.fuseIndex.search(query);
    const lunrResults = this.lunrIndex.search(query);

    // Process Fuse results
    const fuseSearchResults = fuseResults.map(result => ({
      node: result.item,
      score: 1 - (result.score || 0),
      matches: result.matches || [],
      highlights: this.generateHighlights(result.item.content, query),
    }));

    // Process Lunr results
    const lunrSearchResults = lunrResults
      .map(result => {
        const node = this.documents.find(d => d.id === result.ref);
        return node
          ? {
              node,
              score: result.score,
              matches: [],
              highlights: this.generateHighlights(node.content, query),
            }
          : null;
      })
      .filter(Boolean) as SearchResult[];

    // Merge and deduplicate results
    const mergedResults = this.mergeSearchResults(
      fuseSearchResults,
      lunrSearchResults
    );

    // Apply filters
    results = this.applyFilters(mergedResults, filters);

    // Sort by relevance and recency
    results.sort((a, b) => {
      const scoreWeight = 0.7;
      const recencyWeight = 0.3;

      const aScore =
        a.score * scoreWeight +
        this.calculateRecencyScore(a.node.metadata.lastUpdated) * recencyWeight;
      const bScore =
        b.score * scoreWeight +
        this.calculateRecencyScore(b.node.metadata.lastUpdated) * recencyWeight;

      return bScore - aScore;
    });

    return results.slice(0, 50); // Limit to top 50 results
  }

  private applyFilters(
    results: SearchResult[],
    filters?: SearchFilters
  ): SearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      const metadata = result.node.metadata;

      if (
        filters.complexity &&
        !filters.complexity.includes(metadata.complexity)
      ) {
        return false;
      }

      if (
        filters.tags &&
        !filters.tags.some(tag => metadata.tags.includes(tag))
      ) {
        return false;
      }

      if (filters.packages && !filters.packages.includes(metadata.package)) {
        return false;
      }

      if (
        filters.frameworks &&
        metadata.framework &&
        !filters.frameworks.includes(metadata.framework)
      ) {
        return false;
      }

      if (filters.types && !filters.types.includes(result.node.type)) {
        return false;
      }

      return true;
    });
  }

  getSuggestions(query: string): string[] {
    // Extract common terms and suggest completions
    const allTerms = this.documents.flatMap(doc => [
      ...doc.title.split(' '),
      ...doc.metadata.tags,
      doc.metadata.package,
    ]);

    const suggestions = allTerms
      .filter(term => term.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    return [...new Set(suggestions)];
  }
}
```

### Phase 2: Live Code Playground (6 hours)

#### Task 2.1: Code Playground Engine

```typescript
// docs/interactive-docs/src/playground/playground-engine.ts
import * as ts from 'typescript';
import { CodeJar } from 'codejar';
import { withLineNumbers } from 'codejar/linenumbers';

export interface PlaygroundConfig {
  initialCode: string;
  packages: string[];
  environment: 'node' | 'browser';
  enabledFeatures: string[];
}

export interface PlaygroundResult {
  success: boolean;
  output: string;
  errors: PlaygroundError[];
  executionTime: number;
  memoryUsage?: number;
}

export class PlaygroundEngine {
  private worker: Worker | null = null;
  private compilerOptions: ts.CompilerOptions;

  constructor() {
    this.compilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      lib: ['ES2020', 'DOM'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    };
  }

  async initialize(): Promise<void> {
    // Initialize Web Worker for code execution
    this.worker = new Worker('/playground-worker.js');

    // Load VytchesDDD library modules
    await this.loadLibraryModules();
  }

  createEditor(container: HTMLElement, config: PlaygroundConfig): CodeEditor {
    const jar = CodeJar(container, withLineNumbers(this.highlight.bind(this)));

    jar.updateCode(config.initialCode);

    return {
      getValue: () => jar.toString(),
      setValue: (code: string) => jar.updateCode(code),
      on: (event: string, handler: Function) => {
        if (event === 'change') {
          jar.onUpdate(handler);
        }
      },
      destroy: () => jar.destroy(),
    };
  }

  async execute(
    code: string,
    context: PlaygroundContext
  ): Promise<PlaygroundResult> {
    const startTime = performance.now();

    try {
      // Compile TypeScript to JavaScript
      const compiledCode = this.compileCode(code);

      if (compiledCode.errors.length > 0) {
        return {
          success: false,
          output: '',
          errors: compiledCode.errors,
          executionTime: performance.now() - startTime,
        };
      }

      // Execute in Web Worker
      const result = await this.executeInWorker(
        compiledCode.javascript,
        context
      );

      return {
        success: result.success,
        output: result.output,
        errors: result.errors,
        executionTime: performance.now() - startTime,
        memoryUsage: result.memoryUsage,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        errors: [
          {
            message: error.message,
            line: 0,
            column: 0,
            severity: 'error',
          },
        ],
        executionTime: performance.now() - startTime,
      };
    }
  }

  private compileCode(code: string): CompilationResult {
    const sourceFile = ts.createSourceFile(
      'playground.ts',
      code,
      ts.ScriptTarget.ES2020,
      true
    );

    const program = ts.createProgram(['playground.ts'], this.compilerOptions, {
      getSourceFile: fileName =>
        fileName === 'playground.ts' ? sourceFile : undefined,
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => '',
      getCanonicalFileName: fileName => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    });

    const emitResult = program.emit();
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    const errors = diagnostics.map(diagnostic => {
      const file = diagnostic.file;
      const { line, character } = file
        ? file.getLineAndCharacterOfPosition(diagnostic.start!)
        : { line: 0, character: 0 };

      return {
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        line: line + 1,
        column: character + 1,
        severity: 'error' as const,
      };
    });

    // Get compiled JavaScript
    let javascript = '';
    program.emit(undefined, (fileName, data) => {
      if (fileName.endsWith('.js')) {
        javascript = data;
      }
    });

    return { javascript, errors };
  }

  private async executeInWorker(
    code: string,
    context: PlaygroundContext
  ): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);

      const handler = (event: MessageEvent) => {
        if (event.data.id === messageId) {
          this.worker!.removeEventListener('message', handler);
          resolve(event.data.result);
        }
      };

      this.worker!.addEventListener('message', handler);

      this.worker!.postMessage({
        id: messageId,
        code,
        context,
        timeout: 5000, // 5 second timeout
      });

      // Timeout fallback
      setTimeout(() => {
        this.worker!.removeEventListener('message', handler);
        reject(new Error('Execution timeout'));
      }, 6000);
    });
  }

  private highlight(editor: HTMLElement): void {
    // Simple TypeScript syntax highlighting
    const code = editor.textContent || '';
    const highlighted = this.highlightTypeScript(code);
    editor.innerHTML = highlighted;
  }

  private highlightTypeScript(code: string): string {
    // Basic syntax highlighting patterns
    return code
      .replace(
        /\b(class|interface|function|const|let|var|import|export|from|async|await)\b/g,
        '<span class="keyword">$1</span>'
      )
      .replace(
        /\b(string|number|boolean|void|any|unknown)\b/g,
        '<span class="type">$1</span>'
      )
      .replace(/"[^"]*"/g, '<span class="string">$&</span>')
      .replace(/\/\/.*$/gm, '<span class="comment">$&</span>')
      .replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>');
  }

  async savePlayground(code: string, title: string): Promise<string> {
    // Generate shareable playground link
    const playgroundData = {
      code,
      title,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    const encoded = btoa(JSON.stringify(playgroundData));
    const shareId = await this.saveToStorage(encoded);

    return `${window.location.origin}/playground/${shareId}`;
  }

  async loadSharedPlayground(
    shareId: string
  ): Promise<PlaygroundConfig | null> {
    const encoded = await this.loadFromStorage(shareId);

    if (!encoded) return null;

    try {
      const data = JSON.parse(atob(encoded));
      return {
        initialCode: data.code,
        packages: ['@vytches/ddd-core'],
        environment: 'browser',
        enabledFeatures: ['console', 'debugger'],
      };
    } catch {
      return null;
    }
  }
}
```

#### Task 2.2: Playground Worker

```javascript
// docs/interactive-docs/public/playground-worker.js
// Web Worker for safe code execution
let console = {
  log: (...args) => {
    self.postMessage({
      type: 'console',
      level: 'log',
      args: args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ),
    });
  },
  error: (...args) => {
    self.postMessage({
      type: 'console',
      level: 'error',
      args: args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ),
    });
  },
  warn: (...args) => {
    self.postMessage({
      type: 'console',
      level: 'warn',
      args: args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ),
    });
  },
};

// Mock VytchesDDD modules for demonstration
const VytchesDDD = {
  AggregateRoot: class AggregateRoot {
    constructor(params) {
      this.id = params.id;
      this.version = params.version || 0;
      this.uncommittedEvents = [];
    }

    apply(eventType, payload) {
      this.uncommittedEvents.push({
        eventType,
        payload,
        version: this.version + 1,
      });
    }

    commit() {
      this.version += this.uncommittedEvents.length;
      this.uncommittedEvents = [];
    }
  },

  EntityId: {
    fromText: text => ({ value: text, type: 'text' }),
    createWithRandomUUID: () => ({
      value: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          var r = (Math.random() * 16) | 0;
          var v = c == 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      ),
      type: 'uuid',
    }),
  },

  Result: {
    ok: value => ({ isSuccess: () => true, value, error: null }),
    fail: error => ({ isSuccess: () => false, value: null, error }),
  },
};

self.onmessage = async function (event) {
  const { id, code, context, timeout } = event.data;

  let output = [];
  let errors = [];
  let success = true;

  // Redirect console to capture output
  const originalConsole = console;
  console = {
    log: (...args) => output.push(['log', ...args]),
    error: (...args) => output.push(['error', ...args]),
    warn: (...args) => output.push(['warn', ...args]),
    info: (...args) => output.push(['info', ...args]),
  };

  try {
    // Create execution context
    const executionContext = {
      ...VytchesDDD,
      console,
      setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 1000)), // Limit delay
      setInterval: () => {
        throw new Error('setInterval not allowed in playground');
      },
      fetch: () => {
        throw new Error('Network requests not allowed in playground');
      },
    };

    // Execute code with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Execution timeout')), timeout)
    );

    const executePromise = new Promise(resolve => {
      try {
        // Create function from code
        const fn = new Function(
          ...Object.keys(executionContext),
          `${code}\n//# sourceURL=playground.js`
        );

        // Execute with context
        const result = fn(...Object.values(executionContext));

        // Handle async results
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        errors.push({
          message: error.message,
          line: 0,
          column: 0,
          severity: 'error',
        });
        success = false;
        resolve(null);
      }
    });

    await Promise.race([executePromise, timeoutPromise]);
  } catch (error) {
    success = false;
    errors.push({
      message: error.message,
      line: 0,
      column: 0,
      severity: 'error',
    });
  } finally {
    // Restore console
    console = originalConsole;
  }

  // Send result back
  self.postMessage({
    id,
    result: {
      success,
      output: output.map(entry => entry.join(' ')).join('\n'),
      errors,
      memoryUsage: performance.memory
        ? performance.memory.usedJSHeapSize
        : undefined,
    },
  });
};
```

### Phase 3: Visual Components (4 hours)

#### Task 3.1: Interactive Documentation UI

```tsx
// docs/interactive-docs/src/components/DocumentationPage.tsx
import React, { useState, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { NavigationSidebar } from './NavigationSidebar';
import { ContentArea } from './ContentArea';
import { PlaygroundPanel } from './PlaygroundPanel';
import { InteractiveDocumentationEngine } from '../core/documentation-engine';

interface DocumentationPageProps {
  initialNodeId?: string;
}

export const DocumentationPage: React.FC<DocumentationPageProps> = ({
  initialNodeId,
}) => {
  const [docEngine, setDocEngine] = useState<InteractiveDocumentationEngine>();
  const [currentNode, setCurrentNode] = useState<DocumentationNode | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showPlayground, setShowPlayground] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeDocumentation();
  }, []);

  async function initializeDocumentation() {
    const engine = new InteractiveDocumentationEngine();
    await engine.initialize();
    setDocEngine(engine);

    if (initialNodeId) {
      const node = engine.getNode(initialNodeId);
      setCurrentNode(node || null);
    }

    setIsLoading(false);
  }

  const handleSearch = async (query: string, filters?: SearchFilters) => {
    if (!docEngine) return;

    const results = await docEngine.search(query, filters);
    setSearchResults(results);
  };

  const handleNodeSelect = (nodeId: string) => {
    if (!docEngine) return;

    const node = docEngine.getNode(nodeId);
    if (node) {
      setCurrentNode(node);
      setSearchResults([]);

      // Show playground if node has playground config
      setShowPlayground(!!node.playground);
    }
  };

  const handlePlaygroundToggle = () => {
    setShowPlayground(!showPlayground);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading documentation...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Navigation Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <NavigationSidebar
          docEngine={docEngine!}
          onNodeSelect={handleNodeSelect}
          currentNodeId={currentNode?.id}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Search Bar */}
        <div className="bg-white shadow-sm p-4">
          <SearchBar
            onSearch={handleSearch}
            docEngine={docEngine!}
            placeholder="Search examples, guides, and API docs..."
          />
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Documentation Content */}
          <div
            className={`${showPlayground ? 'w-1/2' : 'w-full'} overflow-auto`}
          >
            {searchResults.length > 0 ? (
              <SearchResults
                results={searchResults}
                onResultClick={handleNodeSelect}
              />
            ) : (
              <ContentArea
                node={currentNode}
                docEngine={docEngine!}
                onNodeSelect={handleNodeSelect}
                onPlaygroundToggle={handlePlaygroundToggle}
              />
            )}
          </div>

          {/* Playground Panel */}
          {showPlayground && currentNode?.playground && (
            <div className="w-1/2 border-l">
              <PlaygroundPanel
                config={currentNode.playground}
                docEngine={docEngine!}
                onClose={() => setShowPlayground(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

#### Task 3.2: Search Interface

```tsx
// docs/interactive-docs/src/components/SearchBar.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import {
  InteractiveDocumentationEngine,
  SearchFilters,
} from '../core/documentation-engine';

interface SearchBarProps {
  onSearch: (query: string, filters?: SearchFilters) => void;
  docEngine: InteractiveDocumentationEngine;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  docEngine,
  placeholder = 'Search...',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string, searchFilters?: SearchFilters) => {
      if (searchQuery.trim()) {
        onSearch(searchQuery, searchFilters);
      }
    }, 300),
    [onSearch]
  );

  // Debounced suggestions
  const debouncedSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length > 1) {
        const suggestions = docEngine.getSuggestions(searchQuery);
        setSuggestions(suggestions);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 150),
    [docEngine]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    debouncedSearch(value, filters);
    debouncedSuggestions(value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion, filters);
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (query.trim()) {
      debouncedSearch(query, newFilters);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center space-x-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-2 pl-10 pr-4 text-gray-700 bg-white border rounded-lg focus:outline-none focus:border-blue-500"
          />

          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Clear Button */}
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setShowSuggestions(false);
                onSearch('');
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <svg
                className="w-4 h-4 text-gray-400 hover:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg border ${
            showFilters
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Filters
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFiltersChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  );
};
```

### Phase 4: Progressive Disclosure (2 hours)

#### Task 4.1: Learning Path System

```typescript
// docs/interactive-docs/src/components/LearningPath.tsx
import React from 'react';
import { DocumentationNode, LearningPath as ILearningPath } from '../core/documentation-engine';

interface LearningPathProps {
  path: ILearningPath;
  currentNodeId: string;
  onNodeSelect: (nodeId: string) => void;
}

export const LearningPath: React.FC<LearningPathProps> = ({
  path,
  currentNodeId,
  onNodeSelect
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center mb-3">
        <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <h3 className="text-lg font-semibold text-blue-800">Learning Path</h3>
      </div>

      <div className="space-y-3">
        {path.steps.map((step, index) => {
          const isCompleted = path.completedSteps.includes(step.nodeId);
          const isCurrent = step.nodeId === currentNodeId;
          const isAvailable = index === 0 || path.completedSteps.includes(path.steps[index - 1].nodeId);

          return (
            <div key={step.nodeId} className="flex items-center">
              {/* Step Indicator */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                  ? 'bg-blue-500 text-white'
                  : isAvailable
                  ? 'bg-gray-300 text-gray-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1">
                <button
                  onClick={() => isAvailable ? onNodeSelect(step.nodeId) : null}
                  disabled={!isAvailable}
                  className={`text-left w-full ${
                    isAvailable
                      ? 'text-blue-600 hover:text-blue-800 cursor-pointer'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className="font-medium">{step.title}</div>
                  <div className="text-sm text-gray-600">{step.description}</div>
                  <div className="text-xs text-gray-500">
                    {step.estimatedTime} • {step.complexity}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Indicator */}
      <div className="mt-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Progress</span>
          <span>{path.completedSteps.length} of {path.steps.length} completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(path.completedSteps.length / path.steps.length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};
```

### Phase 5: Mobile Experience & Performance (2 hours)

#### Task 5.1: Responsive Design

```tsx
// docs/interactive-docs/src/components/MobileDocumentation.tsx
import React, { useState } from 'react';
import { DocumentationPage } from './DocumentationPage';

export const MobileDocumentation: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  return (
    <div className="h-screen bg-gray-50 md:hidden">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <h1 className="text-lg font-semibold">VytchesDDD Docs</h1>

        <button
          onClick={() => setPlaygroundOpen(!playgroundOpen)}
          className={`p-2 rounded-lg ${playgroundOpen ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative bg-white w-4/5 max-w-sm shadow-xl">
            {/* Sidebar content */}
          </div>
        </div>
      )}

      {/* Content Stack */}
      <div className="h-full flex flex-col">
        {playgroundOpen ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto">
              {/* Documentation content */}
            </div>
            <div className="h-1/2 border-t">{/* Playground */}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">{/* Full documentation */}</div>
        )}
      </div>
    </div>
  );
};
```

### Phase 6: Integration & Deployment (2 hours)

#### Task 6.1: Static Site Generation

```javascript
// docs/interactive-docs/scripts/build-docs.js
const fs = require('fs-extra');
const path = require('path');
const {
  InteractiveDocumentationEngine,
} = require('../dist/core/documentation-engine');

class StaticDocumentationBuilder {
  constructor() {
    this.outputDir = 'dist/static';
    this.docEngine = new InteractiveDocumentationEngine();
  }

  async build() {
    console.log('🔨 Building static documentation...');

    // Initialize documentation engine
    await this.docEngine.initialize();

    // Clean output directory
    await fs.emptyDir(this.outputDir);

    // Generate static pages
    await this.generateStaticPages();

    // Generate search index
    await this.generateSearchIndex();

    // Copy assets
    await this.copyAssets();

    console.log('✅ Documentation build complete!');
  }

  async generateStaticPages() {
    const allNodes = this.docEngine.getAllNodes();

    for (const node of allNodes) {
      const html = await this.renderNodeToHTML(node);
      const outputPath = path.join(this.outputDir, `${node.id}.html`);

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, html);
    }

    // Generate index page
    const indexHTML = await this.renderIndexPage();
    await fs.writeFile(path.join(this.outputDir, 'index.html'), indexHTML);
  }

  async renderNodeToHTML(node) {
    const template = await fs.readFile('templates/node.html', 'utf8');
    const relatedNodes = this.docEngine.getRelatedNodes(node.id);

    return template
      .replace('{{title}}', node.title)
      .replace('{{content}}', this.renderMarkdown(node.content))
      .replace('{{metadata}}', JSON.stringify(node.metadata))
      .replace('{{relatedNodes}}', this.renderRelatedNodes(relatedNodes))
      .replace(
        '{{playground}}',
        node.playground ? this.renderPlayground(node.playground) : ''
      );
  }

  async generateSearchIndex() {
    const searchIndex = await this.docEngine.buildSearchIndex();

    await fs.writeFile(
      path.join(this.outputDir, 'search-index.json'),
      JSON.stringify(searchIndex)
    );
  }

  async copyAssets() {
    // Copy CSS, JS, images
    await fs.copy('src/assets', path.join(this.outputDir, 'assets'));

    // Copy playground worker
    await fs.copy(
      'public/playground-worker.js',
      path.join(this.outputDir, 'playground-worker.js')
    );
  }
}

// Build command
if (require.main === module) {
  const builder = new StaticDocumentationBuilder();
  builder.build().catch(console.error);
}
```

## 📈 Success Metrics

### User Experience Metrics

- [ ] <3 second average page load time
- [ ] <500ms search response time
- [ ] 95% mobile compatibility score
- [ ] 80% improvement in documentation discovery time
- [ ] <15 second time to first interaction

### Content Metrics

- [ ] 100% documentation coverage with interactive elements
- [ ] 500+ searchable examples and guides
- [ ] 20+ video tutorials integrated
- [ ] 50+ playground examples
- [ ] Progressive learning paths for all skill levels

### Technical Metrics

- [ ] 90+ Lighthouse performance score
- [ ] Full offline functionality
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Accessibility compliance (WCAG 2.1 AA)

## 🔧 Technical Implementation Details

### Architecture Decisions

1. **Static Generation**: Pre-built HTML for performance
2. **Progressive Enhancement**: Works without JavaScript
3. **Service Worker**: Offline functionality
4. **IndexedDB**: Client-side search caching
5. **Web Workers**: Safe code execution

### Performance Optimizations

1. **Code Splitting**: Lazy load playground components
2. **Image Optimization**: WebP with fallbacks
3. **Search Indexing**: Pre-built search indices
4. **CDN Deployment**: Global content delivery
5. **Caching Strategy**: Aggressive caching with cache busting

## 🚨 Risk Mitigation

### Technical Risks

- **Browser compatibility**: Comprehensive testing matrix
- **Performance**: Continuous monitoring and optimization
- **Security**: Sandboxed code execution
- **Accessibility**: Automated testing and manual audits

### Content Risks

- **Outdated examples**: Automated synchronization with source
- **Quality control**: Review process for community contributions
- **Search accuracy**: Regular index optimization

## 📚 References

- [React Documentation](https://reactjs.org/docs)
- [Fuse.js Documentation](https://fusejs.io/)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## ✅ Definition of Done

- [ ] Interactive documentation portal deployed
- [ ] Search functionality operational
- [ ] Live playground working
- [ ] Mobile experience optimized
- [ ] Video tutorials integrated
- [ ] Progressive learning paths complete
- [ ] Performance targets met
- [ ] Accessibility compliance achieved
