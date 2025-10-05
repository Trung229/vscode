# Web AI Chat Extension

A VS Code built-in extension that allows you to chat with AI about any website content using Google Gemini API.

![Extension Demo](https://via.placeholder.com/800x450?text=Web+AI+Chat+Demo)

## ✨ Features

- 🌐 **Load Any Website**: Fetch and display any website in a built-in browser
- 🤖 **AI Chat**: Ask questions about the website content using Google Gemini
- 📱 **Split View**: Browser and chat interface side-by-side
- 🎨 **Resizable Panels**: Adjust the layout to your preference
- ⚡ **Real-time Processing**: Extract and analyze website content on-the-fly
- 🔒 **Secure**: Your API key is stored locally in VS Code settings

## 📋 Requirements

- **VS Code**: Version 1.70.0 or higher
- **Node.js**: Version 16.x or higher
- **Google Gemini API Key**: Get it from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 🚀 Installation & Setup

### Option 1: Test as Regular Extension (Recommended for Development)

1. **Navigate to extension folder:**

   ```bash
   cd /Users/trungpham/Documents/vscode/extensions/ai-chat
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Open extension in VS Code:**

   ```bash
   code .
   ```

4. **Run the extension:**
   - Press `F5` (or Run > Start Debugging)
   - A new VS Code window will open with the extension loaded

### Option 2: Run as Built-in Extension in VS Code Source

1. **Install dependencies for the extension:**

   ```bash
   cd /Users/trungpham/Documents/vscode/extensions/ai-chat
   npm install
   ```

2. **Build VS Code from source:**

   ```bash
   cd /Users/trungpham/Documents/vscode

   # Use yarn instead of npm (recommended)
   yarn install
   yarn compile
   ```

3. **Run VS Code:**

   ```bash
   ./scripts/code.sh
   ```

   The extension will be loaded automatically as a built-in extension.

## ⚙️ Configuration

### Set up Google Gemini API Key

1. Open VS Code Settings (`Cmd + ,` on Mac, `Ctrl + ,` on Windows/Linux)
2. Search for "Web AI Chat"
3. Paste your API key into `webAiChat.apiKey`

Or manually edit `settings.json`:

```json
{
	"webAiChat.apiKey": "your-google-gemini-api-key-here"
}
```

### Get Your API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into VS Code settings

## 📖 Usage

### Starting a Session

1. Open Command Palette:

   - Mac: `Cmd + Shift + P`
   - Windows/Linux: `Ctrl + Shift + P`

2. Type and select: **"Web AI Chat: Start New Session"**

3. A split view will appear with:
   - **Left Panel**: Website browser
   - **Right Panel**: AI chat interface

### Loading a Website

1. Enter a URL in the address bar (e.g., `https://example.com`)
2. Click **"Load"** button
3. The website will be displayed in the iframe
4. Content is automatically extracted for AI analysis

**Note:** Some websites may not display due to security policies (CORS, X-Frame-Options), but the content will still be available for AI chat.

### Chatting with AI

1. After loading a website, type your question in the chat input
2. Click **"Send"** or press `Enter`
3. AI will analyze the website content and respond

**Example questions:**

- "What is this website about?"
- "Summarize the main points"
- "What products are mentioned on this page?"
- "Explain the key features"

## 🎨 Interface

```
┌─────────────────────────────────────────────────────────┐
│  Web AI Chat                                            │
├──────────────────────┬──────────────────────────────────┤
│  Browser Panel       │  Chat Panel                      │
│  ┌────────────────┐  │  ┌────────────────────────────┐ │
│  │ URL Bar        │  │  │ Chat Messages              │ │
│  │ [Load]         │  │  │ You: [question]            │ │
│  ├────────────────┤  │  │ AI: [response]             │ │
│  │                │  │  │                            │ │
│  │   Website      │  │  │ [scrollable]               │ │
│  │   Content      │  │  │                            │ │
│  │                │  │  └────────────────────────────┘ │
│  │                │  │  ┌────────────────────────────┐ │
│  │                │  │  │ Ask about website...       │ │
│  └────────────────┘  │  │ [Send]                     │ │
│                      │  └────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────┘
```

## 🛠️ Troubleshooting

### Extension not showing in Command Palette

- Make sure you've run `npm install` in the extension folder
- Reload the VS Code window: `Cmd/Ctrl + Shift + P` > "Developer: Reload Window"
- Check the Output panel for errors: View > Output > "Extension Host"

### "API Key not configured" error

- Verify you've set `webAiChat.apiKey` in VS Code settings
- Check that the API key is valid on [Google AI Studio](https://makersuite.google.com/app/apikey)

### Website not loading in iframe

This is normal for some websites due to security policies. The content is still fetched and available for AI chat, but the visual display may be blocked.

### Permission denied errors

If you encounter permission errors when building VS Code:

```bash
# Fix npm cache permissions
sudo chown -R $(whoami):staff ~/.npm

# Fix out directory permissions
sudo chown -R $(whoami):staff /Users/trungpham/Documents/vscode/out
```

### Module not found errors

Make sure you've installed dependencies:

```bash
cd /Users/trungpham/Documents/vscode/extensions/ai-chat
npm install
```

## 🏗️ Development

### Project Structure

```
ai-chat/
├── extension.js          # Main extension code
├── package.json          # Extension manifest
├── package-lock.json     # Dependency lock file
├── node_modules/         # Dependencies
└── .vscode/
    └── launch.json       # Debug configuration
```

### Tech Stack

- **VS Code Extension API**: Webview, Commands, Configuration
- **Axios**: HTTP client for fetching website content
- **Google Generative AI**: Gemini 2.0 Flash model for AI responses
- **HTML/CSS/JavaScript**: Webview UI

### Making Changes

1. Edit `extension.js`
2. Reload the extension:
   - If running with F5: Stop and restart debugging
   - If running as built-in: Reload window (`Cmd/Ctrl + Shift + P` > "Developer: Reload Window")

## 📝 Notes

- The extension extracts up to 15,000 characters of website content for AI analysis
- Website scripts and styles are removed during content extraction
- Each query is processed independently (no conversation history yet)

## 🐛 Known Issues

- Some websites cannot be displayed in iframe due to CORS policies
- Large websites may take time to load
- No conversation history between queries

## 📄 License

MIT License - Copyright (c) Microsoft Corporation

## 🤝 Contributing

This is a built-in extension for VS Code. For contributions, please refer to the main VS Code repository guidelines.

## 🔗 Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Google Gemini API](https://ai.google.dev/)
- [Get API Key](https://makersuite.google.com/app/apikey)

---

**Happy Chatting! 🚀**
