/**
 * Alexandria Storage Module
 * Handles server-side file storage for templates, settings, and manual selections.
 * All data is stored on the server for cross-PC access.
 *
 * @module alexandria/storage
 */

// Default settings (used when server has no settings yet)
const DEFAULT_SETTINGS = {
  retention: {
    maxVersionsPerTemplate: 20,
    maxAgeDays: 30,
  },
  debug: false,
  detectionMode: 'precise', // 'lazy' = include more widgets, 'precise' = only high-confidence prompts
  templateOrder: [], // Custom template ordering (array of template IDs)
  filterType: 'all', // Configure mode filter: 'all', 'detected', or 'overrides'
};

// Storage key for tracked workflow name (kept in localStorage as it's session-specific)
const WORKFLOW_NAME_KEY = 'alexandria_current_workflow';

// Storage key for current storage directory
const STORAGE_DIR_KEY = 'alexandria_storage_directory';

// Cache for current storage directory from backend
let _currentStorageDir = null;

// Templates cache - loaded from server file storage
let _templatesCache = [];
let _templatesCacheLoaded = false;

// Settings cache - loaded from server
let _settingsCache = null;
let _settingsCacheLoaded = false;

// Manual selections cache - loaded from server per workflow
let _manualSelectionsCache = {};
let _currentWorkflowOverridesId = null;

// ============ File Storage API ============

/**
 * Get the current storage directory from the backend
 * @returns {Promise<string|null>} Storage directory path or null
 */
export async function getStorageDirectory() {
  try {
    const response = await fetch('/alexandria/storage-dir');
    const data = await response.json();
    if (data.status === 'ok') {
      _currentStorageDir = data.storage_directory;
      return data.storage_directory;
    }
  } catch (e) {
    console.warn('Alexandria: Could not get storage directory from backend', e);
  }
  return _currentStorageDir;
}

/**
 * Set the storage directory on the backend
 * @param {string} directory - Storage directory path
 * @returns {Promise<boolean>} Success status
 */
export async function setStorageDirectory(directory) {
  try {
    const response = await fetch('/alexandria/storage-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_directory: directory })
    });
    const data = await response.json();
    if (data.status === 'ok') {
      _currentStorageDir = data.storage_directory;
      localStorage.setItem(STORAGE_DIR_KEY, data.storage_directory);
      return true;
    }
  } catch (e) {
    console.warn('Alexandria: Could not set storage directory', e);
  }
  return false;
}

/**
 * Save a template to file storage (via backend API)
 * @param {Object} template - Template data to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveTemplateToFile(template) {
  try {
    const response = await fetch('/alexandria/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    });
    const data = await response.json();
    return data.status === 'ok';
  } catch (e) {
    console.warn('Alexandria: Could not save template to file', e);
    return false;
  }
}

/**
 * Load templates from file storage (via backend API)
 * @returns {Promise<Array>} Array of templates from file storage
 */
export async function loadTemplatesFromFiles() {
  try {
    const response = await fetch('/alexandria/templates', {
      cache: 'no-store' // Always fetch fresh templates for cross-device sync
    });
    const data = await response.json();
    if (data.status === 'ok') {
      return data.templates || [];
    }
  } catch (e) {
    console.warn('Alexandria: Could not load templates from files', e);
  }
  return [];
}

/**
 * Delete a template from file storage
 * @param {string} templateName - Name of template to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTemplateFromFile(templateName) {
  try {
    const response = await fetch('/alexandria/templates/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName })
    });
    const data = await response.json();
    return data.status === 'ok';
  } catch (e) {
    console.warn('Alexandria: Could not delete template from file', e);
    return false;
  }
}

/**
 * Sync templates - refreshes cache from server file storage
 * @returns {Promise<Array>} Templates array
 * @deprecated Use refreshTemplatesFromServer() instead
 */
export async function syncTemplates() {
  return refreshTemplatesFromServer();
}

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Simple hash function for string content
 * Uses djb2 algorithm - fast and good distribution for our use case
 * @param {string} str - String to hash
 * @returns {string} Hex hash string
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Compute a hash for template entries (for diff detection)
 * Entries are sorted before hashing to ensure consistency
 * @param {Array} entries - Template entries
 * @returns {string} Hash string
 */
