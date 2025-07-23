# Query Handlers with Caching and Performance Optimization

**Version**: 1.0.0  
**Package**: @vytches-ddd/cqrs  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: query-handler, caching, performance-optimization, pagination  
**Dependencies**: @vytches-ddd/cqrs, @vytches-ddd/di, @vytches-ddd/utils

## Description

Demonstrates the CQRS query pattern with automatic handler registration, caching
strategies, and performance optimization. Shows how to create queries that
retrieve data efficiently with pagination, filtering, and caching support.

## Business Context

Data retrieval operations in applications often have different performance
requirements than write operations. Queries for user lists, search results, and
reports need optimization strategies like caching, pagination, and specialized
read models to provide fast, responsive user experiences.

## Code Example

````typescript
// user-queries.ts
import {
  BaseQuery,
  GetUserByIdQuery,
  GetUsersByRoleQuery,
  SearchUsersQuery,
} from '../types';

/**
 * @llm-summary Query for retrieving single user by ID
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Represents a request to retrieve a specific user by their unique identifier
 * with optional inclusion of profile and preference data.
 *
 * @example
 * ```typescript
 * const query = new GetUserByIdQuery('user-123', {
 *   includeProfile: true,
 *   includePreferences: false
 * });
 *
 * const result = await queryBus.execute(query);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class GetUserByIdQuery implements GetUserByIdQuery {
  public readonly queryId: string;
  public readonly timestamp: Date;

  constructor(
    public readonly userId: string,
    public readonly includeProfile: boolean = true,
    public readonly includePreferences: boolean = true,
    public readonly correlationId?: string
  ) {
    this.queryId = `get-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
  }

  /**
   * @llm-summary Generates cache key for query result caching
   * @llm-domain Performance Optimization
   * @llm-complexity Simple
   *
   * @description
   * Creates a unique cache key based on query parameters to enable
   * efficient result caching and cache invalidation.
   *
   * @returns String cache key for this query
   *
   * @since 1.0.0
   * @public
   */
  getCacheKey(): string {
    return `user:${this.userId}:profile-${this.includeProfile}:prefs-${this.includePreferences}`;
  }

  /**
   * @llm-summary Gets cache TTL in seconds for this query type
   * @llm-domain Performance Optimization
   * @llm-complexity Simple
   *
   * @description
   * Returns the time-to-live for cached results of this query type.
   * User data can be cached for moderate periods since it changes infrequently.
   *
   * @returns Cache TTL in seconds
   *
   * @since 1.0.0
   * @public
   */
  getCacheTTL(): number {
    return 300; // 5 minutes
  }
}

/**
 * @llm-summary Query for retrieving users by role with filtering
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Represents a request to retrieve users filtered by role and status
 * with pagination support for large result sets.
 *
 * @since 1.0.0
 * @public
 */
export class GetUsersByRoleQuery implements GetUsersByRoleQuery {
  public readonly queryId: string;
  public readonly timestamp: Date;
  public readonly pagination: PaginationOptions;

  constructor(
    public readonly role: 'admin' | 'user' | 'moderator',
    public readonly status?: 'active' | 'inactive' | 'suspended',
    public readonly includeInactive: boolean = false,
    pagination: Partial<PaginationOptions> = {},
    public readonly correlationId?: string
  ) {
    this.queryId = `get-users-by-role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.pagination = {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortDirection: 'desc',
      ...pagination,
    };
  }

  getCacheKey(): string {
    const statusPart = this.status || 'all';
    const inactivePart = this.includeInactive ? 'with-inactive' : 'active-only';
    const pagePart = `page-${this.pagination.page}-size-${this.pagination.pageSize}`;
    const sortPart = `sort-${this.pagination.sortBy}-${this.pagination.sortDirection}`;

    return `users-by-role:${this.role}:${statusPart}:${inactivePart}:${pagePart}:${sortPart}`;
  }

  getCacheTTL(): number {
    return 180; // 3 minutes - shorter TTL for lists that change more frequently
  }
}

/**
 * @llm-summary Query for searching users with advanced filtering
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Represents a request to search users with text search, filters,
 * and date ranges with pagination and sorting support.
 *
 * @since 1.0.0
 * @public
 */
export class SearchUsersQuery implements SearchUsersQuery {
  public readonly queryId: string;
  public readonly timestamp: Date;
  public readonly pagination: PaginationOptions;
  public readonly filters: Record<string, unknown>;

  constructor(
    public readonly searchTerm?: string,
    public readonly role?: 'admin' | 'user' | 'moderator',
    public readonly status?: 'active' | 'inactive' | 'suspended',
    public readonly createdAfter?: Date,
    public readonly createdBefore?: Date,
    pagination: Partial<PaginationOptions> = {},
    public readonly correlationId?: string
  ) {
    this.queryId = `search-users-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.pagination = {
      page: 1,
      pageSize: 20,
      sortBy: 'relevance',
      sortDirection: 'desc',
      ...pagination,
    };
    this.filters = {
      searchTerm: this.searchTerm,
      role: this.role,
      status: this.status,
      createdAfter: this.createdAfter,
      createdBefore: this.createdBefore,
    };
  }

