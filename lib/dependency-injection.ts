interface ServiceContainer {
  apiClient: any;
  adminStore: any;
  cacheManager: any;
  logger: any;
}

class DependencyContainer {
  private services: Map<string, any> = new Map();
  private factories: Map<string, () => any> = new Map();
  private singletons: Set<string> = new Set();

  register<T>(name: string, factory: () => T, singleton: boolean = true): void {
    this.factories.set(name, factory);
    if (singleton) {
      this.singletons.add(name);
    }
  }

  get<T>(name: string): T {
    if (this.singletons.has(name) && this.services.has(name)) {
      return this.services.get(name);
    }

    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not registered`);
    }

    const instance = factory();

    if (this.singletons.has(name)) {
      this.services.set(name, instance);
    }

    return instance;
  }

  clear(): void {
    this.services.clear();
  }
}

export const container = new DependencyContainer();

// Регистрация сервисов
container.register('apiClient', () => {
  class ApiClient {
    private baseUrl = "/api";
    private pendingRequests = new Map<string, Promise<any>>();

    async request(endpoint: string, options: RequestInit = {}): Promise<any> {
      const requestKey = `${endpoint}-${JSON.stringify(options)}`;

      if (this.pendingRequests.has(requestKey)) {
        return this.pendingRequests.get(requestKey);
      }

      const promise = this.executeRequest(endpoint, options);
      this.pendingRequests.set(requestKey, promise);

      promise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });

      return promise;
    }

    private async executeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
      try {

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`API Error: ${response.status} ${response.statusText}`, data);
          throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
        }

        return data;
      } catch (error) {
        const logger = container.get<any>('logger');
        logger.error('API request failed:', { endpoint, error });
        throw error;
      }
    }

    async getModelLines() {
      return this.request('/model-lines');
    }

    async createModelLine(data: any) {
      return this.request('/model-lines', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    async updateModelLine(id: string, data: any) {
      return this.request(`/model-lines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }

    async deleteModelLine(id: string) {
      return this.request(`/model-lines/${id}`, {
        method: 'DELETE',
      });
    }

    async getManufacturers() {
      return this.request('/manufacturers');
    }

    async createManufacturer(data: any) {
      return this.request('/manufacturers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    async updateManufacturer(id: string, data: any) {
      return this.request(`/manufacturers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }

    async deleteManufacturer(id: string) {
      return this.request(`/manufacturers/${id}`, {
        method: 'DELETE',
      });
    }

    async getProducts() {
      return this.request('/products');
    }

    async createProduct(data: any) {
      return this.request('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    async updateProduct(id: string, data: any) {
      return this.request(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }

    async deleteProduct(id: string) {
      return this.request(`/products/${id}`, {
        method: 'DELETE',
      });
    }

    async getCategories() {
      return this.request('/categories');
    }
  }

  return new ApiClient();
});

container.register('logger', () => ({
  error: (message: string, context?: any) => {
    console.error(`[ERROR] ${message}`, context);
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] ${message}`, context);
  },
  info: (message: string, context?: any) => {
    console.info(`[INFO] ${message}`, context);
  },
}));

container.register('cacheManager', () => {
  class CacheManager {
    private cache = new Map<string, { data: any; expires: number }>();

    get<T>(key: string): T | null {
      const cached = this.cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
      if (cached) {
        this.cache.delete(key);
      }
      return null;
    }

    set(key: string, data: any, ttl: number = 300000): void {
      this.cache.set(key, {
        data,
        expires: Date.now() + ttl
      });
    }

    delete(key: string): void {
      this.cache.delete(key);
    }

    clear(): void {
      this.cache.clear();
    }

    clearAll(): void {
      this.clear();
    }

    getStats() {
      return {
        size: this.cache.size,
        entries: Array.from(this.cache.keys())
      };
    }
  }

  return new CacheManager();
});

export const getApiClient = () => container.get<any>('apiClient');
export const getLogger = () => container.get<any>('logger');
export const getCacheManager = () => container.get<any>('cacheManager');