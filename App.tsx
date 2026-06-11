import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  StatusBar,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useStreamingChat } from './src/hooks/useStreamingChat';
import { ChatBubble } from './src/components/ChatBubble';
import { AVAILABLE_MODELS, ModelId, isClaudeModel } from './src/types/chat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 300);

export default function App() {
  const {
    conversations,
    activeConversation,
    currentConversationId,
    isStreaming,
    apiKey,
    claudeApiKey,

    saveApiKey,
    saveClaudeApiKey,
    loading,
    sendMessage,
    startNewConversation,
    deleteConversation,
    selectConversation,
    updateSystemPrompt,
    updateModel,
    clearAllConversations,
    cancelCurrentResponse,
  } = useStreamingChat();

  const [inputMessage, setInputMessage] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings Form States
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempClaudeApiKey, setTempClaudeApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showClaudeApiKey, setShowClaudeApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>('gemini-2.5-flash');
  const [systemPromptText, setSystemPromptText] = useState('');

  // Refs
  const flatListRef = useRef<FlatList>(null);

  // Drawer sliding animation
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacityAnim = useRef(new Animated.Value(0)).current;

  // Initialize Settings Form when active conversation changes
  useEffect(() => {
    setTempApiKey(apiKey);
    setTempClaudeApiKey(claudeApiKey);
  }, [apiKey, claudeApiKey]);
  useEffect(() => {
    if (activeConversation) {
      setSelectedModel(activeConversation.model);
      setSystemPromptText(activeConversation.systemPrompt || '');
    }
  }, [activeConversation]);

// Open/Close Drawer Animations
const toggleDrawer = (open: boolean) => {
  if (open) {
    setIsDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  } else {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacityAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDrawerOpen(false);
    });
  }
};

// Auto scroll to bottom of flatlist when messages count or text updates
const scrollToBottom = () => {
  if (flatListRef.current) {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }
};

useEffect(() => {
  if (activeConversation?.messages) {
    scrollToBottom();
  }
}, [activeConversation?.messages]);

// Handle Send action
const handleSend = () => {
  if (!inputMessage.trim()) return;
  Keyboard.dismiss();
  const messageText = inputMessage;
  setInputMessage('');
  sendMessage(messageText, selectedModel, systemPromptText);
};

// Open Settings Modal
const openSettings = () => {
  setTempApiKey(apiKey);
  setTempClaudeApiKey(claudeApiKey);
  if (activeConversation) {
    setSelectedModel(activeConversation.model);
    setSystemPromptText(activeConversation.systemPrompt || '');
  }
  setIsSettingsOpen(true);
};

// Save Settings Changes
const handleSaveSettings = async () => {
  await saveApiKey(tempApiKey);
  await saveClaudeApiKey(tempClaudeApiKey);
  if (currentConversationId) {
    updateModel(currentConversationId, selectedModel);
    updateSystemPrompt(currentConversationId, systemPromptText);
  }
  setIsSettingsOpen(false);
};

// Starter Prompts array for empty chat
const STARTER_PROMPTS = [
  {
    title: '💻 Code React Hook',
    prompt: 'Write a custom React hook in TypeScript to track network connection status.',
  },
  {
    title: '🧬 Quantum Computing',
    prompt: 'Explain quantum computing to a 10-year-old using analogy of a spinning coin.',
  },
  {
    title: '📧 Refine Professional Email',
    prompt: 'Draft a polite and concise email asking a project manager for an extension on a deadline.',
  },
];

if (loading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.loadingText}>Initializing Workspace...</Text>
    </View>
  );
}

const activeModel = activeConversation?.model || selectedModel;
const isClaude = isClaudeModel(activeModel);
const isMissingKey = isClaude ? !claudeApiKey : !apiKey;
const missingKeyProviderName = isClaude ? 'Anthropic Claude' : 'Google Gemini';