  getCacheKey(): string {
    const searchPart = this.searchTerm
      ? `search-${encodeURIComponent(this.searchTerm)}`
      : 'no-search';
    const rolePart = this.role || 'all-roles';
    const statusPart = this.status || 'all-status';
    const datePart =
      this.createdAfter || this.createdBefore
        ? `dates-${this.createdAfter?.getTime() || 0}-${this.createdBefore?.getTime() || 0}`
        : 'no-dates';
    const pagePart = `page-${this.pagination.page}-size-${this.pagination.pageSize}`;

    return `search-users:${searchPart}:${rolePart}:${statusPart}:${datePart}:${pagePart}`;
  }

  getCacheTTL(): number {
    // Search results change frequently and are user-specific
    return 60; // 1 minute
  }

  /**
   * @llm-summary Checks if query has search criteria that would benefit from indexing
   * @llm-domain Performance Optimization
   * @llm-complexity Simple
   *
   * @description
   * Determines if the query has sufficient search criteria to use
   * database indexes effectively for performance optimization.
   *
   * @returns True if query should use indexed search, false for full scan
   *
   * @since 1.0.0
   * @public
   */
  shouldUseIndexedSearch(): boolean {
    return (
      !!(this.searchTerm && this.searchTerm.length >= 3) ||
      !!(this.role || this.status || this.createdAfter || this.createdBefore)
    );
  }
}
````

````typescript
// user-query-handlers.ts
import { QueryHandler } from '@vytches-ddd/cqrs';
import { Result } from '@vytches-ddd/utils';
import {
  GetUserByIdQuery,
  GetUsersByRoleQuery,
  SearchUsersQuery,
  User,
  UserListResult,
  QueryResult,
} from '../types';

/**
 * @llm-summary Query handler for retrieving users by ID with caching
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Handles GetUserById queries with intelligent caching, cache invalidation,
 * and performance optimization. Automatically registered through decorators.
 *
 * @example
 * ```typescript
 * @QueryHandler(GetUserByIdQuery)
 * class GetUserByIdQueryHandler {
 *   async handle(query: GetUserByIdQuery): Promise<QueryResult<User>>
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@QueryHandler(GetUserByIdQuery, {
  autoRegister: true,
  enableCaching: true,
  timeout: 5000,
  enableMetrics: true,
})
export class GetUserByIdQueryHandler {
  constructor(
    private readonly userRepository: UserReadRepository,
    private readonly cacheService: CacheService
  ) {}

  /**
   * @llm-summary Handles user retrieval with caching and performance optimization
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes GetUserById query with multi-level caching, efficient data loading,
   * and performance monitoring for optimal response times.
   *
   * @param query - GetUserById query with user ID and inclusion options
   * @returns Promise with query result containing user data or error
   *
   * @example
   * ```typescript
   * const query = new GetUserByIdQuery('user-123', true, false);
   * const result = await handler.handle(query);
   *
   * if (result.success) {
   *   console.log('User found:', result.data?.name);
   * }
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async handle(query: GetUserByIdQuery): Promise<QueryResult<User>> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Processing GetUserById query: ${query.queryId}`);

      // 1. Check cache first
      const cacheKey = query.getCacheKey();
      const cachedUser = await this.cacheService.get<User>(cacheKey);

      if (cachedUser) {
        console.log(`⚡ Cache hit for user ${query.userId}`);

        return {
          success: true,
          data: cachedUser,
          metadata: {
            queryId: query.queryId,
            cacheHit: true,
            executionTime: Date.now() - startTime,
          },
        };
      }

      console.log(`💾 Cache miss for user ${query.userId}, querying database`);

      // 2. Load user from repository
      const user = await this.userRepository.findById(query.userId, {
        includeProfile: query.includeProfile,
        includePreferences: query.includePreferences,
      });

      if (!user) {
        return {
          success: false,
          error: `User not found: ${query.userId}`,
          metadata: {
            queryId: query.queryId,
            cacheHit: false,
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 3. Cache the result
      await this.cacheService.set(cacheKey, user, query.getCacheTTL());

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ User retrieved successfully: ${user.id} (${executionTime}ms)`
      );

      return {
        success: true,
        data: user,
        metadata: {
          queryId: query.queryId,
          cacheHit: false,
          executionTime,
          correlationId: query.correlationId,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Failed to retrieve user:`, error);

      return {
        success: false,
        error: `User retrieval failed: ${error.message}`,
        metadata: {
          queryId: query.queryId,
          executionTime,
          errorType: error.constructor.name,
        },
      };
    }
  }
}

/**
 * @llm-summary Query handler for retrieving users by role with pagination
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Handles GetUsersByRole queries with efficient pagination, filtering,
 * and caching strategies for list operations.
 *
 * @since 1.0.0
 * @public
 */
