import { NextRequest, NextResponse } from 'next/server';
import { logEvaluation } from '@/lib/logging/evaluation-logger';
import type { FlagResponseRequest, EvaluationResult } from '@/types/chat';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as FlagResponseRequest;

    // Validate required fields
    if (!body.feedback || body.feedback.trim().length === 0) {
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      );
    }

    if (!body.user_query || !body.assistant_response) {
      return NextResponse.json(
        { error: 'user_query and assistant_response are required' },
        { status: 400 }
      );
    }

    // Limit feedback to 1000 characters
    const feedback = body.feedback.trim().substring(0, 1000);

    // Create a minimal evaluation if none provided
    const evaluation: EvaluationResult = body.evaluation || {
      scores: {
        factual_accuracy: 0,
        context_inclusion: 0,
        limitation_acknowledgment: 0,
        responsible_framing: 0,
        query_relevance: 0
      },
      weighted_score: 0,
      flags: ['User flagged - no evaluation available'],
      summary: 'Response flagged by user without evaluation scores'
    };

    // Log the flagged response (fire-and-forget)
    logEvaluation({
      userQuery: body.user_query,
      assistantResponse: body.assistant_response,
      toolCalls: body.tool_calls || [],
      evaluation,
      logType: 'user_flagged',
      userFeedback: feedback
    }).catch(error => {
      console.error('Failed to log flagged response:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Flag API error:', error);
    return NextResponse.json(
      { error: 'Failed to process flag request' },
      { status: 500 }
    );
  }
}
