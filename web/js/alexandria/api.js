/**
 * Alexandria Global API
 * Public API exposed on window.Alexandria for external access and debugging.
 *
 * @module alexandria/api
 */

import { app } from "../../../../scripts/app.js";
import * as Storage from "./storage.js";
import * as Detection from "./detection.js";
import * as UI from "./ui.js";

/**
 * Find a node matching a template entry using multi-criteria matching:
 * 1. Exact ID + type match (most reliable)
 * 2. Type + title match (for renamed nodes)
 * 3. Single type match (if only one instance)
 *
 * @param {Object} entry - Template entry
 * @returns {Object|null} Matching node or null
 */
function findNode(entry) {
  const nodes = app.graph?._nodes;
  if (!nodes) return null;

  // Try exact ID + type match first
  let match = nodes.find(n => n.id === entry.nodeId && n.type === entry.nodeType);
  if (match) return match;

  // Try type + title match
  match = nodes.find(n => n.type === entry.nodeType && (n.title || n.type) === entry.nodeTitle);
  if (match) return match;

  // If only one node of this type exists, use it
  const typeMatches = nodes.filter(n => n.type === entry.nodeType);
  if (typeMatches.length === 1) return typeMatches[0];

  return null;
}

/**
 * Validate template object structure
 * @param {*} template - Value to validate
 * @returns {boolean} True if valid template structure
 */
function isValidTemplate(template) {
  if (!template || typeof template !== 'object') return false;
  if (!Array.isArray(template.versions)) return false;
  if (typeof template.currentVersionIndex !== 'number') return false;
  if (template.currentVersionIndex < 0 || template.currentVersionIndex >= template.versions.length) return false;

  const version = template.versions[template.currentVersionIndex];
  if (!version || !Array.isArray(version.entries)) return false;

  return true;
}

/**
 * Restore a template to the current workflow
 * @param {Object} template - Template object
 * @returns {Object} Results with restored, skipped, and failed arrays
 */
function restoreTemplate(template) {
  // Input validation
  if (!isValidTemplate(template)) {
    console.error('Alexandria: restoreTemplate called with invalid template object');
    return { restored: [], skipped: [], failed: [], error: 'Invalid template structure' };
  }

  const version = template.versions[template.currentVersionIndex];
  const results = { restored: [], skipped: [], failed: [] };

  for (const entry of version.entries) {
    // Validate entry structure
    if (!entry || typeof entry !== 'object' || !entry.nodeType || !entry.widgetName) {
      results.skipped.push(entry);
      continue;
    }

    const node = findNode(entry);

    if (!node) {
      results.skipped.push(entry);
      continue;
    }

    const widget = node.widgets?.find(w => w.name === entry.widgetName);
    if (!widget) {
      results.skipped.push(entry);
      continue;
    }

    try {
      widget.value = entry.value;

      // Trigger widget callback if it exists
      if (widget.callback) {
        widget.callback(widget.value);
      }

      // Mark node as dirty
      if (node.setDirtyCanvas) {
        node.setDirtyCanvas(true);
      }

      results.restored.push(entry);
    } catch (e) {
      console.error(`Alexandria: Failed to restore ${entry.widgetName}:`, e);
      results.failed.push({ entry, error: e.message });
    }
  }

  // Refresh the canvas
  if (app.graph?.setDirtyCanvas) {
    app.graph.setDirtyCanvas(true, true);
  }

  console.log(`Alexandria: Restored ${results.restored.length}/${version.entries.length} prompts`);
  return results;
}

/**
 * Create and expose the global Alexandria API
 * @returns {Object} API object
 */
export function createGlobalAPI() {
  const api = {
    // UI
    open: () => UI.open(),
    close: () => UI.close(),
    toggle: () => UI.toggle(),
    isOpen: () => UI.isOpenState(),

    // Detection
    getDetectedPrompts: () => Detection.getDetectedPrompts(),
    getAllWorkflowWidgets: () => Detection.getAllWorkflowWidgets(),

    // Templates
    getTemplates: () => Storage.getTemplates(),
    getTemplate: (id) => Storage.getTemplate(id),
    getTemplateByName: (name) => Storage.getTemplateByName(name),

    /**
     * Save current detected prompts as a template
     * @param {string} name - Template name
     * @returns {Promise<Object|null>} Created template or null
     */
    async saveTemplate(name) {
      // Input validation
      if (typeof name !== 'string' || name.trim().length === 0) {
        console.error('Alexandria: saveTemplate requires a non-empty string name');
        return null;
      }

      const sanitizedName = name.trim().slice(0, 200); // Limit name length
      const entries = Detection.createTemplateEntries();

      if (!entries?.length) {
        console.warn('Alexandria: No prompts to save');
        return null;
      }

      const workflowInfo = Detection.getWorkflowIdentity();
      return Storage.createTemplateFileOnly(sanitizedName, entries, workflowInfo);
    },

    /**
     * Load a template by name
     * @param {string} name - Template name
     * @returns {Object|false} Restore results or false
     */
    loadTemplate(name) {
      // Input validation
      if (typeof name !== 'string' || name.trim().length === 0) {
        console.error('Alexandria: loadTemplate requires a non-empty string name');
        return false;
      }

      const template = Storage.getTemplateByName(name.trim());
      if (!template) {
        console.warn('Alexandria: Template not found:', name);
        return false;
      }
      return this.restoreTemplate(template);
    },

    /**
     * Restore a template object
     * @param {Object} template - Template object
     * @returns {Object} Restore results
     */
    restoreTemplate,

    // Import/Export
    exportData: () => Storage.exportAll(),
    downloadExport: () => Storage.downloadExport(),
    importData: async (data) => Storage.importAll(data),

    // Settings
    getSettings: () => Storage.getSettings(),
    saveSettings: (settings) => Storage.saveSettings(settings),
    enableDebug: () => Storage.saveSettings({ ...Storage.getSettings(), debug: true }),
    disableDebug: () => Storage.saveSettings({ ...Storage.getSettings(), debug: false }),

    // Version
    version: '1.0.0',
  };

  return api;
}

/**
 * Install the global API on window
 */
export function installGlobalAPI() {
  window.Alexandria = createGlobalAPI();

  // Also expose internal modules for debugging
  window.AlexandriaStorage = Storage;
  window.AlexandriaDetection = Detection;
  window.AlexandriaUI = UI;

  console.log('Alexandria: Global API installed');
}