@QueryHandler(GetUsersByRoleQuery, {
  autoRegister: true,
  enableCaching: true,
  timeout: 8000,
  enableMetrics: true,
})
export class GetUsersByRoleQueryHandler {
  constructor(
    private readonly userRepository: UserReadRepository,
    private readonly cacheService: CacheService
  ) {}

  /**
   * @llm-summary Handles user list retrieval with pagination and caching
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes GetUsersByRole query with optimized pagination, filtering,
   * and intelligent caching for list operations.
   *
   * @param query - GetUsersByRole query with role filter and pagination
   * @returns Promise with query result containing paginated user list
   *
   * @since 1.0.0
   * @public
   */
  async handle(
    query: GetUsersByRoleQuery
  ): Promise<QueryResult<UserListResult>> {
    const startTime = Date.now();

    try {
      console.log(`📋 Processing GetUsersByRole query: ${query.queryId}`);

      // 1. Check cache for list results
      const cacheKey = query.getCacheKey();
      const cachedResult =
        await this.cacheService.get<UserListResult>(cacheKey);

      if (cachedResult) {
        console.log(`⚡ Cache hit for user list by role ${query.role}`);

        return {
          success: true,
          data: cachedResult,
          totalCount: cachedResult.totalCount,
          pageInfo: cachedResult.pageInfo,
          metadata: {
            queryId: query.queryId,
            cacheHit: true,
            executionTime: Date.now() - startTime,
          },
        };
      }

      console.log(`💾 Cache miss for user list, querying database`);

      // 2. Build query filters
      const filters = this.buildFilters(query);

      // 3. Get total count for pagination
      const totalCount = await this.userRepository.countByRole(filters);

      // 4. Calculate pagination info
      const pageInfo = this.calculatePageInfo(query.pagination, totalCount);

      // 5. Load users with pagination
      const users = await this.userRepository.findByRole(filters, {
        page: query.pagination.page,
        pageSize: query.pagination.pageSize,
        sortBy: query.pagination.sortBy,
        sortDirection: query.pagination.sortDirection,
      });

      // 6. Build result
      const result: UserListResult = {
        users,
        totalCount,
        pageInfo,
      };

      // 7. Cache the result
      await this.cacheService.set(cacheKey, result, query.getCacheTTL());

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Users retrieved successfully: ${users.length} users (${executionTime}ms)`
      );

      return {
        success: true,
        data: result,
        totalCount,
        pageInfo,
        metadata: {
          queryId: query.queryId,
          cacheHit: false,
          executionTime,
          resultCount: users.length,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Failed to retrieve users by role:`, error);

      return {
        success: false,
        error: `User list retrieval failed: ${error.message}`,
        metadata: {
          queryId: query.queryId,
          executionTime,
          errorType: error.constructor.name,
        },
      };
    }
  }

  /**
   * @llm-summary Builds database query filters from query parameters
   * @llm-domain Data Access
   * @llm-complexity Simple
   *
   * @description
   * Constructs repository filter object from query parameters
   * for efficient database querying.
   *
   * @param query - GetUsersByRole query with filter criteria
   * @returns Repository filter object
   *
   * @since 1.0.0
   * @private
   */
  private buildFilters(query: GetUsersByRoleQuery): UserRoleFilters {
    return {
      role: query.role,
      status: query.status,
      includeInactive: query.includeInactive,
    };
  }

  /**
   * @llm-summary Calculates pagination information for result set
   * @llm-domain Pagination
   * @llm-complexity Simple
   *
   * @description
   * Computes pagination metadata including total pages, next/previous
   * page availability, and navigation information.
   *
   * @param pagination - Pagination options from query
   * @param totalCount - Total number of records available
   * @returns Complete pagination information
   *
   * @since 1.0.0
   * @private
   */
  private calculatePageInfo(
    pagination: PaginationOptions,
    totalCount: number
  ): PageInfo {
    const totalPages = Math.ceil(totalCount / pagination.pageSize);

    return {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    };
  }
}

