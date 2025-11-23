package com.fileuploadapp;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.view.Gravity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.ShapeDrawable;
import android.graphics.drawable.shapes.PathShape;
import android.graphics.Path;
import android.graphics.Paint;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class EpubReaderActivity extends Activity {
    private WebView webView;

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
        
        setContentView(container);
        
        // Load EPUB
        String epubPath = getIntent().getStringExtra("epub_path");
        loadEpub(epubPath);
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
        
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }
}
