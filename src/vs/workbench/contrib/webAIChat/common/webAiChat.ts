/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { localize } from '../../../../nls.js';

// View IDs
export const WEB_AI_CHAT_VIEW_ID = 'workbench.view.webAiChat';
export const WEB_AI_CHAT_CONTAINER_ID = 'workbench.view.webAiChatContainer';

// Context Keys
export const WebAiChatContext = new RawContextKey<boolean>(
	'webAiChatContext',
	false
);

// Titles
export const WEB_AI_CHAT_TITLE = localize('webAiChat', 'Web AI Chat');
