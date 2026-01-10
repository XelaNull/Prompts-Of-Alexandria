/**
 * Alexandria Storage Module
 * Handles localStorage persistence for templates, settings, and manual selections.
 *
 * @module alexandria/storage
 */

// Storage keys - centralized to prevent typos
const STORAGE_KEYS = {
  TEMPLATES: 'alexandria_templates',
  MANUAL_SELECTIONS: 'alexandria_manual',
  SETTINGS: 'alexandria_settings',
  TEMPLATE_ORDER: 'alexandria_template_order',
};

// Default settings
const DEFAULT_SETTINGS = {
  retention: {
    maxVersionsPerTemplate: 20,
    maxAgeDays: 30,
  },
  debug: false,
  detectionMode: 'lazy', // 'lazy' = include more widgets, 'precise' = only high-confidence prompts
};

// Storage key for tracked workflow name (hooked from save/load events)
const WORKFLOW_NAME_KEY = 'alexandria_current_workflow';

// Storage key for current storage directory
const STORAGE_DIR_KEY = 'alexandria_storage_directory';

// Cache for current storage directory from backend
let _currentStorageDir = null;

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
    const response = await fetch('/alexandria/templates');
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
 * Sync templates between localStorage and file storage
 * Merges both sources, preferring file storage for conflicts
 * @returns {Promise<Array>} Merged array of templates
 */
export async function syncTemplates() {
  try {
    // Get templates from both sources
    const localTemplates = getTemplates();

    // Send local templates to backend for sync
    const response = await fetch('/alexandria/templates/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates: localTemplates })
    });
    const data = await response.json();

    if (data.status === 'ok') {
      // Update local storage with merged templates
      const mergedTemplates = data.templates || [];

      // Merge: keep local templates and add any new ones from files
      const localByName = new Map(localTemplates.map(t => [t.name, t]));
      for (const fileTemplate of mergedTemplates) {
        if (!localByName.has(fileTemplate.name)) {
          localTemplates.push(fileTemplate);
        }
      }
      saveTemplates(localTemplates);

      console.log(`Alexandria: Synced ${data.saved_count} templates to files, ${data.total_count} total in file storage`);
      return mergedTemplates;
    }
  } catch (e) {
    console.warn('Alexandria: Could not sync templates', e);
  }
  return getTemplates();
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

// ============ Settings ============

