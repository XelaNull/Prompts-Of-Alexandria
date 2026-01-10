/**
 * Alexandria Detection Engine
 * Multi-method prompt detection with confidence scoring.
 *
 * Detection Methods (in order of confidence):
 * 1. Backward Link Tracing (95%) - Traces from KSampler inputs back to text encoders
 * 2. Known Node Types (90%) - Matches against known prompt node types
 * 3. Output Type Analysis (85%) - CLIP input + CONDITIONING output
 * 4. Input Slot Pattern (80%) - CLIP input + multiline text widget
 * 5. Widget Name Pattern (75-80%) - Matches prompt/text/positive/negative patterns
 * 6. Widget Type Heuristics (60%) - Multiline text widgets with content
 * 7. Manual Override (100%) - User-specified inclusions/exclusions
 *
 * @module alexandria/detection
 */

import { app } from "../../../../scripts/app.js";
import * as Storage from "./storage.js";

// ============ Configuration ============

/**
 * Known prompt node types and their prompt widget names
 * This is the most reliable detection method for common nodes
 */
const KNOWN_PROMPT_NODES = {
  // Core ComfyUI
  'CLIPTextEncode': ['text'],
  'CLIPTextEncodeSDXL': ['text_g', 'text_l'],
  'CLIPTextEncodeSDXLRefiner': ['text'],
  'CLIPTextEncodeSD3': ['text', 'text_g', 'text_l', 'text_t5xxl'],
  'CLIPTextEncodeFlux': ['text'],
  'CLIPTextEncodeHunyuanDiT': ['text'],

  // Popular extensions
  'WildcardEncode': ['text'],
  'ImpactWildcardEncode': ['wildcard_text', 'populated_text'],
  'easy positive': ['positive'],
  'easy negative': ['negative'],
  'CR Prompt Text': ['prompt'],
  'ShowText|pysssss': ['text'],
  'Efficient Loader': ['positive', 'negative'],
  'Eff. Loader SDXL': ['positive', 'negative'],
};

/**
 * Node types that are samplers (have positive/negative conditioning inputs)
 */
const SAMPLER_NODES = [
  'KSampler',
  'KSamplerAdvanced',
  'SamplerCustom',
  'SamplerCustomAdvanced',
  'KSamplerSelect',
];

/**
 * Nodes that pass through conditioning (for link tracing)
 */
const CONDITIONING_COMBINERS = [
  'ConditioningCombine',
  'ConditioningConcat',
  'ConditioningAverage',
  'ConditioningSetArea',
  'ConditioningSetMask',
  'ConditioningSetTimestepRange',
  'ControlNetApply',
  'ControlNetApplyAdvanced',
  'IPAdapterApply',
  'IPAdapterApplyAdvanced',
  'unCLIPConditioning',
  'GLIGENTextBoxApply',
];

/**
 * Widget name patterns that suggest prompt content
 */
const WIDGET_NAME_PATTERNS = [
  { pattern: /^text$/i, boost: 5 },
  { pattern: /^prompt$/i, boost: 5 },
  { pattern: /^positive$/i, boost: 5 },
  { pattern: /^negative$/i, boost: 5 },
  { pattern: /prompt/i, boost: 0 },
  { pattern: /caption/i, boost: 0 },
  { pattern: /wildcard/i, boost: 0 },
  { pattern: /description/i, boost: 0 },
];

/**
 * Widget names that are NOT prompts (false positive prevention)
 */
const NON_PROMPT_WIDGET_NAMES = [
  'filename', 'path', 'directory', 'folder',
  'prefix', 'suffix', 'format', 'extension',
  'json', 'yaml', 'config', 'settings',
  'code', 'script', 'command',
  'url', 'uri', 'link',
  'model', 'checkpoint', 'lora',
  'output', 'input', 'result',
  'api_key', 'token', 'secret',
];

// ============ Widget Type Detection ============

/**
 * Check if a widget is a text-type widget
 * @param {Object} widget - LiteGraph widget
 * @returns {boolean}
 */
