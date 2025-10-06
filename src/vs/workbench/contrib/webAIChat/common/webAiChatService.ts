/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { consumeStream } from '../../../../base/common/stream.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { localize } from '../../../../nls.js';
import {
	GEMINI_API_BASE_URL,
	GEMINI_MODEL,
	MAX_SITE_CONTENT_LENGTH,
	HTTP_OK_MIN,
	HTTP_OK_MAX,
	USER_AGENT
} from './webAiChatConstants.js';

export interface IWebsiteFetchResult {
	htmlContent: string;
	cleanedContent: string;
}

export interface IAIResponse {
	text: string;
	error?: boolean;
}

export class WebAiChatService {
	private siteContent: string = '';
	private loadRequestCancellation: CancellationTokenSource | undefined;

	constructor(
		private readonly requestService: IRequestService,
		private readonly configurationService: IConfigurationService,
		private readonly notificationService: INotificationService
	) { }

	public getSiteContent(): string {
		return this.siteContent;
	}

	public cancelLoadWebsite(): void {
		if (this.loadRequestCancellation) {
			this.loadRequestCancellation.cancel();
			this.loadRequestCancellation.dispose();
			this.loadRequestCancellation = undefined;
		}
	}

	public async fetchWebsite(url: string): Promise<IWebsiteFetchResult | null> {
		this.cancelLoadWebsite();
		this.loadRequestCancellation = new CancellationTokenSource();

		try {
			const urlObj = new URL(url);
			const origin = urlObj.origin;

			const response = await this.requestService.request({
				type: 'GET',
				url: url,
				headers: this.getBrowserHeaders(origin)
			}, this.loadRequestCancellation.token);

			const statusCode = response.res.statusCode || 0;
			if (statusCode < HTTP_OK_MIN || statusCode >= HTTP_OK_MAX) {
				throw new Error(localize('webAiChat.httpError', 'HTTP {0}: Failed to fetch', statusCode));
			}

			const buffer = await consumeStream(response.stream, chunks => VSBuffer.concat(chunks));
			const htmlContent = buffer.toString();

			this.siteContent = this.cleanHtmlContent(htmlContent);

			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('webAiChat.fetchSuccess', 'Website content fetched successfully!')
			});

			const modifiedHtml = this.injectScriptsToHtml(htmlContent, url);

