/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, ViewContainerLocation, Extensions as ViewContainerExtensions, IViewsRegistry, Extensions as ViewExtensions, ViewContainer } from '../../../../workbench/common/views.js';
import { HELLO_WORLD_CONTAINER_ID, HELLO_WORLD_VIEW_ID } from '../common/helloWorld.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../../workbench/browser/parts/views/viewPaneContainer.js';
import { HelloWorldView } from './helloWorldView.js';

// 1. Đăng ký một icon mới
const helloWorldIcon = registerIcon('hello-world-view-icon', Codicon.smiley, localize('helloWorldIcon', 'Icon for the Hello World view.'));

// 2. Đăng ký View Container (cái panel ở sidebar)
const viewContainer: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(
	{
		id: HELLO_WORLD_CONTAINER_ID,
		title: localize2('helloWorld', "Hello World"),
		icon: helloWorldIcon, // Sử dụng icon vừa đăng ký
		order: 6, // Vị trí trên Activity Bar
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [HELLO_WORLD_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
		storageId: 'workbench.helloWorld.state'
	},
	ViewContainerLocation.Sidebar, // Chỉ định vị trí là ở Sidebar
	{ isDefault: true }
);

// 3. Đăng ký View (nội dung "Xin chào") và đặt nó vào trong View Container
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews(
	[{
		id: HELLO_WORLD_VIEW_ID,
		name: localize2('helloWorldView', "Hello World View 123"),
		ctorDescriptor: new SyncDescriptor(HelloWorldView), // Trỏ tới class logic của view
		containerIcon: helloWorldIcon,
		canToggleVisibility: true,
		canMoveView: true,
	}],
	viewContainer // Quan trọng: chỉ định view này thuộc về container nào
);