function computeEntriesHash(entries) {
  if (!entries || entries.length === 0) return '0';

  const sorted = [...entries].sort((a, b) => {
    const keyA = `${a.nodeType}:${a.nodeTitle}:${a.widgetName}`;
    const keyB = `${b.nodeType}:${b.nodeTitle}:${b.widgetName}`;
    return keyA.localeCompare(keyB);
  });

  const content = sorted.map(e =>
    `${e.nodeType}|${e.widgetName}|${JSON.stringify(e.value)}`
  ).join('\n');

  return simpleHash(content);
}

/**
 * Safe JSON parse with fallback
 * @param {string} json - JSON string
 * @param {*} fallback - Fallback value on parse failure
 * @returns {*} Parsed value or fallback
 */
function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch (e) {
    console.warn('Alexandria: JSON parse failed', e);
    return fallback;
  }
}

/**
 * Safe localStorage get
 * @param {string} key - Storage key
 * @param {*} fallback - Fallback value
 * @returns {*} Stored value or fallback
 */
function safeGet(key, fallback) {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch (e) {
    console.warn(`Alexandria: Failed to read ${key}`, e);
    return fallback;
  }
}

/**
 * Safe localStorage set
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success status
 */
function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Alexandria: Failed to write ${key}`, e);
    return false;
  }
}

// ============ Settings (Server-Side Storage) ============

/**
 * Load settings from server
 * @returns {Promise<Object>} Settings object
 */
export async function loadSettingsFromServer() {
  try {
    const response = await fetch('/alexandria/settings', {
      cache: 'no-store' // Always fetch fresh settings for cross-device sync
    });
    const data = await response.json();
    if (data.status === 'ok') {
      _settingsCache = { ...DEFAULT_SETTINGS, ...data.settings };
      _settingsCacheLoaded = true;
      return _settingsCache;
    }
  } catch (e) {
    console.warn('Alexandria: Could not load settings from server', e);
  }
  _settingsCache = { ...DEFAULT_SETTINGS };
  _settingsCacheLoaded = true;
  return _settingsCache;
}

/**
 * Save settings to server
 * @param {Object} settings - Settings to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveSettingsToServer(settings) {
  try {
    const response = await fetch('/alexandria/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    const data = await response.json();
    if (data.status === 'ok') {
      _settingsCache = { ...DEFAULT_SETTINGS, ...settings };
      return true;
    }
  } catch (e) {
    console.warn('Alexandria: Could not save settings to server', e);
  }
  return false;
}

/**
 * Get settings (from cache - call loadSettingsFromServer first)
 * @returns {Object} Settings object
 */
export function getSettings() {
  if (!_settingsCacheLoaded) {
    console.warn('Alexandria: Settings cache not loaded - using defaults');
    return { ...DEFAULT_SETTINGS };
  }
  return _settingsCache || { ...DEFAULT_SETTINGS };
}

/**
 * Save settings (async, saves to server)
 * @param {Object} settings - Settings to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveSettings(settings) {
  _settingsCache = { ...DEFAULT_SETTINGS, ...settings };
  return saveSettingsToServer(settings);
}

/**
 * Check if settings have been loaded
 * @returns {boolean}
 */
export function isSettingsCacheLoaded() {
  return _settingsCacheLoaded;
}

export function isDebugEnabled() {
  return getSettings().debug === true;
}

/**
 * Get current detection mode
 * @returns {string} 'lazy' or 'precise'
 */
export function getDetectionMode() {
  return getSettings().detectionMode || 'precise';
}

/**
 * Set detection mode (async, saves to server)
 * @param {string} mode - 'lazy' or 'precise'
 * @returns {Promise<boolean>} Success status
 */
export async function setDetectionMode(mode) {
  const settings = getSettings();
  settings.detectionMode = mode;
  return saveSettings(settings);
}

/**
 * Get current filter type for Configure mode
 * @returns {string} 'all', 'detected', or 'overrides'
 */
export function getFilterType() {
  return getSettings().filterType || 'all';
}

/**
 * Set filter type (async, saves to server)
 * @param {string} type - 'all', 'detected', or 'overrides'
 * @returns {Promise<boolean>} Success status
 */
export async function setFilterType(type) {
  const settings = getSettings();
  settings.filterType = type;
  return saveSettings(settings);
}

// ============ Tracked Workflow Name ============

/**
 * Get the tracked workflow name (set by save/load hooks)
 * @returns {string|null} Workflow name or null
 */
export function getTrackedWorkflowName() {
  try {
    return localStorage.getItem(WORKFLOW_NAME_KEY) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Set the tracked workflow name (called by save/load hooks)
 * @param {string} name - Workflow name
 */
export function setTrackedWorkflowName(name) {
  try {
    if (name) {
      localStorage.setItem(WORKFLOW_NAME_KEY, name);
    } else {
      localStorage.removeItem(WORKFLOW_NAME_KEY);
    }
  } catch (e) {
    console.warn('Alexandria: Could not save tracked workflow name', e);
  }
}

// ============ Manual Selections (Server-Side Per-Workflow Storage) ============

/**
 * Generate a stable widget key that works across sessions and devices
 * Uses nodeType:nodeTitle:widgetName format instead of nodeId
 * @param {string} nodeType - Node type
 * @param {string} nodeTitle - Node title (or type if no title)
 * @param {string} widgetName - Widget name
 * @returns {string} Stable widget key
 */
export function getStableWidgetKey(nodeType, nodeTitle, widgetName) {
  // Normalize the key to handle minor differences
  const type = (nodeType || 'unknown').trim();
  const title = (nodeTitle || nodeType || 'unknown').trim();
  const widget = (widgetName || 'unknown').trim();
  return `${type}:${title}:${widget}`;
}

/**
 * Load manual selections for the current workflow from server
 * @param {string} workflowId - Workflow ID to load overrides for
 * @returns {Promise<Object>} Manual selections object
 */
export async function loadManualSelectionsFromServer(workflowId) {
  if (!workflowId) {
    console.warn('Alexandria: No workflow ID provided for loading manual selections');
    return {};
  }

  try {
    const response = await fetch(`/alexandria/workflow-overrides/${encodeURIComponent(workflowId)}`, {
      cache: 'no-store' // Always fetch fresh overrides for cross-device sync
    });
    const data = await response.json();
    if (data.status === 'ok') {
      _manualSelectionsCache = data.overrides?.manualSelections || {};
      _currentWorkflowOverridesId = workflowId;
      return _manualSelectionsCache;
    }
  } catch (e) {
    console.warn('Alexandria: Could not load manual selections from server', e);
  }
  _manualSelectionsCache = {};
  _currentWorkflowOverridesId = workflowId;
  return _manualSelectionsCache;
}

/**
 * Save manual selections for the current workflow to server
 * @param {string} workflowId - Workflow ID
 * @param {Object} selections - Manual selections to save
 * @param {string} workflowName - Optional workflow name for display
 * @returns {Promise<boolean>} Success status
 */
export async function saveManualSelectionsToServer(workflowId, selections, workflowName = null) {
  if (!workflowId) {
    console.warn('Alexandria: No workflow ID provided for saving manual selections');
    return false;
  }

  try {
    const response = await fetch(`/alexandria/workflow-overrides/${encodeURIComponent(workflowId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: {
          workflowName: workflowName,
          manualSelections: selections,
          updatedAt: new Date().toISOString()
        }
      })
    });
    const data = await response.json();
    if (data.status === 'ok') {
      _manualSelectionsCache = selections;
      _currentWorkflowOverridesId = workflowId;
      return true;
    }
  } catch (e) {
    console.warn('Alexandria: Could not save manual selections to server', e);
  }
  return false;
}

