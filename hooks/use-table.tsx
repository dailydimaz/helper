"use client";
import { useSearchParams } from "next/navigation";
import { useMemo, useCallback, useRef, useEffect } from "react";
import useSWR, { SWRConfiguration } from "swr";
import { PerformanceMonitor } from "@/lib/database/optimizations";

// Performance tracking for table operations
const performanceMonitor = PerformanceMonitor.getInstance();

interface UseTableOptions {
  pathname: string;
  perPage?: number;
  refreshInterval?: number;
  dedupingInterval?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  cache?: boolean;
  optimisticUpdates?: boolean;
}

export function useTable({
  pathname,
  perPage = 10,
  refreshInterval = 0,
  dedupingInterval = 2000,
  revalidateOnFocus = true,
  revalidateOnReconnect = true,
  cache = true,
  optimisticUpdates = false,
}: UseTableOptions) {
  const query = useSearchParams();
  const startTimeRef = useRef<number>();
  
  // Optimized URL construction with memoization
  const dataURL = useMemo(() => {
    const p = new URL("https://example.com" + pathname);
    p.searchParams.set("perPage", perPage.toString());
    p.searchParams.set("page", query.get("page") || "1");
    if (query.get("q")) p.searchParams.set("q", query.get("q") as string);
    return p.pathname + p.search;
  }, [pathname, perPage, query]);

  const paginateURL = useMemo(() => {
    const p = new URL("https://example.com" + pathname);
    if (query.get("q")) p.searchParams.set("q", query.get("q") as string);
    p.searchParams.set("countOnly", "true");
    return p.pathname + p.search;
  }, [pathname, query]);

  // Performance tracking for data fetching
  const trackDataFetch = useCallback((url: string, isStart: boolean = true) => {
    if (isStart) {
      startTimeRef.current = Date.now();
    } else if (startTimeRef.current) {
      const duration = Date.now() - startTimeRef.current;
      performanceMonitor.recordSlowQuery(`Table Data: ${url}`, duration);
    }
  }, []);

  // Enhanced SWR configuration
  const swrConfig: SWRConfiguration = {
    refreshInterval,
    dedupingInterval,
    revalidateOnFocus,
    revalidateOnReconnect,
    revalidateIfStale: cache,
    errorRetryCount: 3,
    errorRetryInterval: 1000,
    onSuccess: () => trackDataFetch(dataURL, false),
    onError: (error) => {
      console.error('Table data fetch error:', error);
      trackDataFetch(dataURL, false);
    },
    onLoadingSlow: () => {
      console.warn('Table data loading is slow:', dataURL);
    },
  };

  const dataSwr = useSWR(dataURL, {
    ...swrConfig,
    onLoadingSlow: (key) => {
      performanceMonitor.recordSlowQuery(`Slow Table Load: ${key}`, 5000);
    },
  });

  const paginateSwr = useSWR(paginateURL, {
    ...swrConfig,
    refreshInterval: 0, // Don't auto-refresh count queries
  });

  // Track when data loading starts
  useEffect(() => {
    if (dataSwr.isLoading) {
      trackDataFetch(dataURL, true);
    }
  }, [dataSwr.isLoading, dataURL, trackDataFetch]);

  // Optimistic updates for better UX
  const optimisticMutate = useCallback(async (
    optimisticData?: any,
    revalidate: boolean = true
  ) => {
    const promises = [];
    
    if (optimisticUpdates && optimisticData) {
      promises.push(dataSwr.mutate(optimisticData, revalidate));
    } else {
      promises.push(dataSwr.mutate());
    }
    
    promises.push(paginateSwr.mutate());
    
    return Promise.all(promises);
  }, [dataSwr, paginateSwr, optimisticUpdates]);

  // Enhanced error handling
  const error = dataSwr.error || paginateSwr.error;
  const hasError = !!error;
  
  // Loading state optimization
  const isInitialLoading = dataSwr.isLoading && !dataSwr.data;
  const isRefreshing = dataSwr.isLoading && !!dataSwr.data;

  return {
    // Data
    data: dataSwr?.data?.data || [],
    total: paginateSwr?.data?.total || -1,
    perPage,
    
    // Loading states
    isLoading: isInitialLoading,
    isRefreshing,
    totalLoading: paginateSwr.isLoading,
    
    // Error handling
    error,
    hasError,
    
    // Actions
    mutate: optimisticMutate,
    refresh: useCallback(() => optimisticMutate(undefined, true), [optimisticMutate]),
    
    // Performance metrics
    performance: {
      dataUrl: dataURL,
      paginateUrl: paginateURL,
      cacheHit: !!dataSwr.data && !dataSwr.isLoading,
    },
  };
}

