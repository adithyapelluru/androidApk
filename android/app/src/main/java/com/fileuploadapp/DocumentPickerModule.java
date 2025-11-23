package com.fileuploadapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import android.util.Base64;

public class DocumentPickerModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final int PICK_DOCUMENT_REQUEST = 1;
    private Promise mPromise;

    public DocumentPickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
    }

    @Override
    public String getName() {
        return "DocumentPicker";
    }

    @ReactMethod
    public void pickDocument(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist");
            return;
        }

        mPromise = promise;

        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        String[] mimeTypes = {"application/pdf", "application/epub+zip"};
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
        intent.addCategory(Intent.CATEGORY_OPENABLE);

        currentActivity.startActivityForResult(intent, PICK_DOCUMENT_REQUEST);
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_DOCUMENT_REQUEST) {
            if (mPromise != null) {
                if (resultCode == Activity.RESULT_CANCELED) {
                    mPromise.reject("E_PICKER_CANCELLED", "User cancelled");
                } else if (resultCode == Activity.RESULT_OK) {
                    Uri uri = data.getData();
                    if (uri != null) {
                        try {
                            WritableMap fileData = Arguments.createMap();
                            
                            Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null);
                            String name = "document";
                            long size = 0;
                            String type = "unknown";
                            
                            if (cursor != null && cursor.moveToFirst()) {
                                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                                
                                name = cursor.getString(nameIndex);
                                size = cursor.getLong(sizeIndex);
                                type = activity.getContentResolver().getType(uri);
                                
                                cursor.close();
                            }
                            
                            // Copy file to internal storage
                            File filesDir = activity.getFilesDir();
                            File destFile = new File(filesDir, name);
                            
                            InputStream inputStream = activity.getContentResolver().openInputStream(uri);
                            OutputStream outputStream = new FileOutputStream(destFile);
                            
                            byte[] buffer = new byte[4096];
                            int length;
                            while ((length = inputStream.read(buffer)) > 0) {
                                outputStream.write(buffer, 0, length);
                            }
                            
                            outputStream.flush();
                            outputStream.close();
                            inputStream.close();
                            
                            // Return file:// URI instead of content://
                            fileData.putString("uri", "file://" + destFile.getAbsolutePath());
                            fileData.putString("name", name);
                            fileData.putDouble("size", size);
                            fileData.putString("type", type != null ? type : "unknown");
                            
                            mPromise.resolve(fileData);
                        } catch (Exception e) {
                            mPromise.reject("E_FILE_COPY_ERROR", "Failed to copy file: " + e.getMessage());
                        }
                    } else {
                        mPromise.reject("E_NO_FILE_SELECTED", "No file selected");
                    }
                }
                mPromise = null;
            }
        }
    }

    @ReactMethod
    public void readFileAsBase64(String filePath, Promise promise) {
        try {
            File file = new File(filePath.replace("file://", ""));
            FileInputStream inputStream = new FileInputStream(file);
            byte[] buffer = new byte[(int) file.length()];
            inputStream.read(buffer);
            inputStream.close();
            
            String base64 = Base64.encodeToString(buffer, Base64.NO_WRAP);
            promise.resolve(base64);
        } catch (Exception e) {
            promise.reject("E_FILE_READ_ERROR", "Failed to read file: " + e.getMessage());
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
    }
}