export function isTextWidget(widget) {
  if (!widget) return false;
  return (
    widget.type === 'customtext' ||
    widget.type === 'string' ||
    widget.type === 'text' ||
    (widget.inputEl && widget.inputEl.tagName === 'TEXTAREA')
  );
}

/**
 * Check if a widget is a multiline text widget (more likely to be a prompt)
 * @param {Object} widget - LiteGraph widget
 * @returns {boolean}
 */
export function isMultilineTextWidget(widget) {
  if (!widget) return false;
  return (
    widget.type === 'customtext' ||
    widget.options?.multiline === true ||
    (widget.inputEl && widget.inputEl.tagName === 'TEXTAREA')
  );
}

/**
 * Check if a node is a text encoder (has CLIP in, CONDITIONING out, text widget)
 * @param {Object} node - LiteGraph node
 * @returns {boolean}
 */
export function isTextEncoder(node) {
  if (!node) return false;
  const hasClipIn = node.inputs?.some(i => i.type === 'CLIP');
  const hasCondOut = node.outputs?.some(o => o.type === 'CONDITIONING');
  const hasTextWidget = node.widgets?.some(w => isTextWidget(w));
  return hasClipIn && hasCondOut && hasTextWidget;
}

/**
 * Check if a node passes through conditioning
 * @param {Object} node - LiteGraph node
 * @returns {boolean}
 */
export function hasConditioningPassthrough(node) {
  if (!node) return false;
  return (
    node.inputs?.some(i => i.type === 'CONDITIONING') &&
    node.outputs?.some(o => o.type === 'CONDITIONING')
  );
}

// ============ Graph Utilities ============

/**
 * Get the link object for a node input
 * @param {Object} node - LiteGraph node
 * @param {string} inputName - Input slot name
 * @returns {Object|null} Link object or null
 */
function getInputLink(node, inputName) {
  if (!node?.inputs) return null;
  const input = node.inputs.find(i => i.name === inputName);
  if (!input || input.link == null) return null; // Use == to catch both null and undefined
  return app.graph.links?.[input.link] || null;
}

/**
 * Get a node by ID from the graph
 * @param {number} id - Node ID
 * @returns {Object|null} Node or null
 */
function getNodeById(id) {
  return app.graph?._nodes?.find(n => n.id === id) || null;
}

/**
 * Get all text widgets from a node
 * @param {Object} node - LiteGraph node
 * @returns {Array} Array of text widgets
 */
function getTextWidgets(node) {
  return node?.widgets?.filter(w => isTextWidget(w)) || [];
}

/**
 * Get display name for a node
 * @param {Object} node - LiteGraph node
 * @returns {string} Display name
 */
export function getNodeDisplayName(node) {
  return node?.title || node?.type || `Node #${node?.id}`;
}

// ============ Detection Methods ============

/**
 * Method 1: Backward Link Tracing (95% confidence)
 * Traces from KSampler positive/negative inputs back through the graph
 * to find text encoders that feed into them.
 *
 * @returns {Map} Map of "nodeId:widgetName" -> detection result
 */
function detectByBackwardLinkTracing() {
  const results = new Map();
  if (!app.graph?._nodes) return results;

  // Find all sampler nodes
  const samplers = app.graph._nodes.filter(n =>
    SAMPLER_NODES.includes(n.type) ||
    (n.inputs?.some(i => i.name === 'positive' && i.type === 'CONDITIONING'))
  );

  if (Storage.isDebugEnabled()) {
    console.log(`Alexandria: Found ${samplers.length} sampler nodes for backward tracing`);
  }

  for (const sampler of samplers) {
    _traceConditioningChain(sampler, 'positive', results, new Set());
    _traceConditioningChain(sampler, 'negative', results, new Set());
  }

  return results;
}

/**
 * Recursively trace conditioning chain backward
 * @private
 */
