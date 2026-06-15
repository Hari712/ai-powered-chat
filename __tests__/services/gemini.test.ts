import { streamGeminiChat } from '../../src/services/gemini';
import { ModelId } from '../../src/types/chat';

// Mock react-native-sse
jest.mock('react-native-sse', () => {
  return jest.fn().mockImplementation(() => {
    return {
      addEventListener: jest.fn(),
      close: jest.fn(),
    };
  });
});

describe('gemini service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streamGeminiChat handles missing API key correctly', () => {
    const onErrorMock = jest.fn();
    const result = streamGeminiChat({
      apiKey: '',
      model: 'gemini-2.5-flash' as ModelId,
      messages: [{ role: 'user', content: 'hello' }],
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: onErrorMock,
    });

    expect(onErrorMock).toHaveBeenCalledWith('Google Gemini API Key is missing. Please set it in Settings.');
    expect(result.close).toBeDefined();
  });
});