/**
 * @llm-summary Query handler for user search with advanced filtering
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Handles SearchUsers queries with full-text search, advanced filtering,
 * and performance optimization for complex search operations.
 *
 * @since 1.0.0
 * @public
 */
@QueryHandler(SearchUsersQuery, {
  autoRegister: true,
  enableCaching: true,
  timeout: 12000,
  enableMetrics: true,
})
export class SearchUsersQueryHandler {
  constructor(
    private readonly userRepository: UserReadRepository,
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * @llm-summary Handles user search with full-text search and filtering
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes SearchUsers query with full-text search capabilities,
   * advanced filtering, and optimized result caching.
   *
   * @param query - SearchUsers query with search criteria and filters
   * @returns Promise with query result containing search results
   *
   * @since 1.0.0
   * @public
   */
  async handle(query: SearchUsersQuery): Promise<QueryResult<UserListResult>> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Processing SearchUsers query: ${query.queryId}`);

      // 1. Check cache for search results
      const cacheKey = query.getCacheKey();
      const cachedResult =
        await this.cacheService.get<UserListResult>(cacheKey);

      if (cachedResult) {
        console.log(`⚡ Cache hit for user search`);

        return {
          success: true,
          data: cachedResult,
          totalCount: cachedResult.totalCount,
          pageInfo: cachedResult.pageInfo,
          metadata: {
            queryId: query.queryId,
            cacheHit: true,
            executionTime: Date.now() - startTime,
          },
        };
      }

      console.log(`💾 Cache miss for search, executing search operation`);

      // 2. Determine search strategy
      let result: UserListResult;

      if (query.shouldUseIndexedSearch()) {
        // Use optimized indexed search for specific criteria
        result = await this.executeIndexedSearch(query);
      } else {
        // Use full-text search for general queries
        result = await this.executeFullTextSearch(query);
      }

      // 3. Cache the results
      await this.cacheService.set(cacheKey, result, query.getCacheTTL());

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Search completed: ${result.users.length} users found (${executionTime}ms)`
      );