export function getSettings() {
  const stored = safeGet(STORAGE_KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings) {
  return safeSet(STORAGE_KEYS.SETTINGS, settings);
}

export function isDebugEnabled() {
  return getSettings().debug === true;
}

/**
 * Get current detection mode
 * @returns {string} 'lazy' or 'precise'
 */
export function getDetectionMode() {
  return getSettings().detectionMode || 'lazy';
}

/**
 * Set detection mode
 * @param {string} mode - 'lazy' or 'precise'
 */
export function setDetectionMode(mode) {
  const settings = getSettings();
  settings.detectionMode = mode;
  saveSettings(settings);
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

// ============ Manual Selections ============

export function getManualSelections() {
  return safeGet(STORAGE_KEYS.MANUAL_SELECTIONS, {});
}

export function saveManualSelections(selections) {
  return safeSet(STORAGE_KEYS.MANUAL_SELECTIONS, selections);
}

export function setManualSelection(nodeType, widgetName, include) {
  const selections = getManualSelections();
  const key = `${nodeType}:${widgetName}`;

  if (include === null || include === undefined) {
    delete selections[key];
  } else {
    selections[key] = include;
  }

  return saveManualSelections(selections);
}

export function getManualSelection(nodeType, widgetName) {
  const selections = getManualSelections();
  const key = `${nodeType}:${widgetName}`;
  return key in selections ? selections[key] : null;
}

// ============ Templates ============

export function getTemplates() {
  return safeGet(STORAGE_KEYS.TEMPLATES, []);
}

export function saveTemplates(templates) {
  return safeSet(STORAGE_KEYS.TEMPLATES, templates);
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
 * @returns {Array} Array of template IDs in custom order
 */
export function getTemplateOrder() {
  return safeGet(STORAGE_KEYS.TEMPLATE_ORDER, []);
}

/**
 * Save custom template order
 * @param {Array} order - Array of template IDs in desired order
 */
export function saveTemplateOrder(order) {
  return safeSet(STORAGE_KEYS.TEMPLATE_ORDER, order);
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
 * @param {string} templateId - Template ID to move
 * @param {number} newIndex - New position index
 */
export function reorderTemplate(templateId, newIndex) {
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

  saveTemplateOrder(order);
  return order;
}

export function createTemplate(name, entries, workflowInfo = null) {
  const templates = getTemplates();
  const now = new Date().toISOString();
  const hash = computeEntriesHash(entries);

  const template = {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    // Workflow linking - associates this template with a specific workflow
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

  templates.push(template);

  // Check if save actually succeeded - don't return template if it didn't persist
  if (!saveTemplates(templates)) {
    console.error(`Alexandria: Failed to persist template "${name}" - localStorage may be full`);
    return null;
  }

  // Also save to file storage (async, don't await)
  saveTemplateToFile(template).then(success => {
    if (success && isDebugEnabled()) {
      console.log(`Alexandria: Template "${name}" also saved to file storage`);
    }
  });

  if (isDebugEnabled()) {
    console.log(`Alexandria: Created template "${name}" for workflow "${workflowInfo?.name || 'unknown'}" with ${entries.length} entries`);
  }

  return template;
}

export function updateTemplate(id, entries) {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);

  if (index === -1) {
    console.warn(`Alexandria: Template ${id} not found for update`);
    return null;
  }

  const template = templates[index];
  const newHash = computeEntriesHash(entries);
  const currentVersion = template.versions[template.currentVersionIndex];

  // Skip if content unchanged (diff detection)
  if (currentVersion && currentVersion.hash === newHash) {
    if (isDebugEnabled()) {
      console.log(`Alexandria: Template "${template.name}" unchanged, skipping save`);
    }
    return template;
  }

  const now = new Date().toISOString();
  template.versions.push({
    id: generateId(),
    timestamp: now,
    hash: newHash,
    entries
  });
  template.currentVersionIndex = template.versions.length - 1;
  template.updatedAt = now;

  applyRetention(template);
  templates[index] = template;

  // Check if save actually succeeded
  if (!saveTemplates(templates)) {
    console.error(`Alexandria: Failed to persist template update - localStorage may be full`);
    return null;
  }

  // Also save to file storage (async, don't await)
  saveTemplateToFile(template).then(success => {
    if (success && isDebugEnabled()) {
      console.log(`Alexandria: Template "${template.name}" also updated in file storage`);
    }
  });

  if (isDebugEnabled()) {
    console.log(`Alexandria: Updated template "${template.name}" (v${template.versions.length})`);
  }

  return template;
}

export function deleteTemplate(id) {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);

  if (index === -1) {
    return false;
  }

  const name = templates[index].name;
  templates.splice(index, 1);
  const success = saveTemplates(templates);

  if (success) {
    // Also delete from file storage (async, don't await)
    deleteTemplateFromFile(name).then(fileSuccess => {
      if (fileSuccess && isDebugEnabled()) {
        console.log(`Alexandria: Template "${name}" also deleted from file storage`);
      }
    });

    if (isDebugEnabled()) {
      console.log(`Alexandria: Deleted template "${name}"`);
    }
  }

  return success;
}

export function renameTemplate(id, newName) {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);

  if (index === -1) {
    return null;
  }

  const oldName = templates[index].name;
  templates[index].name = newName;
  templates[index].updatedAt = new Date().toISOString();
  saveTemplates(templates);

  if (isDebugEnabled()) {
    console.log(`Alexandria: Renamed template "${oldName}" to "${newName}"`);
  }

  return templates[index];
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
 * @returns {Object|null} Updated template or null
 */
export function updateTemplateWorkflow(templateId, workflowInfo) {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === templateId);

  if (index === -1) return null;

  templates[index].workflowId = workflowInfo?.id || null;
  templates[index].workflowName = workflowInfo?.name || null;
  templates[index].updatedAt = new Date().toISOString();

  saveTemplates(templates);
  return templates[index];
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

export function importAll(data, rawSize = 0) {
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

    // Validate and import templates
    if (data.templates && Array.isArray(data.templates)) {
      if (data.templates.length > IMPORT_LIMITS.maxTemplates) {
        console.warn(`Alexandria: Import has ${data.templates.length} templates, limiting to ${IMPORT_LIMITS.maxTemplates}`);
      }

      const validTemplates = [];
      for (const template of data.templates.slice(0, IMPORT_LIMITS.maxTemplates)) {
        const validated = validateTemplate(template);
        if (validated) {
          validTemplates.push(validated);
          importedCount++;
        } else {
          skippedCount++;
        }
      }

      if (validTemplates.length > 0) {
        if (!saveTemplates(validTemplates)) {
          throw new Error('Failed to save imported templates - storage may be full');
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

// Re-export utilities that other modules may need
export { computeEntriesHash, generateId };