function _traceConditioningChain(node, inputName, results, visited) {
  const link = getInputLink(node, inputName);
  if (!link) return;

  const sourceNode = getNodeById(link.origin_id);
  if (!sourceNode) return;

  // Create unique key for visited set (node ID + output slot)
  // BUG FIX: Was using inputName which caused incorrect skipping
  const visitKey = `${sourceNode.id}:${link.origin_slot}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);

  // If this is a text encoder, capture its text widgets
  if (isTextEncoder(sourceNode)) {
    for (const widget of getTextWidgets(sourceNode)) {
      const key = `${sourceNode.id}:${widget.name}`;
      if (!results.has(key) || results.get(key).confidence < 95) {
        results.set(key, {
          node: sourceNode,
          widget,
          confidence: 95,
          method: 'backward_link_tracing'
        });
      }
    }
    return; // Don't trace further past text encoders
  }

  // If this node passes through conditioning, trace its inputs
  if (hasConditioningPassthrough(sourceNode) || CONDITIONING_COMBINERS.includes(sourceNode.type)) {
    const condInputs = sourceNode.inputs?.filter(i => i.type === 'CONDITIONING') || [];
    for (const input of condInputs) {
      _traceConditioningChain(sourceNode, input.name, results, visited);
    }
  }
}

/**
 * Method 2: Known Node Types (90% confidence)
 * Matches against a list of known prompt node types.
 *
 * @returns {Map} Detection results
 */
function detectByKnownNodeType() {
  const results = new Map();
  if (!app.graph?._nodes) return results;

  for (const node of app.graph._nodes) {
    const widgetNames = KNOWN_PROMPT_NODES[node.type];
    if (!widgetNames) continue;

    for (const widgetName of widgetNames) {
      const widget = node.widgets?.find(w => w.name === widgetName);
      if (widget) {
        const key = `${node.id}:${widget.name}`;
        if (!results.has(key)) {
          results.set(key, {
            node,
            widget,
            confidence: 90,
            method: 'known_node_type'
          });
        }
      }
    }
  }

  return results;
}

/**
 * Method 3: Output Type Analysis (85% confidence)
 * Nodes with CLIP input and CONDITIONING output containing text widgets.
 *
 * @returns {Map} Detection results
 */
function detectByOutputType() {
  const results = new Map();
  if (!app.graph?._nodes) return results;

  for (const node of app.graph._nodes) {
    if (!node.outputs?.some(o => o.type === 'CONDITIONING')) continue;
    if (!node.inputs?.some(i => i.type === 'CLIP')) continue;

    for (const widget of getTextWidgets(node)) {
      const key = `${node.id}:${widget.name}`;
      if (!results.has(key) || results.get(key).confidence < 85) {
        results.set(key, {
          node,
          widget,
          confidence: 85,
          method: 'output_type_analysis'
        });
      }
    }
  }

  return results;
}

/**
 * Method 4: Input Slot Pattern (80% confidence)
 * Nodes with CLIP input and multiline text widgets.
 *
 * @returns {Map} Detection results
 */
function detectByInputPattern() {
  const results = new Map();
  if (!app.graph?._nodes) return results;

  for (const node of app.graph._nodes) {
    if (!node.inputs?.some(i => i.type === 'CLIP')) continue;

    const textWidgets = node.widgets?.filter(w => isMultilineTextWidget(w)) || [];
    for (const widget of textWidgets) {
      const key = `${node.id}:${widget.name}`;
      if (!results.has(key) || results.get(key).confidence < 80) {
        results.set(key, {
          node,
          widget,
          confidence: 80,
          method: 'input_slot_pattern'
        });
      }
    }
  }

  return results;
}

/**
 * Method 5: Widget Name Pattern (75-80% confidence)
 * Text widgets with names matching prompt-related patterns.
 *
 * @returns {Map} Detection results
 */
function detectByWidgetName() {
  const results = new Map();
  if (!app.graph?._nodes) return results;

  for (const node of app.graph._nodes) {
    if (!node.widgets) continue;

    for (const widget of node.widgets) {
      if (!isTextWidget(widget)) continue;

      let matched = false;
      let bestBoost = 0;

      for (const { pattern, boost } of WIDGET_NAME_PATTERNS) {
        if (pattern.test(widget.name)) {
          matched = true;
          bestBoost = Math.max(bestBoost, boost);
        }
      }

      if (matched) {
        const confidence = 75 + bestBoost;
        const key = `${node.id}:${widget.name}`;
        if (!results.has(key) || results.get(key).confidence < confidence) {
          results.set(key, {
            node,
            widget,
            confidence,
            method: 'widget_name_pattern'
          });
        }
      }
    }
  }

  return results;
}

/**
 * Method 6: Widget Type Heuristics (60% confidence)
 * Any multiline text widget with content that doesn't look like code/config.
 *
 * @returns {Map} Detection results
 */
function detectByWidgetType() {
  const results = new Map();
  if (!app.graph?._nodes) return results;

  for (const node of app.graph._nodes) {
    if (!node.widgets) continue;

    for (const widget of node.widgets) {
      if (!isMultilineTextWidget(widget)) continue;

      // Skip widgets with non-prompt-like names
      const nameLower = widget.name.toLowerCase();
      if (NON_PROMPT_WIDGET_NAMES.some(n => nameLower.includes(n))) continue;

      // Note: We include empty values now (removed the check that excluded them)
      // Users might want to back up intentionally empty prompts

      const key = `${node.id}:${widget.name}`;
      if (!results.has(key) || results.get(key).confidence < 60) {
        results.set(key, {
          node,
          widget,
          confidence: 60,
          method: 'widget_type_heuristic'
        });
      }
    }
  }

  return results;
}

/**
 * Method 7: Manual Overrides (100% confidence for includes, marks exclusions)
 * Applies user-specified inclusions and exclusions.
 * Keys are now per-instance: "nodeId:widgetName" for specific node control.
 *
 * @param {Map} results - Existing detection results (mutated)
 * @returns {Map} Modified results
 */
function applyManualOverrides(results) {
  const manualSelections = Storage.getManualSelections();
  if (!app.graph?._nodes) return results;

  // First pass: add manual inclusions
  for (const [key, include] of Object.entries(manualSelections)) {
    if (!include) continue;
    const [nodeIdStr, widgetName] = key.split(':');
    const nodeId = parseInt(nodeIdStr, 10);
    const node = app.graph._nodes.find(n => n.id === nodeId);

    if (!node) continue; // Node no longer exists in workflow

    const widget = node.widgets?.find(w => w.name === widgetName);
    if (!widget) continue;

    const resultKey = `${node.id}:${widget.name}`;
    results.set(resultKey, {
      node,
      widget,
      confidence: 100,
      method: 'user_manual_selection'
    });
  }

  // Second pass: mark exclusions
  for (const [key, include] of Object.entries(manualSelections)) {
    if (include !== false) continue;
    const [nodeIdStr, widgetName] = key.split(':');
    const nodeId = parseInt(nodeIdStr, 10);

    const resultKey = `${nodeId}:${widgetName}`;
    if (results.has(resultKey)) {
      results.get(resultKey).excluded = true;
    }
  }

  return results;
}

// ============ Main Detection API ============

/**
 * Run all detection methods and combine results
 * Higher confidence methods take precedence
 *
 * @returns {Map} Map of "nodeId:widgetName" -> detection result
 */
export function detectAllPrompts() {
  const results = new Map();

  const methods = [
    { fn: detectByBackwardLinkTracing, name: 'backward_link_tracing' },
    { fn: detectByKnownNodeType, name: 'known_node_type' },
    { fn: detectByOutputType, name: 'output_type_analysis' },
    { fn: detectByInputPattern, name: 'input_slot_pattern' },
    { fn: detectByWidgetName, name: 'widget_name_pattern' },
    { fn: detectByWidgetType, name: 'widget_type_heuristic' },
  ];

  for (const { fn, name } of methods) {
    try {
      const methodResults = fn();
      let count = 0;
      for (const [key, result] of methodResults) {
        if (!results.has(key) || results.get(key).confidence < result.confidence) {
          results.set(key, result);
          count++;
        }
      }
      if (Storage.isDebugEnabled() && count > 0) {
        console.log(`Alexandria: ${name} found ${count} prompts`);
      }
    } catch (e) {
      console.warn(`Alexandria: Detection method ${name} failed`, e);
    }
  }

  applyManualOverrides(results);
  return results;
}

/**
 * Get detected prompts as an array, sorted by confidence
 * Excludes manually excluded widgets
 *
 * @returns {Array} Array of detection results
 */
export function getDetectedPrompts() {
  const results = detectAllPrompts();
  return Array.from(results.values())
    .filter(r => !r.excluded)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find which ComfyUI canvas group a node belongs to
 * @param {Object} node - LiteGraph node
 * @returns {Object|null} Group object or null if not in a group
 */
function findNodeGroup(node) {
  if (!app.graph?._groups || !node.pos) return null;

  const nodeX = node.pos[0];
  const nodeY = node.pos[1];

  for (const group of app.graph._groups) {
    // Try multiple ways to get group bounds (LiteGraph varies)
    let gx, gy, gw, gh;

    if (group._bounding && group._bounding.length === 4) {
      [gx, gy, gw, gh] = group._bounding;
    } else if (group.bounding && group.bounding.length === 4) {
      [gx, gy, gw, gh] = group.bounding;
    } else if (group._pos && group._size) {
      // Fallback: use _pos and _size
      gx = group._pos[0];
      gy = group._pos[1];
      gw = group._size[0];
      gh = group._size[1];
    } else if (group.pos && group.size) {
      // Another fallback
      gx = group.pos[0];
      gy = group.pos[1];
      gw = group.size[0];
      gh = group.size[1];
    } else {
      continue; // No valid bounds found
    }

    // Check if node position is within group bounds
    if (nodeX >= gx && nodeX <= gx + gw && nodeY >= gy && nodeY <= gy + gh) {
      return group;
    }
  }

  return null;
}

/**
 * Get all workflow widgets with detection status
 * Used by the UI to show all nodes and which widgets are detected
 *
 * @returns {Array} Array of node data with widgets
 */
export function getAllWorkflowWidgets() {
  if (!app.graph?._nodes) return [];

  const detectedPrompts = detectAllPrompts();
  const nodes = [];

  for (const node of app.graph._nodes) {
    if (!node.widgets || node.widgets.length === 0) continue;

    // Find canvas group for this node
    const canvasGroup = findNodeGroup(node);
    // Group title can be in different properties depending on LiteGraph version
    const groupTitle = canvasGroup ? (canvasGroup.title || canvasGroup._title || 'Unnamed Group') : null;

    const nodeData = {
      id: node.id,
      type: node.type,
      title: node.title || node.type,
      pos: node.pos ? { x: node.pos[0], y: node.pos[1] } : null,
      mode: node.mode,
      canvasGroup: groupTitle,
      widgets: [],
    };

    for (const widget of node.widgets) {
      const key = `${node.id}:${widget.name}`;
      const detection = detectedPrompts.get(key);

      nodeData.widgets.push({
        name: widget.name,
        value: widget.value,
        type: widget.type,
        isDetected: !!detection && !detection.excluded,
        isExcluded: detection?.excluded || false,
        confidence: detection?.confidence || 0,
        method: detection?.method || null,
      });
    }

    nodes.push(nodeData);
  }

  // Sort: detected nodes first, then alphabetically
  nodes.sort((a, b) => {
    const aHas = a.widgets.some(w => w.isDetected);
    const bHas = b.widgets.some(w => w.isDetected);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.title.localeCompare(b.title);
  });

  return nodes;
}

/**
 * Create template entries from detected prompts
 * @param {Array} detectedPrompts - Optional pre-detected prompts
 * @returns {Array} Array of template entry objects
 */
export function createTemplateEntries(detectedPrompts = null) {
  if (!detectedPrompts) {
    detectedPrompts = getDetectedPrompts();
  }

  return detectedPrompts.map(p => ({
    nodeType: p.node.type,
    nodeTitle: p.node.title || p.node.type,
    nodeId: p.node.id,
    widgetName: p.widget.name,
    value: p.widget.value,
    valueType: typeof p.widget.value,
    detectionMethod: p.method,
    confidenceScore: p.confidence,
  }));
}

// ============ Workflow Identity ============

/**
 * Check if the current workflow has been saved (has a filename)
 * @returns {boolean} True if workflow is saved
 */
export function isWorkflowSaved() {
  return getWorkflowFilename() !== null;
}

/**
 * Get a unique identifier for the current workflow.
 * Tries multiple methods in order of preference:
 * 1. Workflow filename from ComfyUI (if saved)
 * 2. Generated signature from node structure
 *
 * @returns {Object} { id: string, name: string, source: string, isSaved: boolean }
 */
export function getWorkflowIdentity() {
  // Method 1: Try to get filename from ComfyUI
  // ComfyUI stores this in various places depending on version
  const filename = getWorkflowFilename();
  if (filename) {
    return {
      id: generateWorkflowHash(filename),
      name: filename.replace(/\.json$/i, ''),
      source: 'filename',
      isSaved: true
    };
  }

  // Method 2: Generate from node structure (workflow not saved)
  const signature = generateWorkflowSignature();
  return {
    id: signature.hash,
    name: signature.name,
    source: 'generated',
    isSaved: false
  };
}

/**
 * Try to get the workflow filename from ComfyUI
 * @returns {string|null} Filename or null if not saved/available
 */
function getWorkflowFilename() {
  try {
    // ComfyUI stores filename in different places depending on version
    // Try common locations
    if (app.graphDialog?.filename) {
      return app.graphDialog.filename;
    }
    if (app.graph?.filename) {
      return app.graph.filename;
    }
    // Check for title in graph (sometimes set from filename)
    if (app.graph?.title && app.graph.title !== 'Workflow') {
      return app.graph.title;
    }
    // Check localStorage for last loaded workflow
    const lastWorkflow = localStorage.getItem('Comfy.PreviousWorkflow');
    if (lastWorkflow) {
      try {
        const data = JSON.parse(lastWorkflow);
        if (data.workflow?.name) return data.workflow.name;
      } catch (e) { /* ignore parse errors */ }
    }
  } catch (e) {
    console.warn('Alexandria: Could not get workflow filename', e);
  }
  return null;
}

/**
 * Generate a workflow signature based on node structure.
 * Creates a stable-ish identifier from the types of nodes present.
 *
 * @returns {Object} { hash: string, name: string }
 */
function generateWorkflowSignature() {
  if (!app.graph?._nodes) {
    return { hash: 'empty', name: 'Empty Workflow' };
  }

  const nodes = app.graph._nodes;

  // Count node types for signature
  const typeCounts = {};
  for (const node of nodes) {
    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
  }

  // Sort for consistent ordering
  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Generate hash from node type composition
  const signatureStr = sortedTypes
    .map(([type, count]) => `${type}:${count}`)
    .join('|');

  const hash = simpleHash(signatureStr);

  // Generate a human-readable name
  const promptCount = getDetectedPrompts().length;
  const totalNodes = nodes.length;
  const name = `Untitled (${promptCount} prompt${promptCount !== 1 ? 's' : ''}, ${totalNodes} nodes)`;

  return { hash, name };
}

/**
 * Generate a simple hash from a string
 * @param {string} str - Input string
 * @returns {string} Hash string
 */
function generateWorkflowHash(str) {
  return 'wf_' + simpleHash(str);
}

/**
 * Simple hash function (djb2)
 * @param {string} str - Input string
 * @returns {string} Hex hash
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Export configuration for potential extension
export { KNOWN_PROMPT_NODES, SAMPLER_NODES, CONDITIONING_COMBINERS };
