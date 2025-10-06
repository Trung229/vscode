/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IViewDescriptorService } from '../../../../workbench/common/views.js';
import { ViewPane } from '../../../../workbench/browser/parts/views/viewPane.js';
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
import { WEB_AI_CHAT_VIEW_ID } from '../../../../workbench/contrib/webAIChat/common/webAiChat.js';
import { IWebviewService, IOverlayWebview, WebviewContentPurpose } from '../../../../workbench/contrib/webview/browser/webview.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { WebAiChatService } from '../common/webAiChatService.js';
import { getWebviewContent } from './webAiChatWebview.js';
import { MIN_CONTAINER_DIMENSION } from '../common/webAiChatConstants.js';
import './media/webAiChat.css';

export class WebAiChatView extends ViewPane {
	private webview: IOverlayWebview | undefined;
	private readonly webviewDisposables = this._register(new DisposableStore());
	private _container: HTMLElement | undefined;
	private readonly chatService: WebAiChatService;

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
		@IRequestService requestService: IRequestService,
		@INotificationService notificationService: INotificationService,
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

		this.chatService = new WebAiChatService(requestService, configurationService, notificationService);
		this._register(this.chatService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this._container = container;

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

		webview.setHtml(getWebviewContent());
		container.appendChild(webview.container);
		webview.claim(this, mainWindow, undefined);

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
				this.chatService.cancelLoadWebsite();
				break;
			case 'askLLM':
				await this.handleAskLLM(message.question || '');
				break;
		}
	}

	private async handleLoadWebsite(url: string): Promise<void> {
		try {
			const result = await this.chatService.fetchWebsite(url);

			if (result) {
				this.webview?.postMessage({
					command: 'displayWebsite',
					htmlContent: result.htmlContent,
					url: url
				});
			}
		} catch (error) {
			// Error is already handled by the service
		} finally {
			this.webview?.postMessage({ command: 'loadComplete' });
		}
	}

	private async handleAskLLM(question: string): Promise<void> {
		const response = await this.chatService.askAI(question);
		this.webview?.postMessage({
			command: 'llmResponse',
			text: response.text
		});
	}

	private layoutWebview(): void {
		if (this._container && this.webview) {
			const width = this._container.clientWidth;
			const height = this._container.clientHeight;

			if (width > MIN_CONTAINER_DIMENSION && height > MIN_CONTAINER_DIMENSION) {
				this.webview.layoutWebviewOverElement(this._container, new Dimension(width, height));
			}
		}
	}

	override setVisible(visible: boolean): void {
		super.setVisible(visible);

		if (visible) {
			this.layoutService.setPartHidden(true, Parts.EDITOR_PART);
		} else {
			this.layoutService.setPartHidden(false, Parts.EDITOR_PART);
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		mainWindow.requestAnimationFrame(() => {
			this.layoutWebview();
		});
	}

	override dispose(): void {
		this.webviewDisposables.dispose();
		if (this.webview) {
			this.webview.dispose();
		}
		super.dispose();
	}
}
