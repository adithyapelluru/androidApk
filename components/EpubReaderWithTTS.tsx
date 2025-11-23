import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Tts from 'react-native-tts';
import RNFS from 'react-native-fs';

interface EpubReaderWithTTSProps {
  epubPath: string;
  onClose: () => void;
}

const EpubReaderWithTTS: React.FC<EpubReaderWithTTSProps> = ({
  epubPath,
  onClose,
}) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.5);
  const [currentText, setCurrentText] = useState('');
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    loadEpub();
    initializeTTS();

    return () => {
      Tts.stop();
    };
  }, []);

  const initializeTTS = async () => {
    try {
      console.log('🎤 Initializing TTS...');
      await Tts.setDefaultLanguage('en-US');
      await Tts.setDefaultRate(speechRate);
      await Tts.setDefaultPitch(1.0);

      Tts.addEventListener('tts-start', () => {
        console.log('🎙️ TTS Started');
        setIsSpeaking(true);
      });
      Tts.addEventListener('tts-finish', () => {
        console.log('✅ TTS Finished');
        setIsSpeaking(false);
      });
      Tts.addEventListener('tts-cancel', () => {
        console.log('⏹️ TTS Cancelled');
        setIsSpeaking(false);
      });
      
      console.log('✅ TTS initialized successfully');
    } catch (error) {
      console.error('❌ TTS initialization error:', error);
    }
  };

  const loadEpub = async () => {
    try {
      const cleanPath = epubPath.replace('file://', '');
      
      // Read EPUB file (it's a ZIP)
      const exists = await RNFS.exists(cleanPath);
      if (!exists) {
        Alert.alert('Error', 'EPUB file not found');
        return;
      }

      // For now, we'll use a simple approach - extract text from the EPUB
      // In production, you'd want to properly parse the EPUB structure
      const content = await extractEpubContent(cleanPath);
      setHtmlContent(content);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading EPUB:', error);
      Alert.alert('Error', 'Failed to load EPUB file');
      setIsLoading(false);
    }
  };

  const extractEpubContent = async (path: string): Promise<string> => {
    try {
      console.log('📚 Reading EPUB file from:', path);
      
      // EPUB files are ZIP archives - we need to use the native module
      // For now, use react-native-zip-archive or similar
      // Since we don't have a ZIP library, let's use the native reader's content
      
      // Read the file as base64 and let WebView handle it
      const fileContent = await RNFS.readFile(path, 'base64');
      console.log('📦 File read, size:', fileContent.length);
      
      // For now, return a message asking to use native reader
      // We need to properly implement ZIP extraction
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: Georgia, 'Times New Roman', serif;
                line-height: 1.8;
                padding: 20px;
                padding-bottom: 100px;
                font-size: 18px;
                background: #faf8f5;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
              }
              p { margin-bottom: 1em; text-align: justify; }
              h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
              .tts-highlight {
                background-color: #FFD700;
                padding: 2px 4px;
                border-radius: 3px;
              }
              .info-box {
                background: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 16px;
                margin: 20px 0;
                border-radius: 4px;
              }
            </style>
          </head>
          <body id="content">
            <h1>EPUB Reader with TTS</h1>
            <div class="info-box">
              <p><strong>Note:</strong> Full EPUB parsing requires additional libraries.</p>
              <p>The native reader displays EPUB content correctly.</p>
            </div>
            <h2>Sample Text for TTS Demo</h2>
            <p>This is a demonstration of the Text-to-Speech feature. In a production app, this would display the actual EPUB content extracted from the file.</p>
            <p>The EPUB file format is essentially a ZIP archive containing HTML, CSS, and images. To properly display EPUB content in React Native, we would need to:</p>
            <ul>
              <li>Extract the ZIP archive</li>
              <li>Parse the content.opf file to find the reading order</li>
              <li>Load and combine all HTML chapters</li>
              <li>Apply the book's CSS styling</li>
            </ul>
            <p>For now, you can use the native EPUB reader (without TTS) which already implements all of this functionality.</p>
            <p>Try tapping the play button below to hear this text read aloud!</p>
          </body>
        </html>
      `;
    } catch (error) {
      console.error('❌ Error reading EPUB:', error);
      return `
        <!DOCTYPE html>
        <html>
          <body>
            <h1>Error</h1>
            <p>Failed to load EPUB file: ${error}</p>
          </body>
        </html>
      `;
    }
  };

  const extractTextFromWebView = () => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          const body = document.getElementById('content');
          const text = body ? body.innerText : '';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'text',
            content: text
          }));
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: error.toString()
          }));
        }
      })();
      true;
    `);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📱 WebView Message:', data.type);
      
      if (data.type === 'text') {
        console.log('📖 Text to speak:', data.content.substring(0, 100) + '...');
        speakText(data.content);
      } else if (data.type === 'error') {
        console.error('❌ WebView Error:', data.message);
      }
    } catch (error) {
      console.error('❌ Error parsing WebView message:', error);
    }
  };

  const speakText = async (text: string) => {
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ No text to speak');
      Alert.alert('No Content', 'No text available to read');
      return;
    }

    try {
      console.log('🔊 Starting TTS...');
      console.log('📝 Text length:', text.length, 'characters');
      console.log('⚡ Speech rate:', speechRate);
      
      // Store the text being spoken
      setCurrentText(text);
      await Tts.speak(text);
      
      console.log('✅ TTS started successfully');
    } catch (error) {
      console.error('❌ TTS error:', error);
      Alert.alert('Error', 'Failed to start text-to-speech');
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      console.log('⏸️ Stopping TTS...');
      Tts.stop();
      setIsSpeaking(false);
      setCurrentText('');
    } else {
      console.log('▶️ Starting TTS - Extracting text from WebView...');
      extractTextFromWebView();
    }
  };

  const adjustSpeed = (delta: number) => {
    const newRate = Math.max(0.3, Math.min(1.5, speechRate + delta));
    console.log('⚡ Speed changed:', speechRate.toFixed(1), '→', newRate.toFixed(1));
    setSpeechRate(newRate);
    Tts.setDefaultRate(newRate);
    
    // If currently speaking, restart with new rate
    if (isSpeaking) {
      console.log('🔄 Restarting TTS with new speed...');
      Tts.stop();
      setTimeout(() => extractTextFromWebView(), 100);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading EPUB...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={onClose}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* WebView for EPUB content */}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
      />

      {/* Current Text Display */}
      {isSpeaking && currentText && (
        <View style={styles.currentTextContainer}>
          <Text style={styles.currentTextLabel}>Now Reading:</Text>
          <Text style={styles.currentText} numberOfLines={3}>
            {currentText}
          </Text>
        </View>
      )}

      {/* TTS Controls */}
      <View style={styles.ttsControls}>
        <TouchableOpacity
          style={styles.speedButton}
          onPress={() => adjustSpeed(-0.1)}>
          <Text style={styles.speedButtonText}>-</Text>
        </TouchableOpacity>

        <Text style={styles.speedText}>{speechRate.toFixed(1)}x</Text>

        <TouchableOpacity
          style={styles.speedButton}
          onPress={() => adjustSpeed(0.1)}>
          <Text style={styles.speedButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, isSpeaking && styles.playButtonActive]}
          onPress={toggleSpeech}>
          <Text style={styles.playButtonText}>
            {isSpeaking ? '⏸' : '▶'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  ttsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  speedButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  speedButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  speedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    minWidth: 50,
    textAlign: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  playButtonActive: {
    backgroundColor: '#FF3B30',
  },
  playButtonText: {
    fontSize: 28,
    color: '#fff',
  },
  currentTextContainer: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#0056b3',
  },
  currentTextLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.8,
  },
  currentText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
});

export default EpubReaderWithTTS;
