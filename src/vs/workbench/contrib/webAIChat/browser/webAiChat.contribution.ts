/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { webAiChatConfigurationNode } from '../../../../workbench/contrib/webAIChat/common/webAiChatConfiguration.js';
import { WebAiChatEditor, WebAiChatEditorInput } from './webAiChatEditor.js';
import { EditorExtensions, IEditorFactoryRegistry, IEditorSerializer } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ServicesAccessor, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

// Note: We don't need View Container or Sidebar View anymore
// Web AI Chat is rendered directly in Editor Group for full screen experience

// Register Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration(webAiChatConfigurationNode);

// Register Editor Serializer
class WebAiChatEditorInputSerializer implements IEditorSerializer {
	canSerialize(editorInput: EditorInput): boolean {
		return true;
	}

	serialize(input: WebAiChatEditorInput): string {
		return '';
	}

	deserialize(instantiationService: IInstantiationService): WebAiChatEditorInput {
		return instantiationService.createInstance(WebAiChatEditorInput);
	}
}

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(WebAiChatEditorInput.ID, WebAiChatEditorInputSerializer);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(
		EditorPaneDescriptor.create(
			WebAiChatEditor,
			WebAiChatEditor.ID,
			localize('webAiChatEditor', 'Web AI Chat')
		),
		[new SyncDescriptor(WebAiChatEditorInput)]
	);

// Register Command to open full screen editor
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'webAiChat.openFullScreen',
			title: localize2('openWebAiChatFullScreen', 'Open Web AI Chat (Full Screen)'),
			category: localize2('webAiChatCategory', 'Web AI Chat'),
			f1: true, // Show in Command Palette
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const input = new WebAiChatEditorInput();
		await editorService.openEditor(input, { pinned: true });
	}
});

// Auto-open Web AI Chat Editor on startup
class WebAiChatAutoOpener extends Disposable implements IWorkbenchContribution {
	constructor(
		@IEditorService private readonly editorService: IEditorService
	) {
		super();
		this.openWebAiChat();
	}

	private async openWebAiChat(): Promise<void> {
		// Open Web AI Chat Editor automatically on startup
		const input = new WebAiChatEditorInput();
		await this.editorService.openEditor(input, { pinned: true });
	}
}

// Register the auto-opener to run on workbench restored
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WebAiChatAutoOpener, LifecyclePhase.Restored);