/**
 * Get manual selections (from cache - must load first)
 * @returns {Object} Manual selections object
 */
export function getManualSelections() {
  return _manualSelectionsCache || {};
}

/**
 * Save manual selections (async, saves to server)
 * Uses the current workflow context
 * @param {Object} selections - Selections to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveManualSelections(selections) {
  _manualSelectionsCache = selections;
  if (_currentWorkflowOverridesId) {
    const workflowName = getTrackedWorkflowName();
    return saveManualSelectionsToServer(_currentWorkflowOverridesId, selections, workflowName);
  }
  console.warn('Alexandria: Cannot save manual selections - no workflow context');
  return false;
}

/**
 * Set a single manual selection using stable key
 * @param {string} nodeType - Node type
 * @param {string} nodeTitle - Node title
 * @param {string} widgetName - Widget name
 * @param {boolean|null} include - true to include, false to exclude, null to remove
 * @returns {Promise<boolean>} Success status
 */
export async function setManualSelection(nodeType, nodeTitle, widgetName, include) {
  const selections = getManualSelections();
  const key = getStableWidgetKey(nodeType, nodeTitle, widgetName);

  if (include === null || include === undefined) {
    delete selections[key];
  } else {
    selections[key] = include;
  }

  return saveManualSelections(selections);
}

