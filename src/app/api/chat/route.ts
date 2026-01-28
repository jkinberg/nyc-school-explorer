import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkPrefilter } from '@/lib/ai/prefilter';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
import { evaluateResponse } from '@/lib/ai/evaluation';
import { ALL_TOOL_DEFINITIONS, executeTool } from '@/lib/mcp';
import {
  checkRateLimit,
  recordRequest,
  checkDailyBudget,
  recordTokenUsage,
  getRateLimitHeaders
} from '@/lib/utils/rate-limit';
import { generateId } from '@/lib/utils/formatting';

// Initialize Anthropic client
const anthropic = new Anthropic();

// Types for the API
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
}

// Get client IP from request
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// Format a Server-Sent Event
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  try {
    // Parse request body
    const body = await request.json() as ChatRequest;
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    // Rate limiting check
    if (process.env.RATE_LIMIT_ENABLED !== 'false') {
      const rateLimit = checkRateLimit(clientIP);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: rateLimit.error,
            code: 'RATE_LIMIT',
            retryAfter: rateLimit.resetIn
          },
          {
            status: 429,
            headers: getRateLimitHeaders(clientIP)
          }
        );
      }

      // Check daily budget
      const budget = checkDailyBudget();
      if (!budget.allowed) {
        return NextResponse.json(
          {
            error: 'Daily API budget exceeded. Please try again tomorrow.',
            code: 'BUDGET_EXCEEDED'
          },
          { status: 503 }
        );
      }
    }

    // Get the latest user message for pre-filtering
    const latestUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    // Pre-filter check
    const prefilterResult = checkPrefilter(latestUserMessage.content);
    if (prefilterResult.blocked) {
      // Record the request even though it was blocked
      recordRequest(clientIP);

      // Return as SSE stream for consistency
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(sseEvent('text_delta', { text: prefilterResult.reframe })));
          controller.enqueue(encoder.encode(sseEvent('done', { suggestedQueries: [], usage: {}, evaluating: false })));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...getRateLimitHeaders(clientIP)
        }
      });
    }

    // Prepare messages for Claude
    let systemPrompt = getSystemPrompt();
    if (prefilterResult.flag) {
      systemPrompt = prefilterResult.flag + '\n\n' + systemPrompt;
    }

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let accumulatedText = '';
        const toolResults: string[] = [];
        let totalUsage = { input_tokens: 0, output_tokens: 0 };

        // Conversation messages grow with each tool-use iteration
        let conversationMessages: Anthropic.MessageParam[] = [...anthropicMessages];

        try {
          let continueLoop = true;

          while (continueLoop) {
            // Create streaming request
            const messageStream = anthropic.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools: ALL_TOOL_DEFINITIONS as Anthropic.Tool[],
              messages: conversationMessages
            });

            // Listen for text deltas and emit them as SSE events
            messageStream.on('text', (textDelta) => {
              accumulatedText += textDelta;
              controller.enqueue(encoder.encode(sseEvent('text_delta', { text: textDelta })));
            });

            // Wait for the stream to complete and get the final message
            const finalMessage = await messageStream.finalMessage();

            // Accumulate usage
            if (finalMessage.usage) {
              totalUsage.input_tokens += finalMessage.usage.input_tokens;
              totalUsage.output_tokens += finalMessage.usage.output_tokens;
            }

            if (finalMessage.stop_reason === 'tool_use') {
              // Extract tool use blocks from the response
              const toolUseBlocks = finalMessage.content.filter(
                (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
              );

              // Execute each tool
              const toolResultsContent: Anthropic.ToolResultBlockParam[] = [];

              for (const toolUse of toolUseBlocks) {
                // Emit tool_start event
                controller.enqueue(encoder.encode(sseEvent('tool_start', { name: toolUse.name })));

                try {
                  const result = executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
                  toolResults.push(JSON.stringify(result));

                  toolResultsContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result)
                  });
                } catch (toolError) {
                  console.error(`Tool error (${toolUse.name}):`, toolError);
                  toolResultsContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify({ error: `Tool execution failed: ${toolError}` }),
                    is_error: true
                  });
                }

                // Emit tool_end event
                controller.enqueue(encoder.encode(sseEvent('tool_end', { name: toolUse.name })));
              }

              // Add assistant response and tool results to conversation for next iteration
              conversationMessages = [
                ...conversationMessages,
                { role: 'assistant', content: finalMessage.content },
                { role: 'user', content: toolResultsContent }
              ];
            } else {
              // stop_reason is 'end_turn' or other — we're done
              continueLoop = false;
            }
          }

          // Record request and token usage
          recordRequest(clientIP);
          recordTokenUsage(totalUsage.input_tokens, totalUsage.output_tokens);

          // Generate suggested follow-up queries
          const suggestedQueries = generateSuggestedQueries(accumulatedText, toolResults);

          const evaluationEnabled = process.env.ENABLE_EVALUATION !== 'false';

          // Emit done event with metadata
          controller.enqueue(encoder.encode(sseEvent('done', {
            suggestedQueries,
            usage: {
              inputTokens: totalUsage.input_tokens,
              outputTokens: totalUsage.output_tokens
            },
            evaluating: evaluationEnabled
          })));

          // Await evaluation with timeout, then emit result before closing
          if (evaluationEnabled) {
            const TIMEOUT = Symbol('timeout');
            try {
              const evaluation = await Promise.race([
                evaluateResponse(
                  latestUserMessage.content,
                  accumulatedText,
                  toolResults.join('\n')
                ),
                new Promise<typeof TIMEOUT>(resolve => setTimeout(() => resolve(TIMEOUT), 10_000))
              ]);
              if (evaluation === TIMEOUT) {
                console.warn('Evaluation timed out after 10s');
              } else if (evaluation) {
                controller.enqueue(encoder.encode(sseEvent('evaluation', evaluation)));
              } else {
                console.warn('Evaluation returned null (parse failure or missing API key)');
              }
            } catch (err) {
              console.error('Evaluation error:', err);
              // Non-critical — don't emit error event
            }
          }

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          controller.enqueue(encoder.encode(sseEvent('error', { error: errorMessage })));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...getRateLimitHeaders(clientIP)
      }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Generate contextual follow-up suggestions
