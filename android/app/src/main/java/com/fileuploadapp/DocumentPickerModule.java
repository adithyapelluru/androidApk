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
                        WritableMap fileData = Arguments.createMap();
                        fileData.putString("uri", uri.toString());
                        
                        Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null);
                        if (cursor != null && cursor.moveToFirst()) {
                            int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                            
                            String name = cursor.getString(nameIndex);
                            long size = cursor.getLong(sizeIndex);
                            
                            fileData.putString("name", name);
                            fileData.putDouble("size", size);
                            
                            String type = activity.getContentResolver().getType(uri);
                            fileData.putString("type", type != null ? type : "unknown");
                            
                            cursor.close();
                        }
                        
                        mPromise.resolve(fileData);
                    } else {
                        mPromise.reject("E_NO_FILE_SELECTED", "No file selected");
                    }
                }
                mPromise = null;
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
    }
}
