import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkPrefilter } from '@/lib/ai/prefilter';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
import { evaluateResponse } from '@/lib/ai/evaluation';
import { generateSuggestedQueriesWithLLM, generateFallbackSuggestions } from '@/lib/ai/suggestions';
import { ALL_TOOL_DEFINITIONS, executeTool } from '@/lib/mcp';
import {
  checkRateLimit,
  recordRequest,
  checkDailyBudget,
  recordTokenUsage,
  getRateLimitHeaders
} from '@/lib/utils/rate-limit';
import { generateId } from '@/lib/utils/formatting';
import { logEvaluation, shouldAutoLog } from '@/lib/logging/evaluation-logger';

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
          controller.enqueue(encoder.encode(sseEvent('done', { usage: {}, evaluating: false, suggestionsLoading: false })));
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
        const toolNames: string[] = [];
        const toolCallsForLogging: Array<{ name: string; parameters: Record<string, unknown> }> = [];
        let totalUsage = { input_tokens: 0, output_tokens: 0 };

        // Conversation messages grow with each tool-use iteration
        let conversationMessages: Anthropic.MessageParam[] = [...anthropicMessages];

        try {
          let continueLoop = true;
          const MAX_TOOL_ITERATIONS = 5;
          let toolIterations = 0;

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
                // Track tool names for suggestion generation
                toolNames.push(toolUse.name);

                // Emit enhanced tool_start event with id and parameters
                const toolParams = toolUse.input as Record<string, unknown>;

                // Track tool calls with parameters for evaluation logging
                toolCallsForLogging.push({ name: toolUse.name, parameters: toolParams });

                controller.enqueue(encoder.encode(sseEvent('tool_start', {
                  id: toolUse.id,
                  name: toolUse.name,
                  parameters: toolParams
                })));

                try {
                  const result = executeTool(toolUse.name, toolParams) as Record<string, unknown>;

                  // Store full result for evaluation
                  toolResults.push(JSON.stringify(result));

                  // Generate result summary for client display
                  const resultSummary = generateToolResultSummary(toolUse.name, result);

                  if (toolUse.name === 'generate_chart') {
                    // Layer 1: Send full chart data to client for rendering
                    controller.enqueue(encoder.encode(sseEvent('chart_data', {
                      toolUseId: toolUse.id,
                      ...result
                    })));

                    // Send only a lightweight summary to Claude
                    const chartResult = result as { chart: { type: string; title: string; xAxis: unknown; yAxis: unknown; data: unknown[] }; _context: unknown };
                    const summary = {
                      chart: {
                        type: chartResult.chart.type,
                        title: chartResult.chart.title,
                        xAxis: chartResult.chart.xAxis,
                        yAxis: chartResult.chart.yAxis,
                        data_point_count: chartResult.chart.data.length,
                      },
                      _context: chartResult._context,
                    };
                    toolResultsContent.push({
                      type: 'tool_result',
                      tool_use_id: toolUse.id,
                      content: JSON.stringify(summary)
                    });
                  } else {
                    // Layer 2: Summarize tool results for conversation context
                    const summarized = summarizeForConversation(toolUse.name, result);
                    toolResultsContent.push({
                      type: 'tool_result',
                      tool_use_id: toolUse.id,
                      content: JSON.stringify(summarized)
                    });
                  }

                  // Extract school name/dbn pairs for client-side linking
                  const schools = extractSchoolMappings(toolUse.name, result);

                  // Emit enhanced tool_end event with result summary and school mappings
                  controller.enqueue(encoder.encode(sseEvent('tool_end', {
                    id: toolUse.id,
                    name: toolUse.name,
                    resultSummary,
                    schools
                  })));
                } catch (toolError) {
                  console.error(`Tool error (${toolUse.name}):`, toolError);
                  toolResultsContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify({ error: `Tool execution failed: ${toolError}` }),
                    is_error: true
                  });

                  // Emit tool_end event with error
                  controller.enqueue(encoder.encode(sseEvent('tool_end', {
                    id: toolUse.id,
                    name: toolUse.name,
                    error: `Tool execution failed: ${toolError}`
                  })));
                }
              }

              toolIterations++;

              // Add assistant response and tool results to conversation for next iteration
              conversationMessages = [
                ...conversationMessages,
                { role: 'assistant', content: finalMessage.content },
                { role: 'user', content: toolResultsContent }
              ];

              // Safety cap: prevent runaway tool loops
              if (toolIterations >= MAX_TOOL_ITERATIONS) {
                console.warn(`Tool iteration cap (${MAX_TOOL_ITERATIONS}) reached, forcing synthesis`);

                // Do one final API call without tools, with a synthesis instruction
                // appended to the last user message so Claude reads its tool results
                // and produces a complete answer instead of setting up another tool call
                const synthesisMessages: Anthropic.MessageParam[] = [
                  ...conversationMessages.slice(0, -1), // everything except last user msg
                  {
                    role: 'user',
                    content: [
                      ...toolResultsContent,
                      { type: 'text' as const, text: 'Now synthesize all the data above into a complete, well-structured response for the user. Do not call any more tools.' }
                    ]
                  }
                ];

                const synthesisStream = anthropic.messages.stream({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 4096,
                  system: systemPrompt,
                  messages: synthesisMessages
                });

                synthesisStream.on('text', (textDelta) => {
                  accumulatedText += textDelta;
                  controller.enqueue(encoder.encode(sseEvent('text_delta', { text: textDelta })));
                });

                const synthMessage = await synthesisStream.finalMessage();
                if (synthMessage.usage) {
                  totalUsage.input_tokens += synthMessage.usage.input_tokens;
                  totalUsage.output_tokens += synthMessage.usage.output_tokens;
                }

                continueLoop = false;
              }
            } else {
              // stop_reason is 'end_turn' or other — we're done
              continueLoop = false;
            }
          }

          // Record request and token usage
          recordRequest(clientIP);
          recordTokenUsage(totalUsage.input_tokens, totalUsage.output_tokens);

          const evaluationEnabled = process.env.ENABLE_EVALUATION !== 'false';
          const suggestionsEnabled = !!process.env.GEMINI_API_KEY;

          // Emit done event with metadata (suggestions will arrive separately)
          controller.enqueue(encoder.encode(sseEvent('done', {
            usage: {
              inputTokens: totalUsage.input_tokens,
              outputTokens: totalUsage.output_tokens
            },
            evaluating: evaluationEnabled,
            suggestionsLoading: suggestionsEnabled
          })));

          // Helper for timeout handling
          const TIMEOUT = Symbol('timeout');
          const geminiTimeout = <T>(p: Promise<T>, ms: number) =>
            Promise.race([p, new Promise<typeof TIMEOUT>(r => setTimeout(() => r(TIMEOUT), ms))]);

          const tasks: Promise<void>[] = [];

          // Suggestions task (15s timeout — simpler prompt, should be fast)
          if (suggestionsEnabled) {
            tasks.push((async () => {
              try {
                const result = await geminiTimeout(
                  generateSuggestedQueriesWithLLM(latestUserMessage.content, accumulatedText, toolResults),
                  15_000
                );
                // generateSuggestedQueriesWithLLM returns validated suggestions (guardrail Layer B applied internally)
                // If result is empty after validation, it returns null
                if (result !== TIMEOUT && result && result.length > 0) {
                  controller.enqueue(encoder.encode(sseEvent('suggested_queries', { suggestions: result })));
                } else {
                  // Fallback to entity-based contextual suggestions
                  const fallback = generateFallbackSuggestions(toolResults, accumulatedText);
                  controller.enqueue(encoder.encode(sseEvent('suggested_queries', { suggestions: fallback })));
                }
              } catch {
                const fallback = generateFallbackSuggestions(toolResults, accumulatedText);
                controller.enqueue(encoder.encode(sseEvent('suggested_queries', { suggestions: fallback })));
              }
            })());
          }

          // Evaluation task (30s timeout — unchanged logic)
          if (evaluationEnabled) {
            tasks.push((async () => {
              try {
                // Truncate tool results for evaluation to keep Gemini prompt reasonable
                const evalToolResults = toolResults.join('\n').slice(0, 10_000);
                const evaluation = await geminiTimeout(
                  evaluateResponse(
                    latestUserMessage.content,
                    accumulatedText,
                    evalToolResults
                  ),
                  30_000
                );
                if (evaluation === TIMEOUT) {
                  console.warn('Evaluation timed out after 30s');
                } else if (evaluation) {
                  // Check if this response should be auto-logged
                  const wasAutoLogged = shouldAutoLog(evaluation);

                  if (wasAutoLogged) {
                    // Auto-log the evaluation (fire-and-forget)
                    logEvaluation({
                      userQuery: latestUserMessage.content,
                      assistantResponse: accumulatedText,
                      toolCalls: toolCallsForLogging,
                      evaluation,
                      logType: 'auto'
                    }).catch(err => console.error('Auto-log failed:', err));
                  }

                  // Include auto_logged flag in evaluation SSE event
                  controller.enqueue(encoder.encode(sseEvent('evaluation', {
                    ...evaluation,
                    auto_logged: wasAutoLogged
                  })));
                } else {
                  console.warn('Evaluation returned null (parse failure or missing API key)');
                }
              } catch (err) {
                console.error('Evaluation error:', err);
                // Non-critical — don't emit error event
              }
            })());
          }

          // Wait for both tasks to complete (neither blocks the other)
          await Promise.allSettled(tasks);

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

