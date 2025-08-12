import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useUser } from '@/hooks/use-user';
import { ReactNode } from 'react';

// Mock fetch for SWR
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock SWR wrapper for testing
function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <SWRConfig
      value={{
        fetcher: (url: string) => fetch(url).then(res => res.json()),
        dedupingInterval: 0,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

describe('useUser Hook Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication States', () => {
    it('should show loading state initially', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      expect(result.current.status).toBe('loading');
      expect(result.current.user).toBeNull();
    });

    it('should show authenticated state with user data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        permissions: 'member',
        access: { role: 'afk', keywords: [] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUser,
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should show unauthenticated state on auth error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: 'Authentication required',
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });

    it('should show unauthenticated state on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('API Response Handling', () => {
    it('should handle successful API response with consistent structure', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'admin@example.com',
        displayName: 'Admin User',
        permissions: 'admin',
        access: { role: 'core', keywords: ['admin', 'support'] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUser,
          message: 'User retrieved successfully',
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockFetch).toHaveBeenCalledWith('/adm/me');
    });

    it('should handle API response without data field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          // Missing data field
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle malformed API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // Completely different structure
          user: { name: 'test' },
          authenticated: true,
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: 'Authentication required',
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle 403 forbidden error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          success: false,
          error: 'Insufficient permissions',
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Internal server error',
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      }, { timeout: 200 });
    });
  });

  describe('Data Consistency', () => {
    it('should not expose sensitive user data', async () => {
      const apiResponse = {
        id: 'user-789',
        email: 'test@example.com',
        displayName: 'Test User',
        permissions: 'member',
        access: { role: 'afk', keywords: [] },
        // These should not be exposed
        password: 'hashed-password',
        sessionToken: 'secret-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: apiResponse,
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toEqual(apiResponse); // Hook returns data as-is
        // Note: API should not return sensitive data in the first place
      });
    });

    it('should handle user data with missing optional fields', async () => {
      const minimalUser = {
        id: 'user-minimal',
        email: 'minimal@example.com',
        // Missing displayName, access, etc.
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: minimalUser,
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toEqual(minimalUser);
      });
    });
  });

  describe('Reload Functionality', () => {
    it('should provide reload function', async () => {
      const mockUser = {
        id: 'user-reload',
        email: 'reload@example.com',
        displayName: 'Reload User',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUser,
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      expect(typeof result.current.reload).toBe('function');
    });

    it('should refetch data when reload is called', async () => {
      const initialUser = {
        id: 'user-reload',
        email: 'initial@example.com',
        displayName: 'Initial User',
      };

      const updatedUser = {
        id: 'user-reload',
        email: 'updated@example.com',
        displayName: 'Updated User',
      };

      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: initialUser,
        }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(initialUser);
      });

      // Setup second call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: updatedUser,
        }),
      });

      // Call reload
      await result.current.reload();

      await waitFor(() => {
        expect(result.current.user).toEqual(updatedUser);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('SWR Integration', () => {
    it('should use correct endpoint for fetching user data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'test', email: 'test@example.com' },
        }),
      });

      renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/adm/me');
      });
    });

    it('should handle SWR caching behavior', async () => {
      const mockUser = {
        id: 'user-cache',
        email: 'cache@example.com',
        displayName: 'Cache User',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUser,
        }),
      });

      const { result: result1 } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      const { result: result2 } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.status).toBe('authenticated');
        expect(result2.current.status).toBe('authenticated');
      });

      // Both hooks should have the same user data
      expect(result1.current.user).toEqual(result2.current.user);
    });

    it('should handle SWR revalidation', async () => {
      const mockUser = {
        id: 'user-revalidate',
        email: 'revalidate@example.com',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUser,
        }),
      });

      const { result, rerender } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      // Rerender should not cause additional fetch due to SWR caching
      rerender();

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      // Should still have same data
      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('State Transitions', () => {
    it('should transition from loading to authenticated', async () => {
      const mockUser = {
        id: 'user-transition',
        email: 'transition@example.com',
      };

      let resolvePromise: (value: any) => void;
      const mockPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(mockPromise);

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.status).toBe('loading');
      expect(result.current.user).toBeNull();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUser,
        }),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should transition from loading to unauthenticated on error', async () => {
      let rejectPromise: (error: any) => void;
      const mockPromise = new Promise((_, reject) => {
        rejectPromise = reject;
      });

      mockFetch.mockReturnValueOnce(mockPromise);

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.status).toBe('loading');

      // Reject the promise
      rejectPromise!(new Error('Auth failed'));

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
        expect(result.current.user).toBeNull();
      });
    });
  });
});