return (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" backgroundColor="#090d16" />

    {/* Drawer Overlay */}
    {isDrawerOpen && (
      <Animated.View style={[styles.drawerOverlay, { opacity: overlayOpacityAnim }]}>
        <TouchableOpacity
          style={styles.overlayClickTarget}
          activeOpacity={1}
          onPress={() => toggleDrawer(false)}
        />
      </Animated.View>
    )}

    {/* Drawer Container */}
    <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: drawerAnim }] }]}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerHeaderTitle}>History</Text>
        <TouchableOpacity
          onPress={() => {
            startNewConversation(selectedModel, systemPromptText);
            toggleDrawer(false);
          }}
          style={styles.newChatButton}
        >
          <Text style={styles.newChatButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isActive = item.id === currentConversationId;
          const modelName = AVAILABLE_MODELS.find(m => m.id === item.model)?.name || 'Gemini';
          return (
            <View style={[styles.drawerItemContainer, isActive && styles.activeDrawerItemContainer]}>
              <TouchableOpacity
                style={styles.drawerItemButton}
                onPress={() => {
                  selectConversation(item.id);
                  toggleDrawer(false);
                }}
              >
                <Text numberOfLines={1} style={[styles.drawerItemText, isActive && styles.activeDrawerItemText]}>
                  {item.title || 'New Chat'}
                </Text>
                <Text style={styles.drawerItemSubtext}>{modelName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteChatItemButton}
                onPress={() => deleteConversation(item.id)}
              >
                <Text style={styles.deleteChatItemText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyDrawer}>
            <Text style={styles.emptyDrawerText}>No chat history yet.</Text>
          </View>
        }
      />

      <View style={styles.drawerFooter}>
        <TouchableOpacity
          onPress={() => {
            clearAllConversations();
            toggleDrawer(false);
          }}
          style={styles.clearAllButton}
        >
          <Text style={styles.clearAllButtonText}>Clear All Chats</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>

    {/* Main Container */}
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => toggleDrawer(true)} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>☰</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {activeConversation ? activeConversation.title : 'AI Workspace'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {AVAILABLE_MODELS.find((m) => m.id === activeModel)?.name}
          </Text>
        </View>

        <TouchableOpacity onPress={openSettings} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Warning Banner if API Key is missing */}
      {isMissingKey && (
        <TouchableOpacity style={styles.warningBanner} onPress={openSettings}>
          <Text style={styles.warningBannerText}>
            ⚠️ {missingKeyProviderName} API Key Required. Tap here to configure.
          </Text>
        </TouchableOpacity>
      )}

      {/* Chat Feed */}
      <View style={styles.feedContainer}>
        {activeConversation && activeConversation.messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={activeConversation.messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.feedContent}
            renderItem={({ item }) => <ChatBubble message={item} />}
            onContentSizeChange={scrollToBottom}
          />
        ) : (
          /* Welcome Landing Screen */
          <FlatList
            data={[]}
            renderItem={() => null}
            ListHeaderComponent={
              <View style={styles.welcomeContainer}>
                <View style={styles.avatarOrb}>
                  <Text style={styles.orbEmoji}>✨</Text>
                </View>
                <Text style={styles.welcomeTitle}>AI Workspace</Text>
                <Text style={styles.welcomeSubtitle}>
                  Powered by Google Gemini and Anthropic Claude. Stream answers, format complex code blocks, and persist chat histories locally.
                </Text>

                <View style={styles.promptList}>
                  <Text style={styles.promptListHeader}>Getting Started Suggestions</Text>
                  {STARTER_PROMPTS.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.promptCard}
                      onPress={() => {
                        // Auto create conversation if none selected
                        if (!currentConversationId) {
                          startNewConversation(selectedModel, systemPromptText);
                        }
                        setInputMessage(item.prompt);
                      }}
                    >
                      <Text style={styles.promptCardTitle}>{item.title}</Text>
                      <Text numberOfLines={2} style={styles.promptCardBody}>
                        "{item.prompt}"
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
          />
        )}
      </View>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, isMissingKey && { opacity: 0.5 }]}
          placeholder={isMissingKey ? `API key required for ${missingKeyProviderName}` : isStreaming ? "AI is streaming..." : "Type your message..."}
          placeholderTextColor="#64748b"
          value={inputMessage}
          onChangeText={setInputMessage}
          editable={!isStreaming && !isMissingKey}
          multiline
          maxLength={1000}
        />
        {isStreaming ? (
          <TouchableOpacity onPress={cancelCurrentResponse} style={styles.stopButton}>
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendButton, (!inputMessage.trim() || isMissingKey) && styles.sendButtonDisabled]}
            disabled={!inputMessage.trim() || isMissingKey}
          >
            <Text style={styles.sendIcon}>➔</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>

    {/* Settings Modal */}
    <Modal visible={isSettingsOpen} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
              <Text style={styles.closeModalButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={[]}
            renderItem={() => null}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.modalBody}>
                {/* API Key inputs */}
                <Text style={styles.label}>Google Gemini API Key</Text>
                <Text style={[styles.hint, { marginTop: 4, marginBottom: 8 }]}>
                  Get a free API key at: aistudio.google.com
                </Text>
                <View style={styles.apiKeyInputContainer}>
                  <TextInput
                    style={styles.apiKeyInput}
                    placeholder="AIzaSy..."
                    placeholderTextColor="#64748b"
                    value={tempApiKey}
                    onChangeText={setTempApiKey}
                    secureTextEntry={!showApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowApiKey(!showApiKey)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeIcon}>{showApiKey ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 15 }]}>Anthropic Claude API Key</Text>
                <Text style={[styles.hint, { marginTop: 4, marginBottom: 8 }]}>
                  Get a free API key at: console.anthropic.com
                </Text>
                <View style={styles.apiKeyInputContainer}>
                  <TextInput
                    style={styles.apiKeyInput}
                    placeholder="sk-ant-..."
                    placeholderTextColor="#64748b"
                    value={tempClaudeApiKey}
                    onChangeText={setTempClaudeApiKey}
                    secureTextEntry={!showClaudeApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowClaudeApiKey(!showClaudeApiKey)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeIcon}>{showClaudeApiKey ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.hint}>
                  Your keys are strictly saved locally on this device and are only sent directly to Google/Anthropic endpoints.
                </Text>

                {/* Model Selector */}
                <Text style={[styles.label, { marginTop: 20 }]}>Select AI Model</Text>
                {AVAILABLE_MODELS.map((model) => {
                  const isSel = selectedModel === model.id;

                  return (
                    <TouchableOpacity
                      key={model.id}
                      onPress={() => setSelectedModel(model.id)}
                      style={[styles.modelCard, isSel && styles.modelCardSelected]}
                    >
                      <View style={styles.modelHeaderRow}>
                        <Text style={[styles.modelCardName, isSel && styles.modelCardNameSelected]}>
                          {model.name}
                        </Text>
                        {isSel && <View style={styles.selectionDot} />}
                      </View>
                      <Text style={styles.modelCardDesc}>{model.description}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* System Prompt input */}
                <Text style={[styles.label, { marginTop: 20 }]}>System Instructions (Optional)</Text>
                <TextInput
                  style={styles.systemPromptInput}
                  placeholder="E.g., You are an expert backend engineer..."
                  placeholderTextColor="#64748b"
                  value={systemPromptText}
                  onChangeText={setSystemPromptText}
                  multiline
                  numberOfLines={4}
                />
                <Text style={styles.hint}>
                  Sets general assistant personas, style preferences, and boundary constraints.
                </Text>
              </View>
            }
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={handleSaveSettings} style={styles.saveSettingsButton}>
              <Text style={styles.saveSettingsButtonText}>Save Configuration</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16', // Premium very dark blue/slate
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090d16',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  // Header styles
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  iconButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  iconButtonText: {
    color: '#e2e8f0',
    fontSize: 18,
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#818cf8', // Indigo light
    fontSize: 10,
    marginTop: 1,
  },
  // Warning Banner
  warningBanner: {
    backgroundColor: '#451a03', // Warm yellow/brown dark warning
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#78350f',
    alignItems: 'center',
  },
  warningBannerText: {
    color: '#fcd34d',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Feed Layout
  feedContainer: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    paddingBottom: 24,
  },
  // Welcome screen elements
  welcomeContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  avatarOrb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // Glassmorphic translucent indigo
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  orbEmoji: {
    fontSize: 28,
  },
  welcomeTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 18,
  },
  welcomeSubtitle: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  promptList: {
    width: '100%',
    marginTop: 36,
  },
  promptListHeader: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  promptCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    width: '100%',
  },
  promptCardTitle: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptCardBody: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  // Input container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    minHeight: 38,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  stopButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  // Sidebar/Drawer Styles
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 999,
  },
  overlayClickTarget: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0f172a',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    zIndex: 1000,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  drawerHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newChatButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  newChatButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  drawerItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
    paddingRight: 6,
  },
  activeDrawerItemContainer: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  drawerItemButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  drawerItemText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '400',
  },
  activeDrawerItemText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  drawerItemSubtext: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
  deleteChatItemButton: {
    padding: 10,
  },
  deleteChatItemText: {
    color: '#475569',
    fontSize: 12,
  },
  emptyDrawer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyDrawerText: {
    color: '#475569',
    fontSize: 12,
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  clearAllButton: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearAllButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal/Settings Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    minHeight: '60%',
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeModalButton: {
    color: '#94a3b8',
    fontSize: 16,
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  apiKeyInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  apiKeyInput: {
    flex: 1,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  eyeButton: {
    padding: 8,
  },
  eyeIcon: {
    fontSize: 14,
  },
  hint: {
    color: '#64748b',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  modelCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  modelCardSelected: {
    borderColor: '#4f46e5',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  modelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  modelCardName: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modelCardNameSelected: {
    color: '#ffffff',
  },
  selectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818cf8',
  },
  modelCardDesc: {
    color: '#64748b',
    fontSize: 11,
  },
  systemPromptInput: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 80,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  saveSettingsButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveSettingsButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
