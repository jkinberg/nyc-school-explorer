import { NextRequest, NextResponse } from 'next/server';
import { ALL_TOOL_DEFINITIONS, executeTool } from '@/lib/mcp';

// In-memory rate limiter for MCP endpoint
const mcpRateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MCP_RATE_LIMIT = 60; // requests per minute

// JSON-RPC 2.0 Error Codes
const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  RATE_LIMIT_EXCEEDED: { code: -32002, message: 'Rate limit exceeded' },
};

// Get client IP from request
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// Check rate limit for MCP endpoint
function checkMcpRateLimit(ip: string): { allowed: boolean; resetIn: number } {
  const now = Date.now();
  const entry = mcpRateLimitStore.get(ip);

  if (entry) {
    if (now < entry.resetAt) {
      if (entry.count >= MCP_RATE_LIMIT) {
        return { allowed: false, resetIn: Math.ceil((entry.resetAt - now) / 1000) };
      }
      entry.count++;
    } else {
      mcpRateLimitStore.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    }
  } else {
    mcpRateLimitStore.set(ip, { count: 1, resetAt: now + 60 * 1000 });
  }

  return { allowed: true, resetIn: 0 };
}

// JSON-RPC 2.0 Response helpers
function jsonRpcSuccess(id: string | number | null, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: string | number | null, error: { code: number; message: string; data?: unknown }) {
  return { jsonrpc: '2.0', id, error };
}

// Protocol version we support
const PROTOCOL_VERSION = '2025-06-18';

// Server info
const SERVER_INFO = {
  name: 'nyc-schools-data',
  version: '1.0.0',
};

// Handle initialize method
function handleInitialize(params: { protocolVersion?: string; clientInfo?: { name: string; version: string } }) {
  console.log(`[MCP] initialize from client: ${params.clientInfo?.name || 'unknown'}`);

  return {
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: SERVER_INFO,
    capabilities: {
      tools: {},
    },
  };
}

// Handle tools/list method
function handleToolsList() {
  // Transform our tool definitions to MCP format
  const tools = ALL_TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
  }));

  return { tools };
}

// Handle tools/call method
function handleToolsCall(params: { name: string; arguments?: Record<string, unknown> }, ip: string) {
  const { name, arguments: args = {} } = params;

  // Log the tool call
  console.log(`[MCP] method=tools/call tool=${name} ip=${ip}`);

  // Check if tool exists
  const toolExists = ALL_TOOL_DEFINITIONS.some(t => t.name === name);
  if (!toolExists) {
    throw { ...JSON_RPC_ERRORS.INVALID_PARAMS, message: `Unknown tool: ${name}` };
  }

  try {
    const result = executeTool(name, args);

    // MCP expects content array with type/text items
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    throw { ...JSON_RPC_ERRORS.INTERNAL_ERROR, message };
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  // Rate limit check
  const rateLimit = checkMcpRateLimit(clientIP);
  if (!rateLimit.allowed) {
    console.log(`[MCP] rate limit exceeded ip=${clientIP}`);
    return NextResponse.json(
      jsonRpcError(null, {
        ...JSON_RPC_ERRORS.RATE_LIMIT_EXCEEDED,
        data: { retryAfter: rateLimit.resetIn },
      }),
      { status: 429 }
    );
  }

  // Parse request body
  let body: { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      jsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR),
      { status: 400 }
    );
  }

  // Validate JSON-RPC structure
  const { jsonrpc, id, method, params } = body;

  // Check if this is a notification (no id field means notification in JSON-RPC 2.0)
  const isNotification = id === undefined || id === null;

  if (jsonrpc !== '2.0') {
    return NextResponse.json(
      jsonRpcError(id ?? null, { ...JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid JSON-RPC version' }),
      { status: 400 }
    );
  }

  if (!method || typeof method !== 'string') {
    return NextResponse.json(
      jsonRpcError(id ?? null, { ...JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Method is required' }),
      { status: 400 }
    );
  }

  // Route to appropriate handler
  try {
    let result: unknown;

    switch (method) {
      case 'initialize':
        result = handleInitialize((params as { protocolVersion?: string; clientInfo?: { name: string; version: string } }) || {});
        break;

      case 'notifications/initialized':
      case 'initialized':
        // Client notification after initialize - acknowledge without response body
        console.log(`[MCP] client initialized ip=${clientIP}`);
        return new Response(null, { status: 202 });

      case 'tools/list':
        result = handleToolsList();
        break;

      case 'tools/call':
        if (!params || typeof params !== 'object' || !('name' in params)) {
          return NextResponse.json(
            jsonRpcError(id ?? null, { ...JSON_RPC_ERRORS.INVALID_PARAMS, message: 'tools/call requires name parameter' }),
            { status: 400 }
          );
        }
        result = handleToolsCall(params as { name: string; arguments?: Record<string, unknown> }, clientIP);
        break;

      default:
        // For notifications to unknown methods, accept gracefully (per MCP spec)
        if (isNotification) {
          console.log(`[MCP] ignoring unknown notification method=${method} ip=${clientIP}`);
          return new Response(null, { status: 202 });
        }
        console.log(`[MCP] unknown method=${method} ip=${clientIP}`);
        return NextResponse.json(
          jsonRpcError(id ?? null, JSON_RPC_ERRORS.METHOD_NOT_FOUND),
          { status: 400 }
        );
    }

    return NextResponse.json(jsonRpcSuccess(id ?? null, result));
  } catch (error) {
    // Handle thrown JSON-RPC errors
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      return NextResponse.json(
        jsonRpcError(id ?? null, error as { code: number; message: string }),
        { status: 400 }
      );
    }

    // Unexpected error
    console.error('[MCP] Internal error:', error);
    return NextResponse.json(
      jsonRpcError(id ?? null, JSON_RPC_ERRORS.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nyc-schools-mcp',
    protocolVersion: PROTOCOL_VERSION,
  });
}
