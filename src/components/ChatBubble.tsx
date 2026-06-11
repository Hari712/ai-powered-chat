import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Message } from '../types/chat';
import { TypingIndicator } from './TypingIndicator';

interface Token {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  isCode?: boolean;
}

function parseInlineText(text: string): Token[] {
  let tokens: Token[] = [{ text }];

  // 1. Parse inline code: `code`
  tokens = tokens.flatMap((token) => {
    if (token.isBold || token.isItalic || token.isCode) return [token];
    const parts = token.text.split(/(`[^`\n]+`)/g);
    return parts.map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return { text: part.slice(1, -1), isCode: true };
      }
      return { text: part };
    });
  });

  // 2. Parse bold: **bold**
  tokens = tokens.flatMap((token) => {
    if (token.isBold || token.isItalic || token.isCode) return [token];
    const parts = token.text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { text: part.slice(2, -2), isBold: true };
      }
      return { text: part };
    });
  });

  // 3. Parse italic: *italic* or _italic_
  tokens = tokens.flatMap((token) => {
    if (token.isBold || token.isItalic || token.isCode) return [token];
    const parts = token.text.split(/(\*[^*]+\*|_[^_]+_)/g);
    return parts.map((part) => {
      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        return { text: part.slice(1, -1), isItalic: true };
      }
      return { text: part };
    });
  });

  return tokens;
}

function renderInlineText(text: string, baseStyle: any, indexKey: string) {
  const tokens = parseInlineText(text);
  return tokens.map((token, idx) => {
    const key = `${indexKey}-inline-${idx}`;
    if (token.isCode) {
      return (
        <Text key={key} style={[styles.inlineCode, { color: baseStyle.color === '#ffffff' ? '#ffffff' : '#38bdf8' }]}>
          {token.text}
        </Text>
      );
    }
    if (token.isBold) {
      return (
        <Text key={key} style={[styles.bold, { color: baseStyle.color }]}>
          {token.text}
        </Text>
      );
    }
    if (token.isItalic) {
      return (
        <Text key={key} style={[styles.italic, { color: baseStyle.color }]}>
          {token.text}
        </Text>
      );
    }
    return <Text key={key} style={baseStyle}>{token.text}</Text>;
  });
}

function renderMarkdownBlock(text: string, baseStyle: any, keyPrefix: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const key = `${keyPrefix}-line-${idx}`;

    // 1. Headers: #, ##, ###
    if (line.startsWith('# ')) {
      return (
        <Text key={key} style={[styles.h1, { color: baseStyle.color }]}>
          {renderInlineText(line.slice(2), styles.h1, key)}
        </Text>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <Text key={key} style={[styles.h2, { color: baseStyle.color }]}>
          {renderInlineText(line.slice(3), styles.h2, key)}
        </Text>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <Text key={key} style={[styles.h3, { color: baseStyle.color }]}>
          {renderInlineText(line.slice(4), styles.h3, key)}
        </Text>
      );
    }

    // 2. Bullet list item: "- " or "* "
    const isBullet = line.startsWith('- ') || line.startsWith('* ');
    if (isBullet) {
      return (
        <View key={key} style={styles.listItem}>
          <Text style={[styles.listBullet, baseStyle]}>• </Text>
          <Text style={styles.listTextContainer}>
            {renderInlineText(line.slice(2), baseStyle, key)}
          </Text>
        </View>
      );
    }

    // 3. Numbered list item: e.g. "1. "
    const numListMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numListMatch) {
      const num = numListMatch[1];
      const rest = numListMatch[2];
      return (
        <View key={key} style={styles.listItem}>
          <Text style={[styles.listBullet, baseStyle]}>{num}. </Text>
          <Text style={styles.listTextContainer}>
            {renderInlineText(rest, baseStyle, key)}
          </Text>
        </View>
      );
    }

    // 4. Normal paragraph text
    if (!line.trim()) {
      // Empty line renders as a spacer if not the last line
      if (idx === lines.length - 1) return null;
      return <View key={key} style={styles.lineSpacer} />;
    }

    return (
      <Text key={key} style={[styles.paragraph, baseStyle]}>
        {renderInlineText(line, baseStyle, key)}
      </Text>
    );
  });
}

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { role, content, error, isStreaming } = message;
  const isUser = role === 'user';

  // Entry animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Copy full message content
  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
  };

  // Share full message content
  const handleShare = async () => {
    try {
      await Share.share({ message: content });
    } catch (e) {
      console.error(e);
    }
  };

  // Parse code blocks from content
  const renderContent = () => {
    if (error) {
      return <Text style={styles.errorText}>{content}</Text>;
    }

    if (isStreaming && !content.trim()) {
      return <TypingIndicator />;
    }

    // Split text by code block delimiter
    const parts = content.split('```');

    const baseStyle = isUser ? styles.userText : styles.assistantText;

    return parts.map((part, index) => {
      // Even indexes are regular text, odd indexes are code blocks
      const isCode = index % 2 !== 0;

      if (!isCode) {
        if (!part.trim() && index === parts.length - 1) return null;
        return renderMarkdownBlock(part, baseStyle, `part-${index}`);
      }

      // Process code block
      const lines = part.split('\n');
      const firstLine = lines[0].trim();
      const hasLanguage = /^[a-zA-Z0-9+#-]+$/.test(firstLine) && firstLine.length < 15;
      
      const language = hasLanguage ? firstLine : 'code';
      const codeContent = hasLanguage ? lines.slice(1).join('\n') : lines.join('\n');

      const handleCopyCode = async () => {
        await Clipboard.setStringAsync(codeContent.trim());
      };

      return (
        <View key={index} style={styles.codeContainer}>
          <View style={styles.codeHeader}>
            <Text style={styles.codeLanguage}>{language.toLowerCase()}</Text>
            <TouchableOpacity onPress={handleCopyCode} style={styles.codeCopyButton}>
              <Text style={styles.codeCopyText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeText} selectable>
            {codeContent.trim()}
          </Text>
        </View>
      );
    });
  };

  return (
    <Animated.View
      style={[
        styles.row,
        isUser ? styles.userRow : styles.assistantRow,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          error ? styles.errorBubble : null,
        ]}
      >
        {renderContent()}

        {/* Action bar for bubbles */}
        {content.length > 0 && !isStreaming && !error && (
          <View style={[styles.actionBar, isUser ? styles.userActionBar : styles.assistantActionBar]}>
            <TouchableOpacity onPress={handleCopy} style={styles.actionButton}>
              <Text style={styles.actionText}>Copy</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 6,
    flexDirection: 'row',
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
    paddingLeft: 40,
  },
  assistantRow: {
    justifyContent: 'flex-start',
    paddingRight: 40,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#4f46e5', // Modern Indigo 600
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1e293b', // Modern slate-800
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155', // Slate-700
  },
  errorBubble: {
    backgroundColor: '#451a1a',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  assistantText: {
    color: '#f8fafc', // Slate 50
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  errorText: {
    color: '#fca5a5', // Red 300
    fontSize: 15,
    lineHeight: 21,
  },
  // Code block styling
  codeContainer: {
    backgroundColor: '#0f172a', // Slate 900
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    width: '100%',
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  codeLanguage: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: 'bold',
  },
  codeCopyButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  codeCopyText: {
    color: '#e2e8f0',
    fontSize: 10,
  },
  codeText: {
    color: '#38bdf8', // Light sky blue monospaced content
    fontFamily: 'Courier',
    fontSize: 13,
    padding: 10,
    lineHeight: 18,
  },
  // Action bar under text
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
  },
  userActionBar: {
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'flex-end',
  },
  assistantActionBar: {
    borderTopColor: '#334155',
    justifyContent: 'flex-start',
  },
  actionButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  actionText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#334155',
    marginHorizontal: 6,
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'Courier',
    backgroundColor: '#0f172a',
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  h1: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  h2: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  h3: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 2,
  },
  paragraph: {
    marginVertical: 2,
    fontSize: 15,
    lineHeight: 21,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 6,
  },
  listBullet: {
    width: 16,
    fontSize: 15,
  },
  listTextContainer: {
    flex: 1,
  },
  lineSpacer: {
    height: 8,
  },
});
export default ChatBubble;
