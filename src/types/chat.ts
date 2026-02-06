import type { ResponseContext } from './school';

// Message types for chat interface
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  evaluation?: EvaluationResult;
}

// Tool call tracking
export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  context?: ResponseContext;
}

// Conversation state
export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: Date;
  lastMessageAt: Date;
  context?: ConversationContext;
}

export interface ConversationContext {
  lastSchoolViewed?: string; // DBN
  activeFilters?: Record<string, unknown>;
  chartsGenerated?: ChartData[];
}

// Chart data for visualization
export interface ChartData {
  type: 'scatter' | 'bar' | 'histogram' | 'line' | 'diverging_bar';
  title: string;
  xAxis: {
    label: string;
    dataKey: string;
  };
  yAxis: {
    label: string;
    dataKey: string;
  };
  data: Record<string, unknown>[];
  colorBy?: string;
  midpoint?: number;  // For diverging_bar reference line
  context: ResponseContext;
}

// Streaming response content types
export type ContentType = 'text' | 'chart' | 'school_card' | 'school_list' | 'limitation_callout';

export interface StreamContent {
  type: ContentType;
  content: string | ChartData | SchoolCardData | SchoolListData | string;
}

export interface SchoolCardData {
  dbn: string;
  name: string;
  borough: string;
  impact_score: number | null;
  performance_score: number | null;
  economic_need_index: number | null;
  enrollment: number | null;
  category: string | null;
}

export interface SchoolListData {
  schools: SchoolCardData[];
  total: number;
  context: ResponseContext;
}

// Pre-filter result
export interface PrefilterResult {
  blocked: boolean;
  reframe?: string;
  flag?: string;
}

// Evaluation result from LLM-as-judge
export interface EvaluationResult {
  scores: {
    factual_accuracy: number;      // 1-5
    context_inclusion: number;      // 1-5
    limitation_acknowledgment: number; // 1-5
    responsible_framing: number;    // 1-5
    query_relevance: number;        // 1-5
  };
  weighted_score: number;           // 0-100
  flags: string[];
  summary: string;
  auto_logged?: boolean;            // True if response was auto-logged for review
}

// Evaluation logging types
export interface EvaluationLogEntry {
  id: string;
  timestamp: string;
  log_type: 'auto' | 'user_flagged';
  user_query: string;
  assistant_response: string;
  tool_calls: Array<{ name: string; parameters: Record<string, unknown> }>;
  evaluation: {
    scores: EvaluationResult['scores'];
    weighted_score: number;
    confidence_level: string;
    flags: string[];
    summary: string;
  };
  user_feedback?: string;
}

export interface FlagResponseRequest {
  message_id: string;
  user_query: string;
  assistant_response: string;
  tool_calls?: Array<{ name: string; parameters: Record<string, unknown> }>;
  evaluation?: EvaluationResult;
  feedback: string;
}

// Confidence badge based on evaluation
export type ConfidenceLevel = 'high' | 'verified' | 'review_suggested' | 'low';

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 90) return 'high';
  if (score >= 75) return 'verified';
  if (score >= 60) return 'review_suggested';
  return 'low';
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, { label: string; color: string }> = {
  high: { label: 'High confidence', color: 'green' },
  verified: { label: 'Verified', color: 'blue' },
  review_suggested: { label: 'Review suggested', color: 'yellow' },
  low: { label: 'Low confidence', color: 'red' }
};

// Suggested follow-up queries
export interface SuggestedQuery {
  text: string;
  category: 'explore' | 'compare' | 'explain' | 'visualize';
}

// Rate limiting
export interface RateLimitInfo {
  requestsRemaining: number;
  requestsLimit: number;
  resetAt: Date;
  tokensUsedToday: number;
  dailyTokenLimit: number;
}

// API request/response types
export interface ChatRequest {
  messages: Pick<Message, 'role' | 'content'>[];
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  content: StreamContent[];
  suggestedQueries?: SuggestedQuery[];
  evaluation?: EvaluationResult;
  rateLimitInfo?: RateLimitInfo;
}

// Error responses
export interface ChatError {
  error: string;
  code: 'RATE_LIMIT' | 'PRE_FILTER_BLOCK' | 'API_ERROR' | 'INVALID_REQUEST';
  reframe?: string;
  retryAfter?: number;
}
