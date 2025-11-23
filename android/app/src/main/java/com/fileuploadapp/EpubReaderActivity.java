package com.fileuploadapp;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.view.Gravity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.ShapeDrawable;
import android.graphics.drawable.shapes.PathShape;
import android.graphics.Path;
import android.graphics.Paint;
import android.content.SharedPreferences;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class EpubReaderActivity extends Activity implements TextToSpeech.OnInitListener {
    private WebView webView;
    private String epubPath;
    private SharedPreferences prefs;
    private TextToSpeech tts;
    private ImageButton playButton;
    private boolean isSpeaking = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create main container
        FrameLayout container = new FrameLayout(this);
        container.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        
        // Create WebView for content
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(true);
        settings.setSupportZoom(true);
        
        container.addView(webView);
        
        // Create floating back button
        ImageButton backButton = new ImageButton(this);
        int size = dpToPx(56);
        int margin = dpToPx(16);
        
        FrameLayout.LayoutParams fabParams = new FrameLayout.LayoutParams(size, size);
        fabParams.gravity = Gravity.TOP | Gravity.START;
        fabParams.setMargins(margin, margin, 0, 0);
        backButton.setLayoutParams(fabParams);
        
        // Style the button background
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.OVAL);
        shape.setColor(Color.parseColor("#007AFF"));
        backButton.setBackground(shape);
        backButton.setElevation(dpToPx(6));
        backButton.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        backButton.setPadding(dpToPx(14), dpToPx(14), dpToPx(14), dpToPx(14));
        
        // Create back arrow drawable
        backButton.setImageDrawable(createBackArrowDrawable());
        
        backButton.setOnClickListener(v -> finish());
        
        container.addView(backButton);
        
        // Create TTS controls at bottom
        LinearLayout ttsControls = new LinearLayout(this);
        FrameLayout.LayoutParams ttsParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            dpToPx(80)
        );
        ttsParams.gravity = Gravity.BOTTOM;
        ttsControls.setLayoutParams(ttsParams);
        ttsControls.setOrientation(LinearLayout.HORIZONTAL);
        ttsControls.setGravity(Gravity.CENTER);
        ttsControls.setBackgroundColor(Color.WHITE);
        ttsControls.setElevation(dpToPx(8));
        ttsControls.setPadding(dpToPx(16), dpToPx(16), dpToPx(16), dpToPx(16));
        
        // Play/Pause button
        playButton = new ImageButton(this);
        int playSize = dpToPx(56);
        LinearLayout.LayoutParams playParams = new LinearLayout.LayoutParams(playSize, playSize);
        playButton.setLayoutParams(playParams);
        
        GradientDrawable playShape = new GradientDrawable();
        playShape.setShape(GradientDrawable.OVAL);
        playShape.setColor(Color.parseColor("#007AFF"));
        playButton.setBackground(playShape);
        playButton.setElevation(dpToPx(4));
        playButton.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        playButton.setPadding(dpToPx(14), dpToPx(14), dpToPx(14), dpToPx(14));
        playButton.setImageDrawable(createPlayDrawable());
        
        playButton.setOnClickListener(v -> toggleSpeech());
        
        ttsControls.addView(playButton);
        container.addView(ttsControls);
        
        setContentView(container);
        
        // Initialize SharedPreferences for saving reading position
        prefs = getSharedPreferences("EpubReaderPrefs", MODE_PRIVATE);
        
        // Initialize TTS
        tts = new TextToSpeech(this, this);
        
        // Load EPUB
        epubPath = getIntent().getStringExtra("epub_path");
        loadEpub(epubPath);
    }
    
    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(Locale.US);
            tts.setSpeechRate(0.8f);
            
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                android.util.Log.e("TTS", "Language not supported");
            }
            
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    runOnUiThread(() -> {
                        isSpeaking = true;
                        updatePlayButton();
                    });
                }
                
                @Override
                public void onDone(String utteranceId) {
                    runOnUiThread(() -> {
                        isSpeaking = false;
                        updatePlayButton();
                    });
                }
                
                @Override
                public void onError(String utteranceId) {
                    runOnUiThread(() -> {
                        isSpeaking = false;
                        updatePlayButton();
                    });
                }
            });
        }
    }
    
    private void toggleSpeech() {
        if (isSpeaking) {
            tts.stop();
            isSpeaking = false;
            updatePlayButton();
        } else {
            extractAndSpeak();
        }
    }
    
    private void extractAndSpeak() {
        // Extract text from current viewport and below (not the entire book)
        webView.evaluateJavascript(
            "(function() { " +
            "  var scrollY = window.scrollY || window.pageYOffset; " +
            "  var viewportHeight = window.innerHeight; " +
            "  var elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6'); " +
            "  var text = ''; " +
            "  for (var i = 0; i < elements.length; i++) { " +
            "    var rect = elements[i].getBoundingClientRect(); " +
            "    var elementTop = rect.top + scrollY; " +
            "    if (elementTop >= scrollY - viewportHeight) { " +
            "      text += elements[i].innerText + ' '; " +
            "    } " +
            "  } " +
            "  return text; " +
            "})();",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String text) {
                    if (text != null && !text.equals("null")) {
                        // Remove quotes and clean up
                        text = text.replace("\\n", " ").replace("\\\"", "\"");
                        if (text.startsWith("\"")) text = text.substring(1);
                        if (text.endsWith("\"")) text = text.substring(0, text.length() - 1);
                        
                        // Split text into chunks (TTS has a 4000 char limit)
                        int maxLength = 3000;
                        if (text.length() <= maxLength) {
                            android.os.Bundle params = new android.os.Bundle();
                            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "epub_tts_0");
                            tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, "epub_tts_0");
                        } else {
                            // Split into sentences and group them
                            int start = 0;
                            int chunkIndex = 0;
                            
                            while (start < text.length()) {
                                int end = Math.min(start + maxLength, text.length());
                                
                                // Try to break at sentence end
                                if (end < text.length()) {
                                    int lastPeriod = text.lastIndexOf(". ", end);
                                    int lastQuestion = text.lastIndexOf("? ", end);
                                    int lastExclaim = text.lastIndexOf("! ", end);
                                    int breakPoint = Math.max(lastPeriod, Math.max(lastQuestion, lastExclaim));
                                    
                                    if (breakPoint > start) {
                                        end = breakPoint + 2;
                                    }
                                }
                                
                                String chunk = text.substring(start, end);
                                android.os.Bundle params = new android.os.Bundle();
                                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "epub_tts_" + chunkIndex);
                                
                                if (chunkIndex == 0) {
                                    tts.speak(chunk, TextToSpeech.QUEUE_FLUSH, params, "epub_tts_" + chunkIndex);
                                } else {
                                    tts.speak(chunk, TextToSpeech.QUEUE_ADD, params, "epub_tts_" + chunkIndex);
                                }
                                
                                start = end;
                                chunkIndex++;
                            }
                        }
                    }
                }
            }
        );
    }
    
    private void updatePlayButton() {
        if (isSpeaking) {
            playButton.setImageDrawable(createPauseDrawable());
            GradientDrawable shape = new GradientDrawable();
            shape.setShape(GradientDrawable.OVAL);
            shape.setColor(Color.parseColor("#FF3B30"));
            playButton.setBackground(shape);
        } else {
            playButton.setImageDrawable(createPlayDrawable());
            GradientDrawable shape = new GradientDrawable();
            shape.setShape(GradientDrawable.OVAL);
            shape.setColor(Color.parseColor("#007AFF"));
            playButton.setBackground(shape);
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        saveScrollPosition();
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        saveScrollPosition();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
    
    private void saveScrollPosition() {
        if (webView != null && epubPath != null) {
            int scrollY = webView.getScrollY();
            prefs.edit().putInt(getBookKey(), scrollY).apply();
        }
    }
    
    private void restoreScrollPosition() {
        if (webView != null && epubPath != null) {
            int scrollY = prefs.getInt(getBookKey(), 0);
            if (scrollY > 0) {
                // Hide webview initially to prevent flash
                webView.setAlpha(0f);
                
                // Scroll immediately and show after
                webView.post(() -> {
                    webView.scrollTo(0, scrollY);
                    // Fade in smoothly
                    webView.animate().alpha(1f).setDuration(150).start();
                });
            }
        }
    }
    
    private String getBookKey() {
        // Use file path as unique key for this book
        return "scroll_" + epubPath.hashCode();
    }
    
    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
    
    private ShapeDrawable createBackArrowDrawable() {
        // Create a back arrow path
        Path path = new Path();
        path.moveTo(15, 5);  // Top of arrow
        path.lineTo(5, 12);  // Point of arrow
        path.lineTo(15, 19); // Bottom of arrow
        path.moveTo(6, 12);  // Start of line
        path.lineTo(20, 12); // End of line
        
        PathShape pathShape = new PathShape(path, 24, 24);
        ShapeDrawable drawable = new ShapeDrawable(pathShape);
        drawable.getPaint().setColor(Color.WHITE);
        drawable.getPaint().setStyle(Paint.Style.STROKE);
        drawable.getPaint().setStrokeWidth(3);
        drawable.getPaint().setStrokeCap(Paint.Cap.ROUND);
        drawable.getPaint().setStrokeJoin(Paint.Join.ROUND);
        drawable.setIntrinsicWidth(dpToPx(24));
        drawable.setIntrinsicHeight(dpToPx(24));
        
        return drawable;
    }
    
    private ShapeDrawable createPlayDrawable() {
        // Create a play triangle
        Path path = new Path();
        path.moveTo(8, 4);
        path.lineTo(8, 20);
        path.lineTo(20, 12);
        path.close();
        
        PathShape pathShape = new PathShape(path, 24, 24);
        ShapeDrawable drawable = new ShapeDrawable(pathShape);
        drawable.getPaint().setColor(Color.WHITE);
        drawable.getPaint().setStyle(Paint.Style.FILL);
        drawable.setIntrinsicWidth(dpToPx(24));
        drawable.setIntrinsicHeight(dpToPx(24));
        
        return drawable;
    }
    
    private ShapeDrawable createPauseDrawable() {
        // Create pause bars
        Path path = new Path();
        path.addRect(6, 4, 10, 20, Path.Direction.CW);
        path.addRect(14, 4, 18, 20, Path.Direction.CW);
        
        PathShape pathShape = new PathShape(path, 24, 24);
        ShapeDrawable drawable = new ShapeDrawable(pathShape);
        drawable.getPaint().setColor(Color.WHITE);
        drawable.getPaint().setStyle(Paint.Style.FILL);
        drawable.setIntrinsicWidth(dpToPx(24));
        drawable.setIntrinsicHeight(dpToPx(24));
        
        return drawable;
    }
    
    private void loadEpub(String path) {
        try {
            File file = new File(path);
            InputStream inputStream = new FileInputStream(file);
            ZipInputStream zipInputStream = new ZipInputStream(inputStream);
            
            ZipEntry entry;
            List<String> htmlFiles = new ArrayList<>();
            
            while ((entry = zipInputStream.getNextEntry()) != null) {
                String name = entry.getName();
                if (name.endsWith(".html") || name.endsWith(".xhtml") || name.endsWith(".htm")) {
                    byte[] buffer = new byte[2048];
                    int len;
                    StringBuilder content = new StringBuilder();
                    while ((len = zipInputStream.read(buffer)) > 0) {
                        content.append(new String(buffer, 0, len, "UTF-8"));
                    }
                    htmlFiles.add(content.toString());
                }
                zipInputStream.closeEntry();
            }
            
            zipInputStream.close();
            
            if (htmlFiles.isEmpty()) {
                webView.loadData("<h1>No content found</h1><p>This EPUB file appears to be empty or corrupted.</p>", "text/html", "UTF-8");
            } else {
                displayAllContent(htmlFiles);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            webView.loadData("<h1>Error loading EPUB</h1><p>" + e.getMessage() + "</p>", "text/html", "UTF-8");
        }
    }
    
    private void displayAllContent(List<String> htmlFiles) {
        // Combine all HTML content into one scrollable document
        StringBuilder allContent = new StringBuilder();
        
        for (String content : htmlFiles) {
            // Remove html, head, body tags from individual files
            content = content.replaceAll("(?i)</?html[^>]*>", "");
            content = content.replaceAll("(?i)</?head[^>]*>", "");
            content = content.replaceAll("(?i)</?body[^>]*>", "");
            content = content.replaceAll("(?i)<meta[^>]*>", "");
            
            allContent.append(content);
            allContent.append("<div style='height: 20px;'></div>"); // Spacing between chapters
        }
        
        // Wrap all content with beautiful styling
        String html = "<!DOCTYPE html><html><head>" +
            "<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes'>" +
            "<style>" +
            "* { margin: 0; padding: 0; box-sizing: border-box; }" +
            "body { " +
            "  font-family: Georgia, 'Times New Roman', serif; " +
            "  line-height: 1.8; " +
            "  padding: 20px; " +
            "  font-size: 18px; " +
            "  background: #faf8f5; " +
            "  color: #333; " +
            "  max-width: 800px; " +
            "  margin: 0 auto; " +
            "}" +
            "p { margin-bottom: 1em; text-align: justify; }" +
            "h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: bold; }" +
            "h1 { font-size: 2em; }" +
            "h2 { font-size: 1.5em; }" +
            "h3 { font-size: 1.3em; }" +
            "img { max-width: 100%; height: auto; display: block; margin: 1em auto; }" +
            "blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #ccc; font-style: italic; }" +
            "a { color: #007AFF; text-decoration: none; }" +
            "</style>" +
            "</head><body>" + allContent.toString() + "</body></html>";
        
        // Set WebViewClient to restore scroll position after content loads
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                restoreScrollPosition();
            }
        });
        
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }
}