			return {
				htmlContent: modifiedHtml,
				cleanedContent: this.siteContent
			};

		} catch (error: any) {
			if (error.name === 'Canceled') {
				return null;
			}

			this.siteContent = '';
			const errorMessage = this.getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: errorMessage
			});

			throw error;
		} finally {
			this.loadRequestCancellation?.dispose();
			this.loadRequestCancellation = undefined;
		}
	}

	public async askAI(question: string): Promise<IAIResponse> {
		if (!this.siteContent) {
			return {
				text: localize('webAiChat.noContent', 'Error: Please load a website first or check if the URL is correct.'),
				error: true
			};
		}

		const apiKey = this.configurationService.getValue<string>('webAiChat.apiKey');
		if (!apiKey) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: localize('webAiChat.apiKeyMissing', 'Please set your Google AI API Key in the settings.')
			});
			return {
				text: localize('webAiChat.apiKeyNotConfigured', 'API Key not configured.'),
				error: true
			};
		}

		try {
			const prompt = this.buildPrompt(question);
			const responseData = await this.callGeminiAPI(apiKey, prompt);

			const aiResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text ||
				localize('webAiChat.noAIResponse', 'No response from AI');

			return {
				text: aiResponse,
				error: false
			};

		} catch (error) {
			return {
				text: localize('webAiChat.aiError', 'Sorry, I encountered an error with the AI model.'),
				error: true
			};
		}
	}

	private getBrowserHeaders(origin: string): Record<string, string> {
		return {
			'User-Agent': USER_AGENT,
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
		};
	}

	private cleanHtmlContent(html: string): string {
		return html
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private injectScriptsToHtml(html: string, url: string): string {
		const sandboxFixScript = this.getSandboxFixScript();
		const baseTag = `<base href="${url}">`;

		let modifiedHtml = html;

		if (modifiedHtml.match(/<head[^>]*>/i)) {
			modifiedHtml = modifiedHtml.replace(/(<head[^>]*>)/i, `$1\n${baseTag}\n${sandboxFixScript}`);
		} else if (modifiedHtml.match(/<html[^>]*>/i)) {
			modifiedHtml = modifiedHtml.replace(/(<html[^>]*>)/i, `$1\n<head>${baseTag}${sandboxFixScript}</head>`);
		} else {
			modifiedHtml = `<!DOCTYPE html><html><head>${baseTag}${sandboxFixScript}</head><body>${modifiedHtml}</body></html>`;
		}

		return modifiedHtml;
	}

	private getSandboxFixScript(): string {
		return `<script>
	(function() {
		var originalError = console.error;
		var originalWarn = console.warn;
		console.error = function() {
			var args = Array.prototype.slice.call(arguments);
			var firstArg = args[0] ? String(args[0]) : '';
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

		var blockNavigation = function() { return false; };
		window.onbeforeunload = blockNavigation;

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

		safeWrap(EventTarget.prototype, 'addEventListener');

		safeWrap(document, 'write', function(content) {
			if (content && (String(content).includes('top.location') || String(content).includes('parent.location'))) {
				return;
			}
			return document.write.call(document, content);
		});

		window.addEventListener('error', function(e) {
			e.preventDefault();
			e.stopPropagation();
			return true;
		}, true);

		window.addEventListener('unhandledrejection', function(e) {
			e.preventDefault();
			return true;
		});

		var removeBlockers = function() {
			try {
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

		window.addEventListener('load', function() {
			removeBlockers();
			setInterval(removeBlockers, 2000);
		});
		setTimeout(removeBlockers, 1000);
	})();
</script>`;
	}

	private buildPrompt(question: string): string {
		const contentSubstring = this.siteContent.substring(0, MAX_SITE_CONTENT_LENGTH);
		return localize(
			'webAiChat.prompt',
			'Based ONLY on the following website content, answer the user\'s question.\nWebsite Content: "{0}"\n\nUser Question: "{1}"',
			contentSubstring,
			question
		);
	}

	private async callGeminiAPI(apiKey: string, prompt: string): Promise<any> {
		const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent`;

		const response = await this.requestService.request({
			type: 'POST',
			url: url,
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey
			},
			data: JSON.stringify({
				contents: [{
					parts: [{
						text: prompt
					}]
				}]
			})
		}, CancellationToken.None);

		const buffer = await consumeStream(response.stream, chunks => VSBuffer.concat(chunks));
		return JSON.parse(buffer.toString());
	}

	private getErrorMessage(error: any): string {
		if (!error.message) {
			return localize('webAiChat.fetchFailed', 'Failed to fetch website content.');
		}

		if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
			return localize('webAiChat.websiteNotFound', 'Cannot find the website. Please check the URL.');
		} else if (error.message.includes('ECONNREFUSED')) {
			return localize('webAiChat.connectionRefused', 'Connection refused. The website may be down.');
		} else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
			return localize('webAiChat.timeout', 'Request timeout. The website is taking too long to respond.');
		} else if (error.message.includes('CERT') || error.message.includes('certificate')) {
			return localize('webAiChat.certError', 'SSL certificate error. The website may have security issues.');
		} else if (error.message.includes('403')) {
			return localize('webAiChat.forbidden', 'Access forbidden (403). The website may be blocking automated requests.');
		} else if (error.message.includes('404')) {
			return localize('webAiChat.notFound', 'Page not found (404). Please check the URL.');
		} else if (error.message.includes('5')) {
			return localize('webAiChat.serverError', 'Server error ({0}). The website may be experiencing issues.', error.message);
		}

		return localize('webAiChat.fetchError', 'Failed to fetch: {0}', error.message);
	}

	public dispose(): void {
		this.cancelLoadWebsite();
	}
}

