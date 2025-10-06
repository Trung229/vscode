/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
	IViewDescriptorService,
} from '../../../../workbench/common/views.js';
import {
	ViewPane,
} from '../../../../workbench/browser/parts/views/viewPane.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IViewletViewOptions } from '../../../../workbench/browser/parts/views/viewsViewlet.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import {
	WEB_AI_CHAT_VIEW_ID,
} from '../../../../workbench/contrib/webAIChat/common/webAiChat.js';
import { IWebviewService, IOverlayWebview, WebviewContentPurpose } from '../../../../workbench/contrib/webview/browser/webview.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { consumeStream } from '../../../../base/common/stream.js';
import './media/webAiChat.css';

export class WebAiChatView extends ViewPane {
	private webview: IOverlayWebview | undefined;
	private readonly webviewDisposables = this._register(new DisposableStore());
	private _container: HTMLElement | undefined;
	private siteContent: string = '';
	private loadRequestCancellation: CancellationTokenSource | undefined;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IRequestService private readonly requestService: IRequestService,
		@INotificationService private readonly notificationService: INotificationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super(
			options,
			keybindingService,
			contextMenuService,
			configurationService,
			contextKeyService,
			viewDescriptorService,
			instantiationService,
			openerService,
			themeService,
			hoverService
		);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this._container = container;
		console.log('renderBody, ====>');
		// Create webview
		const webview = this.webviewService.createWebviewOverlay({
			providedViewType: WEB_AI_CHAT_VIEW_ID,
			title: 'Web AI Chat',
			options: { purpose: WebviewContentPurpose.NotebookRenderer },
			contentOptions: {
				allowScripts: true,
				localResourceRoots: []
			},
			extension: undefined
		});
		this.webview = webview;

		// Set webview HTML content
		webview.setHtml(this.getWebviewContent());

		// Attach webview to container
		container.appendChild(webview.container);

		// IMPORTANT: Show the webview
		webview.claim(this, mainWindow, undefined);

