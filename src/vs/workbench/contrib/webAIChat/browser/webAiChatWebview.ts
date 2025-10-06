/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

export function getWebviewContent(): string {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>${localize('webAiChat.title', 'Web AI Chat')}</title>
		<style>
			${getWebviewStyles()}
		</style>
	</head>
	<body>
		${getWebviewBody()}
		<script>
			${getWebviewScript()}
		</script>
	</body>
	</html>`;
}

function getWebviewStyles(): string {
	return `
		body, html {
			margin: 0;
			padding: 0;
			height: 100%;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			display: flex;
			flex-direction: column;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			overflow: hidden;
		}
		.main-container {
			display: flex;
			flex: 1;
			min-height: 0;
		}
		.browser-container {
			width: 50%;
			min-width: 200px;
			display: flex;
			flex-direction: column;
			padding: 10px;
		}
		.chat-container {
			flex: 1;
			display: flex;
			flex-direction: column;
			padding: 10px;
		}
		.resizer {
			width: 5px;
			cursor: col-resize;
			background-color: var(--vscode-sideBar-border);
			flex-shrink: 0;
		}
		.resizer:hover {
			background-color: var(--vscode-sash-hoverBorder);
		}
		input {
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			padding: 5px;
		}
		button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 5px 10px;
			margin-left: 5px;
			cursor: pointer;
			min-width: 70px;
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		input:disabled {
			opacity: 0.5;
		}
		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.url-input-bar {
			display: flex;
			margin-bottom: 10px;
			align-items: center;
		}
		.url-input-bar input {
			flex: 1;
		}
		.loader {
			font-size: 10px;
			margin: 0 10px;
			text-align: center;
			display: none;
		}
		iframe {
			flex: 1;
			border: 1px solid var(--vscode-input-border);
		}
		.chat-messages {
			flex: 1;
			border: 1px solid var(--vscode-input-border);
			padding: 10px;
			margin-bottom: 10px;
			overflow-y: auto;
		}
		.chat-messages div {
			margin-bottom: 5px;
		}
		.chat-input-bar {
			display: flex;
		}
		.chat-input-bar input {
			flex: 1;
		}
		.loading-dots span {
			display: inline-block;
			width: 4px;
			height: 4px;
			background-color: var(--vscode-editor-foreground);
			border-radius: 50%;
			animation: bounce 1.4s infinite both;
		}
		.loading-dots span:nth-child(2) {
			animation-delay: 0.2s;
		}
		.loading-dots span:nth-child(3) {
			animation-delay: 0.4s;
		}
		@keyframes bounce {
			0%, 80%, 100% {
				transform: scale(0);
			}
			40% {
				transform: scale(1.0);
			}
		}
	`;
}

function getWebviewBody(): string {
	const urlPlaceholder = localize('webAiChat.urlPlaceholder', 'https://example.com');
	const loadingText = localize('webAiChat.loading', 'Loading...');
	const loadButton = localize('webAiChat.loadButton', 'Load');
	const welcomeMessage = localize('webAiChat.welcome', 'Welcome to Web AI Chat! Load a website to start.');
	const questionPlaceholder = localize('webAiChat.questionPlaceholder', 'Ask about the website content...');
	const sendButton = localize('webAiChat.sendButton', 'Send');

	return `
		<div class="main-container">
			<div class="browser-container" id="browser-container">
				<div class="url-input-bar">
					<input type="text" id="urlInput" placeholder="${urlPlaceholder}">
					<div class="loader" id="loader">${loadingText}</div>
					<button id="loadBtn">${loadButton}</button>
				</div>
				<iframe id="websiteFrame" src="" sandbox="allow-scripts allow-forms"></iframe>
			</div>
			<div class="resizer" id="resizer"></div>
			<div class="chat-container">
				<div class="chat-messages" id="chatMessages">
					<div>${welcomeMessage}</div>
				</div>
				<div class="chat-input-bar">
					<input type="text" id="questionInput" placeholder="${questionPlaceholder}">
					<button id="sendBtn">${sendButton}</button>
				</div>
			</div>
		</div>
	`;
}

function getWebviewScript(): string {
	const cancelText = localize('webAiChat.cancel', 'Cancel');
	const loadText = localize('webAiChat.load', 'Load');
	const youLabel = localize('webAiChat.you', 'You');
	const aiLabel = localize('webAiChat.ai', 'AI');

	return `
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

		// Resizer logic
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
			leftPanel.style.width = newWidth + 'px';
		}

		function handleMouseUp() {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		}

		// Website loading logic
		function setLoadingState(isLoading) {
			if (isLoading) {
				urlInput.disabled = true;
				loadBtn.textContent = '${cancelText}';
				loadBtn.onclick = handleCancel;
				loader.style.display = 'block';
			} else {
				urlInput.disabled = false;
				loadBtn.textContent = '${loadText}';
				loadBtn.onclick = handleLoad;
				loader.style.display = 'none';
			}
		}

		function handleLoad() {
			const url = urlInput.value;
			if (url) {
				vscode.postMessage({ command: 'loadWebsite', url: url });
				setLoadingState(true);
			}
		}

		function handleCancel() {
			vscode.postMessage({ command: 'cancelLoadWebsite' });
			setLoadingState(false);
		}

		loadBtn.onclick = handleLoad;

		// Chat logic
		function setChatInputEnabled(enabled) {
			questionInput.disabled = !enabled;
			sendBtn.disabled = !enabled;
		}

		const handleSend = () => {
			const question = questionInput.value;
			if (question && !questionInput.disabled) {
				setChatInputEnabled(false);
				chatMessages.innerHTML += '<div><strong>${youLabel}:</strong> ' + question + '</div>';
				questionInput.value = '';
				const loadingIndicator = document.createElement('div');
				loadingIndicator.id = 'loading-indicator';
				loadingIndicator.innerHTML = '<strong>${aiLabel}:</strong> <span class="loading-dots"><span></span><span></span><span></span></span>';
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

		// Message listener from backend
		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.command) {
				case 'displayWebsite':
					if (message.htmlContent) {
						websiteFrame.srcdoc = message.htmlContent;
					}
					break;
				case 'loadComplete':
					setLoadingState(false);
					break;
				case 'llmResponse':
					const loadingIndicator = document.getElementById('loading-indicator');
					if (loadingIndicator) {
						loadingIndicator.remove();
					}
					chatMessages.innerHTML += '<div><strong>${aiLabel}:</strong> ' + message.text + '</div>';
					chatMessages.scrollTop = chatMessages.scrollHeight;
					setChatInputEnabled(true);
					break;
			}
		});
	`;
}

