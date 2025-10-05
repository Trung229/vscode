# Web AI Chat

<p align="center"></p>
	<h1>Demo</h1>
  <img src="https://malworld.blob.core.windows.net/web-chat-ai/tuoitre_scr.png" alt="Web AI Chat Demo" width="800" />
  <img src="https://malworld.blob.core.windows.net/web-chat-ai/scr_ht" alt="Web AI Chat Demo" width="800" />
</p>

**Web AI Chat** is a powerful VS Code feature that allows you to fetch any website content, view it directly in VS Code, and chat with AI about the website using Google Gemini.

## ✨ Features

- 🌐 **Fetch Any Website**: Load any URL without CORS restrictions
- 🖼️ **Live Preview**: View the website with full styling in an embedded iframe
- 🤖 **AI Chat**: Ask questions about the website content using Google Gemini AI
- ⚡ **Fast & Responsive**: Built with modern web technologies
- 🎨 **Resizable Layout**: Drag to resize the browser and chat panels

## 🚀 Getting Started

### Prerequisites

- **Google Gemini API Key**: You need a Google AI API key to use the chat feature
  - Get your free API key at: https://makersuite.google.com/app/apikey

### Installation

This feature is built into VS Code. No additional installation needed!

## 📖 How to Use

### 1. Open Web AI Chat

There are two ways to open Web AI Chat:

#### Option A: View in Sidebar

1. Open Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Type and select: **"Web AI Chat: Focus on Web AI Chat View"**
3. The Web AI Chat view will appear in your sidebar

#### Option B: Full Screen Editor

1. Open Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Type and select: **"Web AI Chat: Open Web AI Chat Editor"**
3. A full-screen editor will open with Web AI Chat

### 2. Configure API Key

Before chatting with AI, you need to set up your Google Gemini API key:

1. Open VS Code Settings:

   - macOS: `Cmd+,`
   - Windows/Linux: `Ctrl+,`

2. Search for: **"Web AI Chat API Key"**

3. Paste your Google Gemini API key

**Alternative**: Use Command Palette

- Run: **"Web AI Chat: Set API Key"**
- Paste your API key when prompted

### 3. Load a Website

1. Enter a URL in the address bar (e.g., `https://example.com`)
2. Click the **"Load"** button
3. Wait for the website to load in the preview area

**Supported URLs:**

- Any HTTP/HTTPS website
- Local development servers (e.g., `http://localhost:3000`)
- Even CORS-protected websites!

### 4. Chat with AI

1. After loading a website, type your question in the chat input
2. Examples:

   - "What is this website about?"
   - "Summarize the main content"
   - "What products are mentioned on this page?"
   - "Extract all the email addresses from this page"

3. Press **Enter** or click **"Send"**
4. AI will analyze the website content and respond

## 🎮 Interface Overview

```
┌─────────────────────────────────────────────────────┐
│  [URL Input Bar]  [Load Button]                    │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│   Website Preview        │   AI Chat                │
│   (Embedded iframe)      │                          │
│                          │   You: What is this?     │
│                          │   AI: This is a...       │
│                          │                          │
│                          │   [Chat Input] [Send]    │
└──────────────────────────┴──────────────────────────┘
         ↕ Drag to resize
```

## ⚙️ Configuration

### Available Settings

Open VS Code Settings and search for "Web AI Chat":

| Setting            | Description                | Default |
| ------------------ | -------------------------- | ------- |
| `webAiChat.apiKey` | Your Google Gemini API key | `""`    |

### Commands

Access these commands via Command Palette (`Cmd/Ctrl+Shift+P`):

| Command                                  | Description                            |
| ---------------------------------------- | -------------------------------------- |
| `Web AI Chat: Focus on Web AI Chat View` | Open Web AI Chat in sidebar            |
| `Web AI Chat: Open Web AI Chat Editor`   | Open Web AI Chat in full-screen editor |
| `Web AI Chat: Set API Key`               | Configure your Google Gemini API key   |

## 🛠️ Technical Details

### How It Works

1. **CORS Bypass**: VS Code's Electron main process fetches websites without browser CORS restrictions
2. **Content Processing**: HTML is parsed and cleaned for AI analysis
3. **Iframe Display**: Full HTML (with styles) is displayed using `srcdoc`
4. **AI Integration**: Google Gemini processes the content and answers questions

### Architecture

```
┌──────────────────┐
│  User Interface  │ (Webview/HTML)
│  - URL Input     │
│  - Iframe        │
│  - Chat UI       │
└────────┬─────────┘
         │ IPC Messages
┌────────▼─────────┐
│  Main Process    │ (TypeScript)
│  - Fetch URL     │ ← No CORS!
│  - Process HTML  │
│  - Call AI API   │
└──────────────────┘
```

## 🐛 Troubleshooting

### Website Not Loading

**Problem**: Website shows blank or error

- **Solution**: Some websites have strict CSP policies. Try a different URL or check console for errors.

**Problem**: "Failed to fetch" error

- **Solution**: Check your internet connection and verify the URL is correct.

### AI Chat Not Working

**Problem**: "API Key not configured" message

- **Solution**: Make sure you've set your Google Gemini API key in settings.

**Problem**: "No response from AI"

- **Solution**:
  - Verify your API key is valid
  - Check if you've loaded a website first
  - Try loading a simpler website

### Performance Issues

**Problem**: Website loads slowly

- **Solution**: Large websites may take time to fetch. Wait for the "Load Complete" notification.

**Problem**: Chat responses are slow

- **Solution**: This depends on Google's API response time. Be patient.

## 📝 Tips & Tricks

1. **Resize Panels**: Drag the vertical divider between website preview and chat to adjust sizes

2. **Cancel Loading**: If a website is taking too long, click the "Cancel" button

3. **Better AI Responses**: Ask specific questions rather than general ones

   - ❌ "Tell me about this"
   - ✅ "What are the top 3 features mentioned?"

4. **Local Development**: Use this to quickly test and analyze your local web apps

5. **Content Extraction**: Ask AI to extract specific information:
   - "List all the links on this page"
   - "What prices are mentioned?"
   - "Summarize the article in 3 bullet points"

## 🔒 Privacy & Security

- **No Data Storage**: Website content is processed in memory only
- **API Key Security**: Your API key is stored securely in VS Code settings
- **No Tracking**: No analytics or tracking of your browsing

## 📄 License

This feature is part of VS Code and follows the same license terms.

## 🤝 Contributing

This is a custom VS Code feature. If you encounter issues or have suggestions, please report them to your development team.

## 🎯 Use Cases

- **Research**: Quickly analyze and extract information from multiple websites
- **Content Analysis**: Ask AI to summarize, compare, or extract data
- **Development**: Test and analyze your own web applications
- **Learning**: Understand website structure and content
- **Productivity**: Get quick answers without leaving VS Code

---

**Enjoy using Web AI Chat!** 🎉

For questions or support, contact your development team.