/**
 * Get a single manual selection using stable key
 * @param {string} nodeType - Node type
 * @param {string} nodeTitle - Node title
 * @param {string} widgetName - Widget name
 * @returns {boolean|null} true/false if set, null if not set
 */
export function getManualSelection(nodeType, nodeTitle, widgetName) {
  const selections = getManualSelections();
  const key = getStableWidgetKey(nodeType, nodeTitle, widgetName);
  return key in selections ? selections[key] : null;
}

/**
 * Get the current workflow overrides ID
 * @returns {string|null} Current workflow ID or null
 */
export function getCurrentWorkflowOverridesId() {
  return _currentWorkflowOverridesId;
}

/**
 * Set the current workflow context for manual selections
 * @param {string} workflowId - Workflow ID
 */
export function setCurrentWorkflowOverridesId(workflowId) {
  _currentWorkflowOverridesId = workflowId;
}

// ============ Templates (Server File Storage) ============

/**
 * Refresh templates cache from server file storage
 * Call this when opening the UI to ensure fresh data
 * @returns {Promise<Array>} Templates array
 */
export async function refreshTemplatesFromServer() {
  try {
    const templates = await loadTemplatesFromFiles();
    _templatesCache = templates;
    _templatesCacheLoaded = true;
    if (isDebugEnabled()) {
      console.log(`Alexandria: Loaded ${templates.length} templates from server`);
    }
    return templates;
  } catch (e) {
    console.error('Alexandria: Failed to load templates from server', e);
    return _templatesCache;
  }
}

/**
 * Get all templates (from cache, must call refreshTemplatesFromServer first)
 * @returns {Array} Templates array
 */
export function getTemplates() {
  if (!_templatesCacheLoaded) {
    console.warn('Alexandria: Templates cache not loaded - call refreshTemplatesFromServer() first');
  }
  return _templatesCache;
}

/**
 * Check if templates cache has been loaded
 * @returns {boolean}
 */
export function isTemplatesCacheLoaded() {
  return _templatesCacheLoaded;
}

/**
 * Update the local templates cache (after a save operation)
 * @param {Object} template - Template to add or update in cache
 */
export function updateTemplatesCache(template) {
  const index = _templatesCache.findIndex(t => t.id === template.id || t.name === template.name);
  if (index >= 0) {
    _templatesCache[index] = template;
  } else {
    _templatesCache.push(template);
  }
}

/**
 * Remove a template from the local cache
 * @param {string} templateId - Template ID to remove
 */
export function removeFromTemplatesCache(templateId) {
  _templatesCache = _templatesCache.filter(t => t.id !== templateId);
}

export function getTemplate(id) {
  return getTemplates().find(t => t.id === id) || null;
}

export function getTemplateByName(name) {
  return getTemplates().find(t => t.name === name) || null;
}

// ============ Template Ordering ============

/**
 * Get the custom template order (array of template IDs)
 * Now reads from server-side settings for cross-device sync
 * @returns {Array} Array of template IDs in custom order
 */
export function getTemplateOrder() {
  const settings = getSettings();
  return settings.templateOrder || [];
}

/**
 * Save custom template order to server
 * @param {Array} order - Array of template IDs in desired order
 * @returns {Promise<boolean>} Success status
 */
export async function saveTemplateOrder(order) {
  const settings = getSettings();
  settings.templateOrder = order;
  return saveSettings(settings);
}

/**
 * Get templates sorted by custom order
 * Templates not in the order list appear at the end (by creation date)
 * @returns {Array} Sorted templates
 */