// Extract school name/DBN pairs for client-side linking
function extractSchoolMappings(
  toolName: string,
  result: Record<string, unknown>
): Array<{ name: string; dbn: string }> {
  const mappings: Array<{ name: string; dbn: string }> = [];

  const extractFromSchool = (school: Record<string, unknown>) => {
    const name = school.name as string | undefined;
    const dbn = school.dbn as string | undefined;
    if (name && dbn) {
      mappings.push({ name, dbn });
    }
  };

  switch (toolName) {
    case 'search_schools':
    case 'get_curated_lists': {
      const schools = result.schools as Record<string, unknown>[] | undefined;
      if (schools) {
        for (const school of schools) {
          extractFromSchool(school);
        }
      }
      break;
    }
    case 'find_similar_schools': {
      const target = result.target_school as Record<string, unknown> | undefined;
      if (target) extractFromSchool(target);
      const similar = result.similar_schools as Record<string, unknown>[] | undefined;
      if (similar) {
        for (const school of similar) {
          extractFromSchool(school);
        }
      }
      break;
    }
    case 'get_school_profile': {
      const profile = result.profile as Record<string, unknown> | null;
      if (profile?.school) {
        extractFromSchool(profile.school as Record<string, unknown>);
      }
      const similarSchools = profile?.similarSchools as Record<string, unknown>[] | undefined;
      if (similarSchools) {
        for (const school of similarSchools) {
          extractFromSchool(school);
        }
      }
      break;
    }
    case 'compare_schools': {
      const comparison = result.comparison as Record<string, unknown> | undefined;
      const schools = comparison?.schools as Record<string, unknown>[] | undefined;
      if (schools) {
        for (const school of schools) {
          extractFromSchool(school);
        }
      }
      break;
    }
    // generate_chart, analyze_correlations, explain_metrics don't return individual schools
  }

  return mappings;
}

