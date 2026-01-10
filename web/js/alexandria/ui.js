/**
 * Alexandria Widget Browser UI
 * Main panel for browsing, saving, and loading prompt templates.
 *
 * @module alexandria/ui
 */

import { app } from "../../../../scripts/app.js";
import * as Storage from "./storage.js";
import * as Detection from "./detection.js";

// ============ Version ============

const VERSION = "1.1.0";

// ============ State ============

let panel = null;
let isOpen = false;
let searchQuery = '';
let filterType = 'all';
let selectedWidgets = new Map();
let selectedTemplateId = null;
let selectedVersionIndex = null; // null = use template's currentVersionIndex (latest)
let activeTab = 'templates';
// UI mode: 'landing', 'create', 'load', 'configure'
let uiMode = 'landing';
// Track if version history is expanded
let versionHistoryExpanded = false;
// Diff view: show only changes (true) or all entries (false)
let showDiffOnly = true;

// Collapse state for groups and nodes
let collapsedGroups = new Set();
let collapsedNodes = new Set();
// Track groups user manually expanded (so we don't auto-collapse them again)
let userExpandedGroups = new Set();
// Collapse state for template preview
let collapsedPreviewGroups = new Set();
let collapsedPreviewNodes = new Set();

// Debounce timer for search
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 300;

// ============ Utilities ============

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Get a preview of a value (truncated if long)
 * @param {*} value - Value to preview
 * @param {number} maxLen - Maximum length
 * @returns {string} Preview string
 */
function getValuePreview(value, maxLen = 80) {
  if (value === null || value === undefined) return '(empty)';
  const str = String(value);
  return str.length <= maxLen ? str : str.substring(0, maxLen) + '...';
}

/**
 * Get human-readable time ago string
 * @param {string} dateStr - ISO date string
 * @returns {string} Time ago string
 */
function getTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Method label mapping for display
 */
const METHOD_LABELS = {
  'backward_link_tracing': 'Link Trace',
  'known_node_type': 'Known Node',
  'output_type_analysis': 'Output Type',
  'input_slot_pattern': 'Input Pattern',
  'widget_name_pattern': 'Widget Name',
  'widget_type_heuristic': 'Widget Type',
  'user_manual_selection': 'Manual',
};

// ============ Drag Functionality ============

/**
 * Make a panel draggable by its header
 * @param {HTMLElement} panelEl - The panel element
 */
function makeDraggable(panelEl) {
  const header = panelEl.querySelector('.alexandria-header');
  if (!header) return;

  let isDragging = false;
  let offsetX, offsetY;
  let hasConvertedPosition = false;

  header.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on close button or other interactive elements
    if (e.target.closest('button, input, a')) return;

    isDragging = true;
    panelEl.classList.add('dragging');

    // Get current rendered position
    const rect = panelEl.getBoundingClientRect();

    // On first drag, convert from CSS centering to absolute positioning
    if (!hasConvertedPosition) {
      // Remove the CSS transform centering
      panelEl.style.transform = 'none';
      // Set explicit left/top based on current rendered position
      panelEl.style.left = rect.left + 'px';
      panelEl.style.top = rect.top + 'px';
      hasConvertedPosition = true;
    }

    // Calculate offset of mouse within the panel
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Calculate new position based on mouse position minus offset
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Keep panel within viewport bounds
    const rect = panelEl.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width;
    const maxTop = window.innerHeight - rect.height;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    panelEl.style.left = newLeft + 'px';
    panelEl.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      panelEl.classList.remove('dragging');
    }
  });
}

// ============ Panel Management ============

/**
 * Initialize the widget browser
 */
export function init() {
  loadSelections();
}

/**
 * Load detected prompts into selection state
 */
function loadSelections() {
  selectedWidgets.clear();
  const detected = Detection.getDetectedPrompts();
  for (const prompt of detected) {
    const key = `${prompt.node.id}:${prompt.widget.name}`;
    selectedWidgets.set(key, true);
  }
}

/**
 * Check if this is a first-time user (no templates saved)
 * @returns {boolean}
 */
function isFirstTimeUser() {
  return Storage.getTemplates().length === 0;
}

/**
 * Toggle panel open/close
 */
export function toggle() {
  isOpen ? close() : open();
}

/**
 * Open the panel
 * @param {string} [mode='landing'] - Initial mode: 'landing', 'create', or 'load'
 */
export function open(mode = 'landing') {
  if (panel) panel.remove();
  loadSelections();

  // Reset collapse state for fresh analysis
  collapsedGroups.clear();
  collapsedNodes.clear();
  userExpandedGroups.clear();
  collapsedPreviewGroups.clear();
  collapsedPreviewNodes.clear();

  // Reset version selection state
  selectedVersionIndex = null;
  versionHistoryExpanded = false;
  showDiffOnly = true; // Default to diff view

  // Set initial mode
  uiMode = mode;
  if (mode !== 'load') {
    selectedTemplateId = null;
  }

  panel = createPanel();
  document.body.appendChild(panel);
  isOpen = true;
}

/**
 * Close the panel
 */
export function close() {
  if (panel) {
    panel.remove();
    panel = null;
  }
  isOpen = false;
}

/**
 * Check if panel is open
 * @returns {boolean}
 */
export function isOpenState() {
  return isOpen;
}

// ============ Panel Creation ============

/**
 * Create the main panel element
 * @returns {HTMLElement} Panel element
 */
function createPanel() {
  const panelEl = document.createElement('div');
  panelEl.className = 'alexandria-panel';

  renderPanelContent(panelEl);
  makeDraggable(panelEl);

  return panelEl;
}

/**
 * Render panel content based on current UI mode
 */
function renderPanelContent(panelEl) {
  const detectedCount = Detection.getDetectedPrompts().length;
  const templateCount = Storage.getTemplates().length;

  if (uiMode === 'landing') {
    panelEl.className = 'alexandria-panel';
    panelEl.innerHTML = `
      <div class="alexandria-header">
        <div class="alexandria-title">
          <span class="alexandria-icon">📜</span>
          Prompts of Alexandria
          <span class="alexandria-version">v${VERSION}</span>
        </div>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-welcome">
        <p class="alexandria-welcome-text">
          The ancient Library of Alexandria sought to preserve all human knowledge,
          yet was lost to time. We carry that torch forward—your prompts are spells
          that conjure beauty from nothing, and they deserve to be saved.
        </p>
        <p class="alexandria-welcome-subtext">
          Never lose a prompt again. Save your work, restore it anywhere, share it with others.
        </p>
      </div>
      <div class="alexandria-landing">
        <div class="alexandria-landing-card" data-action="go-create">
          <div class="alexandria-landing-icon">💾</div>
          <div class="alexandria-landing-title">Save Prompts</div>
          <div class="alexandria-landing-desc">
            ${detectedCount > 0
              ? `Save your <strong>${detectedCount} detected prompt${detectedCount !== 1 ? 's' : ''}</strong> as a reusable template`
              : 'Select prompts from your workflow to save as a template'}
          </div>
        </div>
        <div class="alexandria-landing-card ${templateCount === 0 ? 'alexandria-landing-card-disabled' : ''}" data-action="go-load">
          <div class="alexandria-landing-icon">📂</div>
          <div class="alexandria-landing-title">Load Template</div>
          <div class="alexandria-landing-desc">
            ${templateCount > 0
              ? `Restore prompts from one of your <strong>${templateCount} saved template${templateCount !== 1 ? 's' : ''}</strong>`
              : 'No templates saved yet'}
          </div>
        </div>
        <div class="alexandria-landing-card alexandria-landing-card-secondary" data-action="go-configure">
          <div class="alexandria-landing-icon">⚙️</div>
          <div class="alexandria-landing-title">Configure Detection</div>
          <div class="alexandria-landing-desc">
            Customize which widgets are included or excluded from prompt saves
          </div>
        </div>
      </div>
      <div class="alexandria-landing-footer">
        <button class="alexandria-btn-small" data-action="import">Import Templates</button>
        ${templateCount > 0 ? '<button class="alexandria-btn-small" data-action="export">Export All</button>' : ''}
      </div>
    `;
    attachLandingListeners(panelEl);

  } else if (uiMode === 'create') {
    panelEl.className = 'alexandria-panel alexandria-panel-wide';
    panelEl.innerHTML = `
      <div class="alexandria-header">
        <div class="alexandria-title">
          <button class="alexandria-back-btn" data-action="go-landing">←</button>
          <span class="alexandria-icon">📜</span>
          <div class="alexandria-title-stack">
            <span class="alexandria-title-main">Prompts of Alexandria <span class="alexandria-version">v${VERSION}</span></span>
            <span class="alexandria-title-sub">💾 Save Prompts</span>
          </div>
        </div>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-toolbar">
        <div class="alexandria-search">
          <input type="text" placeholder="Search nodes..." class="alexandria-search-input" />
        </div>
        <div class="alexandria-filters">
          <button class="alexandria-filter-btn ${filterType === 'all' ? 'active' : ''}" data-filter="all">All Widgets</button>
          <button class="alexandria-filter-btn ${filterType === 'detected' ? 'active' : ''}" data-filter="detected">Prompts Only</button>
        </div>
      </div>
      <div class="alexandria-content"></div>
      <div class="alexandria-footer">
        <div class="alexandria-status">
          <span class="alexandria-status-text"></span>
        </div>
        <div class="alexandria-actions">
          <button class="alexandria-btn alexandria-btn-secondary" data-action="select-detected">Select All Detected</button>
          <button class="alexandria-btn alexandria-btn-secondary" data-action="clear">Clear</button>
          <button class="alexandria-btn alexandria-btn-primary" data-action="save">💾 Save as Template</button>
        </div>
      </div>
    `;
    attachCreateListeners(panelEl);
    renderCreateContent(panelEl);

  } else if (uiMode === 'load') {
    panelEl.className = 'alexandria-panel alexandria-panel-wide';
    panelEl.innerHTML = `
      <div class="alexandria-header">
        <div class="alexandria-title">
          <button class="alexandria-back-btn" data-action="go-landing">←</button>
          <span class="alexandria-icon">📜</span>
          <div class="alexandria-title-stack">
            <span class="alexandria-title-main">Prompts of Alexandria <span class="alexandria-version">v${VERSION}</span></span>
            <span class="alexandria-title-sub">📂 Load Template</span>
          </div>
        </div>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-body">
        <div class="alexandria-sidebar">
          <div class="alexandria-sidebar-header">
            <span class="alexandria-sidebar-title">Saved Templates</span>
          </div>
          <div class="alexandria-template-list"></div>
          <div class="alexandria-sidebar-footer">
            <button class="alexandria-btn-small alexandria-btn-full" data-action="export">Export All</button>
            <button class="alexandria-btn-small alexandria-btn-full" data-action="import">Import</button>
          </div>
        </div>
        <div class="alexandria-main">
          <div class="alexandria-content"></div>
        </div>
      </div>
      <div class="alexandria-footer">
        <div class="alexandria-status">
          <span class="alexandria-status-text">Select a template to preview</span>
        </div>
        <div class="alexandria-actions">
          <button class="alexandria-btn alexandria-btn-secondary" data-action="export-template" ${!selectedTemplateId ? 'disabled' : ''}>Export Template</button>
          <button class="alexandria-btn alexandria-btn-primary" data-action="load-template" ${!selectedTemplateId ? 'disabled' : ''}>Load Template</button>
        </div>
      </div>
    `;
    attachLoadListeners(panelEl);
    renderLoadContent(panelEl);

  } else if (uiMode === 'configure') {
    // Configure mode: Browse all modules and set manual include/exclude overrides
    panelEl.className = 'alexandria-panel alexandria-panel-wide';
    const manualSelections = Storage.getManualSelections();
    const overrideCount = Object.keys(manualSelections).length;

    panelEl.innerHTML = `
      <div class="alexandria-header">
        <div class="alexandria-title">
          <button class="alexandria-back-btn" data-action="go-landing">←</button>
          <span class="alexandria-icon">📜</span>
          <div class="alexandria-title-stack">
            <span class="alexandria-title-main">Prompts of Alexandria <span class="alexandria-version">v${VERSION}</span></span>
            <span class="alexandria-title-sub">⚙️ Configure Detection</span>
          </div>
        </div>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-toolbar">
        <div class="alexandria-search">
          <input type="text" placeholder="Search nodes..." class="alexandria-search-input" />
        </div>
        <div class="alexandria-filters">
          <button class="alexandria-filter-btn ${filterType === 'all' ? 'active' : ''}" data-filter="all">All Widgets</button>
          <button class="alexandria-filter-btn ${filterType === 'detected' ? 'active' : ''}" data-filter="detected">Detected Only</button>
          <button class="alexandria-filter-btn ${filterType === 'overrides' ? 'active' : ''}" data-filter="overrides">Overrides Only</button>
        </div>
      </div>
      <div class="alexandria-content"></div>
      <div class="alexandria-footer">
        <div class="alexandria-status">
          <span class="alexandria-status-text">${overrideCount} manual override${overrideCount !== 1 ? 's' : ''} configured</span>
        </div>
        <div class="alexandria-actions">
          <button class="alexandria-btn alexandria-btn-secondary" data-action="clear-overrides" ${overrideCount === 0 ? 'disabled' : ''}>Clear All Overrides</button>
          <button class="alexandria-btn alexandria-btn-primary" data-action="done">Done</button>
        </div>
      </div>
    `;
    attachConfigureListeners(panelEl);
    renderConfigureContent(panelEl);
  }

  // Common: close button
  panelEl.querySelector('.alexandria-close').onclick = () => close();
}

