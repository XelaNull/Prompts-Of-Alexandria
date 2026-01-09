/**
 * Alexandria Node Handlers
 * Frontend handlers for Alexandria custom nodes.
 * Manages WebSocket communication and custom widgets.
 *
 * @module alexandria/nodes
 */

import { api } from "../../../../scripts/api.js";
import * as Storage from "./storage.js";
import * as Detection from "./detection.js";
import * as UI from "./ui.js";

// Track save hashes to avoid duplicate saves during rapid execution
// Limited to MAX_HASH_ENTRIES to prevent memory leak over long sessions
const lastSaveHashes = new Map();
const MAX_HASH_ENTRIES = 100;

// Flag to prevent duplicate event listener registration
let handlersSetup = false;

// Lock to prevent race condition on concurrent saves
let saveInProgress = false;

// ============ WebSocket Handlers ============

/**
 * Setup WebSocket event handlers for node communication
 * Safe to call multiple times - only registers once
 */
export function setupWebSocketHandlers() {
  if (handlersSetup) {
    console.log('Alexandria: WebSocket handlers already setup');
    return;
  }

  // Listen for save trigger from backend
  api.addEventListener("alexandria.trigger_save", (event) => {
    const { node_id, template_name } = event.detail;
    console.log(`Alexandria: Save triggered by node ${node_id} for "${template_name}"`);
    handleNodeSave(template_name);
  });

  handlersSetup = true;
  console.log('Alexandria: WebSocket handlers registered');
}

/**
 * Handle save trigger from node execution
 * @param {string} templateName - Template name to save to
 */
export function handleNodeSave(templateName) {
  // Race condition guard - prevent concurrent saves from duplicating
  if (saveInProgress) {
    console.log('Alexandria: Save already in progress, skipping');
    return;
  }

  saveInProgress = true;

  try {
    const entries = Detection.createTemplateEntries();

    if (!entries || entries.length === 0) {
      console.log('Alexandria: No prompts detected to save');
      return;
    }

    // Check for changes using hash
    const newHash = Storage.computeEntriesHash(entries);
    const lastHash = lastSaveHashes.get(templateName);

    if (lastHash === newHash) {
      if (Storage.isDebugEnabled()) {
        console.log(`Alexandria: No changes for "${templateName}", skipping save`);
      }
      return;
    }

    // Save or update template
    const existing = Storage.getTemplateByName(templateName);
    let success = false;

    if (existing) {
      success = Storage.updateTemplate(existing.id, entries) !== null;
      if (success) {
        console.log(`Alexandria: Updated template "${templateName}" (${entries.length} prompts)`);
      }
    } else {
      success = Storage.createTemplate(templateName, entries) !== null;
      if (success) {
        console.log(`Alexandria: Created template "${templateName}" (${entries.length} prompts)`);
      }
    }

    // Only update hash cache if save actually succeeded
    if (success) {
      lastSaveHashes.set(templateName, newHash);

      // Memory leak prevention: evict oldest entries if over limit
      if (lastSaveHashes.size > MAX_HASH_ENTRIES) {
        const firstKey = lastSaveHashes.keys().next().value;
        lastSaveHashes.delete(firstKey);
      }
    } else {
      console.error(`Alexandria: Failed to save template "${templateName}" - localStorage may be full`);
      UI.showToast?.('Failed to save - storage may be full', 'error');
    }
  } finally {
    saveInProgress = false;
  }
}

// ============ Node Customization ============

/**
 * Add custom widgets to the Control Node
 * @param {Object} node - LiteGraph node
 */
export function addControlNodeWidgets(node) {
  // Get template name widget reference
  const getTemplateName = () => {
    const widget = node.widgets?.find(w => w.name === "template_name");
    return widget?.value || "My Template";
  };

  // Add Save Now button
  node.addWidget("button", "Save Now", null, () => {
    const templateName = getTemplateName();
    handleNodeSave(templateName);
    UI.showToast?.(`Saved "${templateName}"`);
  });

  // Add Open Panel button
  node.addWidget("button", "Open Panel", null, () => {
    UI.open();
  });

  // Style the node
  node.color = "#1a1a2e";
  node.bgcolor = "#16213e";

  if (Storage.isDebugEnabled()) {
    console.log(`Alexandria: Added widgets to Control node ${node.id}`);
  }
}

/**
 * Style a Save node
 * @param {Object} node - LiteGraph node
 */
export function styleSaveNode(node) {
  node.color = "#1a2e1a";
  node.bgcolor = "#162e16";
}

/**
 * Clear the save hash cache (for testing)
 */
export function clearSaveHashes() {
  lastSaveHashes.clear();
}
