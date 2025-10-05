/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const vscode = require('vscode');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Biến để quản lý yêu cầu tải web đang diễn ra
let loadRequestController = null;

function activate(context) {
	console.log('Congratulations, your extension "web-ai-chat" is now active!');

	const disposable = vscode.commands.registerCommand('aichat.startSession', () => {
		// Tạo một Webview Panel mới
		const panel = vscode.window.createWebviewPanel(
			'webAiChat', // Định danh của webview
			'Web AI Chat', // Tiêu đề hiển thị trên tab
			vscode.ViewColumn.One, // Hiển thị ở cột editor chính
			{
				enableScripts: true, // Cho phép chạy JavaScript trong webview
			}
		);

		// Gán nội dung HTML cho webview
		panel.webview.html = getWebviewContent(panel.webview);

		let siteContent = ''; // Biến để lưu nội dung website đã được làm sạch

		// Xử lý tin nhắn gửi từ webview (giao diện) đến extension (backend)
		panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'loadWebsite':
						// Nếu có yêu cầu đang chạy, hủy nó trước
						if (loadRequestController) {
							loadRequestController.abort();
						}
						loadRequestController = new AbortController();

						try {
							const response = await axios.get(message.url, {
								signal: loadRequestController.signal, // Gắn tín hiệu hủy
							});

							const headers = response.headers;
							const xFrameOptions = (
								headers['x-frame-options'] || ''
							).toUpperCase();
							const csp = headers['content-security-policy'] || '';

							let isEmbeddable = true;
							if (xFrameOptions === 'DENY' || xFrameOptions === 'SAMEORIGIN') {
								isEmbeddable = false;
							}
							if (
								csp.includes("frame-ancestors 'none'") ||
								csp.includes("frame-ancestors 'self'")
							) {
								isEmbeddable = false;
							}

							if (!isEmbeddable) {
								vscode.window.showWarningMessage(
									'Nội dung web đã được tải cho AI, nhưng không thể hiển thị do chính sách bảo mật của trang web.'
								);
							} else {
								vscode.window.showInformationMessage(
									'Website content fetched successfully!'
								);
							}

							siteContent = response.data
								.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
								.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
								.replace(/<[^>]*>/g, ' ')
								.replace(/\s+/g, ' ')
								.trim();
						} catch (error) {
							if (axios.isCancel(error)) {
								console.log('Request canceled by user.');
							} else {
								siteContent = '';
								vscode.window.showErrorMessage(
									'Failed to fetch website content.'
								);
								console.error(error);
							}
						} finally {
							panel.webview.postMessage({ command: 'loadComplete' });
							loadRequestController = null;
						}
						return;

					case 'cancelLoadWebsite':
						if (loadRequestController) {
							loadRequestController.abort();
							loadRequestController = null;
						}
						return;

					case 'askLLM':
						const userQuestion = message.question;
						if (!siteContent) {
							panel.webview.postMessage({
								command: 'llmResponse',
								text: 'Error: Please load a website first or check if the URL is correct.',
							});
							return;
						}

						try {
							const apiKey = vscode.workspace
								.getConfiguration('webAiChat')
								.get('apiKey');
							if (!apiKey) {
								vscode.window.showErrorMessage(
									'Please set your Google AI API Key in the settings.'
								);
								panel.webview.postMessage({
									command: 'llmResponse',
									text: 'API Key not configured.',
								});
								return;
							}

							const genAI = new GoogleGenerativeAI(apiKey);
							const model = genAI.getGenerativeModel({
								model: 'gemini-2.5-flash',
							});

							const prompt = `Based ONLY on the following website content, answer the user's question.
                              Website Content: "${siteContent.substring(
								0,
								15000
							)}"

                              User Question: "${userQuestion}"`;

							const result = await model.generateContent(prompt);
							const response = result.response;
							const aiResponse = response.text();

							panel.webview.postMessage({
								command: 'llmResponse',
								text: aiResponse,
							});
						} catch (error) {
							console.error('Error calling Google Gemini API:', error);
							panel.webview.postMessage({
								command: 'llmResponse',
								text: 'Sorry, I encountered an error with the AI model.',
							});
						}
						return;
				}
			},
			undefined,
			context.subscriptions
		);
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(webview) {
	return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${webview.cspSource} 'unsafe-inline';
                script-src ${webview.cspSource} 'unsafe-inline';
                frame-src *;
            ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Web AI Chat</title>
            <style>
                body, html {
                    margin: 0; padding: 0; height: 100%;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex; flex-direction: column;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    overflow: hidden;
                }
                .main-container { display: flex; flex: 1; min-height: 0; }
                .browser-container {
                    width: 50%;
                    min-width: 200px;
                    display: flex; flex-direction: column; padding: 10px;
                }
                .chat-container { flex: 1; display: flex; flex-direction: column; padding: 10px; }
                .resizer {
                    width: 5px;
                    cursor: col-resize;
                    background-color: var(--vscode-side-bar-border);
                    flex-shrink: 0;
                }
                .resizer:hover {
                    background-color: var(--vscode-sash-hoverBorder);
                }
                input { background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 5px; }
                button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; margin-left: 5px; cursor: pointer; min-width: 70px; }
                button:hover { background-color: var(--vscode-button-hoverBackground); }
                input:disabled { opacity: 0.5; }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .url-input-bar { display: flex; margin-bottom: 10px; align-items: center; }
                .url-input-bar input { flex: 1; }
                .loader { font-size: 10px; margin: 0 10px; text-align: center; display: none; }
                iframe { flex: 1; border: 1px solid var(--vscode-input-border); }
                .chat-messages { flex: 1; border: 1px solid var(--vscode-input-border); padding: 10px; margin-bottom: 10px; overflow-y: auto; }
                .chat-messages div { margin-bottom: 5px; }
                .chat-input-bar { display: flex; }
                .chat-input-bar input { flex: 1; }
                .loading-dots span {
                    display: inline-block;
                    width: 4px;
                    height: 4px;
                    background-color: var(--vscode-editor-foreground);
                    border-radius: 50%;
                    animation: bounce 1.4s infinite both;
                }
                .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
                .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                }
            </style>
        </head>
        <body>
            <div class="main-container">
                <div class="browser-container" id="browser-container">
                    <div class="url-input-bar">
                        <input type="text" id="urlInput" placeholder="https://example.com">
                        <div class="loader" id="loader">Loading...</div>
                        <button id="loadBtn">Load</button>
                    </div>
                    <iframe id="websiteFrame" src=""></iframe>
                </div>
                <div class="resizer" id="resizer"></div>
                <div class="chat-container">
                    <div class="chat-messages" id="chatMessages">
                        <div>Welcome to Web AI Chat! Load a website to start.</div>
                    </div>
                    <div class="chat-input-bar">
                        <input type="text" id="questionInput" placeholder="Ask about the website content...">
                        <button id="sendBtn">Send</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const resizer = document.getElementById('resizer');
                const leftPanel = document.getElementById('browser-container');
                const urlInput = document.getElementById('urlInput');
                const loadBtn = document.getElementById('loadBtn');
                const websiteFrame = document.getElementById('websiteFrame');
                const loader = document.getElementById('loader');
                const questionInput = document.getElementById('questionInput');
                const sendBtn = document.getElementById('sendBtn');
                const chatMessages = document.getElementById('chatMessages');

                // --- Logic xử lý thanh kéo (resizer) ---
                let startX, startWidth;
                resizer.addEventListener('mousedown', (e) => {
                    startX = e.clientX;
                    startWidth = parseInt(document.defaultView.getComputedStyle(leftPanel).width, 10);
                    e.preventDefault();
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                });
                function handleMouseMove(e) {
                    const dx = e.clientX - startX;
                    const newWidth = startWidth + dx;
                    leftPanel.style.width = \`\${newWidth}px\`;
                }
                function handleMouseUp() {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                }

                // --- Logic xử lý tải Website ---
                function setLoadingState(isLoading) {
                    if (isLoading) {
                        urlInput.disabled = true;
                        loadBtn.textContent = 'Cancel';
                        loadBtn.onclick = handleCancel;
                        loader.style.display = 'block';
                    } else {
                        urlInput.disabled = false;
                        loadBtn.textContent = 'Load';
                        loadBtn.onclick = handleLoad;
                        loader.style.display = 'none';
                    }
                }
                function handleLoad() {
                    const url = urlInput.value;
                    if (url) {
                        websiteFrame.src = url;
                        vscode.postMessage({ command: 'loadWebsite', url: url });
                        setLoadingState(true);
                    }
                }
                function handleCancel() {
                    vscode.postMessage({ command: 'cancelLoadWebsite' });
                    setLoadingState(false);
                }
                loadBtn.onclick = handleLoad;

                // --- Logic xử lý Chat ---
                function setChatInputEnabled(enabled) {
                    questionInput.disabled = !enabled;
                    sendBtn.disabled = !enabled;
                }
                const handleSend = () => {
                    const question = questionInput.value;
                    if (question && !questionInput.disabled) {
                        setChatInputEnabled(false);
                        chatMessages.innerHTML += \`<div><strong>You:</strong> \${question}</div>\`;
                        questionInput.value = '';
                        const loadingIndicator = document.createElement('div');
                        loadingIndicator.id = 'loading-indicator';
                        loadingIndicator.innerHTML = \`<strong>AI:</strong> <span class="loading-dots"><span></span><span></span><span></span></span>\`;
                        chatMessages.appendChild(loadingIndicator);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        vscode.postMessage({ command: 'askLLM', question: question });
                    }
                };
                sendBtn.addEventListener('click', handleSend);
                questionInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        handleSend();
                    }
                });

                // --- Listener nhận tin nhắn từ Backend ---
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'loadComplete':
                            setLoadingState(false);
                            break;
                        case 'llmResponse':
                            const loadingIndicator = document.getElementById('loading-indicator');
                            if (loadingIndicator) {
                                loadingIndicator.remove();
                            }
                            chatMessages.innerHTML += \`<div><strong>AI:</strong> \${message.text}</div>\`;
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                            setChatInputEnabled(true);
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
};
