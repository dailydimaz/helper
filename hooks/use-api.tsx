"use client";
import { useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
// Performance monitoring removed for client-side compatibility

// BasePath context to avoid circular dependency
const BasePathContext = createContext<string>("");

export const useBasePath = () => useContext(BasePathContext);

export const BasePathProvider = ({ children, basePath }: { children: React.ReactNode; basePath: string }) => (
  <BasePathContext.Provider value={basePath}>{children}</BasePathContext.Provider>
);

// Request deduplication cache
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();
const REQUEST_CACHE_TTL = 1000; // 1 second

type Options = RequestInit & { 
  noAbort?: boolean;
  cache?: boolean;
  dedupe?: boolean;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
};

export const useApi = () => {
  const basePath = useBasePath();
  const abortRef = useRef<Map<AbortController, boolean>>(new Map());
  // Performance monitoring removed for client-side compatibility

  // Generate cache key for request deduplication
  const generateCacheKey = useCallback((method: string, url: string, body?: any) => {
    const bodyHash = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyHash}`;
  }, []);

  // Deduplicate identical requests
  const deduplicateRequest = useCallback(async <T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    const cached = requestCache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < REQUEST_CACHE_TTL) {
      return cached.promise;
    }
    
    const promise = requestFn().finally(() => {
      setTimeout(() => {
        requestCache.delete(key);
      }, REQUEST_CACHE_TTL);
    });
    
    requestCache.set(key, { promise, timestamp: now });
    return promise;
  }, []);

  const handleOptions = useCallback((method: string, body?: any, opts?: Options) => {
    const extraHeaders = opts?.headers || {};
    const options: Options = {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...extraHeaders,
      },
      method,
      noAbort: opts?.noAbort,
      cache: opts?.cache ?? true,
      dedupe: opts?.dedupe ?? true,
      timeout: opts?.timeout ?? 10000, // 10 second default timeout
      retries: opts?.retries ?? 2,
      retryDelay: opts?.retryDelay ?? 1000,
    };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body) {
      (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    return options;
  }, []);

  const requestWithRetry = useCallback(async (
    url: string,
    options: Options,
    attempt: number = 0
  ): Promise<any> => {
    const startTime = Date.now();
    const fullUrl = `${basePath}/api${url}`;
    
    const ctrl = new AbortController();
    if (!options.noAbort) {
      abortRef.current.set(ctrl, true);
      options.signal = ctrl.signal;
    }

    // Add timeout handling
    const timeoutId = options.timeout ? setTimeout(() => {
      ctrl.abort();
    }, options.timeout) : null;

    try {
      const response = await fetch(fullUrl, options);
      const duration = Date.now() - startTime;
      
      // Performance tracking removed for client-side compatibility

      if (timeoutId) clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw { 
          ...data, 
          code: response.status,
          url,
          duration,
        };
      }

      return {
        ...data,
        _performance: {
          duration,
          cached: false,
          attempt: attempt + 1,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (timeoutId) clearTimeout(timeoutId);
      
      // Retry logic for network errors
      if (attempt < (options.retries || 0) && 
          !ctrl.signal.aborted &&
          (error.name === 'TypeError' || error.code >= 500)) {
        
        await new Promise(resolve => 
          setTimeout(resolve, options.retryDelay || 1000)
        );
        
        return requestWithRetry(url, options, attempt + 1);
      }

      // Performance tracking removed for client-side compatibility

      throw {
        ...error,
        duration,
        attempt: attempt + 1,
      };
    } finally {
      if (!options.noAbort) {
        abortRef.current.delete(ctrl);
      }
    }
  }, [basePath]);

  const request = useCallback(async (url: string, options: Options) => {
    // Request deduplication for GET requests
    if (options.method === 'GET' && options.dedupe) {
      const cacheKey = generateCacheKey(options.method || 'GET', url);
      return deduplicateRequest(cacheKey, () => requestWithRetry(url, options));
    }
    
    return requestWithRetry(url, options);
  }, [generateCacheKey, deduplicateRequest, requestWithRetry]);

  // Optimized API methods with memoization
  const apiMethods = useMemo(() => ({
    get: (url: string, opts?: Options) => 
      request(url, handleOptions("GET", null, opts)),
    
    post: (url: string, body?: any, opts?: Options) => 
      request(url, handleOptions("POST", body, opts)),
    
    put: (url: string, body?: any, opts?: Options) => 
      request(url, handleOptions("PUT", body, opts)),
    
    delete: (url: string, opts?: Options) => 
      request(url, handleOptions("DELETE", null, opts)),
    
    patch: (url: string, body?: any, opts?: Options) => 
      request(url, handleOptions("PATCH", body, opts)),

    // Batch requests utility
    batch: async (requests: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string;
      body?: any;
      options?: Options;
    }>) => {
      const batchResults = await Promise.allSettled(
        requests.map(({ method, url, body, options }) => {
          const methodFn = apiMethods[method.toLowerCase() as keyof typeof apiMethods] as any;
          return methodFn(url, body, options);
        })
      );
      
      return batchResults.map((result, index) => ({
        ...requests[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
      }));
    },

    // Clear request cache
    clearCache: () => {
      requestCache.clear();
    },

    // Get performance metrics
    getMetrics: () => ({ message: 'Performance metrics not available on client-side' }),
  }), [request, handleOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any pending requests
      for (const [ctrl] of abortRef.current) {
        ctrl.abort();
      }
      abortRef.current.clear();
    };
  }, []);

  return apiMethods;
};

/**
 * Hook for optimized API calls with caching
 */
export const useOptimizedApi = () => {
  const api = useApi();
  
  return {
    ...api,
    
    // Cached GET requests
    getCached: (url: string, cacheTTL: number = 300000, opts?: Options) => {
      return api.get(url, {
        ...opts,
        cache: true,
        dedupe: true,
      });
    },
    
    // Optimistic updates
    optimisticUpdate: async <T>(
      url: string,
      optimisticData: T,
      updateFn: () => Promise<any>
    ) => {
      // Return optimistic data immediately
      const optimisticPromise = Promise.resolve({
        data: optimisticData,
        _optimistic: true,
      });
      
      try {
        // Perform actual update in background
        const actualResult = await updateFn();
        return actualResult;
      } catch (error) {
        // If update fails, you might want to revert or handle error
        throw error;
      }
    },
  };
};

/**
 * Hook for real-time API calls with WebSocket fallback
 */
export const useRealTimeApi = () => {
  const api = useApi();
  const wsRef = useRef<WebSocket | null>(null);
  
  const connectWebSocket = useCallback((url: string, onMessage: (data: any) => void) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }
    
    const ws = new WebSocket(url);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
    return ws;
  }, []);
  
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);
  
  return {
    ...api,
    connectWebSocket,
    disconnectWebSocket,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};