/**
 * Hook for optimized single item fetching with caching
 */
export function useItem<T = any>(
  pathname: string | null,
  options: {
    refreshInterval?: number;
    cache?: boolean;
    revalidateOnFocus?: boolean;
  } = {}
) {
  const {
    refreshInterval = 0,
    cache = true,
    revalidateOnFocus = false,
  } = options;
  
  const startTimeRef = useRef<number>();
  
  const trackFetch = useCallback((url: string, isStart: boolean = true) => {
    if (isStart) {
      startTimeRef.current = Date.now();
    } else if (startTimeRef.current) {
      const duration = Date.now() - startTimeRef.current;
      performanceMonitor.recordSlowQuery(`Item Fetch: ${url}`, duration);
    }
  }, []);
  
  const swrConfig: SWRConfiguration = {
    refreshInterval,
    revalidateIfStale: cache,
    revalidateOnFocus,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // Longer deduping for single items
    errorRetryCount: 2,
    onSuccess: () => pathname && trackFetch(pathname, false),
    onError: (error) => {
      console.error('Item fetch error:', error);
      if (pathname) trackFetch(pathname, false);
    },
  };
  
  const swr = useSWR<{ data: T }>(pathname, swrConfig);
  
  useEffect(() => {
    if (swr.isLoading && pathname) {
      trackFetch(pathname, true);
    }
  }, [swr.isLoading, pathname, trackFetch]);
  
  return {
    data: swr.data?.data,
    isLoading: swr.isLoading && !swr.data,
    isRefreshing: swr.isLoading && !!swr.data,
    error: swr.error,
    mutate: swr.mutate,
    performance: {
      url: pathname,
      cacheHit: !!swr.data && !swr.isLoading,
    },
  };
}

/**
 * Hook for real-time data with optimized polling intervals
 */
export function useRealTimeTable(options: UseTableOptions & {
  pollingInterval?: number;
  backgroundPolling?: boolean;
}) {
  const { pollingInterval = 30000, backgroundPolling = true, ...tableOptions } = options;
  
  const table = useTable({
    ...tableOptions,
    refreshInterval: pollingInterval,
    revalidateOnFocus: backgroundPolling,
    revalidateOnReconnect: true,
  });
  
  // Optimize polling based on user activity
  useEffect(() => {
    let activePolling = pollingInterval;
    let inactivityTimer: NodeJS.Timeout;
    
    const handleActivity = () => {
      clearTimeout(inactivityTimer);
      
      // Reduce polling frequency after 5 minutes of inactivity
      inactivityTimer = setTimeout(() => {
        activePolling = pollingInterval * 2; // Double the interval
      }, 5 * 60 * 1000);
    };
    
    if (backgroundPolling) {
      document.addEventListener('mousedown', handleActivity);
      document.addEventListener('keydown', handleActivity);
      document.addEventListener('scroll', handleActivity);
      
      return () => {
        document.removeEventListener('mousedown', handleActivity);
        document.removeEventListener('keydown', handleActivity);
        document.removeEventListener('scroll', handleActivity);
        clearTimeout(inactivityTimer);
      };
    }
  }, [pollingInterval, backgroundPolling]);
  
  return table;
}

/**
 * Performance monitoring hook for table operations
 */
export function useTablePerformance() {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    getMetrics: () => monitor.getPerformanceReport(),
    getSlowQueries: () => monitor.getSlowQueries(),
    clearMetrics: () => monitor.getSlowQueries().length = 0,
  };
}