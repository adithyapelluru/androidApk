package com.fileuploadapp;

import android.app.Activity;
import android.content.Intent;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class EpubReaderModule extends ReactContextBaseJavaModule {

    public EpubReaderModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "EpubReader";
    }

    @ReactMethod
    public void openEpub(String filePath, Promise promise) {
        try {
            Activity currentActivity = getCurrentActivity();
            if (currentActivity == null) {
                promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist");
                return;
            }

            // Open EPUB in a new activity
            String cleanPath = filePath.replace("file://", "");
            Intent intent = new Intent(currentActivity, EpubReaderActivity.class);
            intent.putExtra("epub_path", cleanPath);
            currentActivity.startActivity(intent);

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("E_EPUB_OPEN_ERROR", "Failed to open EPUB: " + e.getMessage());
        }
    }
}