/**
 * Attach listeners for landing mode
 */
function attachLandingListeners(panelEl) {
  panelEl.querySelector('[data-action="go-create"]').onclick = () => {
    uiMode = 'create';
    renderPanelContent(panelEl);
  };

  const loadCard = panelEl.querySelector('[data-action="go-load"]');
  if (!loadCard.classList.contains('alexandria-landing-card-disabled')) {
    loadCard.onclick = () => {
      uiMode = 'load';
      renderPanelContent(panelEl);
    };
  }

  panelEl.querySelector('[data-action="go-configure"]').onclick = () => {
    uiMode = 'configure';
    renderPanelContent(panelEl);
  };

  panelEl.querySelector('[data-action="import"]').onclick = importTemplates;
  const exportBtn = panelEl.querySelector('[data-action="export"]');
  if (exportBtn) exportBtn.onclick = exportTemplates;
}

/**
 * Attach listeners for create mode
 */
function attachCreateListeners(panelEl) {
  panelEl.querySelector('[data-action="go-landing"]').onclick = () => {
    uiMode = 'landing';
    renderPanelContent(panelEl);
  };

  // Search
  const searchInput = panelEl.querySelector('.alexandria-search-input');
  searchInput.oninput = (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase();
      renderCreateContent(panelEl);
    }, SEARCH_DEBOUNCE_MS);
  };

  // Filters
  panelEl.querySelectorAll('.alexandria-filter-btn').forEach(btn => {
    btn.onclick = () => {
      panelEl.querySelectorAll('.alexandria-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterType = btn.dataset.filter;
      renderCreateContent(panelEl);
    };
  });

  // Actions
  panelEl.querySelector('[data-action="select-detected"]').onclick = () => {
    selectAllDetected();
    renderCreateContent(panelEl);
  };
  panelEl.querySelector('[data-action="clear"]').onclick = () => {
    clearSelection();
    renderCreateContent(panelEl);
  };
  panelEl.querySelector('[data-action="save"]').onclick = saveAsTemplate;
}

/**
 * Render content for create mode
 */
function renderCreateContent(panelEl) {
  const content = panelEl.querySelector('.alexandria-content');
  content.innerHTML = renderNodeList();
  attachNodeListListeners(panelEl);
  updateCreateStatusBar(panelEl);
}

/**
 * Update status bar for create mode
 */
function updateCreateStatusBar(panelEl) {
  const statusText = panelEl.querySelector('.alexandria-status-text');
  const selectedCount = Array.from(selectedWidgets.values()).filter(v => v).length;
  const detectedCount = Detection.getDetectedPrompts().length;

  if (selectedCount === 0) {
    statusText.textContent = `${detectedCount} prompt${detectedCount !== 1 ? 's' : ''} detected — select prompts to save`;
  } else {
    statusText.textContent = `${selectedCount} prompt${selectedCount !== 1 ? 's' : ''} selected — ready to save`;
  }
}

/**
 * Attach listeners for configure mode
 */
function attachConfigureListeners(panelEl) {
  panelEl.querySelector('[data-action="go-landing"]').onclick = () => {
    uiMode = 'landing';
    renderPanelContent(panelEl);
  };

  // Search
  const searchInput = panelEl.querySelector('.alexandria-search-input');
  searchInput.oninput = (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase();
      renderConfigureContent(panelEl);
    }, SEARCH_DEBOUNCE_MS);
  };

  // Filters
  panelEl.querySelectorAll('.alexandria-filter-btn').forEach(btn => {
    btn.onclick = () => {
      panelEl.querySelectorAll('.alexandria-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterType = btn.dataset.filter;
      renderConfigureContent(panelEl);
    };
  });

  // Clear all overrides
  panelEl.querySelector('[data-action="clear-overrides"]').onclick = () => {
    if (confirm('Clear all manual detection overrides?')) {
      Storage.saveManualSelections({});
      renderConfigureContent(panelEl);
      updateConfigureStatusBar(panelEl);
    }
  };

  // Done button
  panelEl.querySelector('[data-action="done"]').onclick = () => close();
}

/**
 * Render content for configure mode
 */
function renderConfigureContent(panelEl) {
  const content = panelEl.querySelector('.alexandria-content');
  content.innerHTML = renderConfigureNodeList();
  attachConfigureNodeListListeners(panelEl);
  updateConfigureStatusBar(panelEl);
}

/**
 * Update status bar for configure mode
 */
function updateConfigureStatusBar(panelEl) {
  const statusText = panelEl.querySelector('.alexandria-status-text');
  const clearBtn = panelEl.querySelector('[data-action="clear-overrides"]');
  const manualSelections = Storage.getManualSelections();
  const overrideCount = Object.keys(manualSelections).length;

  statusText.textContent = `${overrideCount} manual override${overrideCount !== 1 ? 's' : ''} configured`;
  clearBtn.disabled = overrideCount === 0;
}

/**
 * Render node list for configure mode (with override controls)
 */
function renderConfigureNodeList() {
  let nodes = Detection.getAllWorkflowWidgets();
  const manualSelections = Storage.getManualSelections();

  // Use stable sort by node ID to prevent reordering when overrides change
  nodes.sort((a, b) => a.id - b.id);

  // Filter by search
  if (searchQuery) {
    nodes = nodes.filter(node => {
      const str = `${node.title} ${node.type}`.toLowerCase();
      return str.includes(searchQuery) ||
        node.widgets.some(w => w.name.toLowerCase().includes(searchQuery));
    });
  }

  // Filter by type
  if (filterType === 'detected') {
    nodes = nodes.filter(n => n.widgets.some(w => w.isDetected));
  } else if (filterType === 'overrides') {
    nodes = nodes.filter(n => n.widgets.some(w => {
      const key = `${n.id}:${w.name}`;
      return key in manualSelections;
    }));
  }

  if (nodes.length === 0) {
    if (filterType === 'overrides') {
      return `
        <div class="alexandria-empty">
          <div class="alexandria-empty-icon">⚙️</div>
          <div class="alexandria-empty-text">No overrides configured</div>
          <div class="alexandria-empty-hint">Use the toggle buttons to always include or exclude specific widgets</div>
        </div>
      `;
    }
    return `
      <div class="alexandria-empty">
        <div class="alexandria-empty-icon">📭</div>
        <div class="alexandria-empty-text">No nodes found</div>
        <div class="alexandria-empty-hint">${searchQuery ? 'Try a different search term' : 'Add nodes to your workflow'}</div>
      </div>
    `;
  }

  // Group nodes by canvas group
  const groups = new Map();
  for (const node of nodes) {
    const groupKey = node.canvasGroup || '(Ungrouped)';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(node);
  }

  // Auto-collapse groups that have no detected prompts or overrides
  for (const [groupKey, groupNodes] of groups) {
    const hasRelevant = groupNodes.some(n => n.widgets.some(w => {
      const key = `${n.id}:${w.name}`;
      return w.isDetected || key in manualSelections;
    }));
    if (!hasRelevant && !userExpandedGroups.has(groupKey)) {
      collapsedGroups.add(groupKey);
    }
  }

  // Render
  const totalNodes = nodes.length;
  const allCollapsed = nodes.every(n => collapsedNodes.has(n.id));
  let html = `
    <div class="alexandria-collapse-controls">
      <a href="#" class="alexandria-collapse-link" data-action="${allCollapsed ? 'expand-all' : 'collapse-all'}">
        ${allCollapsed ? '▼ Expand All' : '▲ Collapse All'}
      </a>
    </div>
  `;

  for (const [groupType, groupNodes] of groups) {
    const isGroupCollapsed = collapsedGroups.has(groupType);
    const detectedCount = groupNodes.filter(n => n.widgets.some(w => w.isDetected)).length;
    const overrideCount = groupNodes.filter(n => n.widgets.some(w => {
      const key = `${n.id}:${w.name}`;
      return key in manualSelections;
    })).length;

    // Collect all node IDs and widget names in this group for bulk operations
    const groupWidgetData = [];
    for (const node of groupNodes) {
      for (const widget of node.widgets) {
        groupWidgetData.push({ nodeId: node.id, widgetName: widget.name });
      }
    }
    const groupDataAttr = escapeHtml(JSON.stringify(groupWidgetData));

    html += `
      <div class="alexandria-group ${isGroupCollapsed ? 'collapsed' : ''}">
        <div class="alexandria-group-header" data-group="${escapeHtml(groupType)}">
          <span class="alexandria-collapse-icon">${isGroupCollapsed ? '▶' : '▼'}</span>
          <span class="alexandria-group-title">${escapeHtml(groupType)}</span>
          <span class="alexandria-group-count">${groupNodes.length} node${groupNodes.length !== 1 ? 's' : ''}</span>
          ${detectedCount > 0 ? `<span class="alexandria-badge badge-detected">${detectedCount} detected</span>` : ''}
          ${overrideCount > 0 ? `<span class="alexandria-badge badge-override">${overrideCount} override${overrideCount !== 1 ? 's' : ''}</span>` : ''}
          <span class="alexandria-group-actions">
            <button class="alexandria-btn-tiny" data-action="include-all" data-group-widgets='${groupDataAttr}' title="Include all widgets in this group">✓ All</button>
            <button class="alexandria-btn-tiny" data-action="exclude-all" data-group-widgets='${groupDataAttr}' title="Exclude all widgets in this group">✗ All</button>
            <button class="alexandria-btn-tiny" data-action="auto-all" data-group-widgets='${groupDataAttr}' title="Reset all widgets in this group to auto">Auto All</button>
          </span>
        </div>
        <div class="alexandria-group-content" style="${isGroupCollapsed ? 'display:none;' : ''}">
          ${groupNodes.map(node => renderConfigureNode(node, manualSelections)).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Render a node card for configure mode
 */
function renderConfigureNode(node, manualSelections) {
  const hasDetected = node.widgets.some(w => w.isDetected);
  const hasOverride = node.widgets.some(w => {
    const key = `${node.id}:${w.name}`;
    return key in manualSelections;
  });
  const isBypassed = node.mode === 2 || node.mode === 4;
  const isNodeCollapsed = collapsedNodes.has(node.id);

  return `
    <div class="alexandria-node ${hasDetected ? 'has-detected' : ''} ${hasOverride ? 'has-override' : ''} ${isBypassed ? 'alexandria-node-bypassed' : ''} ${isNodeCollapsed ? 'collapsed' : ''}">
      <div class="alexandria-node-header" data-node-id="${node.id}">
        <span class="alexandria-collapse-icon">${isNodeCollapsed ? '▶' : '▼'}</span>
        <span class="alexandria-node-icon">📦</span>
        <span class="alexandria-node-title">${escapeHtml(node.title)}</span>
        <span class="alexandria-node-id">#${node.id}</span>
        <span class="alexandria-node-type-label">${escapeHtml(node.type)}</span>
        ${isBypassed ? '<span class="alexandria-badge badge-bypassed">Bypassed</span>' : ''}
        ${hasDetected ? '<span class="alexandria-badge badge-detected">Detected</span>' : ''}
        ${hasOverride ? '<span class="alexandria-badge badge-override">Override</span>' : ''}
      </div>
      <div class="alexandria-node-widgets" style="${isNodeCollapsed ? 'display:none;' : ''}">
        ${node.widgets.map(w => renderConfigureWidget(node, w, manualSelections)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a widget row for configure mode with override controls
 * Uses nodeId:widgetName for per-instance overrides
 */
function renderConfigureWidget(node, widget, manualSelections) {
  const key = `${node.id}:${widget.name}`;
  const override = manualSelections[key];
  const preview = getValuePreview(widget.value);

  // Determine current state: 'include', 'exclude', or 'auto'
  let state = 'auto';
  if (override === true) state = 'include';
  else if (override === false) state = 'exclude';

  return `
    <div class="alexandria-widget ${widget.isDetected ? 'widget-detected' : ''} ${state !== 'auto' ? 'widget-override' : ''}">
      <div class="alexandria-widget-info">
        <span class="alexandria-widget-name">${escapeHtml(widget.name)}</span>
        ${widget.isDetected ? `<span class="alexandria-confidence">${widget.confidence}% - ${METHOD_LABELS[widget.method] || widget.method}</span>` : ''}
      </div>
      <div class="alexandria-widget-value">${escapeHtml(preview)}</div>
      <div class="alexandria-override-controls">
        <button class="alexandria-override-btn ${state === 'include' ? 'active include' : ''}"
          data-node-id="${node.id}"
          data-widget-name="${escapeHtml(widget.name)}"
          data-override="include"
          title="Always include this widget in saves">✓ Include</button>
        <button class="alexandria-override-btn ${state === 'auto' ? 'active auto' : ''}"
          data-node-id="${node.id}"
          data-widget-name="${escapeHtml(widget.name)}"
          data-override="auto"
          title="Use automatic detection">Auto</button>
        <button class="alexandria-override-btn ${state === 'exclude' ? 'active exclude' : ''}"
          data-node-id="${node.id}"
          data-widget-name="${escapeHtml(widget.name)}"
          data-override="exclude"
          title="Never include this widget in saves">✗ Exclude</button>
      </div>
    </div>
  `;
}

/**
 * Attach listeners for configure node list
 */
function attachConfigureNodeListListeners(panelEl) {
  // Collapse all link
  const collapseLink = panelEl.querySelector('.alexandria-collapse-link');
  if (collapseLink) {
    collapseLink.onclick = (e) => {
      e.preventDefault();
      const allNodes = Detection.getAllWorkflowWidgets();
      if (collapseLink.dataset.action === 'collapse-all') {
        allNodes.forEach(n => collapsedNodes.add(n.id));
      } else {
        collapsedNodes.clear();
      }
      renderConfigureContent(panelEl);
    };
  }

  // Group headers
  panelEl.querySelectorAll('.alexandria-group-header[data-group]').forEach(header => {
    header.onclick = () => {
      const groupType = header.dataset.group;
      if (collapsedGroups.has(groupType)) {
        collapsedGroups.delete(groupType);
        userExpandedGroups.add(groupType);
      } else {
        collapsedGroups.add(groupType);
        userExpandedGroups.delete(groupType);
      }
      renderConfigureContent(panelEl);
    };
  });

  // Node headers
  panelEl.querySelectorAll('.alexandria-node-header[data-node-id]').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('button')) return;
      const nodeId = parseInt(header.dataset.nodeId, 10);
      if (collapsedNodes.has(nodeId)) {
        collapsedNodes.delete(nodeId);
      } else {
        collapsedNodes.add(nodeId);
      }
      renderConfigureContent(panelEl);
    };
  });

  // Override buttons (individual widget)
  panelEl.querySelectorAll('.alexandria-override-btn').forEach(btn => {
    btn.onclick = () => {
      const nodeId = btn.dataset.nodeId;
      const widgetName = btn.dataset.widgetName;
      const overrideType = btn.dataset.override;

      let value = null; // auto = remove override
      if (overrideType === 'include') value = true;
      else if (overrideType === 'exclude') value = false;

      Storage.setManualSelection(nodeId, widgetName, value);
      renderConfigureContent(panelEl);
    };
  });

  // Bulk action buttons (Include All, Exclude All, Auto All)
  panelEl.querySelectorAll('[data-action="include-all"], [data-action="exclude-all"], [data-action="auto-all"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation(); // Don't trigger group collapse
      const action = btn.dataset.action;
      const widgets = JSON.parse(btn.dataset.groupWidgets);

      let value = null; // auto
      if (action === 'include-all') value = true;
      else if (action === 'exclude-all') value = false;

      for (const { nodeId, widgetName } of widgets) {
        Storage.setManualSelection(nodeId, widgetName, value);
      }
      renderConfigureContent(panelEl);
    };
  });
}

