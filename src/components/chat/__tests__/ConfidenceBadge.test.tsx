import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfidenceBadge } from '../ConfidenceBadge';
import type { EvaluationResult } from '@/types/chat';

describe('ConfidenceBadge', () => {
  const mockEvaluation: EvaluationResult = {
    scores: {
      factual_accuracy: 5,
      context_inclusion: 5,
      limitation_acknowledgment: 5,
      responsible_framing: 5,
      query_relevance: 5,
    },
    weighted_score: 92,
    flags: [],
    summary: 'Excellent response with comprehensive context and responsible framing.',
  };

  const mockEvaluationWithFlags: EvaluationResult = {
    scores: {
      factual_accuracy: 3,
      context_inclusion: 4,
      limitation_acknowledgment: 3,
      responsible_framing: 4,
      query_relevance: 4,
    },
    weighted_score: 68,
    flags: [
      'Minor factual inconsistency noted',
      'Could include more context about ENI',
    ],
    summary: 'Good response but some context missing and minor issues flagged.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders confidence badge with score', () => {
    render(<ConfidenceBadge evaluation={mockEvaluation} />);

    expect(screen.getByText('High confidence')).toBeInTheDocument();
    expect(screen.getByText('(92/100)')).toBeInTheDocument();
  });

  it('expands to show details when clicked', async () => {
    render(<ConfidenceBadge evaluation={mockEvaluation} />);

    // Initially collapsed - summary not visible
    expect(screen.queryByText(mockEvaluation.summary)).not.toBeInTheDocument();

    // Click to expand
    const badge = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(badge);
    });

    // Now summary should be visible
    expect(screen.getByText(mockEvaluation.summary)).toBeInTheDocument();
  });

  it('shows dimension scores when expanded', async () => {
    render(<ConfidenceBadge evaluation={mockEvaluation} />);

    const badge = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(badge);
    });

    expect(screen.getByText(/Factual Accuracy/)).toBeInTheDocument();
    expect(screen.getByText(/Context Inclusion/)).toBeInTheDocument();
    expect(screen.getByText(/Limitation Acknowledgment/)).toBeInTheDocument();
    expect(screen.getByText(/Responsible Framing/)).toBeInTheDocument();
    expect(screen.getByText(/Query Relevance/)).toBeInTheDocument();
  });

  it('shows flags when present', async () => {
    render(<ConfidenceBadge evaluation={mockEvaluationWithFlags} />);

    const badge = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(badge);
    });

    expect(screen.getByText('Flags:')).toBeInTheDocument();
    expect(screen.getByText('Minor factual inconsistency noted')).toBeInTheDocument();
    expect(screen.getByText('Could include more context about ENI')).toBeInTheDocument();
  });

  it('shows copy button when expanded', async () => {
    render(<ConfidenceBadge evaluation={mockEvaluation} />);

    const badge = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(badge);
    });

    expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
  });

  it('copies evaluation text to clipboard when copy button clicked', async () => {
    render(<ConfidenceBadge evaluation={mockEvaluation} />);

    // Expand
    const badge = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(badge);
    });

    // Click copy button
    const copyButton = screen.getByTitle('Copy to clipboard');
    await act(async () => {
      fireEvent.click(copyButton);
    });

    // Verify clipboard was called with formatted text
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];

    // Verify the copied text contains key information
    expect(copiedText).toContain('High confidence');
    expect(copiedText).toContain('92/100');
    expect(copiedText).toContain('Excellent response');
    expect(copiedText).toContain('Factual Accuracy');
    expect(copiedText).toContain('5/5');
  });

  it('copies flags in evaluation text when present', async () => {
    render(<ConfidenceBadge evaluation={mockEvaluationWithFlags} />);

    // Expand
    const badge = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(badge);
    });

    // Click copy button
    const copyButton = screen.getByTitle('Copy to clipboard');
    await act(async () => {
      fireEvent.click(copyButton);
    });

    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];

    expect(copiedText).toContain('Flags:');
    expect(copiedText).toContain('Minor factual inconsistency noted');
    expect(copiedText).toContain('Could include more context about ENI');
  });

  it('shows correct confidence level for different scores', () => {
    const lowScoreEval: EvaluationResult = {
      ...mockEvaluation,
      weighted_score: 45,
    };

    const { rerender } = render(<ConfidenceBadge evaluation={lowScoreEval} />);
    expect(screen.getByText('Low confidence')).toBeInTheDocument();

    const reviewScoreEval: EvaluationResult = {
      ...mockEvaluation,
      weighted_score: 65,
    };
    rerender(<ConfidenceBadge evaluation={reviewScoreEval} />);
    expect(screen.getByText('Review suggested')).toBeInTheDocument();

    const verifiedScoreEval: EvaluationResult = {
      ...mockEvaluation,
      weighted_score: 80,
    };
    rerender(<ConfidenceBadge evaluation={verifiedScoreEval} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows "Logged for review" indicator when auto_logged is true', () => {
    const loggedEval: EvaluationResult = {
      ...mockEvaluationWithFlags,
      auto_logged: true,
    };

    render(<ConfidenceBadge evaluation={loggedEval} />);
    expect(screen.getByText('Logged for review')).toBeInTheDocument();
  });
});
