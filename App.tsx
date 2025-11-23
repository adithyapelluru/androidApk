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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';

const { DocumentPicker, EpubReader } = NativeModules;



interface FileInfo {
  uri: string;
  name: string;
  size: number;
  type: string;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [viewingFile, setViewingFile] = useState<FileInfo | null>(null);

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
    // Store file locally for offline access
    setUploadedFiles([...uploadedFiles, selectedFile]);
    Alert.alert('Success', `File uploaded: ${selectedFile.name}`);
    setSelectedFile(null);
  };

  const viewFile = async (file: FileInfo) => {
    if (file.type === 'application/pdf') {
      setViewingFile(file);
    } else {
      // Open EPUB with native reader
      try {
        await EpubReader.openEpub(file.uri);
      } catch (error) {
        console.error('Error opening EPUB:', error);
        Alert.alert('Error', 'Failed to open EPUB file');
      }
    }
  };

  const closeViewer = () => {
    setViewingFile(null);
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
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => viewFile(selectedFile)}>
                <Text style={styles.viewButtonText}>👁️ View File</Text>
              </TouchableOpacity>
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

          {uploadedFiles.length > 0 && (
            <View style={styles.uploadedSection}>
              <Text style={styles.uploadedTitle}>Uploaded Files:</Text>
              {uploadedFiles.map((file, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.uploadedFileItem}
                  onPress={() => viewFile(file)}>
                  <Text style={styles.uploadedFileIcon}>
                    {file.type === 'application/pdf' ? '📄' : '📚'}
                  </Text>
                  <View style={styles.uploadedFileInfo}>
                    <Text style={styles.uploadedFileName}>{file.name}</Text>
                    <Text style={styles.uploadedFileSize}>
                      {(file.size / 1024).toFixed(2)} KB
                    </Text>
                  </View>
                  <Text style={styles.viewIcon}>👁️</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* PDF/EPUB Viewer Modal */}
      <Modal
        visible={viewingFile !== null}
        animationType="slide"
        onRequestClose={closeViewer}>
        <SafeAreaView style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {viewingFile?.name}
            </Text>
            <TouchableOpacity onPress={closeViewer} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <Pdf
            source={{ uri: viewingFile?.uri || '' }}
            style={styles.pdfViewer}
            trustAllCerts={false}
            onLoadComplete={(numberOfPages) => {
              console.log(`PDF loaded with ${numberOfPages} pages`);
            }}
            onError={(error) => {
              console.error('PDF Error:', error);
              Alert.alert('Error', 'Failed to load PDF');
            }}
          />
        </SafeAreaView>
      </Modal>
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
  uploadedSection: {
    marginTop: 20,
  },
  uploadedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  uploadedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  uploadedFileIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  uploadedFileInfo: {
    flex: 1,
  },
  uploadedFileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  uploadedFileSize: {
    fontSize: 14,
    color: '#666',
  },
  viewIcon: {
    fontSize: 24,
    marginLeft: 8,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#007AFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  viewerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 12,
  },
  closeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pdfViewer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  viewButton: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
