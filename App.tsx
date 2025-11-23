import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import EpubReaderWithTTS from './components/EpubReaderWithTTS';

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
  const [viewingEpub, setViewingEpub] = useState<FileInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageChangeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved files on app start
  useEffect(() => {
    loadAndSyncFiles();
  }, []);

  const loadAndSyncFiles = async () => {
    try {
      // Load saved file list from AsyncStorage
      const savedFiles = await AsyncStorage.getItem('uploadedFiles');
      let fileList: FileInfo[] = savedFiles ? JSON.parse(savedFiles) : [];

      // Scan the document directory for actual files
      const dirFiles = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      const pdfEpubFiles = dirFiles.filter(
        file => file.name.endsWith('.pdf') || file.name.endsWith('.epub')
      );

      // Rebuild file list from actual files
      const rebuiltFiles: FileInfo[] = [];
      for (const file of pdfEpubFiles) {
        // Check if file is already in saved list
        const existingFile = fileList.find(f => f.name === file.name);
        if (existingFile) {
          rebuiltFiles.push(existingFile);
        } else {
          // Add new file that wasn't in the list
          const fileType = file.name.endsWith('.pdf') 
            ? 'application/pdf' 
            : 'application/epub+zip';
          rebuiltFiles.push({
            uri: `file://${file.path}`,
            name: file.name,
            size: file.size,
            type: fileType,
          });
        }
      }

      // Update state and storage
      setUploadedFiles(rebuiltFiles);
      await saveFilesToStorage(rebuiltFiles);
    } catch (error) {
      console.error('Error loading and syncing files:', error);
    }
  };

  const saveFilesToStorage = async (files: FileInfo[]) => {
    try {
      await AsyncStorage.setItem('uploadedFiles', JSON.stringify(files));
    } catch (error) {
      console.error('Error saving files:', error);
    }
  };

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

  const uploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select a file first');
      return;
    }

    try {
      let fileName = selectedFile.name;
      let destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      // Check if this file is already uploaded (same URI)
      const alreadyUploaded = uploadedFiles.some(f => f.uri === selectedFile.uri);
      if (alreadyUploaded) {
        Alert.alert('Already Uploaded', 'This file is already in your library');
        setSelectedFile(null);
        return;
      }
      
      // Check if file already exists
      const fileExists = await RNFS.exists(destPath);
      if (fileExists) {
        // Ask user what to do
        Alert.alert(
          'File Exists',
          `"${fileName}" already exists. What would you like to do?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: async () => {
                try {
                  // Delete old file if it exists
                  const oldFileExists = await RNFS.exists(destPath);
                  if (oldFileExists) {
                    await RNFS.unlink(destPath);
                  }
                  
                  // Copy new file
                  await RNFS.copyFile(selectedFile.uri, destPath);
                  
                  // Update in list
                  const existingIndex = uploadedFiles.findIndex(f => f.name === fileName);
                  const localFile: FileInfo = {
                    ...selectedFile,
                    uri: `file://${destPath}`,
                  };
                  
                  const updatedFiles = [...uploadedFiles];
                  if (existingIndex >= 0) {
                    updatedFiles[existingIndex] = localFile;
                  } else {
                    updatedFiles.push(localFile);
                  }
                  
                  setUploadedFiles(updatedFiles);
                  await saveFilesToStorage(updatedFiles);
                  Alert.alert('Success', 'File replaced successfully');
                  setSelectedFile(null);
                } catch (error) {
                  console.error('Error replacing file:', error);
                  Alert.alert('Error', 'Failed to replace file');
                }
              },
            },
            {
              text: 'Keep Both',
              onPress: async () => {
                try {
                  // Add timestamp to filename
                  const timestamp = Date.now();
                  const nameParts = fileName.split('.');
                  const extension = nameParts.pop();
                  const baseName = nameParts.join('.');
                  fileName = `${baseName}_${timestamp}.${extension}`;
                  destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
                  
                  // Copy the file with new name
                  await RNFS.copyFile(selectedFile.uri, destPath);
                  
                  const localFile: FileInfo = {
                    ...selectedFile,
                    name: fileName,
                    uri: `file://${destPath}`,
                  };
                  
                  const updatedFiles = [...uploadedFiles, localFile];
                  setUploadedFiles(updatedFiles);
                  await saveFilesToStorage(updatedFiles);
                  Alert.alert('Success', `File saved as: ${fileName}`);
                  setSelectedFile(null);
                } catch (error) {
                  console.error('Error saving file:', error);
                  Alert.alert('Error', 'Failed to save file');
                }
              },
            },
          ]
        );
        return;
      }

      // Copy the file (no conflict)
      await RNFS.copyFile(selectedFile.uri, destPath);

      // Create new file info with local path
      const localFile: FileInfo = {
        ...selectedFile,
        uri: `file://${destPath}`,
      };

      // Add to uploaded files and save
      const updatedFiles = [...uploadedFiles, localFile];
      setUploadedFiles(updatedFiles);
      await saveFilesToStorage(updatedFiles);

      Alert.alert('Success', `File saved offline: ${selectedFile.name}`);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to save file for offline access');
    }
  };

  const viewFile = async (file: FileInfo) => {
    if (file.type === 'application/pdf') {
      // Load saved page for this PDF
      const savedPage = await loadPdfPage(file.uri);
      setCurrentPage(savedPage);
      setViewingFile(file);
    } else {
      // Open EPUB with native reader (now has TTS!)
      try {
        await EpubReader.openEpub(file.uri);
      } catch (error) {
        console.error('Error opening EPUB:', error);
        Alert.alert('Error', 'Failed to open EPUB file');
      }
    }
  };

  const closeViewer = async () => {
    // Clear any pending timer
    if (pageChangeTimerRef.current) {
      clearTimeout(pageChangeTimerRef.current);
    }
    // Save current page before closing
    if (viewingFile) {
      await savePdfPage(viewingFile.uri, currentPage);
    }
    setViewingFile(null);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    // Update state immediately for smooth scrolling
    setCurrentPage(page);
    
    // Debounce saving to storage
    if (pageChangeTimerRef.current) {
      clearTimeout(pageChangeTimerRef.current);
    }
    
    pageChangeTimerRef.current = setTimeout(() => {
      if (viewingFile) {
        savePdfPage(viewingFile.uri, page);
      }
    }, 1000); // Save after 1 second of no page changes
  };

  const loadPdfPage = async (uri: string): Promise<number> => {
    try {
      const key = `pdf_page_${uri}`;
      const savedPage = await AsyncStorage.getItem(key);
      return savedPage ? parseInt(savedPage, 10) : 1;
    } catch (error) {
      console.error('Error loading PDF page:', error);
      return 1;
    }
  };

  const savePdfPage = async (uri: string, page: number) => {
    try {
      const key = `pdf_page_${uri}`;
      await AsyncStorage.setItem(key, page.toString());
    } catch (error) {
      console.error('Error saving PDF page:', error);
    }
  };

  const deleteFile = async (file: FileInfo, index: number) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete physical file
              const filePath = file.uri.replace('file://', '');
              const fileExists = await RNFS.exists(filePath);
              if (fileExists) {
                await RNFS.unlink(filePath);
              }

              // Remove from list
              const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
              setUploadedFiles(updatedFiles);
              await saveFilesToStorage(updatedFiles);

              Alert.alert('Success', 'File deleted');
            } catch (error) {
              console.error('Error deleting file:', error);
              Alert.alert('Error', 'Failed to delete file');
            }
          },
        },
      ]
    );
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
              <Text style={styles.uploadedTitle}>
                My Library ({uploadedFiles.length} files)
              </Text>
              <Text style={styles.offlineNote}>
                📥 Available offline
              </Text>
              {uploadedFiles.map((file, index) => (
                <View key={index} style={styles.uploadedFileItem}>
                  <TouchableOpacity
                    style={styles.fileItemContent}
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
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteFile(file, index)}>
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* PDF Viewer Modal */}
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
            page={currentPage}
            style={styles.pdfViewer}
            trustAllCerts={false}
            onLoadComplete={(numberOfPages) => {
              console.log(`PDF loaded with ${numberOfPages} pages`);
            }}
            onPageChanged={(page) => {
              handlePageChange(page);
            }}
            onError={(error) => {
              console.error('PDF Error:', error);
              Alert.alert('Error', 'Failed to load PDF');
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* EPUB Viewer with TTS Modal */}
      <Modal
        visible={viewingEpub !== null}
        animationType="slide"
        onRequestClose={() => setViewingEpub(null)}>
        {viewingEpub && (
          <EpubReaderWithTTS
            epubPath={viewingEpub.uri}
            onClose={() => setViewingEpub(null)}
          />
        )}
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
    marginBottom: 4,
  },
  offlineNote: {
    fontSize: 14,
    color: '#34C759',
    marginBottom: 12,
    fontWeight: '500',
  },
  uploadedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    overflow: 'hidden',
  },
  fileItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
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
