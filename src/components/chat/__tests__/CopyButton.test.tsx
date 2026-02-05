import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with "Copy" text initially', () => {
    render(<CopyButton text="Hello world" />);

    expect(screen.getByRole('button')).toHaveTextContent('Copy');
    expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
  });

  it('copies text to clipboard when clicked', async () => {
    const testText = 'Test content to copy';
    render(<CopyButton text={testText} />);

    const button = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testText);
  });

  it('shows "Copied" text after clicking', async () => {
    render(<CopyButton text="Hello world" />);

    const button = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('reverts to "Copy" text after 2 seconds', async () => {
    vi.useFakeTimers();

    render(<CopyButton text="Hello world" />);

    const button = screen.getByRole('button');

    // Click the button
    await act(async () => {
      fireEvent.click(button);
    });

    // Verify "Copied" is shown
    expect(screen.getByText('Copied')).toBeInTheDocument();

    // Advance timers by 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should now show "Copy" again
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<CopyButton text="Hello world" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Copy to clipboard');
    expect(button).toHaveAttribute('title', 'Copy to clipboard');
  });
});
