/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IConfigurationNode } from '../../../../platform/configuration/common/configurationRegistry.js';

export const webAiChatConfigurationNode: IConfigurationNode = {
	id: 'webAiChat',
	order: 100,
	title: localize('webAiChat', 'Web AI Chat'),
	type: 'object',
	properties: {
		'webAiChat.apiKey': {
			type: 'string',
			default: '',
			description: localize('webAiChat.apiKey', 'Google AI API Key for Gemini. Get your API key from https://makersuite.google.com/app/apikey'),
			scope: 5 // APPLICATION scope
		}
	}
};