function generateSuggestedQueries(
  response: string,
  toolResults: string[]
): { text: string; category: string }[] {
  const suggestions: { text: string; category: string }[] = [];

  // Check what was discussed to suggest relevant follow-ups
  const lowerResponse = response.toLowerCase();
  const toolResultsText = toolResults.join(' ').toLowerCase();

  // If specific schools were mentioned
  if (toolResultsText.includes('dbn') || lowerResponse.includes('school')) {
    suggestions.push({
      text: 'Find similar schools for comparison',
      category: 'compare'
    });
  }

  // If categories were mentioned
  if (lowerResponse.includes('hidden gem') || lowerResponse.includes('elite')) {
    suggestions.push({
      text: 'How many schools maintain this status year-over-year?',
      category: 'explore'
    });
  }

  // If correlations were discussed
  if (lowerResponse.includes('correlat') || lowerResponse.includes('relationship')) {
    suggestions.push({
      text: 'What other factors correlate with student growth?',
      category: 'explore'
    });
  }

  // If Impact Score was mentioned
  if (lowerResponse.includes('impact score')) {
    suggestions.push({
      text: 'What does Impact Score actually measure?',
      category: 'explain'
    });
  }

  // If borough was mentioned
  if (/bronx|brooklyn|manhattan|queens|staten island/i.test(lowerResponse)) {
    suggestions.push({
      text: 'Show me a chart comparing boroughs',
      category: 'visualize'
    });
  }

  // Default suggestions if none match
  if (suggestions.length === 0) {
    suggestions.push(
      { text: 'Show me high-growth schools in high-poverty areas', category: 'explore' },
      { text: 'What are the limitations of this data?', category: 'explain' }
    );
  }

  return suggestions.slice(0, 3);
}

// GET handler for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nyc-school-explorer-chat'
  });
}
