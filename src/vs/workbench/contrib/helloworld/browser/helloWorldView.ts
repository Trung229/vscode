/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IViewletViewOptions } from '../../../../workbench/browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../../workbench/browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../../workbench/common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';

export class HelloWorldView extends ViewPane {

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
		@IHoverService hoverService: IHoverService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	/**
	 * Đây là phương thức quan trọng nhất, nó được gọi khi View cần được hiển thị.
	 * Chúng ta sẽ thêm nội dung vào `container` ở đây.
	 */
	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		// Tạo một thẻ div để chứa nội dung
		const content = document.createElement('div');
		content.style.padding = '10px';
		content.textContent = 'Xin chào Workbench!';

		// Thêm nó vào container chính của View
		container.appendChild(content);
	}

	/**
	 * Phương thức này được dùng để sắp xếp lại bố cục khi kích thước thay đổi.
	 * Với ví dụ đơn giản này, chúng ta không cần làm gì cả.
	 */
	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
	}
}
