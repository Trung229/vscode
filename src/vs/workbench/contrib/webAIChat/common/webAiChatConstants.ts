/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// API Configuration
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_MODEL = 'gemini-2.0-flash-exp';

// Content Limits
export const MAX_SITE_CONTENT_LENGTH = 15000;
export const MIN_CONTAINER_DIMENSION = 0;

// Timing Constants
export const LAYOUT_RETRY_DELAY_MS = 100;
export const BLOCKER_REMOVAL_INTERVAL_MS = 2000;
export const BLOCKER_REMOVAL_INITIAL_DELAY_MS = 1000;

// HTTP Status Codes
export const HTTP_OK_MIN = 200;
export const HTTP_OK_MAX = 300;

// Z-Index Threshold
export const HIGH_ZINDEX_THRESHOLD = 999;

// Default Dimensions
export const DEFAULT_PANEL_WIDTH_PERCENT = 50;
export const MIN_PANEL_WIDTH_PX = 200;
export const RESIZER_WIDTH_PX = 5;

// HTTP Headers
export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

