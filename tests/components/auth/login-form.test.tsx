import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoginForm } from '@/app/login/loginForm';
import { useUser } from '@/hooks/use-user';
import { apiClient } from '@/lib/client';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useUser: vi.fn(),
}));

vi.mock('@/lib/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    systemTheme: 'light',
  }),
}));

const mockPush = vi.fn();
const mockReload = vi.fn();

describe('LoginForm Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });

    (useUser as any).mockReturnValue({
      reload: mockReload,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render login form with all required fields', () => {
      render(<LoginForm />);

      expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render email input with proper attributes', () => {
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
      expect(emailInput).toHaveAttribute('placeholder', 'Enter your email');
      expect(emailInput).toHaveProperty('autoFocus', true);
    });

    it('should render password input with proper attributes', () => {
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password');
    });

    it('should render submit button in disabled state initially', () => {
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should enable submit button when both fields are filled', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      expect(submitButton).not.toBeDisabled();
    });

    it('should keep submit button disabled with only email filled', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');

      expect(submitButton).toBeDisabled();
    });

    it('should keep submit button disabled with only password filled', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(passwordInput, 'password123');

      expect(submitButton).toBeDisabled();
    });

    it('should use browser email validation', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      
      await user.type(emailInput, 'invalid-email');
      
      // Browser validation should be triggered on form submit
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid credentials', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockResolvedValueOnce({
        data: { id: 'user-123', email: 'test@example.com' },
      });

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const mockPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      (apiClient.post as any).mockReturnValueOnce(mockPromise);

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show loading state
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeDisabled();
      expect(screen.getByLabelText('Password')).toBeDisabled();

      // Resolve the promise
      resolvePromise!({ data: { id: 'user-123' } });

      await waitFor(() => {
        expect(screen.queryByText('Signing in...')).not.toBeInTheDocument();
      });
    });

    it('should handle successful login', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockResolvedValueOnce({
        data: { id: 'user-123', email: 'test@example.com' },
      });

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Login successful');
        expect(mockReload).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/mine');
      });
    });

    it('should prevent double submission', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Button should be disabled during loading
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Signing in...')).toBeInTheDocument();

      // Additional clicks should not trigger more requests
      await user.click(submitButton);
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should display error message on login failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Invalid email or password';
      (apiClient.post as any).mockRejectedValueOnce(new Error(errorMessage));

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Form should be re-enabled after error
      expect(screen.getByLabelText('Email')).not.toBeDisabled();
      expect(screen.getByLabelText('Password')).not.toBeDisabled();
    });

    it('should handle API error with custom message', async () => {
      const user = userEvent.setup();
      const customError = { message: 'Account locked' };
      (apiClient.post as any).mockRejectedValueOnce(customError);

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Account locked')).toBeInTheDocument();
      });
    });

    it('should handle API error without custom message', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockRejectedValueOnce(new Error());

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      });
    });

    it('should clear error on new submission attempt', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockRejectedValueOnce(new Error('Login failed'));

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument();
      });

      // Clear the error and try again
      (apiClient.post as any).mockImplementation(() => new Promise(() => {}));

      await user.clear(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Password'), 'newpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
      });
    });
  });

  describe('User Experience', () => {
    it('should focus email input on mount', () => {
      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveFocus();
    });

    it('should allow keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      // Tab should move to password field
      await user.tab();
      expect(passwordInput).toHaveFocus();

      // Tab should move to submit button
      await user.tab();
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus();
    });

    it('should submit form on Enter key', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockResolvedValueOnce({
        data: { id: 'user-123' },
      });

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.keyboard('{Enter}');

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should display appropriate logo based on theme', () => {
      render(<LoginForm />);
      
      const logo = screen.getByAltText('Helper');
      expect(logo).toHaveAttribute('src', '/logo.svg'); // Light theme
    });
  });

  describe('Form State Management', () => {
    it('should maintain form state during loading', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockImplementation(() => new Promise(() => {}));

      render(<LoginForm />);

      const emailValue = 'test@example.com';
      const passwordValue = 'password123';

      await user.type(screen.getByLabelText('Email'), emailValue);
      await user.type(screen.getByLabelText('Password'), passwordValue);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Values should be preserved during loading
      expect(screen.getByDisplayValue(emailValue)).toBeInTheDocument();
      expect(screen.getByDisplayValue(passwordValue)).toBeInTheDocument();
    });

    it('should reset loading state after error', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockRejectedValueOnce(new Error('Login failed'));

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument();
      });

      // Should be back to normal state
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
      expect(screen.getByLabelText('Email')).not.toBeDisabled();
      expect(screen.getByLabelText('Password')).not.toBeDisabled();
    });
  });

  describe('Integration with Authentication Flow', () => {
    it('should integrate with useUser hook reload', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockResolvedValueOnce({
        data: { id: 'user-123' },
      });

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockReload).toHaveBeenCalled();
      });
    });

    it('should redirect to correct page after login', async () => {
      const user = userEvent.setup();
      (apiClient.post as any).mockResolvedValueOnce({
        data: { id: 'user-123' },
      });

      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/mine');
      });
    });
  });
});