/**
 * Attach listeners for load mode
 */
function attachLoadListeners(panelEl) {
  panelEl.querySelector('[data-action="go-landing"]').onclick = () => {
    uiMode = 'landing';
    selectedTemplateId = null;
    renderPanelContent(panelEl);
  };

  panelEl.querySelector('[data-action="export"]').onclick = exportTemplates;
  panelEl.querySelector('[data-action="import"]').onclick = () => {
    importTemplates();
    // Refresh after import
    setTimeout(() => renderLoadContent(panelEl), 100);
  };
  panelEl.querySelector('[data-action="load-template"]').onclick = () => {
    loadSelectedTemplate();
    close();
  };
  panelEl.querySelector('[data-action="export-template"]').onclick = () => {
    exportSelectedTemplate();
    close();
  };
}

/**
 * Render content for load mode
 */
function renderLoadContent(panelEl) {
  // Template list
  const templateList = panelEl.querySelector('.alexandria-template-list');
  templateList.innerHTML = renderTemplateList();
  attachTemplateListListeners(panelEl);

  // Preview
  const content = panelEl.querySelector('.alexandria-content');
  content.innerHTML = renderTemplatePreview();
  attachPreviewListeners(panelEl);

  // Update button states
  const loadBtn = panelEl.querySelector('[data-action="load-template"]');
  const exportBtn = panelEl.querySelector('[data-action="export-template"]');
  loadBtn.disabled = !selectedTemplateId;
  exportBtn.disabled = !selectedTemplateId;

  // Update status
  const statusText = panelEl.querySelector('.alexandria-status-text');
  if (selectedTemplateId) {
    statusText.textContent = 'Click "Load Template" to restore these prompts';
  } else {
    statusText.textContent = 'Select a template to preview';
  }
}

/**
 * Attach listeners for template list in load mode
 */
function attachTemplateListListeners(panelEl) {
  panelEl.querySelectorAll('.alexandria-template-item').forEach(item => {
    item.onclick = (e) => {
      if (e.target.closest('[data-action]')) return;
      selectedTemplateId = item.dataset.templateId;
      selectedVersionIndex = null; // Reset to latest version
      versionHistoryExpanded = false;
      collapsedPreviewGroups.clear();
      collapsedPreviewNodes.clear();
      renderLoadContent(panelEl);
    };
  });

  panelEl.querySelectorAll('[data-action="rename-template"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      showRenameDialog(btn.dataset.templateId);
    };
  });

  panelEl.querySelectorAll('[data-action="delete-template"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      confirmDeleteTemplate(btn.dataset.templateId);
    };
  });
}

/**
 * Attach listeners for preview in load mode
 */
function attachPreviewListeners(panelEl) {
  // Collapse all link
  const collapseLink = panelEl.querySelector('[data-action="preview-collapse-all"]');
  if (collapseLink) {
    collapseLink.onclick = (e) => {
      e.preventDefault();
      const allGroups = panelEl.querySelectorAll('[data-preview-group]');
      const allNodes = panelEl.querySelectorAll('[data-preview-node]');

      if (collapsedPreviewGroups.size === 0 && collapsedPreviewNodes.size === 0) {
        allGroups.forEach(g => collapsedPreviewGroups.add(g.dataset.previewGroup));
        allNodes.forEach(n => collapsedPreviewNodes.add(n.dataset.previewNode));
      } else {
        collapsedPreviewGroups.clear();
        collapsedPreviewNodes.clear();
      }
      renderLoadContent(panelEl);
    };
  }

  // Version history toggle
  const versionToggle = panelEl.querySelector('[data-action="toggle-version-history"]');
  if (versionToggle) {
    versionToggle.onclick = (e) => {
      e.preventDefault();
      versionHistoryExpanded = !versionHistoryExpanded;
      renderLoadContent(panelEl);
    };
  }

  // Diff view toggle
  const diffToggle = panelEl.querySelector('[data-action="toggle-diff-view"]');
  if (diffToggle) {
    diffToggle.onclick = (e) => {
      e.preventDefault();
      showDiffOnly = !showDiffOnly;
      renderLoadContent(panelEl);
    };
  }

  // Go back to latest version
  const goLatestBtn = panelEl.querySelector('[data-action="version-go-latest"]');
  if (goLatestBtn) {
    goLatestBtn.onclick = (e) => {
      e.preventDefault();
      selectedVersionIndex = null;
      renderLoadContent(panelEl);
    };
  }

  // Version item selection
  panelEl.querySelectorAll('.alexandria-version-item[data-version-index]').forEach(item => {
    item.onclick = () => {
      selectedVersionIndex = parseInt(item.dataset.versionIndex, 10);
      renderLoadContent(panelEl);
    };
  });

  // Group headers
  panelEl.querySelectorAll('[data-preview-group]').forEach(header => {
    header.onclick = () => {
      const groupName = header.dataset.previewGroup;
      if (collapsedPreviewGroups.has(groupName)) {
        collapsedPreviewGroups.delete(groupName);
      } else {
        collapsedPreviewGroups.add(groupName);
      }
      renderLoadContent(panelEl);
    };
  });

  // Node headers
  panelEl.querySelectorAll('[data-preview-node]').forEach(header => {
    header.onclick = () => {
      const nodeKey = header.dataset.previewNode;
      if (collapsedPreviewNodes.has(nodeKey)) {
        collapsedPreviewNodes.delete(nodeKey);
      } else {
        collapsedPreviewNodes.add(nodeKey);
      }
      renderLoadContent(panelEl);
    };
  });
}

/**
 * Attach listeners for node list in create mode
 */
function attachNodeListListeners(panelEl) {
  // Collapse all link
  const collapseLink = panelEl.querySelector('.alexandria-collapse-link');
  if (collapseLink) {
    collapseLink.onclick = (e) => {
      e.preventDefault();
      const allNodes = Detection.getAllWorkflowWidgets();
      if (collapseLink.dataset.action === 'collapse-all') {
        allNodes.forEach(n => collapsedNodes.add(n.id));
      } else {
        collapsedNodes.clear();
      }
      renderCreateContent(panelEl);
    };
  }

  // Group headers
  panelEl.querySelectorAll('.alexandria-group-header[data-group]').forEach(header => {
    header.onclick = () => {
      const groupType = header.dataset.group;
      if (collapsedGroups.has(groupType)) {
        collapsedGroups.delete(groupType);
        userExpandedGroups.add(groupType);
      } else {
        collapsedGroups.add(groupType);
        userExpandedGroups.delete(groupType);
      }
      renderCreateContent(panelEl);
    };
  });

  // Node headers
  panelEl.querySelectorAll('.alexandria-node-header[data-node-id]').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('input')) return;
      const nodeId = parseInt(header.dataset.nodeId, 10);
      if (collapsedNodes.has(nodeId)) {
        collapsedNodes.delete(nodeId);
      } else {
        collapsedNodes.add(nodeId);
      }
      renderCreateContent(panelEl);
    };
  });

  // Checkboxes
  panelEl.querySelectorAll('.alexandria-widget-checkbox').forEach(cb => {
    cb.onchange = (e) => {
      const key = `${e.target.dataset.nodeId}:${e.target.dataset.widgetName}`;
      selectedWidgets.set(key, e.target.checked);
      updateCreateStatusBar(panelEl);
    };
  });

  // View/Copy buttons
  panelEl.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.onclick = () => {
      const nodeId = parseInt(btn.dataset.nodeId, 10);
      const widgetName = btn.dataset.widgetName;
      const node = app.graph._nodes.find(n => n.id === nodeId);
      const widget = node?.widgets?.find(w => w.name === widgetName);
      if (widget) showValueModal(node, widget);
    };
  });

  panelEl.querySelectorAll('[data-action="copy"]').forEach(btn => {
    btn.onclick = () => {
      const nodeId = parseInt(btn.dataset.nodeId, 10);
      const widgetName = btn.dataset.widgetName;
      const node = app.graph._nodes.find(n => n.id === nodeId);
      const widget = node?.widgets?.find(w => w.name === widgetName);
      if (widget) {
        navigator.clipboard.writeText(String(widget.value));
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1000);
      }
    };
  });
}

/**
 * Update UI elements based on active tab
 */
function updateTabUI() {
  if (!panel) return;

  const browseToolbar = panel.querySelector('.alexandria-toolbar-browse');
  const loadBtn = panel.querySelector('[data-action="load-template"]');
  const saveBtn = panel.querySelector('[data-action="save"]');
  const selectBtn = panel.querySelector('[data-action="select-detected"]');
  const clearBtn = panel.querySelector('[data-action="clear"]');

  panel.querySelectorAll('.alexandria-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === activeTab);
  });

  if (activeTab === 'browse') {
    browseToolbar.style.display = 'flex';
    loadBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    selectBtn.style.display = 'inline-block';
    clearBtn.style.display = 'inline-block';
  } else {
    browseToolbar.style.display = 'none';
    loadBtn.style.display = selectedTemplateId ? 'inline-block' : 'none';
    saveBtn.style.display = 'none';
    selectBtn.style.display = 'none';
    clearBtn.style.display = 'none';
  }
}

/**
 * Refresh all panel content based on current mode
 */
export function refresh() {
  if (!panel) return;

  if (uiMode === 'create') {
    renderCreateContent(panel);
  } else if (uiMode === 'load') {
    renderLoadContent(panel);
  } else {
    // Landing mode - just re-render the whole panel
    renderPanelContent(panel);
  }
}

/**
 * Update the status bar
 */
