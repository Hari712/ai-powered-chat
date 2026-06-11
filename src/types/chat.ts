export type ModelId = 
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2-flash'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-5-haiku-20241022';

export interface ModelOption {
  id: ModelId;
  name: string;
  description: string;
}

export const isClaudeModel = (id: ModelId) => id.startsWith('claude');

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Ultra-fast, efficient model with active free-tier quota (Recommended)',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Highly intelligent model for reasoning and complex tasks',
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2 Flash',
    description: 'General purpose fast text-generation model',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Fast, extremely capable model for complex reasoning and coding',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Powerful model for highly complex tasks and nuanced understanding',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fastest model for quick, lightweight tasks',
  },
];

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: ModelId;
  systemPrompt?: string;
  createdAt: number;
}
