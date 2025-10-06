/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dimension } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { consumeStream } from '../../../../base/common/stream.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup, IEditorGroupsService, GroupsOrder } from '../../../services/editor/common/editorGroupsService.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IWebviewService, IOverlayWebview, WebviewContentPurpose } from '../../webview/browser/webview.js';
import { WEB_AI_CHAT_VIEW_ID } from '../common/webAiChat.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import './media/webAiChat.css';

export class WebAiChatEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.webAiChatEditor';

	override get typeId(): string {
		return WebAiChatEditorInput.ID;
	}

	override get editorId(): string {
		return WebAiChatEditor.ID;
	}

	override get resource(): URI | undefined {
		return undefined;
	}

	override getName(): string {
		return 'Web AI Chat';
	}

	override getIcon(): any {
		return undefined;
	}

	override matches(other: EditorInput): boolean {
		return other instanceof WebAiChatEditorInput;
	}

	override async resolve(): Promise<any> {
		return null;
	}
}

export class WebAiChatEditor extends EditorPane {
	static readonly ID = 'workbench.editor.webAiChat';

	private webview: IOverlayWebview | undefined;
	private readonly webviewDisposables = this._register(new DisposableStore());
	private _container: HTMLElement | undefined;
	private siteContent: string = '';
	private loadRequestCancellation: CancellationTokenSource | undefined;
	private previousLayoutState: {
		sidebarHidden: boolean;
		panelHidden: boolean;
		statusbarHidden: boolean;
		activitybarHidden: boolean;
		auxiliarybarHidden: boolean;
	} | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IRequestService private readonly requestService: IRequestService,
		@INotificationService private readonly notificationService: INotificationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService
	) {
		super(WebAiChatEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		console.log('[WebAiChat] createEditor called');
		this._container = parent;
		this._container.style.width = '100%';
		this._container.style.height = '100%';
		this._container.style.overflow = 'hidden';

		console.log('[WebAiChat] Creating webview...');
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
		console.log('[WebAiChat] Webview created');

		// Show the webview first
		webview.claim(this, mainWindow, undefined);
		console.log('[WebAiChat] Webview claimed');

		// Attach webview to container
		parent.appendChild(webview.container);
		console.log('[WebAiChat] Webview container attached');

		// Set webview HTML content
		webview.setHtml(this.getWebviewContent());
		console.log('[WebAiChat] HTML content set');

		// Handle messages from webview
		this.webviewDisposables.add(
			webview.onMessage(event => {
				this.handleWebviewMessage(event.message);
			})
		);

		// Force layout after a delay
		setTimeout(() => {
			console.log('[WebAiChat] Performing initial layout');
			this.layoutWebview();
		}, 100);
	}

	override async setInput(input: EditorInput, options: any, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		console.log('[WebAiChat] setInput called with:', input);
		await super.setInput(input, options, context, token);

		// Enter fullscreen mode
		this.enterFullscreenMode();

		setTimeout(() => {
			this.layoutWebview();
		}, 100);
	}

	private enterFullscreenMode(): void {
		console.log('[WebAiChat] Entering fullscreen mode');

		// Save current layout state
		if (!this.previousLayoutState) {
			this.previousLayoutState = {
				sidebarHidden: !this.layoutService.isVisible(Parts.SIDEBAR_PART),
				panelHidden: !this.layoutService.isVisible(Parts.PANEL_PART),
				statusbarHidden: !this.layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow),
				activitybarHidden: !this.layoutService.isVisible(Parts.ACTIVITYBAR_PART),
				auxiliarybarHidden: !this.layoutService.isVisible(Parts.AUXILIARYBAR_PART)
			};
			console.log('[WebAiChat] Saved layout state');
		}

		// Close all other editors in all groups
		const currentGroup = this.group;
		this.editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).forEach(group => {
			if (group.id !== currentGroup.id) {
				// Close all editors in other groups
				group.closeAllEditors({ excludeSticky: false });
			} else {
				// Close all editors except Web AI Chat in current group
				const editors = group.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */);
				editors.forEach(editor => {
					if (!(editor instanceof WebAiChatEditorInput)) {
						group.closeEditor(editor);
					}
				});
			}
		});

		// Hide all UI parts for fullscreen experience
		console.log('[WebAiChat] Hiding all UI parts');
		this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
		this.layoutService.setPartHidden(true, Parts.PANEL_PART);
		this.layoutService.setPartHidden(true, Parts.STATUSBAR_PART);
		this.layoutService.setPartHidden(true, Parts.ACTIVITYBAR_PART);
		this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
		console.log('[WebAiChat] Fullscreen mode complete');
	}

	private restorePreviousLayout(): void {
		if (this.previousLayoutState) {
			// Restore previous layout state
			this.layoutService.setPartHidden(this.previousLayoutState.sidebarHidden, Parts.SIDEBAR_PART);
			this.layoutService.setPartHidden(this.previousLayoutState.panelHidden, Parts.PANEL_PART);
			this.layoutService.setPartHidden(this.previousLayoutState.statusbarHidden, Parts.STATUSBAR_PART);
			this.layoutService.setPartHidden(this.previousLayoutState.activitybarHidden, Parts.ACTIVITYBAR_PART);
			this.layoutService.setPartHidden(this.previousLayoutState.auxiliarybarHidden, Parts.AUXILIARYBAR_PART);

			this.previousLayoutState = undefined;
		}
	}

	override layout(dimension: Dimension): void {
		if (this._container) {
			this._container.style.width = `${dimension.width}px`;
			this._container.style.height = `${dimension.height}px`;
		}
		this.layoutWebview();
	}

	private layoutWebview(): void {
		if (this._container && this.webview) {
			const width = this._container.clientWidth;
			const height = this._container.clientHeight;
			console.log('[WebAiChat] Layout webview - dimensions:', width, 'x', height);

			if (width > 0 && height > 0) {
				this.webview.layoutWebviewOverElement(this._container, new Dimension(width, height));
				console.log('[WebAiChat] Webview layout applied successfully');
			} else {
				console.warn('[WebAiChat] Container has zero dimensions, retrying...');
				setTimeout(() => this.layoutWebview(), 100);
			}
		} else {
			console.warn('[WebAiChat] Cannot layout - container or webview missing');
		}
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

			// Check if embeddable
			const xFrameOptions = (response.res.headers['x-frame-options'] || '').toString().toUpperCase();
			const csp = (response.res.headers['content-security-policy'] || '').toString();

			let isEmbeddable = true;
			if (xFrameOptions === 'DENY' || xFrameOptions === 'SAMEORIGIN') {
				isEmbeddable = false;
			}
			if (csp.includes('frame-ancestors \'none\'') || csp.includes('frame-ancestors \'self\'')) {
				isEmbeddable = false;
			}

			// Clean content for AI (remove HTML tags)
			this.siteContent = htmlContent
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
				.replace(/<[^>]*>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();

			if (!isEmbeddable) {
				this.notificationService.notify({
					severity: Severity.Warning,
					message: 'Nội dung web đã được tải cho AI, nhưng không thể hiển thị do chính sách bảo mật của trang web.'
				});

				// Send message to display security warning in iframe instead of content
				this.webview?.postMessage({
					command: 'displaySecurityWarning',
					url: url,
					message: 'Trang web này không thể hiển thị do chính sách bảo mật (X-Frame-Options hoặc CSP). Tuy nhiên, nội dung đã được tải và bạn có thể hỏi AI về nội dung trang web.'
				});
			} else {
				this.notificationService.notify({
					severity: Severity.Info,
					message: 'Website content fetched successfully!'
				});

				// Inject <base> tag to help iframe resolve relative URLs
				let modifiedHtml = htmlContent;
				const baseTag = `<base href="${url}">`;

				// Try to inject after <head> tag
				if (modifiedHtml.match(/<head[^>]*>/i)) {
					modifiedHtml = modifiedHtml.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
				} else if (modifiedHtml.match(/<html[^>]*>/i)) {
					// If no <head>, inject after <html>
					modifiedHtml = modifiedHtml.replace(/(<html[^>]*>)/i, `$1\n<head>${baseTag}</head>`);
				} else {
					// If no structure, wrap it
					modifiedHtml = `<!DOCTYPE html><html><head>${baseTag}</head><body>${modifiedHtml}</body></html>`;
				}

				// Send HTML content to webview for display in iframe
				this.webview?.postMessage({
					command: 'displayWebsite',
					htmlContent: modifiedHtml,
					url: url
				});
			}

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
					<iframe id="websiteFrame" src="" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
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
					case 'displaySecurityWarning':
						// Display security warning message in iframe
						const warningHtml = \`<!DOCTYPE html>
						<html>
						<head>
							<meta charset="UTF-8">
							<style>
								body {
									font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
									display: flex;
									align-items: center;
									justify-content: center;
									height: 100vh;
									margin: 0;
									background-color: #1e1e1e;
									color: #cccccc;
								}
								.warning-container {
									text-align: center;
									padding: 40px;
									max-width: 500px;
								}
								.warning-icon {
									font-size: 64px;
									margin-bottom: 20px;
								}
								h2 {
									color: #f48771;
									margin-bottom: 20px;
								}
								p {
									line-height: 1.6;
									margin-bottom: 15px;
								}
								.url {
									color: #4ec9b0;
									word-break: break-all;
								}
							</style>
						</head>
						<body>
							<div class="warning-container">
								<div class="warning-icon">🔒</div>
								<h2>Không thể hiển thị trang web</h2>
								<p class="url">\${message.url}</p>
								<p>\${message.message}</p>
							</div>
						</body>
						</html>\`;
						websiteFrame.srcdoc = warningHtml;
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

	override clearInput(): void {
		// Cancel any ongoing requests
		if (this.loadRequestCancellation) {
			this.loadRequestCancellation.cancel();
			this.loadRequestCancellation.dispose();
		}

		// Restore previous layout
		this.restorePreviousLayout();

		super.clearInput();
	}

	override dispose(): void {
		// Cancel any ongoing requests
		if (this.loadRequestCancellation) {
			this.loadRequestCancellation.cancel();
			this.loadRequestCancellation.dispose();
		}

		// Restore previous layout
		this.restorePreviousLayout();

		this.webviewDisposables.dispose();
		if (this.webview) {
			this.webview.dispose();
		}
		super.dispose();
	}
}