      return {
        success: true,
        data: result,
        totalCount: result.totalCount,
        pageInfo: result.pageInfo,
        metadata: {
          queryId: query.queryId,
          cacheHit: false,
          executionTime,
          resultCount: result.users.length,
          searchStrategy: query.shouldUseIndexedSearch()
            ? 'indexed'
            : 'fulltext',
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Failed to search users:`, error);

      return {
        success: false,
        error: `User search failed: ${error.message}`,
        metadata: {
          queryId: query.queryId,
          executionTime,
          errorType: error.constructor.name,
        },
      };
    }
  }

  /**
   * @llm-summary Executes indexed search for specific filter criteria
   * @llm-domain Search Optimization
   * @llm-complexity Simple
   *
   * @description
   * Performs optimized database search using indexes when specific
   * filter criteria are provided for better performance.
   *
   * @param query - Search query with indexed filter criteria
   * @returns Promise with search results
   *
   * @since 1.0.0
   * @private
   */
  private async executeIndexedSearch(
    query: SearchUsersQuery
  ): Promise<UserListResult> {
    const searchFilters = {
      searchTerm: query.searchTerm,
      role: query.role,
      status: query.status,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
    };

    // Get total count
    const totalCount = await this.userRepository.countBySearch(searchFilters);

    // Calculate pagination
    const pageInfo = this.calculatePageInfo(query.pagination, totalCount);

    // Execute search
    const users = await this.userRepository.searchUsers(
      searchFilters,
      query.pagination
    );

    return {
      users,
      totalCount,
      pageInfo,
    };
  }

  /**
   * @llm-summary Executes full-text search for general search terms
   * @llm-domain Search Optimization
   * @llm-complexity Simple
   *
   * @description
   * Performs full-text search using specialized search service
   * for natural language queries and general search terms.
   *
   * @param query - Search query with full-text search term
   * @returns Promise with search results
   *
   * @since 1.0.0
   * @private
   */
  private async executeFullTextSearch(
    query: SearchUsersQuery
  ): Promise<UserListResult> {
    if (!query.searchTerm) {
      // No search term provided, return empty results
      return {
        users: [],
        totalCount: 0,
        pageInfo: {
          page: query.pagination.page,
          pageSize: query.pagination.pageSize,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    // Use search service for full-text capabilities
    const searchResult = await this.searchService.searchUsers(
      query.searchTerm,
      {
        role: query.role,
        status: query.status,
        createdAfter: query.createdAfter,
        createdBefore: query.createdBefore,
      },
      query.pagination
    );

    return searchResult;
  }

  private calculatePageInfo(
    pagination: PaginationOptions,
    totalCount: number
  ): PageInfo {
    const totalPages = Math.ceil(totalCount / pagination.pageSize);

    return {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    };
  }
}

// Service interfaces
interface UserReadRepository {
  findById(
    id: string,
    options?: { includeProfile?: boolean; includePreferences?: boolean }
  ): Promise<User | null>;
  findByRole(
    filters: UserRoleFilters,
    pagination: PaginationOptions
  ): Promise<User[]>;
  countByRole(filters: UserRoleFilters): Promise<number>;
  searchUsers(
    filters: UserSearchFilters,
    pagination: PaginationOptions
  ): Promise<User[]>;
  countBySearch(filters: UserSearchFilters): Promise<number>;
}

interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface SearchService {
  searchUsers(
    searchTerm: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<UserListResult>;
}

interface UserRoleFilters {
  role: string;
  status?: string;
  includeInactive: boolean;
}

interface UserSearchFilters {
  searchTerm?: string;
  role?: string;
  status?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}
````

````typescript
// query-bus-setup.ts
import { QueryBus } from '@vytches-ddd/cqrs';
import { VytchesDDD } from '@vytches-ddd/di';
import {
  GetUserByIdQueryHandler,
  GetUsersByRoleQueryHandler,
  SearchUsersQueryHandler,
} from '../types';

/**
 * @llm-summary Query bus setup with caching and performance optimization
 * @llm-domain System Configuration
 * @llm-complexity Simple
 *
 * @description
 * Demonstrates setup of query bus with automatic handler registration,
 * caching configuration, and performance monitoring.
 *
 * @example
 * ```typescript
 * const queryBus = await setupQueryBus();
 * const result = await queryBus.execute(new GetUserByIdQuery('user-123'));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class QueryBusSetup {
  private queryBus: QueryBus;

  constructor() {
    this.queryBus = new QueryBus({
      enableCaching: true,
      enableMetrics: true,
      defaultTimeout: 10000,
    });
  }

  /**
   * @llm-summary Initializes query bus with handlers and caching
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Sets up query bus with automatic handler registration,
   * caching service, and performance monitoring.
   *
   * @returns Promise that resolves when setup is complete
   *
   * @since 1.0.0
   * @public
   */
  async initialize(): Promise<void> {
    try {
      // Register query bus with DI container
      VytchesDDD.registerInstance('queryBus', this.queryBus);

      // Register services
      VytchesDDD.registerInstance(
        'userReadRepository',
        new InMemoryUserReadRepository()
      );
      VytchesDDD.registerInstance('cacheService', new InMemoryCacheService());
      VytchesDDD.registerInstance('searchService', new MockSearchService());

      // Register query handlers
      VytchesDDD.registerInstance(
        'getUserByIdQueryHandler',
        new GetUserByIdQueryHandler(
          VytchesDDD.resolve('userReadRepository'),
          VytchesDDD.resolve('cacheService')
        )
      );

      VytchesDDD.registerInstance(
        'getUsersByRoleQueryHandler',
        new GetUsersByRoleQueryHandler(
          VytchesDDD.resolve('userReadRepository'),
          VytchesDDD.resolve('cacheService')
        )
      );

      VytchesDDD.registerInstance(
        'searchUsersQueryHandler',
        new SearchUsersQueryHandler(
          VytchesDDD.resolve('userReadRepository'),
          VytchesDDD.resolve('searchService'),
          VytchesDDD.resolve('cacheService')
        )
      );

      // Configure auto-discovery
      await VytchesDDD.configure();

      console.log('✅ Query bus initialized with handlers:');
      console.log('  - GetUserByIdQueryHandler (caching enabled)');
      console.log('  - GetUsersByRoleQueryHandler (pagination + caching)');
      console.log('  - SearchUsersQueryHandler (full-text search + caching)');
    } catch (error) {
      console.error('❌ Failed to initialize query bus:', error);
      throw error;
    }
  }

  getQueryBus(): QueryBus {
    return this.queryBus;
  }
}

// Demonstration
async function demonstrateQueryHandling(): Promise<void> {
  console.log('🚀 Setting up query bus...');

  const setup = new QueryBusSetup();
  await setup.initialize();

  const queryBus = setup.getQueryBus();

  console.log('\n🔍 Single user query...');

  // Single user query
  const getUserQuery = new GetUserByIdQuery('user-123', true, true);
  const userResult = await queryBus.execute(getUserQuery);

  if (userResult.success) {
    console.log('✅ User found:', userResult.data?.name);
    console.log(`⚡ Execution time: ${userResult.metadata?.executionTime}ms`);
    console.log(`💾 Cache hit: ${userResult.metadata?.cacheHit}`);
  }

  console.log('\n📋 User list query...');

  // User list query with pagination
  const getUsersQuery = new GetUsersByRoleQuery('user', 'active', false, {
    page: 1,
    pageSize: 10,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  const usersResult = await queryBus.execute(getUsersQuery);

  if (usersResult.success && usersResult.data) {
    console.log(`✅ Found ${usersResult.data.users.length} users`);
    console.log(`📊 Total count: ${usersResult.totalCount}`);
    console.log(
      `📄 Page ${usersResult.pageInfo?.page} of ${usersResult.pageInfo?.totalPages}`
    );
  }

  console.log('\n🔍 Search query...');

  // Search query
  const searchQuery = new SearchUsersQuery(
    'john',
    'user',
    'active',
    undefined,
    undefined,
    { page: 1, pageSize: 5 }
  );

  const searchResult = await queryBus.execute(searchQuery);

  if (searchResult.success && searchResult.data) {
    console.log(`✅ Search found ${searchResult.data.users.length} users`);
    console.log(`🔍 Search strategy: ${searchResult.metadata?.searchStrategy}`);
  }
}
````

## Key Features

- **⚡ Intelligent Caching**: Multi-level caching with TTL and cache key
  optimization
- **📊 Pagination Support**: Efficient pagination with metadata and navigation
  info
- **🔍 Advanced Search**: Full-text search with indexed query optimization
- **📈 Performance Monitoring**: Built-in execution timing and cache hit metrics
- **🎯 Query Optimization**: Different strategies for different query patterns
- **🔄 Automatic Registration**: Query handlers discovered and registered
  automatically

## Query Design Patterns

1. **Self-Describing Queries**: Queries include caching and optimization
   metadata
2. **Immutable Query Objects**: Query properties are readonly after construction
3. **Flexible Inclusion**: Optional data inclusion for performance optimization
4. **Cache-Aware**: Queries provide their own cache keys and TTL values

## Performance Benefits

1. **Reduced Database Load**: Intelligent caching reduces repetitive database
   queries
2. **Optimized Pagination**: Efficient page calculation and navigation metadata
3. **Smart Search Strategy**: Indexed vs full-text search based on query
   characteristics
4. **Cache Locality**: Related queries share cache patterns for better hit rates

## Common Pitfalls

- **❌ Over-Caching**: Don't cache data that changes frequently or is
  user-specific
- **❌ Large Result Sets**: Always use pagination for potentially large data
  sets
- **❌ Complex Queries**: Keep query objects focused and avoid complex logic
- **❌ Cache Invalidation**: Plan cache invalidation strategy for data
  consistency

## Related Examples

- [Example 1: Command Handlers](./example-1.md) - Command handling for state
  changes
- [Example 3: Middleware Pipeline](./example-3.md) - Cross-cutting concerns with
  middleware
- [Intermediate: Event Integration](../intermediate/example-1.md) - Queries with
  event-driven updates