		// Handle messages from webview
		this.webviewDisposables.add(
			webview.onMessage(event => {
				this.handleWebviewMessage(event.message);
			})
		);
	}

	private async handleWebviewMessage(message: { command: string; url?: string; question?: string }): Promise<void> {
		switch (message.command) {
			case 'loadWebsite':
				await this.handleLoadWebsite(message.url || '');
				break;
			case 'cancelLoadWebsite':
				this.handleCancelLoadWebsite();
				break;
			case 'askLLM':
				await this.handleAskLLM(message.question || '');
				break;
		}
	}

	private async handleLoadWebsite(url: string): Promise<void> {
		// Cancel any existing request
		if (this.loadRequestCancellation) {
			this.loadRequestCancellation.cancel();
			this.loadRequestCancellation.dispose();
		}

		this.loadRequestCancellation = new CancellationTokenSource();

		try {
			console.log('[WebAiChat] Fetching URL:', url);

			// Parse URL to get origin for Referer
			const urlObj = new URL(url);
			const origin = urlObj.origin;

			// Add comprehensive browser headers to avoid being blocked
			const response = await this.requestService.request({
				type: 'GET',
				url: url,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
					'Accept-Language': 'en-US,en;q=0.9',
					'Accept-Encoding': 'gzip, deflate, br',
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache',
					'Referer': origin + '/',
					'sec-ch-ua': '"Not)A;Brand";v="99", "Chromium";v="138"',
					'sec-ch-ua-mobile': '?0',
					'sec-ch-ua-platform': '"macOS"',
					'sec-fetch-dest': 'document',
					'sec-fetch-mode': 'navigate',
					'sec-fetch-site': 'same-origin',
					'sec-fetch-user': '?1',
					'upgrade-insecure-requests': '1'
				}
			}, this.loadRequestCancellation.token);

			console.log('[WebAiChat] Response status:', response.res.statusCode);
			console.log('[WebAiChat] Response headers:', response.res.headers);
			// Accept all 2xx status codes (200-299) as success
			const statusCode = response.res.statusCode || 0;
			if (statusCode < 200 || statusCode >= 300) {
				throw new Error(`HTTP ${statusCode}: Failed to fetch`);
			}

			// Read response body
			const buffer = await consumeStream(response.stream, chunks => VSBuffer.concat(chunks));
			const htmlContent = buffer.toString();
			console.log('[WebAiChat] Content fetched, length:', htmlContent.length);

			// Clean content for AI (remove HTML tags)
			this.siteContent = htmlContent
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
				.replace(/<[^>]*>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();

			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Website content fetched successfully!'
			});

			// Inject anti-iframe prevention script and base tag
			let modifiedHtml = htmlContent;

			// Script to fix sandbox restrictions and prevent errors
			const sandboxFixScript = `<script>
		(function() {
			// Suppress ALL console errors and warnings to keep console clean
			var originalError = console.error;
			var originalWarn = console.warn;
			console.error = function() {
				var args = Array.prototype.slice.call(arguments);
				var firstArg = args[0] ? String(args[0]) : '';
				// Suppress sandbox, CORS, and other common iframe errors
				if (firstArg.includes('sandboxed') ||
					firstArg.includes('SecurityError') ||
					firstArg.includes('CORS') ||
					firstArg.includes('ERR_BLOCKED') ||
					firstArg.includes('NotSamesite') ||
					firstArg.includes('Forbidden')) {
					return;
				}
				originalError.apply(console, arguments);
			};
			console.warn = function() {
				var args = Array.prototype.slice.call(arguments);
				var firstArg = args[0] ? String(args[0]) : '';
				if (firstArg.includes('sandboxed') || firstArg.includes('sandbox')) {
					return;
				}
				originalWarn.apply(console, arguments);
			};

			// Override frame-busting techniques
			try {
				Object.defineProperty(window, 'top', {
					configurable: false,
					get: function() { return window.self; }
				});
				Object.defineProperty(window, 'parent', {
					configurable: false,
					get: function() { return window.self; }
				});
			} catch(e) {}

			// Prevent all types of navigation attempts
			var blockNavigation = function() { return false; };
			window.onbeforeunload = blockNavigation;

			// Wrap ALL error-prone methods
			var safeWrap = function(obj, method, handler) {
				if (!obj || !obj[method]) return;
				var original = obj[method];
				obj[method] = function() {
					try {
						return handler ? handler.apply(this, arguments) : original.apply(this, arguments);
					} catch(e) {
						return undefined;
					}
				};
			};

			// Safe addEventListener
			safeWrap(EventTarget.prototype, 'addEventListener');

			// Safe document.write
			safeWrap(document, 'write', function(content) {
				if (content && (String(content).includes('top.location') || String(content).includes('parent.location'))) {
					return;
				}
				return document.write.call(document, content);
			});

			// Global error handler - suppress ALL errors
			window.addEventListener('error', function(e) {
				e.preventDefault();
				e.stopPropagation();
				return true;
			}, true);

			// Unhandled promise rejection handler
			window.addEventListener('unhandledrejection', function(e) {
				e.preventDefault();
				return true;
			});

			// Remove all blocking elements periodically
			var removeBlockers = function() {
				try {
					// Remove high z-index transparent overlays
					var overlays = document.querySelectorAll('div, span, section');
					overlays.forEach(function(el) {
						var style = window.getComputedStyle(el);
						var zIndex = parseInt(style.zIndex);
						var position = style.position;
						if ((position === 'fixed' || position === 'absolute') && zIndex > 999) {
							var opacity = parseFloat(style.opacity);
							var pointerEvents = style.pointerEvents;
							if (opacity === 0 || pointerEvents === 'none' ||
								style.background === 'transparent' ||
								style.backgroundColor === 'transparent' ||
								style.backgroundColor === 'rgba(0, 0, 0, 0)') {
								el.style.display = 'none';
							}
						}
					});
				} catch(e) {}
			};

			// Run blocker removal on load and periodically
			window.addEventListener('load', function() {
				removeBlockers();
				setInterval(removeBlockers, 2000);
			});
			setTimeout(removeBlockers, 1000);
		})();
	</script>`;

			const baseTag = `<base href="${url}">`;

			// Try to inject at the very beginning of <head> (before any other scripts)
			if (modifiedHtml.match(/<head[^>]*>/i)) {
				modifiedHtml = modifiedHtml.replace(/(<head[^>]*>)/i, `$1\n${baseTag}\n${sandboxFixScript}`);
			} else if (modifiedHtml.match(/<html[^>]*>/i)) {
				// If no <head>, inject after <html>
				modifiedHtml = modifiedHtml.replace(/(<html[^>]*>)/i, `$1\n<head>${baseTag}${sandboxFixScript}</head>`);
			} else {
				// If no structure, wrap it
				modifiedHtml = `<!DOCTYPE html><html><head>${baseTag}${sandboxFixScript}</head><body>${modifiedHtml}</body></html>`;
			}

			// Send HTML content to webview for display in iframe
			// Note: X-Frame-Options and CSP frame-ancestors are removed at Electron level
			// so all websites can be embedded in iframe
			this.webview?.postMessage({
				command: 'displayWebsite',
				htmlContent: modifiedHtml,
				url: url
			});

		} catch (error: any) {
			if (error.name === 'Canceled') {
				console.log('[WebAiChat] Request canceled by user.');
			} else {
				this.siteContent = '';
				console.error('[WebAiChat] Error fetching website:', error);

				let errorMessage = 'Failed to fetch website content.';

				// Provide more specific error messages
				if (error.message) {
					if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
						errorMessage = 'Cannot find the website. Please check the URL.';
					} else if (error.message.includes('ECONNREFUSED')) {
						errorMessage = 'Connection refused. The website may be down.';
					} else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
						errorMessage = 'Request timeout. The website is taking too long to respond.';
					} else if (error.message.includes('CERT') || error.message.includes('certificate')) {
						errorMessage = 'SSL certificate error. The website may have security issues.';
					} else if (error.message.includes('403')) {
						errorMessage = 'Access forbidden (403). The website may be blocking automated requests.';
					} else if (error.message.includes('404')) {
						errorMessage = 'Page not found (404). Please check the URL.';
					} else if (error.message.includes('5')) {
						errorMessage = `Server error (${error.message}). The website may be experiencing issues.`;
					} else {
						errorMessage = `Failed to fetch: ${error.message}`;
					}
				}

				this.notificationService.notify({
					severity: Severity.Error,
					message: errorMessage
				});
			}
		} finally {
			this.webview?.postMessage({ command: 'loadComplete' });
			this.loadRequestCancellation?.dispose();
			this.loadRequestCancellation = undefined;
		}
	}

	private handleCancelLoadWebsite(): void {
		if (this.loadRequestCancellation) {
			this.loadRequestCancellation.cancel();
			this.loadRequestCancellation.dispose();
			this.loadRequestCancellation = undefined;
		}
	}

	private async handleAskLLM(question: string): Promise<void> {
		if (!this.siteContent) {
			this.webview?.postMessage({
				command: 'llmResponse',
				text: 'Error: Please load a website first or check if the URL is correct.'
			});
			return;
		}

		try {
			const apiKey = this.configurationService.getValue<string>('webAiChat.apiKey');
			if (!apiKey) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Please set your Google AI API Key in the settings.'
				});
				this.webview?.postMessage({
					command: 'llmResponse',
					text: 'API Key not configured.'
				});
				return;
			}

			// Call Google Gemini API
			const prompt = `Based ONLY on the following website content, answer the user's question.
Website Content: "${this.siteContent.substring(0, 15000)}"

User Question: "${question}"`;

			const response = await this.requestService.request({
				type: 'POST',
				url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
				headers: {
					'Content-Type': 'application/json'
				},
				data: JSON.stringify({
					contents: [{
						parts: [{
							text: prompt
						}]
					}]
				})
			}, CancellationToken.None);

			// Read response
			const buffer = await consumeStream(response.stream, chunks => VSBuffer.concat(chunks));
			const responseData = JSON.parse(buffer.toString());

			const aiResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';

			this.webview?.postMessage({
				command: 'llmResponse',
				text: aiResponse
			});

		} catch (error) {
			console.error('Error calling Google Gemini API:', error);
			this.webview?.postMessage({
				command: 'llmResponse',
				text: 'Sorry, I encountered an error with the AI model.'
			});
		}
	}

	private getWebviewContent(): string {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Web AI Chat</title>
			<style>
				body, html {
					margin: 0; padding: 0; height: 100%;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
					display: flex; flex-direction: column;
					background-color: var(--vscode-editor-background);
					color: white!important;
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
				button:hover { background-color: var(--vscode-button-hoverBackground); }
				input:disabled { opacity: 0.5; }
				button:disabled { opacity: 0.5; cursor: not-allowed; }
				.url-input-bar { display: flex; margin-bottom: 10px; align-items: center; }
				.url-input-bar input { flex: 1; }
				.loader { font-size: 10px; margin: 0 10px; text-align: center; display: none; }
				iframe { flex: 1; border: 1px solid var(--vscode-input-border); }
				.chat-messages {
					flex: 1;
					border: 1px solid var(--vscode-input-border);
					padding: 10px;
					margin-bottom: 10px;
					overflow-y: auto;
				}
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
					<iframe id="websiteFrame" src="" sandbox="allow-scripts allow-forms"></iframe>
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
						// Don't set iframe src directly to avoid CORS
						// websiteFrame.src = url;
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
					case 'displayWebsite':
						// Display website in iframe using srcdoc
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

	private layoutWebview(): void {
		if (this._container && this.webview) {
			const width = this._container.clientWidth;
			const height = this._container.clientHeight;
			console.log('my width and height', width, height);
			// Only layout if container has valid dimensions
			if (width > 0 && height > 0) {
				this.webview.layoutWebviewOverElement(this._container, new Dimension(width, height));
			}
		}
	}

	override setVisible(visible: boolean): void {
		super.setVisible(visible);

		// Hide editor area when this view is visible, show it when hidden
		if (visible) {
			this.layoutService.setPartHidden(true, Parts.EDITOR_PART);
		} else {
			this.layoutService.setPartHidden(false, Parts.EDITOR_PART);
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		// Use requestAnimationFrame to ensure layout happens after paint
		mainWindow.requestAnimationFrame(() => {
			this.layoutWebview();
		});
	}

	override dispose(): void {
		// Cancel any ongoing requests
		if (this.loadRequestCancellation) {
			this.loadRequestCancellation.cancel();
			this.loadRequestCancellation.dispose();
		}

		this.webviewDisposables.dispose();
		if (this.webview) {
			this.webview.dispose();
		}
		super.dispose();
	}
}

