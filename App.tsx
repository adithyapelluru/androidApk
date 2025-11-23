import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { DocumentPicker } = NativeModules;

interface FileInfo {
  uri: string;
  name: string;
  size: number;
  type: string;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pickDocument();
      setSelectedFile(result);
      Alert.alert('Success', `File selected: ${result.name}`);
    } catch (err: any) {
      if (err.code === 'E_PICKER_CANCELLED') {
        console.log('User cancelled file picker');
      } else {
        Alert.alert('Error', 'Failed to pick file');
        console.error(err);
      }
    }
  };

  const uploadFile = () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select a file first');
      return;
    }
    // Here you would implement your upload logic
    Alert.alert('Upload', `Ready to upload: ${selectedFile.name}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>File Upload</Text>
          <Text style={styles.subtitle}>Select and upload your files</Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity style={styles.button} onPress={pickDocument}>
            <Text style={styles.buttonText}>📁 Select PDF/EPUB</Text>
          </TouchableOpacity>

          {selectedFile && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileInfoTitle}>Selected File:</Text>
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>
                  {selectedFile.type === 'application/pdf' ? '📄' : '📚'}
                </Text>
              </View>
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <Text style={styles.fileDetails}>
                Size: {(selectedFile.size / 1024).toFixed(2)} KB
              </Text>
              <Text style={styles.fileDetails}>
                Type: {selectedFile.type === 'application/pdf' ? 'PDF' : 'EPUB'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.uploadButton,
              !selectedFile && styles.buttonDisabled,
            ]}
            onPress={uploadFile}
            disabled={!selectedFile}>
            <Text style={styles.buttonText}>⬆️ Upload File</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  uploadButton: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fileInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  fileInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  fileName: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 8,
    fontWeight: '500',
  },
  fileDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  fileIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  fileIconText: {
    fontSize: 64,
  },
});

export default App;