// Generate human-readable summaries for tool results (for client display)
function generateToolResultSummary(toolName: string, result: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_schools': {
      const schools = result.schools as Record<string, unknown>[] | undefined;
      const total = result.total as number | undefined;
      if (!schools || schools.length === 0) {
        return 'No schools found matching criteria';
      }
      return `Found ${total ?? schools.length} school${(total ?? schools.length) !== 1 ? 's' : ''}`;
    }
    case 'get_school_profile': {
      const profile = result.profile as Record<string, unknown> | null;
      if (!profile) {
        return 'School not found';
      }
      const school = profile.school as Record<string, unknown> | undefined;
      const name = school?.name as string | undefined;
      return name ? `Retrieved profile for ${name}` : 'Retrieved school profile';
    }
    case 'find_similar_schools': {
      const similar = result.similar_schools as Record<string, unknown>[] | undefined;
      if (!similar || similar.length === 0) {
        return 'No similar schools found';
      }
      return `Found ${similar.length} similar school${similar.length !== 1 ? 's' : ''}`;
    }
    case 'analyze_correlations': {
      const correlation = result.correlation as number | undefined;
      if (correlation === undefined) {
        return 'Correlation analysis complete';
      }
      return `Correlation: ${correlation.toFixed(3)}`;
    }
    case 'generate_chart': {
      const chart = result.chart as Record<string, unknown> | undefined;
      const title = chart?.title as string | undefined;
      return title ? `Generated chart: ${title}` : 'Chart generated';
    }
    case 'explain_metrics': {
      const metric = result.metric as string | undefined;
      return metric ? `Explanation for ${metric}` : 'Metric explanation retrieved';
    }
    case 'get_curated_lists': {
      const schools = result.schools as Record<string, unknown>[] | undefined;
      const listType = result.list_type as string | undefined;
      if (!schools || schools.length === 0) {
        return 'No schools in list';
      }
      const label = listType?.replace(/_/g, ' ') || 'curated';
      return `Retrieved ${schools.length} ${label} school${schools.length !== 1 ? 's' : ''}`;
    }
    case 'compare_schools': {
      const comparison = result.comparison as Record<string, unknown> | undefined;
      const schools = comparison?.schools as Record<string, unknown>[] | undefined;
      if (!schools || schools.length === 0) {
        return 'No schools to compare';
      }
      const comparisonType = comparison?.comparison_type as string | undefined;
      const typeLabel = comparisonType === 'vs_citywide' ? ' (vs citywide)' :
                        comparisonType === 'vs_similar' ? ' (vs similar peers)' :
                        comparisonType === 'filtered' ? ' (filtered)' : '';
      return `Compared ${schools.length} school${schools.length !== 1 ? 's' : ''}${typeLabel}`;
    }
    default:
      return 'Tool completed successfully';
  }
}

