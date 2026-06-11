import EventSource from 'react-native-sse';
import { ModelId } from '../types/chat';

interface StreamOptions {
  apiKey: string;
  model: ModelId;
  messages: { role: 'user' | 'model'; content: string }[];
  systemPrompt?: string;
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function streamGeminiChat({
  apiKey,
  model,
  messages,
  systemPrompt,
  onChunk,
  onComplete,
  onError,
}: StreamOptions) {
  if (!apiKey) {
    onError('Google Gemini API Key is missing. Please set it in Settings.');
    return { close: () => {} };
  }

  // Map incoming messages to Gemini contents structure:
  // contents: [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Structure request body for Gemini API streamGenerateContent
  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  // Add system instruction if provided
  if (systemPrompt && systemPrompt.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  // Construct endpoint with alt=sse to enable Server-Sent Events parsing by react-native-sse
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const es = new EventSource(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  }) as any;

  // Listen to standard message events containing the JSON chunks
  es.addEventListener('message', (event: any) => {
    try {
      if (event.data) {
        const data = JSON.parse(event.data);

        // Handle error responses embedded in the stream
        if (data.error) {
          const errorMsg = data.error.message || 'Gemini API Error';
          onError(errorMsg);
          es.close();
          return;
        }

        // Extract text fragment
        const chunkText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof chunkText === 'string') {
          onChunk(chunkText);
        }

        // Check for stream stop signals
        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'NONE') {
          onComplete();
          es.close();
        }
      }
    } catch (e) {
      // Ignore keepalive parsing details
    }
  });

  // Listen for connection-level errors (e.g. invalid key status codes)
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
      } else if (event.xhrStatus === 403 || event.xhrStatus === 401) {
        errorMessage = 'Invalid Gemini API Key. Please verify your AI Studio credentials in Settings.';
      } else if (event.xhrStatus === 429) {
        errorMessage = 'Gemini API rate limit exceeded. Please wait a moment before sending again.';
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
