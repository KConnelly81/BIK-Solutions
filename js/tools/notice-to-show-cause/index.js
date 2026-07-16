/**
 * Notice to Show Cause — Tool Entry Point
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

export function init() {
  const ctrl = new ToolController(SCHEMA, generateDocument, DOC_CONFIG);
  ctrl.mount();
}