export function getTemplatesSorted() {
  const templates = getTemplates();
  const order = getTemplateOrder();

  if (order.length === 0) {
    // No custom order, return by most recently updated
    return [...templates].sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  // Create a map for quick lookup
  const orderMap = new Map(order.map((id, idx) => [id, idx]));

  return [...templates].sort((a, b) => {
    const aIdx = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
    const bIdx = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;

    if (aIdx === Infinity && bIdx === Infinity) {
      // Both not in order, sort by date
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    }
    return aIdx - bIdx;
  });
}

/**
 * Move a template to a new position in the order
 * Saves to server for cross-device sync
 * @param {string} templateId - Template ID to move
 * @param {number} newIndex - New position index
 * @returns {Promise<Array>} Updated order array
 */
export async function reorderTemplate(templateId, newIndex) {
  const templates = getTemplates();
  let order = getTemplateOrder();

  // Initialize order with all template IDs if empty
  if (order.length === 0) {
    order = templates
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(t => t.id);
  }

  // Remove template from current position
  const currentIndex = order.indexOf(templateId);
  if (currentIndex !== -1) {
    order.splice(currentIndex, 1);
  }

  // Insert at new position
  order.splice(newIndex, 0, templateId);

  // Clean up: remove IDs that no longer exist
  const existingIds = new Set(templates.map(t => t.id));
  order = order.filter(id => existingIds.has(id));

  await saveTemplateOrder(order);
  return order;
}

// Note: createTemplate and updateTemplate have been replaced by
// createTemplateFileOnly and updateTemplateFileOnly for server-side storage

/**
 * Delete a template from file storage and cache
 * @param {string} id - Template ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTemplate(id) {
  const template = getTemplate(id);

  if (!template) {
    return false;
  }

  const name = template.name;

  // Delete from file storage
  const success = await deleteTemplateFromFile(name);

  if (success) {
    // Remove from local cache
    removeFromTemplatesCache(id);

    if (isDebugEnabled()) {
      console.log(`Alexandria: Deleted template "${name}"`);
    }
  } else {
    console.error(`Alexandria: Failed to delete template "${name}" from file storage`);
  }

  return success;
}

/**
 * Rename a template in file storage and cache
 * @param {string} id - Template ID
 * @param {string} newName - New template name
 * @returns {Promise<Object|null>} Updated template or null
 */
export async function renameTemplate(id, newName) {
  const template = getTemplate(id);

  if (!template) {
    return null;
  }

  const oldName = template.name;

  // Delete old file
  await deleteTemplateFromFile(oldName);

  // Update template
  template.name = newName;
  template.updatedAt = new Date().toISOString();

  // Save with new name
  const success = await saveTemplateToFile(template);

  if (success) {
    // Update cache
    updateTemplatesCache(template);

    if (isDebugEnabled()) {
      console.log(`Alexandria: Renamed template "${oldName}" to "${newName}"`);
    }

    return template;
  }

  console.error(`Alexandria: Failed to rename template "${oldName}" to "${newName}"`);
  return null;
}

/**
 * Apply retention policy to template versions
 * Removes old versions based on maxVersions and maxAgeDays settings
 * @param {Object} template - Template object (mutated in place)
 */
function applyRetention(template) {
  const settings = getSettings();
  const { maxVersionsPerTemplate, maxAgeDays } = settings.retention;
  const now = Date.now();

  // Filter by age (keep current version regardless of age)
  if (maxAgeDays > 0) {
    const originalLength = template.versions.length;
    template.versions = template.versions.filter((v, i) => {
      if (i === template.currentVersionIndex) return true;
      const ageDays = (now - new Date(v.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays <= maxAgeDays;
    });

    // Adjust currentVersionIndex if versions were removed before it
    if (template.currentVersionIndex >= template.versions.length) {
      template.currentVersionIndex = template.versions.length - 1;
    }

    if (isDebugEnabled() && template.versions.length < originalLength) {
      console.log(`Alexandria: Pruned ${originalLength - template.versions.length} old versions`);
    }
  }

  // Limit total versions (remove oldest, keep current)
  while (template.versions.length > maxVersionsPerTemplate) {
    let oldestIndex = -1;
    let oldestTime = Infinity;

    for (let i = 0; i < template.versions.length; i++) {
      if (i === template.currentVersionIndex) continue;
      const time = new Date(template.versions[i].timestamp).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestIndex = i;
      }
    }

    if (oldestIndex >= 0) {
      template.versions.splice(oldestIndex, 1);
      if (template.currentVersionIndex > oldestIndex) {
        template.currentVersionIndex--;
      }
    } else {
      break; // Safety: couldn't find a version to remove
    }
  }
}

// ============ Workflow Filtering ============

/**
 * Get templates for a specific workflow (respects custom order)
 * Matches by workflowId, with fallback to workflowName comparison
 * @param {string} workflowId - Workflow ID to filter by
 * @param {string} workflowName - Optional workflow name for fallback matching
 * @returns {Array} Templates matching the workflow
 */
export function getTemplatesForWorkflow(workflowId, workflowName) {
  return getTemplatesSorted().filter(function(t) {
    // Direct ID match
    if (t.workflowId === workflowId) return true;
    // Fallback: compare workflow names (handles old templates with mismatched IDs)
    if (workflowName && t.workflowName) {
      var currentName = workflowName.toLowerCase().replace(/\.json$/i, '').trim();
      var templateName = t.workflowName.toLowerCase().replace(/\.json$/i, '').trim();
      return templateName === currentName;
    }
    return false;
  });
}

/**
 * Get templates NOT associated with a specific workflow (respects custom order)
 * @param {string} workflowId - Workflow ID to exclude
 * @param {string} workflowName - Optional workflow name for fallback matching
 * @returns {Array} Templates from other workflows
 */
export function getTemplatesFromOtherWorkflows(workflowId, workflowName) {
  return getTemplatesSorted().filter(function(t) {
    if (!t.workflowId) return false; // Legacy templates without workflow
    // Check if it matches current workflow (by ID or name)
    if (t.workflowId === workflowId) return false;
    if (workflowName && t.workflowName) {
      var currentName = workflowName.toLowerCase().replace(/\.json$/i, '').trim();
      var templateName = t.workflowName.toLowerCase().replace(/\.json$/i, '').trim();
      if (templateName === currentName) return false;
    }
    return true;
  });
}

/**
 * Get legacy templates (those without workflow association, respects custom order)
 * @returns {Array} Templates without workflowId
 */
export function getLegacyTemplates() {
  return getTemplatesSorted().filter(t => !t.workflowId);
}

/**
 * Get unique workflow names from all templates
 * @returns {Array} Array of { id, name, count } objects
 */
export function getWorkflowList() {
  const templates = getTemplates();
  const workflows = new Map();

  for (const template of templates) {
    const id = template.workflowId || '_legacy';
    const name = template.workflowName || 'Unknown Workflow';

    if (!workflows.has(id)) {
      workflows.set(id, { id, name, count: 0 });
    }
    workflows.get(id).count++;
  }

  return Array.from(workflows.values()).sort((a, b) => {
    // Legacy at the end
    if (a.id === '_legacy') return 1;
    if (b.id === '_legacy') return -1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Update workflow info for a template
 * @param {string} templateId - Template ID
 * @param {Object} workflowInfo - { id, name } workflow info
 * @returns {Promise<Object|null>} Updated template or null
 */
export async function updateTemplateWorkflow(templateId, workflowInfo) {
  const template = getTemplate(templateId);

  if (!template) return null;

  template.workflowId = workflowInfo?.id || null;
  template.workflowName = workflowInfo?.name || null;
  template.updatedAt = new Date().toISOString();

  // Save to file storage
  const success = await saveTemplateToFile(template);
  if (success) {
    updateTemplatesCache(template);
    return template;
  }

  console.error(`Alexandria: Failed to update workflow for template "${template.name}"`);
  return null;
}

// ============ Import/Export ============

// Security limits for imports
const IMPORT_LIMITS = {
  maxTemplates: 500,
  maxVersionsPerTemplate: 50,
  maxEntriesPerVersion: 200,
  maxStringLength: 50000, // ~50KB per string value
  maxTotalSize: 5 * 1024 * 1024, // 5MB total import size
};

/**
 * Validate and sanitize a template object
 * @param {Object} template - Template to validate
 * @returns {Object|null} Sanitized template or null if invalid
 */
function validateTemplate(template) {
  if (!template || typeof template !== 'object') return null;
  if (typeof template.id !== 'string') return null;
  if (typeof template.name !== 'string') return null;
  if (!Array.isArray(template.versions)) return null;

  // Sanitize name (prevent XSS via template names)
  const sanitizedName = String(template.name).slice(0, 200);

  // Validate versions
  const sanitizedVersions = [];
  for (const version of template.versions.slice(0, IMPORT_LIMITS.maxVersionsPerTemplate)) {
    if (!version || typeof version !== 'object') continue;
    if (!Array.isArray(version.entries)) continue;

    // Validate entries
    const sanitizedEntries = [];
    for (const entry of version.entries.slice(0, IMPORT_LIMITS.maxEntriesPerVersion)) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.nodeType !== 'string') continue;
      if (typeof entry.widgetName !== 'string') continue;

      // Truncate overly long values
      let value = entry.value;
      if (typeof value === 'string' && value.length > IMPORT_LIMITS.maxStringLength) {
        value = value.slice(0, IMPORT_LIMITS.maxStringLength);
        console.warn(`Alexandria: Truncated long value in import`);
      }

      sanitizedEntries.push({
        nodeType: String(entry.nodeType).slice(0, 200),
        nodeTitle: String(entry.nodeTitle || entry.nodeType).slice(0, 200),
        nodeId: Number(entry.nodeId) || 0,
        widgetName: String(entry.widgetName).slice(0, 200),
        value: value,
        valueType: String(entry.valueType || typeof value).slice(0, 50),
        detectionMethod: String(entry.detectionMethod || 'imported').slice(0, 50),
        confidenceScore: Number(entry.confidenceScore) || 0,
      });
    }

    if (sanitizedEntries.length > 0) {
      sanitizedVersions.push({
        id: String(version.id || generateId()),
        timestamp: String(version.timestamp || new Date().toISOString()),
        hash: String(version.hash || ''),
        entries: sanitizedEntries,
      });
    }
  }

  if (sanitizedVersions.length === 0) return null;

  return {
    id: String(template.id),
    name: sanitizedName,
    createdAt: String(template.createdAt || new Date().toISOString()),
    updatedAt: String(template.updatedAt || new Date().toISOString()),
    versions: sanitizedVersions,
    currentVersionIndex: Math.min(
      Math.max(0, Number(template.currentVersionIndex) || 0),
      sanitizedVersions.length - 1
    ),
  };
}

export function exportAll() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: getTemplates(),
    manualSelections: getManualSelections(),
    settings: getSettings(),
  };
}

export async function importAll(data, rawSize = 0) {
  try {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data: not an object');
    }

    // Size check (if provided by caller)
    if (rawSize > IMPORT_LIMITS.maxTotalSize) {
      throw new Error(`Import too large: ${(rawSize / 1024 / 1024).toFixed(1)}MB exceeds ${IMPORT_LIMITS.maxTotalSize / 1024 / 1024}MB limit`);
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Validate and import templates to file storage
    if (data.templates && Array.isArray(data.templates)) {
      if (data.templates.length > IMPORT_LIMITS.maxTemplates) {
        console.warn(`Alexandria: Import has ${data.templates.length} templates, limiting to ${IMPORT_LIMITS.maxTemplates}`);
      }

      for (const template of data.templates.slice(0, IMPORT_LIMITS.maxTemplates)) {
        const validated = validateTemplate(template);
        if (validated) {
          // Save each template to file storage
          const success = await saveTemplateToFile(validated);
          if (success) {
            updateTemplatesCache(validated);
            importedCount++;
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }
    }

    // Import manual selections (simple key-value, just validate types)
    if (data.manualSelections && typeof data.manualSelections === 'object' && !Array.isArray(data.manualSelections)) {
      const validSelections = {};
      for (const [key, value] of Object.entries(data.manualSelections)) {
        if (typeof key === 'string' && key.length < 500 && typeof value === 'boolean') {
          validSelections[key] = value;
        }
      }
      saveManualSelections(validSelections);
    }

    // Import settings (validate structure)
    if (data.settings && typeof data.settings === 'object') {
      const currentSettings = getSettings();
      const newSettings = { ...currentSettings };

      if (data.settings.retention && typeof data.settings.retention === 'object') {
        newSettings.retention = {
          maxVersionsPerTemplate: Math.min(100, Math.max(1, Number(data.settings.retention.maxVersionsPerTemplate) || 20)),
          maxAgeDays: Math.min(365, Math.max(0, Number(data.settings.retention.maxAgeDays) || 30)),
        };
      }

      if (typeof data.settings.debug === 'boolean') {
        newSettings.debug = data.settings.debug;
      }

      saveSettings(newSettings);
    }

    console.log(`Alexandria: Imported ${importedCount} templates (${skippedCount} skipped as invalid)`);
    return { success: true, imported: importedCount, skipped: skippedCount };
  } catch (e) {
    console.error('Alexandria: Failed to import data', e);
    return { success: false, error: e.message };
  }
}

export function downloadExport(filename = 'alexandria_templates.json') {
  const json = JSON.stringify(exportAll(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Alexandria: Exported to ${filename}`);
}

// ============ File-Only Storage Functions ============
// Used when storage_mode is "file" - bypasses localStorage entirely

/**
 * Create a template in file storage
 * @param {string} name - Template name
 * @param {Array} entries - Template entries
 * @param {Object} workflowInfo - Optional workflow info
 * @returns {Promise<Object|null>} Created template or null
 */
export async function createTemplateFileOnly(name, entries, workflowInfo = null) {
  const now = new Date().toISOString();
  const hash = computeEntriesHash(entries);

  const template = {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    workflowId: workflowInfo?.id || null,
    workflowName: workflowInfo?.name || null,
    versions: [{
      id: generateId(),
      timestamp: now,
      hash,
      entries
    }],
    currentVersionIndex: 0,
  };

  const success = await saveTemplateToFile(template);
  if (!success) {
    console.error(`Alexandria: Failed to save template "${name}" to file storage`);
    return null;
  }

  // Update local cache
  updateTemplatesCache(template);

  if (isDebugEnabled()) {
    console.log(`Alexandria: Created template "${name}" in file storage with ${entries.length} entries`);
  }

  return template;
}

/**
 * Update a template in file storage
 * @param {string} name - Template name to update
 * @param {Array} entries - New entries
 * @returns {Promise<Object|null>} Updated template or null
 */
export async function updateTemplateFileOnly(name, entries) {
  // Load existing template from file storage
  const fileTemplates = await loadTemplatesFromFiles();
  const existing = fileTemplates.find(t => t.name === name);

  if (!existing) {
    console.warn(`Alexandria: Template "${name}" not found in file storage for update`);
    return null;
  }

  const newHash = computeEntriesHash(entries);
  const currentVersion = existing.versions?.[existing.currentVersionIndex];

  // Skip if content unchanged
  if (currentVersion && currentVersion.hash === newHash) {
    if (isDebugEnabled()) {
      console.log(`Alexandria: Template "${name}" unchanged in file storage, skipping`);
    }
    return existing;
  }

  const now = new Date().toISOString();
  existing.versions = existing.versions || [];
  existing.versions.push({
    id: generateId(),
    timestamp: now,
    hash: newHash,
    entries
  });
  existing.currentVersionIndex = existing.versions.length - 1;
  existing.updatedAt = now;

  const success = await saveTemplateToFile(existing);
  if (!success) {
    console.error(`Alexandria: Failed to update template "${name}" in file storage`);
    return null;
  }

  // Update local cache
  updateTemplatesCache(existing);

  if (isDebugEnabled()) {
    console.log(`Alexandria: Updated template "${name}" in file storage (v${existing.versions.length})`);
  }

  return existing;
}

/**
 * Get a template by name from file storage
 * @param {string} name - Template name
 * @returns {Promise<Object|null>} Template or null
 */
export async function getTemplateByNameFromFiles(name) {
  const templates = await loadTemplatesFromFiles();
  return templates.find(t => t.name === name) || null;
}

// ============ Initialization ============

/**
 * Initialize server-side storage - loads settings and templates
 * Should be called early in the extension setup
 * @param {string} workflowId - Optional workflow ID for loading overrides
 * @returns {Promise<void>}
 */
export async function initializeServerStorage(workflowId = null) {
  console.log('Alexandria: Initializing server-side storage...');

  // Load settings from server
  await loadSettingsFromServer();
  console.log('Alexandria: Settings loaded from server');

  // Load templates from server
  await refreshTemplatesFromServer();
  console.log(`Alexandria: ${_templatesCache.length} templates loaded from server`);

  // Load workflow overrides if workflow ID provided
  if (workflowId) {
    await loadManualSelectionsFromServer(workflowId);
    console.log(`Alexandria: Workflow overrides loaded for ${workflowId}`);
  }
}

/**
 * Refresh all server-side data for a workflow context
 * Call this when the workflow changes
 * @param {string} workflowId - Workflow ID
 * @param {string} workflowName - Workflow name
 * @returns {Promise<void>}
 */
export async function refreshWorkflowContext(workflowId, workflowName) {
  if (workflowId) {
    setCurrentWorkflowOverridesId(workflowId);
    await loadManualSelectionsFromServer(workflowId);
  }
  if (workflowName) {
    setTrackedWorkflowName(workflowName);
  }
}

// Re-export utilities that other modules may need
export { computeEntriesHash, generateId };
