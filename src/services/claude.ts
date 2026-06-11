import EventSource from 'react-native-sse';
import { ModelId } from '../types/chat';

interface StreamOptions {
  apiKey: string;
  model: ModelId;
  messages: { role: 'user' | 'model' | 'assistant'; content: string }[];
  systemPrompt?: string;
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function streamClaudeChat({
  apiKey,
  model,
  messages,
  systemPrompt,
  onChunk,
  onComplete,
  onError,
}: StreamOptions) {
  if (!apiKey) {
    onError('Anthropic Claude API Key is missing. Please set it in Settings.');
    return { close: () => {} };
  }

  // Map incoming messages to Anthropic format: role must be 'user' or 'assistant'
  const anthropicMessages = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const requestBody: any = {
    model,
    messages: anthropicMessages,
    max_tokens: 4096,
    stream: true,
  };

  if (systemPrompt && systemPrompt.trim()) {
    requestBody.system = systemPrompt;
  }

  const endpoint = 'https://api.anthropic.com/v1/messages';

  const es = new EventSource(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(requestBody),
  }) as any;

  es.addEventListener('message', (event: any) => {
    try {
      if (event.data) {
        const data = JSON.parse(event.data);

        // Handle error responses embedded in the stream
        if (data.type === 'error') {
          const errorMsg = data.error?.message || 'Claude API Error';
          onError(errorMsg);
          es.close();
          return;
        }

        if (data.type === 'content_block_delta') {
          const text = data.delta?.text;
          if (typeof text === 'string') {
            onChunk(text);
          }
        }

        if (data.type === 'message_stop') {
          onComplete();
          es.close();
        }
      }
    } catch (e) {
      // Ignore keepalive parsing details
    }
  });

  es.addEventListener('error', (event: any) => {
    let errorMessage = 'An error occurred during streaming.';

    if (event.data) {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
        } else if (parsed.message) {
          errorMessage = parsed.message;
        }
      } catch {
        errorMessage = event.data;
      }
    } else if (event.message) {
      errorMessage = event.message;
    } else if (event.xhrStatus) {
      if (event.xhrStatus === 400) {
        errorMessage = 'Invalid request parameters. Please verify your request.';
      } else if (event.xhrStatus === 401 || event.xhrStatus === 403) {
        errorMessage = 'Invalid Claude API Key. Please verify your Anthropic credentials.';
      } else if (event.xhrStatus === 429) {
        errorMessage = 'Claude API rate limit exceeded. Please wait a moment before sending again.';
      } else if (event.xhrStatus === 404) {
        errorMessage = 'The requested model was not found.';
      } else {
        errorMessage = `HTTP error (Status: ${event.xhrStatus})`;
      }
    }

    onError(errorMessage);
    es.close();
  });

  return {
    close: () => {
      es.close();
    },
  };
}