// Layer 2: Summarize tool results to reduce tokens sent back to Claude.
// The full unsummarized result is still stored in toolResults[] for evaluation.
const ESSENTIAL_SCHOOL_FIELDS = [
  'dbn', 'name', 'borough', 'impact_score', 'performance_score',
  'economic_need_index', 'enrollment', 'category', 'is_charter',
  'student_attendance', 'teacher_attendance',
  // Survey scores (family engagement, safety, etc.)
  'survey_family_involvement', 'survey_family_trust', 'survey_safety',
  'survey_communication', 'survey_instruction', 'survey_leadership', 'survey_support',
  // Ratings (string values like "Meeting Target")
  'rating_instruction', 'rating_safety', 'rating_families',
  // Staff metrics
  'principal_years', 'pct_teachers_3plus_years'
] as const;

function pickEssentialFields(school: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of ESSENTIAL_SCHOOL_FIELDS) {
    if (key in school) {
      picked[key] = school[key];
    }
  }
  return picked;
}

function summarizeSchoolProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const summarized: Record<string, unknown> = {};

  // Keep school basics
  if (profile.school) {
    summarized.school = pickEssentialFields(profile.school as Record<string, unknown>);
  }

  // Keep only essential metrics from current/previous years
  if (profile.metrics) {
    const metrics = profile.metrics as Record<string, unknown>;
    const summarizeMetrics = (m: Record<string, unknown> | undefined) => {
      if (!m) return undefined;
      return pickEssentialFields(m);
    };
    summarized.metrics = {
      current: summarizeMetrics(metrics.current as Record<string, unknown> | undefined),
      previous: summarizeMetrics(metrics.previous as Record<string, unknown> | undefined),
    };
  }

  // Keep scalar flags
  if ('isPersistentGem' in profile) summarized.isPersistentGem = profile.isPersistentGem;

  // Summarize similar schools
  if (Array.isArray(profile.similarSchools)) {
    summarized.similarSchools = (profile.similarSchools as Record<string, unknown>[]).map(pickEssentialFields);
  }

  // Keep only latest year budget/suspension/pta totals
  if (Array.isArray(profile.budgets) && (profile.budgets as Record<string, unknown>[]).length > 0) {
    const latest = (profile.budgets as Record<string, unknown>[])[0];
    summarized.latest_budget = {
      year: latest.year,
      total_budget_allocation: latest.total_budget_allocation,
      pct_funded: latest.pct_funded,
    };
  }
  if (Array.isArray(profile.suspensions) && (profile.suspensions as Record<string, unknown>[]).length > 0) {
    const latest = (profile.suspensions as Record<string, unknown>[])[0];
    summarized.latest_suspensions = {
      year: latest.year,
      total_suspensions: latest.total_suspensions,
    };
  }
  if (Array.isArray(profile.pta) && (profile.pta as Record<string, unknown>[]).length > 0) {
    const latest = (profile.pta as Record<string, unknown>[])[0];
    summarized.latest_pta = {
      year: latest.year,
      total_income: latest.total_income,
      total_expenses: latest.total_expenses,
    };
  }

  // Keep location basics
  if (profile.location) {
    const loc = profile.location as Record<string, unknown>;
    summarized.location = {
      address: loc.address,
      borough: loc.city,
      nta: loc.nta,
      grades_served: loc.grades_served,
    };
  }

  return summarized;
}

function summarizeForConversation(toolName: string, result: Record<string, unknown>): Record<string, unknown> {
  switch (toolName) {
    case 'search_schools': {
      const schools = result.schools as Record<string, unknown>[] | undefined;
      return {
        ...result,
        schools: schools?.map(pickEssentialFields),
      };
    }
    case 'get_curated_lists': {
      const schools = result.schools as Record<string, unknown>[] | undefined;
      return {
        ...result,
        schools: schools?.map(pickEssentialFields),
      };
    }
    case 'find_similar_schools': {
      const similarSchools = result.similar_schools as Record<string, unknown>[] | undefined;
      return {
        ...result,
        similar_schools: similarSchools?.map(pickEssentialFields),
      };
    }
    case 'get_school_profile': {
      const profile = result.profile as Record<string, unknown> | null;
      return {
        profile: profile ? summarizeSchoolProfile(profile) : null,
        _context: result._context,
      };
    }
    default:
      return result;
  }
}

// GET handler for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nyc-school-explorer-chat'
  });
}
