/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dimension } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
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
import { WebAiChatService } from '../common/webAiChatService.js';
import { getWebviewContent } from './webAiChatWebview.js';
import { LAYOUT_RETRY_DELAY_MS, MIN_CONTAINER_DIMENSION } from '../common/webAiChatConstants.js';
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
	private readonly chatService: WebAiChatService;
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
		@IRequestService requestService: IRequestService,
		@INotificationService notificationService: INotificationService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService
	) {
		super(WebAiChatEditor.ID, group, telemetryService, themeService, storageService);
		this.chatService = new WebAiChatService(requestService, configurationService, notificationService);
		this._register(this.chatService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._container = parent;
		this._container.style.width = '100%';
		this._container.style.height = '100%';
		this._container.style.overflow = 'hidden';

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

		webview.claim(this, mainWindow, undefined);
		parent.appendChild(webview.container);
		webview.setHtml(getWebviewContent());

		this.webviewDisposables.add(
			webview.onMessage(event => {
				this.handleWebviewMessage(event.message);
			})
		);

		setTimeout(() => {
			this.layoutWebview();
		}, LAYOUT_RETRY_DELAY_MS);
	}

	override async setInput(input: EditorInput, options: any, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this.enterFullscreenMode();

		setTimeout(() => {
			this.layoutWebview();
		}, LAYOUT_RETRY_DELAY_MS);
	}

	private enterFullscreenMode(): void {
		if (!this.previousLayoutState) {
			this.previousLayoutState = {
				sidebarHidden: !this.layoutService.isVisible(Parts.SIDEBAR_PART),
				panelHidden: !this.layoutService.isVisible(Parts.PANEL_PART),
				statusbarHidden: !this.layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow),
				activitybarHidden: !this.layoutService.isVisible(Parts.ACTIVITYBAR_PART),
				auxiliarybarHidden: !this.layoutService.isVisible(Parts.AUXILIARYBAR_PART)
			};
		}

		const currentGroup = this.group;
		this.editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).forEach(group => {
			if (group.id !== currentGroup.id) {
				group.closeAllEditors({ excludeSticky: false });
			} else {
				const editors = group.getEditors(0);
				editors.forEach(editor => {
					if (!(editor instanceof WebAiChatEditorInput)) {
						group.closeEditor(editor);
					}
				});
			}
		});

		this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
		this.layoutService.setPartHidden(true, Parts.PANEL_PART);
		this.layoutService.setPartHidden(true, Parts.STATUSBAR_PART);
		this.layoutService.setPartHidden(true, Parts.ACTIVITYBAR_PART);
		this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
	}

	private restorePreviousLayout(): void {
		if (this.previousLayoutState) {
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

			if (width > MIN_CONTAINER_DIMENSION && height > MIN_CONTAINER_DIMENSION) {
				this.webview.layoutWebviewOverElement(this._container, new Dimension(width, height));
			} else {
				setTimeout(() => this.layoutWebview(), LAYOUT_RETRY_DELAY_MS);
			}
		}
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

	override clearInput(): void {
		this.restorePreviousLayout();
		super.clearInput();
	}

	override dispose(): void {
		this.restorePreviousLayout();
		this.webviewDisposables.dispose();
		if (this.webview) {
			this.webview.dispose();
		}
		super.dispose();
	}
}
