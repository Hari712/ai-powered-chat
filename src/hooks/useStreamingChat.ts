import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation, Message, ModelId, isClaudeModel } from '../types/chat';
import { streamGeminiChat } from '../services/gemini';
import { streamClaudeChat } from '../services/claude';

const CONVERSATIONS_STORAGE_KEY = '@aichatapp_conversations';
const API_KEY_STORAGE_KEY = '@aichatapp_api_key';
const CLAUDE_API_KEY_STORAGE_KEY = '@aichatapp_claude_api_key';
const CURRENT_CONV_STORAGE_KEY = '@aichatapp_current_id';

export function useStreamingChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [claudeApiKey, setClaudeApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Use a ref to keep track of the active stream close handle
  const activeStreamRef = useRef<{ close: () => void } | null>(null);

  // Load API key and conversations on startup
  useEffect(() => {
    async function loadData() {
      try {
        const storedApiKey = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
        if (storedApiKey) {
          setApiKey(storedApiKey);
        }

        const storedClaudeApiKey = await AsyncStorage.getItem(CLAUDE_API_KEY_STORAGE_KEY);
        if (storedClaudeApiKey) {
          setClaudeApiKey(storedClaudeApiKey);
        }

        const storedConversations = await AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY);
        let parsedConversations: Conversation[] = [];
        if (storedConversations) {
          parsedConversations = JSON.parse(storedConversations);
          setConversations(parsedConversations);
        }

        const storedCurrentId = await AsyncStorage.getItem(CURRENT_CONV_STORAGE_KEY);
        console.log("storedCurrentId:", storedCurrentId)
        if (storedCurrentId && parsedConversations.some((c) => c.id === storedCurrentId)) {
          setCurrentConversationId(storedCurrentId);
        } else if (parsedConversations.length > 0) {
          setCurrentConversationId(parsedConversations[0].id);
        }
      } catch (e) {
        console.error('Failed to load storage data:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Sync conversations to storage on state change
  const saveConversations = async (updatedConversations: Conversation[]) => {
    try {
      await AsyncStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(updatedConversations));
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  };

  // Sync current conversation ID to storage on change
  const saveCurrentId = async (id: string | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem(CURRENT_CONV_STORAGE_KEY, id);
      } else {
        await AsyncStorage.removeItem(CURRENT_CONV_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save current id:', e);
    }
  };

  // Save API key
  const saveApiKey = async (key: string) => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE_KEY, key);
      setApiKey(key);
    } catch (e) {
      console.error('Failed to save API key:', e);
    }
  };

  const saveClaudeApiKey = async (key: string) => {
    try {
      await AsyncStorage.setItem(CLAUDE_API_KEY_STORAGE_KEY, key);
      setClaudeApiKey(key);
    } catch (e) {
      console.error('Failed to save Claude API key:', e);
    }
  };

  // Get active conversation helper
  const activeConversation = conversations.find((c) => c.id === currentConversationId) || null;

  // Start a new blank conversation
  const startNewConversation = (model: ModelId = 'gemini-2.5-flash', systemPrompt?: string) => {
    const newConv: Conversation = {
      id: Math.random().toString(36).substring(7),
      title: 'New Chat',
      messages: [],
      model,
      systemPrompt,
      createdAt: Date.now(),
    };

    const updated = [newConv, ...conversations];
    setConversations(updated);
    setCurrentConversationId(newConv.id);
    saveConversations(updated);
    saveCurrentId(newConv.id);
    return newConv.id;
  };

  // Switch between conversations
  const selectConversation = (id: string) => {
    setCurrentConversationId(id);
    saveCurrentId(id);
  };

  // Delete a conversation
  const deleteConversation = (id: string) => {
    if (currentConversationId === id) {
      // If active conversation is being deleted, cancel stream and find fallback
      cancelCurrentResponse();
    }

    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    saveConversations(updated);

    if (currentConversationId === id) {
      if (updated.length > 0) {
        setCurrentConversationId(updated[0].id);
        saveCurrentId(updated[0].id);
      } else {
        setCurrentConversationId(null);
        saveCurrentId(null);
      }
    }
  };

  // Modify active conversation properties
  const updateSystemPrompt = (id: string, prompt: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return { ...c, systemPrompt: prompt };
        }
        return c;
      });
      saveConversations(updated);
      return updated;
    });
  };

  const updateModel = (id: string, model: ModelId) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          return { ...c, model };
        }
        return c;
      });
      saveConversations(updated);
      return updated;
    });
  };

  // Clear all chats
  const clearAllConversations = async () => {
    cancelCurrentResponse();
    setConversations([]);
    setCurrentConversationId(null);
    await AsyncStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
    await AsyncStorage.removeItem(CURRENT_CONV_STORAGE_KEY);
  };

  // Cancel currently running stream
  const cancelCurrentResponse = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.close();
      activeStreamRef.current = null;
    }
    setIsStreaming(false);

    // Turn off streaming state of the message in the current conversation
    if (currentConversationId) {
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === currentConversationId) {
            const messages = c.messages.map((m) => {
              if (m.isStreaming) {
                return { ...m, isStreaming: false };
              }
              return m;
            });
            return { ...c, messages };
          }
          return c;
        });
        saveConversations(updated);
        return updated;
      });
    }
  };

  // Send a user message
  const sendMessage = async (text: string, fallbackModel?: ModelId, fallbackSystemPrompt?: string) => {
    if (!text.trim() || isStreaming) return;

    let activeId = currentConversationId;
    let currentConvModel: ModelId = fallbackModel || 'gemini-2.5-flash';
    let currentConvSysPrompt: string | undefined = fallbackSystemPrompt;

    // Auto-create a conversation if none exists
    if (!activeId) {
      activeId = startNewConversation(fallbackModel, fallbackSystemPrompt);
    } else {
      const existingConv = conversations.find(c => c.id === activeId);
      if (existingConv) {
        currentConvModel = existingConv.model;
        currentConvSysPrompt = existingConv.systemPrompt;
      }
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const assistantMessageId = Math.random().toString(36).substring(7);
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 10,
      isStreaming: true,
    };

    // Update state to include user's message and typing placeholder
    let isFirstMessage = false;

    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === activeId) {
          isFirstMessage = c.messages.length === 0;

          const newMessages = [...c.messages, userMessage, assistantMessage];
          const newTitle = isFirstMessage ? generateTitle(text) : c.title;

          return {
            ...c,
            title: newTitle,
            messages: newMessages,
          };
        }
        return c;
      });

      saveConversations(updated);
      return updated;
    });

    setIsStreaming(true);

    // Get current conversation context (excluding the placeholder assistant message)
    const activeConvInstance = conversations.find((c) => c.id === activeId);
    const contextMessages = activeConvInstance
      ? [...activeConvInstance.messages.map((m) => ({ role: m.role, content: m.content })), { role: userMessage.role, content: userMessage.content }]
      : [{ role: userMessage.role, content: userMessage.content }];

    // Filter and map messages for Gemini: role mapping from assistant to model
    const apiMessages = contextMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        content: m.content,
      }));

    let accumulatedText = '';

    const streamFunc = isClaudeModel(currentConvModel) ? streamClaudeChat : streamGeminiChat;
    const keyToUse = isClaudeModel(currentConvModel) ? claudeApiKey : apiKey;

    const stream = streamFunc({
      apiKey: keyToUse,
      model: currentConvModel,
      messages: apiMessages,
      systemPrompt: currentConvSysPrompt,
      onChunk: (chunk) => {
        accumulatedText += chunk;
        setConversations((prev) => {
          const updated = prev.map((c) => {
            if (c.id === activeId) {
              const messages = c.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return { ...m, content: accumulatedText };
                }
                return m;
              });
              return { ...c, messages };
            }
            return c;
          });
          return updated;
        });
      },
      onComplete: () => {
        setConversations((prev) => {
          const updated = prev.map((c) => {
            if (c.id === activeId) {
              const messages = c.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return { ...m, isStreaming: false };
                }
                return m;
              });
              return { ...c, messages };
            }
            return c;
          });
          saveConversations(updated);
          return updated;
        });
        setIsStreaming(false);
        activeStreamRef.current = null;
      },
      onError: (errorMsg) => {
        setConversations((prev) => {
          const updated = prev.map((c) => {
            if (c.id === activeId) {
              const messages = c.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return {
                    ...m,
                    content: accumulatedText || errorMsg,
                    isStreaming: false,
                    error: !accumulatedText, // If no text has arrived yet, mark as full error
                  };
                }
                return m;
              });
              return { ...c, messages };
            }
            return c;
          });
          saveConversations(updated);
          return updated;
        });
        setIsStreaming(false);
        activeStreamRef.current = null;
      },
    });

    activeStreamRef.current = stream;
  };

  const generateTitle = (text: string) => {
    const cleanText = text.trim();
    if (cleanText.length <= 25) return cleanText;
    return cleanText.substring(0, 22) + '...';
  };

  return {
    conversations,
    activeConversation,
    currentConversationId,
    isStreaming,
    apiKey,
    claudeApiKey,
    loading,
    saveApiKey,
    saveClaudeApiKey,
    sendMessage,
    startNewConversation,
    deleteConversation,
    selectConversation,
    updateSystemPrompt,
    updateModel,
    clearAllConversations,
    cancelCurrentResponse,
  };
}