function updateStatusBar() {
  if (!panel) return;
  const statusText = panel.querySelector('.alexandria-status-text');
  const selectedCount = Array.from(selectedWidgets.values()).filter(v => v).length;
  const detectedCount = Detection.getDetectedPrompts().length;

  if (activeTab === 'browse') {
    if (selectedCount === 0) {
      statusText.textContent = `${detectedCount} prompt${detectedCount !== 1 ? 's' : ''} detected — select prompts to save`;
    } else {
      statusText.textContent = `${selectedCount} prompt${selectedCount !== 1 ? 's' : ''} selected — ready to save`;
    }
  } else {
    if (selectedTemplateId) {
      statusText.textContent = 'Click "Load Template" to restore these prompts';
    } else {
      statusText.textContent = `${detectedCount} prompt${detectedCount !== 1 ? 's' : ''} detected in workflow`;
    }
  }
}

// ============ Template List ============

/**
 * Render a single template item HTML
 * @param {Object} template - Template object
 * @param {boolean} showWorkflowTag - Whether to show workflow name tag
 * @returns {string} HTML string
 */
function renderTemplateItem(template, showWorkflowTag = false) {
  const isSelected = template.id === selectedTemplateId;
  const version = template.versions[template.currentVersionIndex];
  const entryCount = version?.entries?.length || 0;
  const timeAgo = getTimeAgo(template.updatedAt);
  const versionCount = template.versions?.length || 1;
  const workflowTag = showWorkflowTag && template.workflowName
    ? `<span class="alexandria-template-workflow-tag" title="${escapeHtml(template.workflowName)}">${escapeHtml(template.workflowName)}</span>`
    : '';

  return `
    <div class="alexandria-template-item ${isSelected ? 'selected' : ''}" data-template-id="${template.id}" draggable="true">
      <div class="alexandria-drag-handle" title="Drag to reorder">⋮⋮</div>
      <div class="alexandria-template-info">
        <div class="alexandria-template-name">${escapeHtml(template.name)}${workflowTag}</div>
        <div class="alexandria-template-meta">
          ${entryCount} prompt${entryCount !== 1 ? 's' : ''} · ${timeAgo}
          ${versionCount > 1 ? `<span class="alexandria-version-badge" title="${versionCount} versions saved">v${versionCount}</span>` : ''}
        </div>
      </div>
      <div class="alexandria-template-actions">
        <button class="alexandria-btn-icon" data-action="rename-template" data-template-id="${template.id}" title="Rename">✏️</button>
        <button class="alexandria-btn-icon" data-action="delete-template" data-template-id="${template.id}" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * Render the template list HTML
 * @returns {string} HTML string
 */
function renderTemplateList() {
  const allTemplates = Storage.getTemplates();

  if (allTemplates.length === 0) {
    return `
      <div class="alexandria-template-empty">
        <div class="alexandria-template-empty-icon">📭</div>
        <div class="alexandria-template-empty-text">No templates yet</div>
        <div class="alexandria-template-empty-hint">Use "Current Prompts" tab to save your first template</div>
      </div>
    `;
  }

  // Get current workflow identity
  const workflowIdentity = Detection.getWorkflowIdentity();
  const currentWorkflowId = workflowIdentity?.id || null;

  // Separate templates by workflow
  const currentWorkflowTemplates = currentWorkflowId
    ? Storage.getTemplatesForWorkflow(currentWorkflowId)
    : [];
  const otherWorkflowTemplates = currentWorkflowId
    ? Storage.getTemplatesFromOtherWorkflows(currentWorkflowId)
    : [];
  const legacyTemplates = Storage.getLegacyTemplates();

  let html = '';

  // Current workflow templates section
  if (currentWorkflowTemplates.length > 0) {
    const workflowName = workflowIdentity?.name || 'Current Workflow';
    html += `
      <div class="alexandria-template-section">
        <div class="alexandria-template-section-header">
          <span class="alexandria-template-section-icon">📂</span>
          <span class="alexandria-template-section-title">${escapeHtml(workflowName)}</span>
          <span class="alexandria-template-section-count">${currentWorkflowTemplates.length}</span>
        </div>
        ${currentWorkflowTemplates.map(renderTemplateItem).join('')}
      </div>
    `;
  }

  // Legacy templates (no workflow assigned) - show if current workflow has none
  if (legacyTemplates.length > 0 && currentWorkflowTemplates.length === 0) {
    html += `
      <div class="alexandria-template-section">
        <div class="alexandria-template-section-header">
          <span class="alexandria-template-section-icon">📜</span>
          <span class="alexandria-template-section-title">Saved Templates</span>
          <span class="alexandria-template-section-count">${legacyTemplates.length}</span>
        </div>
        ${legacyTemplates.map(renderTemplateItem).join('')}
      </div>
    `;
  }

  // Other workflows section (collapsed by default)
  const otherTemplatesCount = otherWorkflowTemplates.length + (currentWorkflowTemplates.length > 0 ? legacyTemplates.length : 0);
  if (otherTemplatesCount > 0) {
    const otherTemplates = currentWorkflowTemplates.length > 0
      ? [...otherWorkflowTemplates, ...legacyTemplates]
      : otherWorkflowTemplates;

    html += `
      <div class="alexandria-template-section alexandria-template-section-other">
        <div class="alexandria-template-section-header alexandria-template-section-collapsible" data-action="toggle-other-workflows">
          <span class="alexandria-template-section-icon">📁</span>
          <span class="alexandria-template-section-title">Other Workflows</span>
          <span class="alexandria-template-section-count">${otherTemplates.length}</span>
          <span class="alexandria-template-section-toggle">▶</span>
        </div>
        <div class="alexandria-template-section-content" style="display: none;">
          ${otherTemplates.map(t => renderTemplateItem(t, true)).join('')}
        </div>
      </div>
    `;
  }

  // If no templates match current workflow, show helpful message
  if (html === '') {
    const workflowName = workflowIdentity?.name || 'this workflow';
    return `
      <div class="alexandria-template-empty">
        <div class="alexandria-template-empty-icon">📭</div>
        <div class="alexandria-template-empty-text">No templates for ${escapeHtml(workflowName)}</div>
        <div class="alexandria-template-empty-hint">Use "Current Prompts" tab to save your first template</div>
      </div>
    `;
  }

  return html;
}

/**
 * Attach event listeners to template list items
 */
function attachTemplateListeners() {
  if (!panel) return;

  // Template selection
  panel.querySelectorAll('.alexandria-template-item').forEach(item => {
    item.onclick = (e) => {
      if (e.target.closest('[data-action]')) return;
      selectedTemplateId = item.dataset.templateId;
      // Reset preview collapse state for fresh view
      collapsedPreviewGroups.clear();
      collapsedPreviewNodes.clear();
      activeTab = 'templates';
      updateTabUI();
      refresh();
    };
  });

  // Rename
  panel.querySelectorAll('[data-action="rename-template"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      showRenameDialog(btn.dataset.templateId);
    };
  });

  // Delete
  panel.querySelectorAll('[data-action="delete-template"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      confirmDeleteTemplate(btn.dataset.templateId);
    };
  });

  // Toggle other workflows section
  panel.querySelectorAll('[data-action="toggle-other-workflows"]').forEach(header => {
    header.onclick = () => {
      const section = header.closest('.alexandria-template-section-other');
      const content = section?.querySelector('.alexandria-template-section-content');
      const toggle = header.querySelector('.alexandria-template-section-toggle');
      if (content && toggle) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        toggle.textContent = isHidden ? '▼' : '▶';
      }
    };
  });

  // Drag and drop reordering
  attachDragDropListeners();
}

/**
 * Attach drag and drop event listeners for template reordering
 */
function attachDragDropListeners() {
  if (!panel) return;

  let draggedItem = null;
  let draggedId = null;

  panel.querySelectorAll('.alexandria-template-item[draggable="true"]').forEach(item => {
    // Drag start
    item.ondragstart = (e) => {
      draggedItem = item;
      draggedId = item.dataset.templateId;
      item.classList.add('alexandria-dragging');

      // Set drag data
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);

      // Slight delay to allow the drag image to be captured
      setTimeout(() => {
        item.style.opacity = '0.5';
      }, 0);
    };

    // Drag end
    item.ondragend = () => {
      item.classList.remove('alexandria-dragging');
      item.style.opacity = '';
      draggedItem = null;
      draggedId = null;

      // Remove all drop indicators
      panel.querySelectorAll('.alexandria-drop-indicator').forEach(el => el.remove());
      panel.querySelectorAll('.alexandria-drag-over').forEach(el => el.classList.remove('alexandria-drag-over'));
    };

    // Drag over
    item.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedItem || item === draggedItem) return;

      // Add visual indicator
      item.classList.add('alexandria-drag-over');
    };

    // Drag leave
    item.ondragleave = () => {
      item.classList.remove('alexandria-drag-over');
    };

    // Drop
    item.ondrop = (e) => {
      e.preventDefault();
      item.classList.remove('alexandria-drag-over');

      if (!draggedId || item === draggedItem) return;

      const targetId = item.dataset.templateId;

      // Get all template items in the current section to find indices
      const section = item.closest('.alexandria-template-section') || item.closest('.alexandria-sidebar');
      const items = section ? [...section.querySelectorAll('.alexandria-template-item')] : [];
      const targetIndex = items.findIndex(i => i.dataset.templateId === targetId);

      if (targetIndex >= 0) {
        Storage.reorderTemplate(draggedId, targetIndex);
        refresh();
        showToast('Template order updated');
      }
    };
  });
}

// ============ Template Preview ============

/**
 * Find matching workflow node for a template entry
 * @param {Object} entry - Template entry
 * @returns {Object|null} Matching node data or null
 */
function findMatchingNode(entry) {
  if (!app.graph?._nodes) return null;

  // Strategy 1: Match by node ID (best match if workflow unchanged)
  let match = app.graph._nodes.find(n => n.id === entry.nodeId && n.type === entry.nodeType);

  // Strategy 2: Match by type + title
  if (!match) {
    match = app.graph._nodes.find(n => n.type === entry.nodeType && (n.title || n.type) === entry.nodeTitle);
  }

  // Strategy 3: Match by type only (first available)
  if (!match) {
    match = app.graph._nodes.find(n => n.type === entry.nodeType);
  }

  if (!match) return null;

  // Get canvas group for the matched node
  const canvasGroup = findMatchingNodeCanvasGroup(match);

  return {
    id: match.id,
    type: match.type,
    title: match.title || match.type,
    canvasGroup: canvasGroup,
    exactMatch: match.id === entry.nodeId,
    titleMatch: (match.title || match.type) === entry.nodeTitle,
  };
}

/**
 * Find canvas group for a node (mirrors detection.js logic)
 */
function findMatchingNodeCanvasGroup(node) {
  if (!app.graph?._groups || !node.pos) return null;

  const nodeX = node.pos[0];
  const nodeY = node.pos[1];

  for (const group of app.graph._groups) {
    let gx, gy, gw, gh;

    if (group._bounding && group._bounding.length === 4) {
      [gx, gy, gw, gh] = group._bounding;
    } else if (group.bounding && group.bounding.length === 4) {
      [gx, gy, gw, gh] = group.bounding;
    } else if (group._pos && group._size) {
      gx = group._pos[0]; gy = group._pos[1];
      gw = group._size[0]; gh = group._size[1];
    } else if (group.pos && group.size) {
      gx = group.pos[0]; gy = group.pos[1];
      gw = group.size[0]; gh = group.size[1];
    } else {
      continue;
    }

    if (nodeX >= gx && nodeX <= gx + gw && nodeY >= gy && nodeY <= gy + gh) {
      return group.title || group._title || 'Unnamed Group';
    }
  }

  return null;
}

/**
 * Compare a template entry to the current workflow state
 * @param {Object} entry - Template entry
 * @returns {Object} Diff result with status and values
 */
function compareEntryToWorkflow(entry) {
  const match = findMatchingNode(entry);

  if (!match) {
    return {
      status: 'node_missing',
      entry,
      templateValue: entry.value,
      currentValue: null,
      description: 'Node not in workflow'
    };
  }

  // Get the actual node from the graph to access widgets
  const actualNode = app.graph._nodes.find(n => n.id === match.id);
  const widget = actualNode?.widgets?.find(w => w.name === entry.widgetName);
  if (!widget) {
    return {
      status: 'widget_missing',
      entry,
      match,
      templateValue: entry.value,
      currentValue: null,
      description: 'Widget not found'
    };
  }

  // Compare values (handle different types)
  const templateVal = String(entry.value);
  const currentVal = String(widget.value);

  if (templateVal !== currentVal) {
    return {
      status: 'changed',
      entry,
      match,
      templateValue: entry.value,
      currentValue: widget.value,
      description: 'Value differs'
    };
  }

  return {
    status: 'unchanged',
    entry,
    match,
    templateValue: entry.value,
    currentValue: widget.value
  };
}

/**
 * Analyze all entries in a version and categorize by diff status
 * @param {Array} entries - Template entries
 * @returns {Object} Categorized diff results
 */
function analyzeVersionDiff(entries) {
  const results = {
    changed: [],
    nodeMissing: [],
    widgetMissing: [],
    unchanged: [],
    totalEntries: entries.length
  };

  for (const entry of entries) {
    const diff = compareEntryToWorkflow(entry);
    switch (diff.status) {
      case 'changed':
        results.changed.push(diff);
        break;
      case 'node_missing':
        results.nodeMissing.push(diff);
        break;
      case 'widget_missing':
        results.widgetMissing.push(diff);
        break;
      default:
        results.unchanged.push(diff);
    }
  }

  return results;
}

/**
 * Format a timestamp for version history display
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
function formatVersionTimestamp(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / 3600000;
  const diffDays = diffMs / 86400000;

  // If today, show time
  if (diffDays < 1 && date.getDate() === now.getDate()) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  // If yesterday
  if (diffDays < 2) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  // If within a week
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  // Otherwise show full date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Render the version history list
 * @param {Object} template - Template object
 * @param {number} currentVersionIndex - Currently selected version index
 * @returns {string} HTML string
 */
function renderVersionHistory(template, currentVersionIndex) {
  // Sort versions by timestamp descending (newest first)
  const versionsWithIndex = template.versions.map((v, i) => ({ ...v, originalIndex: i }));
  versionsWithIndex.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let html = `<div class="alexandria-version-history">`;

  for (const version of versionsWithIndex) {
    const isSelected = version.originalIndex === currentVersionIndex;
    const isLatest = version.originalIndex === template.currentVersionIndex;
    const entryCount = version.entries?.length || 0;
    const timestamp = formatVersionTimestamp(version.timestamp);

    html += `
      <div class="alexandria-version-item ${isSelected ? 'selected' : ''}" data-version-index="${version.originalIndex}">
        <div class="alexandria-version-item-main">
          <span class="alexandria-version-item-time">${timestamp}</span>
          ${isLatest ? '<span class="alexandria-version-item-badge">Latest</span>' : ''}
        </div>
        <div class="alexandria-version-item-meta">
          ${entryCount} prompt${entryCount !== 1 ? 's' : ''}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Render diff view showing only changed entries
 * @param {Object} diffAnalysis - Results from analyzeVersionDiff
 * @returns {string} HTML string
 */
function renderDiffView(diffAnalysis) {
  let html = '';

  // Render changed entries
  if (diffAnalysis.changed.length > 0) {
    html += `
      <div class="alexandria-diff-section">
        <div class="alexandria-diff-section-header">
          <span class="alexandria-diff-section-icon">📝</span>
          <span class="alexandria-diff-section-title">Changed Values</span>
          <span class="alexandria-diff-section-count">${diffAnalysis.changed.length}</span>
        </div>
        <div class="alexandria-diff-section-content">
          ${diffAnalysis.changed.map(diff => renderDiffEntry(diff)).join('')}
        </div>
      </div>
    `;
  }

  // Render entries with missing nodes
  if (diffAnalysis.nodeMissing.length > 0) {
    html += `
      <div class="alexandria-diff-section alexandria-diff-section-warning">
        <div class="alexandria-diff-section-header">
          <span class="alexandria-diff-section-icon">⚠️</span>
          <span class="alexandria-diff-section-title">Nodes Not Found</span>
          <span class="alexandria-diff-section-count">${diffAnalysis.nodeMissing.length}</span>
        </div>
        <div class="alexandria-diff-section-content">
          ${diffAnalysis.nodeMissing.map(diff => renderDiffEntry(diff)).join('')}
        </div>
      </div>
    `;
  }

  // Render entries with missing widgets
  if (diffAnalysis.widgetMissing.length > 0) {
    html += `
      <div class="alexandria-diff-section alexandria-diff-section-warning">
        <div class="alexandria-diff-section-header">
          <span class="alexandria-diff-section-icon">❓</span>
          <span class="alexandria-diff-section-title">Widgets Not Found</span>
          <span class="alexandria-diff-section-count">${diffAnalysis.widgetMissing.length}</span>
        </div>
        <div class="alexandria-diff-section-content">
          ${diffAnalysis.widgetMissing.map(diff => renderDiffEntry(diff)).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Render a single diff entry
 * @param {Object} diff - Diff result from compareEntryToWorkflow
 * @returns {string} HTML string
 */
function renderDiffEntry(diff) {
  const { entry, status, templateValue, currentValue, match } = diff;
  const nodeTitle = entry.nodeTitle || entry.nodeType;
  const targetId = match ? `→ #${match.id}` : 'No match';

  // Format values for display
  const templatePreview = getValuePreview(templateValue, 150);
  const currentPreview = currentValue !== null ? getValuePreview(currentValue, 150) : '(not available)';

  if (status === 'changed') {
    return `
      <div class="alexandria-diff-entry">
        <div class="alexandria-diff-entry-header">
          <span class="alexandria-diff-entry-node">${escapeHtml(nodeTitle)}</span>
          <span class="alexandria-diff-entry-widget">${escapeHtml(entry.widgetName)}</span>
          <span class="alexandria-diff-entry-target">${targetId}</span>
        </div>
        <div class="alexandria-diff-entry-values">
          <div class="alexandria-diff-value alexandria-diff-value-old">
            <span class="alexandria-diff-value-label">Current:</span>
            <span class="alexandria-diff-value-text">${escapeHtml(currentPreview)}</span>
          </div>
          <div class="alexandria-diff-value alexandria-diff-value-new">
            <span class="alexandria-diff-value-label">Template:</span>
            <span class="alexandria-diff-value-text">${escapeHtml(templatePreview)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // For missing nodes/widgets, just show the template value
  return `
    <div class="alexandria-diff-entry alexandria-diff-entry-missing">
      <div class="alexandria-diff-entry-header">
        <span class="alexandria-diff-entry-node">${escapeHtml(nodeTitle)}</span>
        <span class="alexandria-diff-entry-widget">${escapeHtml(entry.widgetName)}</span>
        <span class="alexandria-diff-entry-target alexandria-diff-entry-no-match">${targetId}</span>
      </div>
      <div class="alexandria-diff-entry-values">
        <div class="alexandria-diff-value alexandria-diff-value-template">
          <span class="alexandria-diff-value-label">Template:</span>
          <span class="alexandria-diff-value-text">${escapeHtml(templatePreview)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render template preview HTML
 * @returns {string} HTML string
 */
function renderTemplatePreview() {
  if (!selectedTemplateId) {
    const templates = Storage.getTemplates();
    if (templates.length === 0) {
      return `
        <div class="alexandria-preview-empty">
          <div class="alexandria-preview-empty-icon">💡</div>
          <div class="alexandria-preview-empty-text">Getting Started</div>
          <div class="alexandria-preview-empty-hint">
            <ol style="text-align: left; margin: 16px auto; max-width: 300px; line-height: 1.8;">
              <li>Go to the <strong>"Current Prompts"</strong> tab</li>
              <li>Review the prompts we detected</li>
              <li>Click <strong>"💾 Save as Template"</strong></li>
              <li>Your prompts are now saved!</li>
            </ol>
            <p style="margin-top: 16px; color: var(--alexandria-text-muted);">
              Later, load any template to restore your prompts instantly.
            </p>
          </div>
        </div>
      `;
    }
    return `
      <div class="alexandria-preview-empty">
        <div class="alexandria-preview-empty-icon">👈</div>
        <div class="alexandria-preview-empty-text">Select a template to preview</div>
        <div class="alexandria-preview-empty-hint">Click a template on the left to see its contents</div>
      </div>
    `;
  }

  const template = Storage.getTemplate(selectedTemplateId);
  if (!template) {
    selectedTemplateId = null;
    return renderTemplatePreview();
  }

  // Determine which version to display
  const versionIndex = selectedVersionIndex !== null
    ? selectedVersionIndex
    : template.currentVersionIndex;
  const version = template.versions[versionIndex];
  const entries = version?.entries || [];
  const versionCount = template.versions?.length || 1;
  const isLatestVersion = versionIndex === template.currentVersionIndex;

  if (entries.length === 0) {
    return `<div class="alexandria-preview-empty"><div class="alexandria-preview-empty-text">Template is empty</div></div>`;
  }

  // Match entries to current workflow nodes and group by target node
  const nodeMap = new Map(); // nodeKey -> { match, entries }
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const entry of entries) {
    const match = findMatchingNode(entry);
    const nodeKey = match ? `matched:${match.id}` : `unmatched:${entry.nodeType}:${entry.nodeTitle}`;

    if (!nodeMap.has(nodeKey)) {
      nodeMap.set(nodeKey, {
        match,
        nodeType: entry.nodeType,
        nodeTitle: entry.nodeTitle,
        originalNodeId: entry.nodeId,
        canvasGroup: match?.canvasGroup || null,
        entries: []
      });
    }
    nodeMap.get(nodeKey).entries.push(entry);

    if (match) matchedCount++;
    else unmatchedCount++;
  }

  // Group nodes by canvas group
  const canvasGroups = new Map();
  for (const [nodeKey, nodeData] of nodeMap) {
    const groupKey = nodeData.canvasGroup || (nodeData.match ? '(Ungrouped)' : '⚠ No Match');
    if (!canvasGroups.has(groupKey)) {
      canvasGroups.set(groupKey, []);
    }
    canvasGroups.get(groupKey).push({ nodeKey, ...nodeData });
  }

  // Sort: matched groups first, then "No Match" last
  const sortedGroups = Array.from(canvasGroups.entries()).sort((a, b) => {
    if (a[0] === '⚠ No Match') return 1;
    if (b[0] === '⚠ No Match') return -1;
    return a[0].localeCompare(b[0]);
  });

  // Build header with version info
  let html = `
    <div class="alexandria-preview-header">
      <div class="alexandria-preview-header-left">
        <span class="alexandria-preview-title">${escapeHtml(template.name)}</span>
        <span class="alexandria-preview-stats">
          ${matchedCount > 0 ? `<span class="alexandria-match-good">✓ ${matchedCount} matched</span>` : ''}
          ${unmatchedCount > 0 ? `<span class="alexandria-match-bad">⚠ ${unmatchedCount} unmatched</span>` : ''}
        </span>
      </div>
      <a href="#" class="alexandria-collapse-link" data-action="preview-collapse-all">▲ Collapse All</a>
    </div>
  `;

  // Analyze diff for the version
  const diffAnalysis = analyzeVersionDiff(entries);
  const hasChanges = diffAnalysis.changed.length > 0 || diffAnalysis.nodeMissing.length > 0 || diffAnalysis.widgetMissing.length > 0;
  const changeCount = diffAnalysis.changed.length + diffAnalysis.nodeMissing.length + diffAnalysis.widgetMissing.length;

  // Version info bar
  html += `
    <div class="alexandria-version-bar">
      <div class="alexandria-version-current">
        <span class="alexandria-version-label">${isLatestVersion ? '📌 Latest' : '📜 Viewing older version'}</span>
        <span class="alexandria-version-time">${getTimeAgo(version.timestamp)}</span>
        ${!isLatestVersion ? `<button class="alexandria-btn-small alexandria-btn-link" data-action="version-go-latest">← Back to latest</button>` : ''}
      </div>
      <div class="alexandria-version-bar-right">
        ${hasChanges ? `
          <button class="alexandria-diff-toggle ${showDiffOnly ? 'active' : ''}" data-action="toggle-diff-view" title="Toggle between showing changes only or all entries">
            ${showDiffOnly ? '🔍 Changes only' : '📋 Show all'}
          </button>
        ` : ''}
        ${versionCount > 1 ? `
          <button class="alexandria-version-toggle" data-action="toggle-version-history">
            ${versionHistoryExpanded ? '▼' : '▶'} History (${versionCount})
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Version history (collapsible)
  if (versionCount > 1 && versionHistoryExpanded) {
    html += renderVersionHistory(template, versionIndex);
  }

  // Diff summary banner (when showing changes only)
  if (showDiffOnly && hasChanges) {
    html += `
      <div class="alexandria-diff-summary">
        <span class="alexandria-diff-summary-icon">📊</span>
        <span class="alexandria-diff-summary-text">
          <strong>${changeCount} change${changeCount !== 1 ? 's' : ''}</strong> from current workflow
          ${diffAnalysis.unchanged.length > 0 ? ` · ${diffAnalysis.unchanged.length} unchanged (hidden)` : ''}
        </span>
      </div>
    `;
  }

  // If diff mode and no changes, show "no changes" message
  if (showDiffOnly && !hasChanges) {
    html += `
      <div class="alexandria-diff-no-changes">
        <div class="alexandria-diff-no-changes-icon">✅</div>
        <div class="alexandria-diff-no-changes-text">This version matches your current workflow</div>
        <div class="alexandria-diff-no-changes-hint">All ${entries.length} prompts are identical to your current values</div>
      </div>
    `;
    return html;
  }

  // If diff mode and has changes, render diff view
  if (showDiffOnly && hasChanges) {
    html += renderDiffView(diffAnalysis);
    return html;
  }

  // Otherwise render full preview (current behavior)
  // Render groups
  for (const [groupName, nodes] of sortedGroups) {
    const isNoMatch = groupName === '⚠ No Match';
    const isGroupCollapsed = collapsedPreviewGroups.has(groupName);
    const nodeCount = nodes.length;
    const entryCount = nodes.reduce((sum, n) => sum + n.entries.length, 0);

    html += `
      <div class="alexandria-group ${isGroupCollapsed ? 'collapsed' : ''} ${isNoMatch ? 'alexandria-group-warning' : ''}">
        <div class="alexandria-group-header" data-preview-group="${escapeHtml(groupName)}">
          <span class="alexandria-collapse-icon">${isGroupCollapsed ? '▶' : '▼'}</span>
          <span class="alexandria-group-title">${escapeHtml(groupName)}</span>
          <span class="alexandria-group-count">${nodeCount} node${nodeCount !== 1 ? 's' : ''} · ${entryCount} prompt${entryCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="alexandria-group-content" style="${isGroupCollapsed ? 'display:none;' : ''}">
          ${nodes.map(nodeData => renderPreviewNode(nodeData)).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Render a single node in template preview
 */
function renderPreviewNode(nodeData) {
  const { match, nodeType, nodeTitle, originalNodeId, entries, nodeKey } = nodeData;
  const isCollapsed = collapsedPreviewNodes.has(nodeKey);
  const entryCount = entries.length;

  // Build match status display
  let matchStatus, matchClass;
  if (match) {
    if (match.exactMatch) {
      matchStatus = `→ #${match.id}`;
      matchClass = 'alexandria-match-exact';
    } else if (match.titleMatch) {
      matchStatus = `→ #${match.id}`;
      matchClass = 'alexandria-match-title';
    } else {
      matchStatus = `→ #${match.id} (type match)`;
      matchClass = 'alexandria-match-type';
    }
  } else {
    matchStatus = 'No matching node';
    matchClass = 'alexandria-match-none';
  }

  // Collapsed summary: show first entry value preview
  const collapsedSummary = isCollapsed && entryCount > 0
    ? `<span class="alexandria-preview-collapsed-value">${escapeHtml(getValuePreview(entries[0].value, 60))}</span>`
    : '';

  return `
    <div class="alexandria-node ${isCollapsed ? 'collapsed' : ''} ${!match ? 'alexandria-node-unmatched' : ''}">
      <div class="alexandria-node-header alexandria-preview-node-header" data-preview-node="${escapeHtml(nodeKey)}">
        <span class="alexandria-collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
        <span class="alexandria-node-title">${escapeHtml(nodeTitle)}</span>
        <span class="alexandria-node-type-badge">${escapeHtml(nodeType)}</span>
        <span class="alexandria-match-status ${matchClass}">${matchStatus}</span>
        ${isCollapsed ? collapsedSummary : ''}
        ${isCollapsed ? `<span class="alexandria-widget-count">${entryCount} prompt${entryCount !== 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="alexandria-node-widgets alexandria-preview-widgets" style="${isCollapsed ? 'display:none;' : ''}">
        ${entries.map(entry => `
          <div class="alexandria-preview-widget">
            <span class="alexandria-preview-widget-name">${escapeHtml(entry.widgetName)}</span>
            <span class="alexandria-preview-widget-value">${escapeHtml(getValuePreview(entry.value, 100))}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============ Node Browser ============

/**
 * Render node list HTML with collapsible groups
 * @returns {string} HTML string
 */
function renderNodeList() {
  let nodes = Detection.getAllWorkflowWidgets();

  // Filter by search
  if (searchQuery) {
    nodes = nodes.filter(node => {
      const str = `${node.title} ${node.type}`.toLowerCase();
      return str.includes(searchQuery) ||
        node.widgets.some(w => w.name.toLowerCase().includes(searchQuery));
    });
  }

  // Filter by type
  if (filterType === 'detected') {
    nodes = nodes.filter(n => n.widgets.some(w => w.isDetected));
  } else if (filterType === 'other') {
    nodes = nodes.filter(n => !n.widgets.some(w => w.isDetected));
  }

  if (nodes.length === 0) {
    if (filterType === 'detected') {
      return `
        <div class="alexandria-empty">
          <div class="alexandria-empty-icon">🔍</div>
          <div class="alexandria-empty-text">No prompts detected</div>
          <div class="alexandria-empty-hint">Add CLIPTextEncode or other prompt nodes to your workflow</div>
        </div>
      `;
    }
    return `
      <div class="alexandria-empty">
        <div class="alexandria-empty-icon">📭</div>
        <div class="alexandria-empty-text">No nodes found</div>
        <div class="alexandria-empty-hint">${searchQuery ? 'Try a different search term' : 'Add nodes to your workflow'}</div>
      </div>
    `;
  }

  // Group nodes by canvas group (or "Ungrouped" if not in a group)
  const groups = new Map();
  for (const node of nodes) {
    const groupKey = node.canvasGroup || '(Ungrouped)';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(node);
  }

  // Auto-collapse groups that have no detected prompts (unless user manually expanded them)
  for (const [groupKey, groupNodes] of groups) {
    const hasDetectedPrompts = groupNodes.some(n => n.widgets.some(w => w.isDetected));
    if (!hasDetectedPrompts && !userExpandedGroups.has(groupKey)) {
      collapsedGroups.add(groupKey);
    }
  }

  // Render collapse all link at top
  const totalNodes = nodes.length;
  const allCollapsed = nodes.every(n => collapsedNodes.has(n.id));
  let html = `
    <div class="alexandria-collapse-controls">
      <a href="#" class="alexandria-collapse-link" data-action="${allCollapsed ? 'expand-all' : 'collapse-all'}">
        ${allCollapsed ? '▼ Expand All' : '▲ Collapse All'}
      </a>
    </div>
  `;

  for (const [groupType, groupNodes] of groups) {
    const isGroupCollapsed = collapsedGroups.has(groupType);
    const detectedCount = groupNodes.filter(n => n.widgets.some(w => w.isDetected)).length;

    html += `
      <div class="alexandria-group ${isGroupCollapsed ? 'collapsed' : ''}">
        <div class="alexandria-group-header" data-group="${escapeHtml(groupType)}">
          <span class="alexandria-collapse-icon">${isGroupCollapsed ? '▶' : '▼'}</span>
          <span class="alexandria-group-title">${escapeHtml(groupType)}</span>
          <span class="alexandria-group-count">${groupNodes.length} node${groupNodes.length !== 1 ? 's' : ''}</span>
          ${detectedCount > 0 ? `<span class="alexandria-badge badge-detected">${detectedCount} with prompts</span>` : ''}
        </div>
        <div class="alexandria-group-content" style="${isGroupCollapsed ? 'display:none;' : ''}">
          ${groupNodes.map(node => renderNode(node)).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Render a single node card with collapsible widgets
 * @param {Object} node - Node data
 * @returns {string} HTML string
 */
function renderNode(node) {
  const hasDetected = node.widgets.some(w => w.isDetected);
  const isBypassed = node.mode === 2 || node.mode === 4;
  const isNodeCollapsed = collapsedNodes.has(node.id);
  const widgetCount = node.widgets.length;

  // Count selected widgets for this node
  const selectedCount = node.widgets.filter(w => {
    const key = `${node.id}:${w.name}`;
    return selectedWidgets.get(key);
  }).length;

  return `
    <div class="alexandria-node ${hasDetected ? 'has-detected' : ''} ${isBypassed ? 'alexandria-node-bypassed' : ''} ${isNodeCollapsed ? 'collapsed' : ''}">
      <div class="alexandria-node-header" data-node-id="${node.id}">
        <span class="alexandria-collapse-icon">${isNodeCollapsed ? '▶' : '▼'}</span>
        <span class="alexandria-node-icon">📦</span>
        <span class="alexandria-node-title">${escapeHtml(node.title)}</span>
        <span class="alexandria-node-id">#${node.id}</span>
        ${isNodeCollapsed && selectedCount > 0
          ? `<span class="alexandria-collapsed-saved">✓ ${selectedCount} Saved</span>`
          : `<span class="alexandria-widget-count">${widgetCount} widget${widgetCount !== 1 ? 's' : ''}</span>`}
        ${isBypassed ? '<span class="alexandria-badge badge-bypassed">Bypassed</span>' : ''}
        ${hasDetected ? '<span class="alexandria-badge badge-detected">Prompts</span>' : ''}
      </div>
      <div class="alexandria-node-widgets" style="${isNodeCollapsed ? 'display:none;' : ''}">
        ${node.widgets.map(w => renderWidget(node, w)).join('')}
      </div>
      <div class="alexandria-node-meta" style="${isNodeCollapsed ? 'display:none;' : ''}">Type: ${escapeHtml(node.type)}</div>
    </div>
  `;
}

/**
 * Render a widget row
 * @param {Object} node - Node data
 * @param {Object} widget - Widget data
 * @returns {string} HTML string
 */
function renderWidget(node, widget) {
  const key = `${node.id}:${widget.name}`;
  const isSelected = selectedWidgets.get(key) || false;
  const preview = getValuePreview(widget.value);

  return `
    <div class="alexandria-widget ${widget.isDetected ? 'widget-detected' : ''}">
      <label class="alexandria-widget-label">
        <input type="checkbox" class="alexandria-widget-checkbox"
          ${isSelected ? 'checked' : ''}
          data-node-id="${node.id}"
          data-node-type="${escapeHtml(node.type)}"
          data-widget-name="${escapeHtml(widget.name)}" />
        <span class="alexandria-widget-name">${escapeHtml(widget.name)}</span>
        ${widget.isDetected ? `<span class="alexandria-confidence">${widget.confidence}%</span>` : ''}
      </label>
      <div class="alexandria-widget-value">${escapeHtml(preview)}</div>
      ${widget.isDetected ? `<div class="alexandria-widget-method">${METHOD_LABELS[widget.method] || widget.method}</div>` : ''}
      <div class="alexandria-widget-actions">
        <button class="alexandria-btn-small" data-action="view" data-node-id="${node.id}" data-widget-name="${escapeHtml(widget.name)}">👁</button>
        <button class="alexandria-btn-small" data-action="copy" data-node-id="${node.id}" data-widget-name="${escapeHtml(widget.name)}">📋</button>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to content area
 */
function attachContentListeners() {
  if (!panel) return;

  // Collapse/Expand All link (for browse tab)
  const collapseLink = panel.querySelector('.alexandria-collapse-link[data-action="collapse-all"], .alexandria-collapse-link[data-action="expand-all"]');
  if (collapseLink) {
    collapseLink.onclick = (e) => {
      e.preventDefault();
      const action = collapseLink.dataset.action;
      const allNodes = Detection.getAllWorkflowWidgets();

      if (action === 'collapse-all') {
        allNodes.forEach(n => collapsedNodes.add(n.id));
      } else {
        collapsedNodes.clear();
      }
      refresh();
    };
  }

  // Collapse/Expand All link (for preview tab)
  const previewCollapseLink = panel.querySelector('.alexandria-collapse-link[data-action="preview-collapse-all"]');
  if (previewCollapseLink) {
    previewCollapseLink.onclick = (e) => {
      e.preventDefault();
      // Toggle: if most are expanded, collapse all; otherwise expand all
      const allGroups = panel.querySelectorAll('[data-preview-group]');
      const allNodes = panel.querySelectorAll('[data-preview-node]');

      if (collapsedPreviewGroups.size === 0 && collapsedPreviewNodes.size === 0) {
        // Collapse all
        allGroups.forEach(g => collapsedPreviewGroups.add(g.dataset.previewGroup));
        allNodes.forEach(n => collapsedPreviewNodes.add(n.dataset.previewNode));
        previewCollapseLink.textContent = '▼ Expand All';
      } else {
        // Expand all
        collapsedPreviewGroups.clear();
        collapsedPreviewNodes.clear();
        previewCollapseLink.textContent = '▲ Collapse All';
      }
      refresh();
    };
  }

  // Preview group header click
  panel.querySelectorAll('[data-preview-group]').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('input, button, a')) return;
      const groupName = header.dataset.previewGroup;
      const group = header.closest('.alexandria-group');
      const content = group.querySelector('.alexandria-group-content');
      const icon = header.querySelector('.alexandria-collapse-icon');

      if (collapsedPreviewGroups.has(groupName)) {
        collapsedPreviewGroups.delete(groupName);
        content.style.display = '';
        icon.textContent = '▼';
        group.classList.remove('collapsed');
      } else {
        collapsedPreviewGroups.add(groupName);
        content.style.display = 'none';
        icon.textContent = '▶';
        group.classList.add('collapsed');
      }
    };
  });

  // Preview node header click
  panel.querySelectorAll('[data-preview-node]').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('input, button, a')) return;
      const nodeKey = header.dataset.previewNode;
      const node = header.closest('.alexandria-node');
      const widgets = node.querySelector('.alexandria-node-widgets');
      const icon = header.querySelector('.alexandria-collapse-icon');

      if (collapsedPreviewNodes.has(nodeKey)) {
        collapsedPreviewNodes.delete(nodeKey);
        widgets.style.display = '';
        icon.textContent = '▼';
        node.classList.remove('collapsed');
      } else {
        collapsedPreviewNodes.add(nodeKey);
        widgets.style.display = 'none';
        icon.textContent = '▶';
        node.classList.add('collapsed');
      }
      // Re-render to update collapsed summary
      refresh();
    };
  });

  // Group header click - toggle collapse (for browse tab, not preview)
  panel.querySelectorAll('.alexandria-group-header[data-group]').forEach(header => {
    header.onclick = (e) => {
      // Don't collapse if clicking on a checkbox or button inside
      if (e.target.closest('input, button')) return;

      const groupType = header.dataset.group;
      const group = header.closest('.alexandria-group');
      const content = group.querySelector('.alexandria-group-content');
      const icon = header.querySelector('.alexandria-collapse-icon');

      if (collapsedGroups.has(groupType)) {
        // User is expanding - track this so we don't auto-collapse again
        collapsedGroups.delete(groupType);
        userExpandedGroups.add(groupType);
        content.style.display = '';
        icon.textContent = '▼';
        group.classList.remove('collapsed');
      } else {
        // User is collapsing - remove from user-expanded tracking
        collapsedGroups.add(groupType);
        userExpandedGroups.delete(groupType);
        content.style.display = 'none';
        icon.textContent = '▶';
        group.classList.add('collapsed');
      }
    };
  });

  // Node header click - toggle collapse
  panel.querySelectorAll('.alexandria-node-header[data-node-id]').forEach(header => {
    header.onclick = (e) => {
      // Don't collapse if clicking on a checkbox or button inside
      if (e.target.closest('input, button')) return;

      const nodeId = parseInt(header.dataset.nodeId, 10);
      const node = header.closest('.alexandria-node');
      const widgets = node.querySelector('.alexandria-node-widgets');
      const meta = node.querySelector('.alexandria-node-meta');
      const icon = header.querySelector('.alexandria-collapse-icon');

      if (collapsedNodes.has(nodeId)) {
        collapsedNodes.delete(nodeId);
        widgets.style.display = '';
        if (meta) meta.style.display = '';
        icon.textContent = '▼';
        node.classList.remove('collapsed');
      } else {
        collapsedNodes.add(nodeId);
        widgets.style.display = 'none';
        if (meta) meta.style.display = 'none';
        icon.textContent = '▶';
        node.classList.add('collapsed');
      }
    };
  });

  // Checkboxes
  panel.querySelectorAll('.alexandria-widget-checkbox').forEach(cb => {
    cb.onchange = (e) => {
      const key = `${e.target.dataset.nodeId}:${e.target.dataset.widgetName}`;
      selectedWidgets.set(key, e.target.checked);

      // Save manual selection for low-confidence detections
      const detection = Detection.detectAllPrompts().get(key);
      if (!detection || detection.confidence < 50) {
        Storage.setManualSelection(
          e.target.dataset.nodeType,
          e.target.dataset.widgetName,
          e.target.checked ? true : null
        );
      }
      updateStatusBar();
    };
  });

  // View buttons
  panel.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.onclick = () => {
      const nodeId = parseInt(btn.dataset.nodeId, 10);
      const widgetName = btn.dataset.widgetName;
      const node = app.graph._nodes.find(n => n.id === nodeId);
      const widget = node?.widgets?.find(w => w.name === widgetName);
      if (widget) showValueModal(node, widget);
    };
  });

  // Copy buttons
  panel.querySelectorAll('[data-action="copy"]').forEach(btn => {
    btn.onclick = () => {
      const nodeId = parseInt(btn.dataset.nodeId, 10);
      const widgetName = btn.dataset.widgetName;
      const node = app.graph._nodes.find(n => n.id === nodeId);
      const widget = node?.widgets?.find(w => w.name === widgetName);
      if (widget) {
        navigator.clipboard.writeText(String(widget.value));
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1000);
      }
    };
  });
}

// ============ Actions ============

/**
 * Select all detected prompts
 */
function selectAllDetected() {
  const detected = Detection.getDetectedPrompts();
  for (const p of detected) {
    selectedWidgets.set(`${p.node.id}:${p.widget.name}`, true);
  }
  refresh();
}

/**
 * Clear all selections
 */
function clearSelection() {
  selectedWidgets.clear();
  refresh();
}

/**
 * Load the selected template
 */
function loadSelectedTemplate() {
  if (!selectedTemplateId) {
    showToast('Please select a template first', 'warning');
    return;
  }

  const template = Storage.getTemplate(selectedTemplateId);
  if (!template) {
    showToast('Template not found', 'error');
    return;
  }

  // Determine which version to load
  const versionIndex = selectedVersionIndex !== null
    ? selectedVersionIndex
    : template.currentVersionIndex;
  const version = template.versions[versionIndex];

  if (!version) {
    showToast('Version not found', 'error');
    return;
  }

  // Create a template-like object with the selected version for restoration
  const templateToLoad = {
    ...template,
    versions: [version],
    currentVersionIndex: 0
  };

  // Use global API for restoration
  const results = window.Alexandria.restoreTemplate(templateToLoad);

  if (results.restored.length === 0 && results.skipped.length > 0) {
    showToast(`No prompts restored (${results.skipped.length} nodes not found)`, 'warning');
  } else if (results.skipped.length > 0) {
    showToast(`Restored ${results.restored.length} prompts (${results.skipped.length} skipped)`);
  } else {
    showToast(`Restored ${results.restored.length} prompts!`);
  }
}

/**
 * Save selected widgets as a template
 */
function saveAsTemplate() {
  // Get workflow identity for linking template to workflow
  const workflowIdentity = Detection.getWorkflowIdentity();

  // Require workflow to be saved so we can link templates properly
  if (!workflowIdentity.isSaved) {
    showToast('Please save your workflow first (Ctrl+S) before saving templates', 'error');
    return;
  }

  const selectedEntries = [];

  for (const [key, selected] of selectedWidgets) {
    if (!selected) continue;

    // Parse key safely
    const separatorIndex = key.indexOf(':');
    if (separatorIndex === -1) continue;

    const nodeId = parseInt(key.substring(0, separatorIndex), 10);
    const widgetName = key.substring(separatorIndex + 1);

    const node = app.graph._nodes.find(n => n.id === nodeId);
    const widget = node?.widgets?.find(w => w.name === widgetName);

    if (node && widget) {
      const detection = Detection.detectAllPrompts().get(key);
      selectedEntries.push({
        nodeType: node.type,
        nodeTitle: node.title || node.type,
        nodeId: node.id,
        widgetName: widget.name,
        value: widget.value,
        valueType: typeof widget.value,
        detectionMethod: detection?.method || 'user_manual_selection',
        confidenceScore: detection?.confidence || 100,
      });
    }
  }

  if (selectedEntries.length === 0) {
    showToast('Please select at least one widget to save', 'warning');
    return;
  }

  showSaveDialog(selectedEntries, workflowIdentity);
}

/**
 * Export all templates
 */
function exportTemplates() {
  Storage.downloadExport();
  showToast('Templates exported!');
}

/**
 * Export a single selected template
 */
function exportSelectedTemplate() {
  if (!selectedTemplateId) {
    showToast('Please select a template first', 'warning');
    return;
  }

  const template = Storage.getTemplate(selectedTemplateId);
  if (!template) {
    showToast('Template not found', 'error');
    return;
  }

  // Determine which version to export
  const versionIndex = selectedVersionIndex !== null
    ? selectedVersionIndex
    : template.currentVersionIndex;
  const version = template.versions[versionIndex];

  if (!version) {
    showToast('Version not found', 'error');
    return;
  }

  // Create export data with just this template (and selected version as latest)
  const exportData = {
    alexandria: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: [{
      ...template,
      versions: [version],
      currentVersionIndex: 0
    }]
  };

  // Generate filename from template name
  const safeName = template.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filename = `alexandria_${safeName}.json`;

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported "${template.name}"!`);
}

/**
 * Import templates from file
 */
function importTemplates() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size before reading (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawData = event.target.result;
        const data = JSON.parse(rawData);

        // Pass file size for additional validation
        const result = Storage.importAll(data, rawData.length);

        if (result.success) {
          if (result.skipped > 0) {
            showToast(`Imported ${result.imported} templates (${result.skipped} invalid skipped)`, 'warning');
          } else {
            showToast(`Imported ${result.imported} templates!`);
          }
          refresh();
        } else {
          showToast(`Import failed: ${result.error}`, 'error');
        }
      } catch (err) {
        showToast('Failed to import: Invalid JSON format', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============ Modals ============

/**
 * Show value viewing modal
 * @param {Object} node - Node object
 * @param {Object} widget - Widget object
 */
function showValueModal(node, widget) {
  const modal = document.createElement('div');
  modal.className = 'alexandria-modal';
  modal.innerHTML = `
    <div class="alexandria-modal-content">
      <div class="alexandria-modal-header">
        <span>${escapeHtml(node.title || node.type)} - ${escapeHtml(widget.name)}</span>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-modal-body">
        <textarea class="alexandria-value-textarea" readonly>${escapeHtml(String(widget.value))}</textarea>
      </div>
      <div class="alexandria-modal-footer">
        <button class="alexandria-btn alexandria-btn-secondary" data-action="copy-all">Copy to Clipboard</button>
        <button class="alexandria-btn alexandria-btn-primary" data-action="close">Close</button>
      </div>
    </div>
  `;

  modal.querySelector('.alexandria-close').onclick = () => modal.remove();
  modal.querySelector('[data-action="close"]').onclick = () => modal.remove();
  modal.querySelector('[data-action="copy-all"]').onclick = () => {
    navigator.clipboard.writeText(String(widget.value));
    modal.querySelector('[data-action="copy-all"]').textContent = 'Copied!';
  };
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  document.body.appendChild(modal);
}

/**
 * Show save dialog
 * @param {Array} entries - Entries to save
 * @param {Object} workflowInfo - Workflow identity info
 */
function showSaveDialog(entries, workflowInfo) {
  const modal = document.createElement('div');
  modal.className = 'alexandria-modal';
  modal.innerHTML = `
    <div class="alexandria-modal-content alexandria-modal-small">
      <div class="alexandria-modal-header">
        <span>Save Template</span>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-modal-body">
        <label class="alexandria-label">Template Name</label>
        <input type="text" class="alexandria-input" placeholder="e.g., Scene One - Beach" autofocus />
        <p class="alexandria-hint">${entries.length} widget${entries.length > 1 ? 's' : ''} will be saved</p>
      </div>
      <div class="alexandria-modal-footer">
        <button class="alexandria-btn alexandria-btn-secondary" data-action="cancel">Cancel</button>
        <button class="alexandria-btn alexandria-btn-primary" data-action="save">Save</button>
      </div>
    </div>
  `;

  const input = modal.querySelector('.alexandria-input');
  const saveBtn = modal.querySelector('[data-action="save"]');

  modal.querySelector('.alexandria-close').onclick = () => modal.remove();
  modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  saveBtn.onclick = () => {
    const name = input.value.trim();
    if (!name) {
      input.classList.add('alexandria-input-error');
      return;
    }

    const existing = Storage.getTemplateByName(name);
    if (existing) {
      Storage.updateTemplate(existing.id, entries);
      showToast(`Template "${name}" updated!`);
    } else {
      Storage.createTemplate(name, entries, workflowInfo);
      showToast(`Template "${name}" saved!`);
    }
    modal.remove();
    refresh();
  };

  input.onkeydown = (e) => { if (e.key === 'Enter') saveBtn.click(); };

  document.body.appendChild(modal);
  input.focus();
}

/**
 * Show rename dialog
 * @param {string} templateId - Template ID
 */
function showRenameDialog(templateId) {
  const template = Storage.getTemplate(templateId);
  if (!template) return;

  const modal = document.createElement('div');
  modal.className = 'alexandria-modal';
  modal.innerHTML = `
    <div class="alexandria-modal-content alexandria-modal-small">
      <div class="alexandria-modal-header">
        <span>Rename Template</span>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-modal-body">
        <label class="alexandria-label">Template Name</label>
        <input type="text" class="alexandria-input" value="${escapeHtml(template.name)}" />
      </div>
      <div class="alexandria-modal-footer">
        <button class="alexandria-btn alexandria-btn-secondary" data-action="cancel">Cancel</button>
        <button class="alexandria-btn alexandria-btn-primary" data-action="rename">Rename</button>
      </div>
    </div>
  `;

  const input = modal.querySelector('.alexandria-input');

  modal.querySelector('.alexandria-close').onclick = () => modal.remove();
  modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.querySelector('[data-action="rename"]').onclick = () => {
    const newName = input.value.trim();
    if (!newName) {
      input.classList.add('alexandria-input-error');
      return;
    }

    Storage.renameTemplate(templateId, newName);
    modal.remove();
    showToast(`Template renamed to "${newName}"`);
    refresh();
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') modal.querySelector('[data-action="rename"]').click();
  };

  document.body.appendChild(modal);
  input.select();
}

/**
 * Show delete confirmation dialog
 * @param {string} templateId - Template ID
 */
function confirmDeleteTemplate(templateId) {
  const template = Storage.getTemplate(templateId);
  if (!template) return;

  const modal = document.createElement('div');
  modal.className = 'alexandria-modal';
  modal.innerHTML = `
    <div class="alexandria-modal-content alexandria-modal-small">
      <div class="alexandria-modal-header">
        <span>Delete Template</span>
        <button class="alexandria-close">&times;</button>
      </div>
      <div class="alexandria-modal-body">
        <p>Are you sure you want to delete "<strong>${escapeHtml(template.name)}</strong>"?</p>
        <p class="alexandria-hint">This cannot be undone.</p>
      </div>
      <div class="alexandria-modal-footer">
        <button class="alexandria-btn alexandria-btn-secondary" data-action="cancel">Cancel</button>
        <button class="alexandria-btn alexandria-btn-danger" data-action="delete">Delete</button>
      </div>
    </div>
  `;

  modal.querySelector('.alexandria-close').onclick = () => modal.remove();
  modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.querySelector('[data-action="delete"]').onclick = () => {
    Storage.deleteTemplate(templateId);
    if (selectedTemplateId === templateId) {
      selectedTemplateId = null;
    }
    modal.remove();
    showToast('Template deleted');
    refresh();
  };

  document.body.appendChild(modal);
}

// ============ Toast ============

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'warning', 'error'
 */
export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `alexandria-toast alexandria-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============ Embedded Sidebar Panel ============

let embeddedPanel = null;

/**
 * Create an embedded panel for the ComfyUI sidebar
 * Unlike the floating panel, this fits within the sidebar container
 * @returns {HTMLElement} Embedded panel element
 */
export function createEmbeddedPanel() {
  loadSelections();

  const panelEl = document.createElement('div');
  panelEl.className = 'alexandria-embedded';
  panelEl.innerHTML = `
    <div class="alexandria-embedded-header">
      <div class="alexandria-title">
        <span class="alexandria-icon">📜</span>
        Prompt Library
      </div>
    </div>
    <div class="alexandria-body alexandria-embedded-body">
      <div class="alexandria-sidebar alexandria-embedded-sidebar">
        <div class="alexandria-sidebar-header">
          <span class="alexandria-sidebar-title">Templates</span>
          <button class="alexandria-btn-icon" data-action="new-template" title="Save current prompts as new template">+</button>
        </div>
        <div class="alexandria-template-list"></div>
        <div class="alexandria-sidebar-footer">
          <button class="alexandria-btn-small alexandria-btn-full" data-action="export">Export All</button>
          <button class="alexandria-btn-small alexandria-btn-full" data-action="import">Import</button>
        </div>
      </div>
      <div class="alexandria-main">
        <div class="alexandria-tabs">
          <button class="alexandria-tab active" data-tab="templates">Template Preview</button>
          <button class="alexandria-tab" data-tab="browse">Browse Widgets</button>
        </div>
        <div class="alexandria-toolbar alexandria-toolbar-browse" style="display:none;">
          <div class="alexandria-search">
            <input type="text" placeholder="Search nodes..." class="alexandria-search-input" />
          </div>
          <div class="alexandria-filters">
            <button class="alexandria-filter-btn active" data-filter="all">All</button>
            <button class="alexandria-filter-btn" data-filter="detected">Detected</button>
            <button class="alexandria-filter-btn" data-filter="other">Other</button>
          </div>
        </div>
        <div class="alexandria-content"></div>
      </div>
    </div>
    <div class="alexandria-footer">
      <div class="alexandria-status">
        <span class="alexandria-status-text">Select a template or browse widgets</span>
      </div>
      <div class="alexandria-actions">
        <button class="alexandria-btn alexandria-btn-secondary" data-action="select-detected" style="display:none;">Select All Detected</button>
        <button class="alexandria-btn alexandria-btn-secondary" data-action="clear" style="display:none;">Clear</button>
        <button class="alexandria-btn alexandria-btn-primary" data-action="load-template" style="display:none;">Load Template</button>
        <button class="alexandria-btn alexandria-btn-primary" data-action="save" style="display:none;">Save as Template</button>
      </div>
    </div>
  `;

  // Tab switching
  panelEl.querySelectorAll('.alexandria-tab').forEach(tab => {
    tab.onclick = () => {
      panelEl.querySelectorAll('.alexandria-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      updateEmbeddedTabUI(panelEl);
      refreshEmbeddedContent(panelEl);
    };
  });

  // Search input with debounce
  const searchInput = panelEl.querySelector('.alexandria-search-input');
  searchInput.oninput = (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase();
      refreshEmbeddedContent(panelEl);
    }, SEARCH_DEBOUNCE_MS);
  };

  // Filter buttons
  panelEl.querySelectorAll('.alexandria-filter-btn').forEach(btn => {
    btn.onclick = () => {
      panelEl.querySelectorAll('.alexandria-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterType = btn.dataset.filter;
      refreshEmbeddedContent(panelEl);
    };
  });

  // Action buttons
  panelEl.querySelector('[data-action="new-template"]').onclick = () => {
    activeTab = 'browse';
    updateEmbeddedTabUI(panelEl);
    refreshEmbeddedContent(panelEl);
  };
  panelEl.querySelector('[data-action="select-detected"]').onclick = () => {
    selectAllDetected();
    refreshEmbeddedContent(panelEl);
  };
  panelEl.querySelector('[data-action="clear"]').onclick = () => {
    clearSelection();
    refreshEmbeddedContent(panelEl);
  };
  panelEl.querySelector('[data-action="save"]').onclick = saveAsTemplate;
  panelEl.querySelector('[data-action="load-template"]').onclick = loadSelectedTemplate;
  panelEl.querySelector('[data-action="export"]').onclick = exportTemplates;
  panelEl.querySelector('[data-action="import"]').onclick = importTemplates;

  embeddedPanel = panelEl;
  return panelEl;
}

/**
 * Update embedded panel tab UI
 * @param {HTMLElement} panelEl - Panel element
 */
function updateEmbeddedTabUI(panelEl) {
  const browseToolbar = panelEl.querySelector('.alexandria-toolbar-browse');
  const loadBtn = panelEl.querySelector('[data-action="load-template"]');
  const saveBtn = panelEl.querySelector('[data-action="save"]');
  const selectBtn = panelEl.querySelector('[data-action="select-detected"]');
  const clearBtn = panelEl.querySelector('[data-action="clear"]');

  panelEl.querySelectorAll('.alexandria-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === activeTab);
  });

  if (activeTab === 'browse') {
    browseToolbar.style.display = 'flex';
    loadBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    selectBtn.style.display = 'inline-block';
    clearBtn.style.display = 'inline-block';
  } else {
    browseToolbar.style.display = 'none';
    loadBtn.style.display = selectedTemplateId ? 'inline-block' : 'none';
    saveBtn.style.display = 'none';
    selectBtn.style.display = 'none';
    clearBtn.style.display = 'none';
  }
}

/**
 * Refresh embedded panel content
 * @param {HTMLElement} panelEl - Panel element (optional, uses embeddedPanel if not provided)
 */
function refreshEmbeddedContent(panelEl) {
  const p = panelEl || embeddedPanel;
  if (!p) return;

  // Template list
  const templateList = p.querySelector('.alexandria-template-list');
  if (templateList) {
    templateList.innerHTML = renderTemplateList();
    attachEmbeddedTemplateListeners(p);
  }

  // Content area
  const content = p.querySelector('.alexandria-content');
  if (content) {
    content.innerHTML = activeTab === 'browse' ? renderNodeList() : renderTemplatePreview();
    attachEmbeddedContentListeners(p);
  }

  // Status bar
  const statusText = p.querySelector('.alexandria-status-text');
  if (statusText) {
    const selectedCount = Array.from(selectedWidgets.values()).filter(v => v).length;
    const detectedCount = Detection.getDetectedPrompts().length;
    statusText.textContent = `${selectedCount} selected | ${detectedCount} auto-detected`;
  }
}

/**
 * Attach template list listeners for embedded panel
 * @param {HTMLElement} panelEl - Panel element
 */
function attachEmbeddedTemplateListeners(panelEl) {
  // Template selection
  panelEl.querySelectorAll('.alexandria-template-item').forEach(item => {
    item.onclick = (e) => {
      if (e.target.closest('[data-action]')) return;
      selectedTemplateId = item.dataset.templateId;
      activeTab = 'templates';
      updateEmbeddedTabUI(panelEl);
      refreshEmbeddedContent(panelEl);
    };
  });

  // Rename
  panelEl.querySelectorAll('[data-action="rename-template"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      showRenameDialog(btn.dataset.templateId);
    };
  });

  // Delete
  panelEl.querySelectorAll('[data-action="delete-template"]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      confirmDeleteTemplate(btn.dataset.templateId);
    };
  });
}

/**
 * Attach content listeners for embedded panel
 * @param {HTMLElement} panelEl - Panel element
 */
function attachEmbeddedContentListeners(panelEl) {
  // Collapse/Expand All link
  const collapseLink = panelEl.querySelector('.alexandria-collapse-link');
  if (collapseLink) {
    collapseLink.onclick = (e) => {
      e.preventDefault();
      const action = collapseLink.dataset.action;
      const allNodes = Detection.getAllWorkflowWidgets();

      if (action === 'collapse-all') {
        allNodes.forEach(n => collapsedNodes.add(n.id));
      } else {
        collapsedNodes.clear();
      }
      refreshEmbeddedContent(panelEl);
    };
  }

  // Group header click - toggle collapse
  panelEl.querySelectorAll('.alexandria-group-header').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('input, button')) return;
      const groupType = header.dataset.group;
      const group = header.closest('.alexandria-group');
      const content = group.querySelector('.alexandria-group-content');
      const icon = header.querySelector('.alexandria-collapse-icon');

      if (collapsedGroups.has(groupType)) {
        // User is expanding - track this so we don't auto-collapse again
        collapsedGroups.delete(groupType);
        userExpandedGroups.add(groupType);
        content.style.display = '';
        icon.textContent = '▼';
        group.classList.remove('collapsed');
      } else {
        // User is collapsing - remove from user-expanded tracking
        collapsedGroups.add(groupType);
        userExpandedGroups.delete(groupType);
        content.style.display = 'none';
        icon.textContent = '▶';
        group.classList.add('collapsed');
      }
    };
  });

  // Node header click - toggle collapse
  panelEl.querySelectorAll('.alexandria-node-header[data-node-id]').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('input, button')) return;
      const nodeId = parseInt(header.dataset.nodeId, 10);
      const node = header.closest('.alexandria-node');
      const widgets = node.querySelector('.alexandria-node-widgets');
      const meta = node.querySelector('.alexandria-node-meta');
      const icon = header.querySelector('.alexandria-collapse-icon');

      if (collapsedNodes.has(nodeId)) {
        collapsedNodes.delete(nodeId);
        widgets.style.display = '';
        if (meta) meta.style.display = '';
        icon.textContent = '▼';
        node.classList.remove('collapsed');
      } else {
        collapsedNodes.add(nodeId);
        widgets.style.display = 'none';
        if (meta) meta.style.display = 'none';
        icon.textContent = '▶';
        node.classList.add('collapsed');
      }
    };
  });

  // Checkboxes
  panelEl.querySelectorAll('.alexandria-widget-checkbox').forEach(cb => {
    cb.onchange = (e) => {
      const key = `${e.target.dataset.nodeId}:${e.target.dataset.widgetName}`;
      selectedWidgets.set(key, e.target.checked);
      const detection = Detection.detectAllPrompts().get(key);
      if (!detection || detection.confidence < 50) {
        Storage.setManualSelection(
          e.target.dataset.nodeType,
          e.target.dataset.widgetName,
          e.target.checked ? true : null
        );
      }
      refreshEmbeddedContent(panelEl);
    };
  });

  // View buttons
  panelEl.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.onclick = () => {
      const nodeId = parseInt(btn.dataset.nodeId, 10);
      const widgetName = btn.dataset.widgetName;
      const node = app.graph._nodes.find(n => n.id === nodeId);
      const widget = node?.widgets?.find(w => w.name === widgetName);
      if (widget) showValueModal(node, widget);
    };
  });

  // Copy buttons
  panelEl.querySelectorAll('[data-action="copy"]').forEach(btn => {
    btn.onclick = () => {
      const nodeId = parseInt(btn.dataset.nodeId, 10);
      const widgetName = btn.dataset.widgetName;
      const node = app.graph._nodes.find(n => n.id === nodeId);
      const widget = node?.widgets?.find(w => w.name === widgetName);
      if (widget) {
        navigator.clipboard.writeText(String(widget.value));
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1000);
      }
    };
  });
}

/**
 * Refresh the embedded panel (called externally)
 */
export function refreshEmbedded() {
  if (embeddedPanel) {
    refreshEmbeddedContent(embeddedPanel);
  }
}
