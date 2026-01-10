/**
 * Prompts of Alexandria - Main Entry Point
 * ComfyUI extension for template-based prompt backup and restoration.
 *
 * This is the entry point that ComfyUI auto-loads.
 * All functionality is organized in the ./alexandria/ submodules.
 *
 * @version 0.5.0
 */

// ============ Debug Logging ============
// Immediate log to confirm script is being loaded by browser
console.log('[Alexandria] Script loading started...');

// Try to get ComfyUI app - use new API if available, fallback to legacy import
let app;
try {
  console.log('[Alexandria] Checking for window.comfyAPI...');
  if (window.comfyAPI?.app) {
    app = window.comfyAPI.app;
    console.log('[Alexandria] Using window.comfyAPI.app (new UI pattern)');
  } else {
    console.log('[Alexandria] window.comfyAPI not found, trying legacy import...');
    const module = await import("../../../scripts/app.js");
    app = module.app;
    console.log('[Alexandria] Using legacy import from scripts/app.js');
  }
  console.log('[Alexandria] App loaded successfully:', !!app);
} catch (e) {
  console.error('[Alexandria] CRITICAL: Failed to load ComfyUI app:', e);
  throw e;
}

// Import all modules with logging
console.log('[Alexandria] Importing submodules...');

let injectStyles, injectSidebarStyles, UI, Nodes, Storage, installGlobalAPI;

try {
  const stylesModule = await import("./alexandria/styles.js");
  injectStyles = stylesModule.injectStyles;
  injectSidebarStyles = stylesModule.injectSidebarStyles;
  console.log('[Alexandria] ✓ styles.js loaded');
} catch (e) {
  console.error('[Alexandria] ✗ Failed to load styles.js:', e);
  throw e;
}

try {
  UI = await import("./alexandria/ui.js");
  console.log('[Alexandria] ✓ ui.js loaded');
} catch (e) {
  console.error('[Alexandria] ✗ Failed to load ui.js:', e);
  throw e;
}

try {
  Nodes = await import("./alexandria/nodes.js");
  console.log('[Alexandria] ✓ nodes.js loaded');
} catch (e) {
  console.error('[Alexandria] ✗ Failed to load nodes.js:', e);
  throw e;
}

try {
  Storage = await import("./alexandria/storage.js");
  console.log('[Alexandria] ✓ storage.js loaded');
} catch (e) {
  console.error('[Alexandria] ✗ Failed to load storage.js:', e);
  throw e;
}

try {
  const apiModule = await import("./alexandria/api.js");
  installGlobalAPI = apiModule.installGlobalAPI;
  console.log('[Alexandria] ✓ api.js loaded');
} catch (e) {
  console.error('[Alexandria] ✗ Failed to load api.js:', e);
  throw e;
}

console.log('[Alexandria] All submodules loaded successfully');

// ============ Sidebar Panel ============

/**
 * Get human-readable time ago string
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
 * Load a specific version of a template
 */
function loadTemplateVersion(templateId, versionIndex) {
  const template = Storage.getTemplate(templateId);
  if (!template) {
    UI.showToast('Template not found', 'error');
    return;
  }

  const version = template.versions[versionIndex];
  if (!version) {
    UI.showToast('Version not found', 'error');
    return;
  }

  // Create a template-like object with the selected version
  const templateToLoad = {
    ...template,
    versions: [version],
    currentVersionIndex: 0
  };

  // Use global API for restoration
  const results = window.Alexandria.restoreTemplate(templateToLoad);

  if (results.restored.length === 0 && results.skipped.length > 0) {
    UI.showToast(`No prompts restored (${results.skipped.length} nodes not found)`, 'warning');
  } else if (results.skipped.length > 0) {
    UI.showToast(`Restored ${results.restored.length} prompts (${results.skipped.length} skipped)`);
  } else {
    UI.showToast(`Restored ${results.restored.length} prompts!`);
  }

  // Refresh sidebar after load
  setTimeout(() => refreshSidebarContent(), 100);
}

/**
 * Load the latest version of a template
 */
function loadTemplate(templateId) {
  const template = Storage.getTemplate(templateId);
  if (!template) {
    UI.showToast('Template not found', 'error');
    return;
  }
  loadTemplateVersion(templateId, template.currentVersionIndex);
}

// Track the sidebar container for refreshes
let sidebarContainer = null;

// Track collapsed templates (by id) - persists during session
let collapsedTemplates = new Set();
// Track which templates user has explicitly toggled (to respect manual changes)
let userToggledTemplates = new Set();

/**
 * Get the current template name from the AlexandriaControl node
 * @returns {string|null} Current template name or null
 */
function getCurrentTemplateName() {
  if (!app.graph) return null;

  // Find the AlexandriaControl node
  const nodes = app.graph._nodes || [];
  for (const node of nodes) {
    if (node.comfyClass === "AlexandriaControl") {
      const widget = node.widgets?.find(w => w.name === "template_name");
      if (widget?.value) {
        return widget.value;
      }
    }
  }
  return null;
}

/**
 * Refresh the sidebar content (called after load operations)
 */
function refreshSidebarContent() {
  if (sidebarContainer) {
    renderSidebarContent(sidebarContainer);
  }
}

/**
 * Render the sidebar panel content
 */
async function renderSidebarContent(container) {
  sidebarContainer = container;

  // Ensure templates are loaded from server
  if (!Storage.isTemplatesCacheLoaded()) {
    container.innerHTML = `
      <div class="alexandria-sidebar">
        <div class="alexandria-sidebar-header">
          <button class="alexandria-sidebar-btn-primary" id="alexandria-open-full">
            <i class="pi pi-external-link"></i> Open Full Panel
          </button>
        </div>
        <div class="alexandria-sidebar-section">
          <div class="alexandria-sidebar-empty">Loading templates...</div>
        </div>
      </div>
    `;
    container.querySelector('#alexandria-open-full').onclick = () => UI.open();

    // Load templates and re-render
    await Storage.refreshTemplatesFromServer();
    renderSidebarContent(container);
    return;
  }

  const templates = Storage.getTemplatesSorted();
  const trackedWorkflow = Storage.getTrackedWorkflowName();

  // Find templates matching current workflow
  const workflowTemplates = templates.filter(t =>
    t.workflowName === trackedWorkflow || !t.workflowName
  );
  const otherTemplates = templates.filter(t =>
    t.workflowName && t.workflowName !== trackedWorkflow
  );

  // Get current template name from control node
  const currentTemplateName = getCurrentTemplateName();

  // Update collapse state based on current template
  // Only auto-collapse templates that user hasn't manually toggled
  workflowTemplates.forEach(t => {
    // Skip templates user has explicitly toggled
    if (userToggledTemplates.has(t.id)) return;

    // Expand current template, collapse others
    if (t.name === currentTemplateName) {
      collapsedTemplates.delete(t.id);
    } else {
      collapsedTemplates.add(t.id);
    }
  });

  container.innerHTML = `
    <div class="alexandria-sidebar">
      <div class="alexandria-sidebar-header">
        <button class="alexandria-sidebar-btn-primary" id="alexandria-open-full">
          <i class="pi pi-external-link"></i> Open Full Panel
        </button>
      </div>

      ${trackedWorkflow ? `
        <div class="alexandria-sidebar-section">
          <div class="alexandria-sidebar-workflow">
            <i class="pi pi-file"></i> ${escapeHtml(trackedWorkflow)}
          </div>
        </div>
      ` : ''}

      <div class="alexandria-sidebar-section">
        <div class="alexandria-sidebar-section-title">
          <i class="pi pi-history"></i> Templates & History
        </div>

        ${workflowTemplates.length === 0 ? `
          <div class="alexandria-sidebar-empty">
            No templates yet.<br>
            <span class="alexandria-sidebar-hint">Use Full Panel to create one.</span>
          </div>
        ` : ''}

        ${workflowTemplates.map(template => {
          const isCollapsed = collapsedTemplates.has(template.id);
          return `
          <div class="alexandria-sidebar-template ${isCollapsed ? 'collapsed' : ''}" data-template-id="${template.id}">
            <div class="alexandria-sidebar-template-header" data-toggle-template="${template.id}">
              <span class="alexandria-sidebar-collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
              <span class="alexandria-sidebar-template-name">${escapeHtml(template.name)}</span>
              <span class="alexandria-sidebar-template-count">v${template.versions.length}</span>
            </div>

            <div class="alexandria-sidebar-versions" style="${isCollapsed ? 'display: none;' : ''}">
              ${template.versions.slice().reverse().map((version, revIdx) => {
                const actualIdx = template.versions.length - 1 - revIdx;
                const isCurrent = actualIdx === template.currentVersionIndex;
                return `
                  <div class="alexandria-sidebar-version ${isCurrent ? 'current' : ''}">
                    <div class="alexandria-sidebar-version-info">
                      <span class="alexandria-sidebar-version-label">
                        ${isCurrent ? '● ' : ''}v${actualIdx + 1}
                      </span>
                      <span class="alexandria-sidebar-version-time">${getTimeAgo(version.timestamp)}</span>
                    </div>
                    <button class="alexandria-sidebar-btn-load"
                            data-template="${template.id}"
                            data-version="${actualIdx}">
                      Load
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `}).join('')}
      </div>

      ${otherTemplates.length > 0 ? `
        <div class="alexandria-sidebar-section">
          <div class="alexandria-sidebar-section-title">
            <i class="pi pi-folder"></i> Other Workflows
          </div>

          ${otherTemplates.map(template => `
            <div class="alexandria-sidebar-other">
              <div class="alexandria-sidebar-other-info">
                <span class="alexandria-sidebar-other-name">${escapeHtml(template.name)}</span>
                <span class="alexandria-sidebar-other-workflow">${escapeHtml(template.workflowName || 'Unknown')}</span>
              </div>
              <button class="alexandria-sidebar-btn-load"
                      data-template="${template.id}">
                Load
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Attach event listeners
  const openFullBtn = container.querySelector('#alexandria-open-full');
  if (openFullBtn) {
    openFullBtn.onclick = () => UI.open();
  }

  // Template header toggle (collapse/expand)
  container.querySelectorAll('.alexandria-sidebar-template-header[data-toggle-template]').forEach(header => {
    header.onclick = (e) => {
      // Don't toggle if clicking a button inside
      if (e.target.closest('button')) return;

      const templateId = header.dataset.toggleTemplate;
      const templateEl = container.querySelector(`.alexandria-sidebar-template[data-template-id="${templateId}"]`);
      const versionsEl = templateEl?.querySelector('.alexandria-sidebar-versions');
      const iconEl = header.querySelector('.alexandria-sidebar-collapse-icon');

      // Mark as user-toggled so auto-collapse won't override
      userToggledTemplates.add(templateId);

      if (collapsedTemplates.has(templateId)) {
        collapsedTemplates.delete(templateId);
        templateEl?.classList.remove('collapsed');
        if (versionsEl) versionsEl.style.display = '';
        if (iconEl) iconEl.textContent = '▼';
      } else {
        collapsedTemplates.add(templateId);
        templateEl?.classList.add('collapsed');
        if (versionsEl) versionsEl.style.display = 'none';
        if (iconEl) iconEl.textContent = '▶';
      }
    };
  });

  // Version load buttons
  container.querySelectorAll('.alexandria-sidebar-btn-load[data-version]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation(); // Prevent header toggle
      const templateId = btn.dataset.template;
      const versionIdx = parseInt(btn.dataset.version, 10);
      loadTemplateVersion(templateId, versionIdx);
    };
  });

  // Template load buttons (latest version)
  container.querySelectorAll('.alexandria-sidebar-btn-load:not([data-version])').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation(); // Prevent header toggle
      const templateId = btn.dataset.template;
      loadTemplate(templateId);
    };
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Register Alexandria in ComfyUI's sidebar
 */
function registerSidebarTab() {
  console.log('[Alexandria] registerSidebarTab called');
  console.log('[Alexandria] app.extensionManager exists:', !!app.extensionManager);

  if (!app.extensionManager) {
    console.log('[Alexandria] Waiting for extensionManager... (will retry in 500ms)');
    setTimeout(registerSidebarTab, 500);
    return;
  }

  console.log('[Alexandria] extensionManager.registerSidebarTab exists:', typeof app.extensionManager.registerSidebarTab);

  if (typeof app.extensionManager.registerSidebarTab !== 'function') {
    console.warn('[Alexandria] registerSidebarTab not available on extensionManager');
    console.log('[Alexandria] extensionManager keys:', Object.keys(app.extensionManager));
    return;
  }

  try {
    console.log('[Alexandria] Calling extensionManager.registerSidebarTab...');
    app.extensionManager.registerSidebarTab({
      id: 'alexandria',
      icon: 'pi pi-book',
      title: 'Prompts',
      tooltip: 'Prompts of Alexandria - Quick access to templates',
      type: 'custom',
      render: (container) => {
        console.log('[Alexandria] Sidebar render() called');
        // Style the container
        container.style.cssText = 'height: 100%; overflow-y: auto;';

        // Render sidebar content
        renderSidebarContent(container);
      },
    });
    console.log('[Alexandria] ✓ Sidebar tab registered successfully');
  } catch (e) {
    console.error('[Alexandria] ✗ Failed to register sidebar tab:', e);
  }
}

// ============ Register Extension ============

console.log('[Alexandria] Registering extension with ComfyUI...');

try {
  app.registerExtension({
    name: 'Prompts.of.Alexandria',

    async setup() {
      console.log('[Alexandria] setup() called - initializing...');

      try {
        // Inject CSS styles (main + sidebar)
        console.log('[Alexandria] Injecting styles...');
        injectStyles();
        injectSidebarStyles();
        console.log('[Alexandria] ✓ Styles injected');

        // Initialize UI
        console.log('[Alexandria] Initializing UI...');
        UI.init();
        console.log('[Alexandria] ✓ UI initialized');

        // Register sidebar tab
        console.log('[Alexandria] Registering sidebar tab...');
        registerSidebarTab();

        // Setup WebSocket handlers for node communication
        console.log('[Alexandria] Setting up WebSocket handlers...');
        Nodes.setupWebSocketHandlers();
        console.log('[Alexandria] ✓ WebSocket handlers set up');

        // Install global API
        console.log('[Alexandria] Installing global API...');
        installGlobalAPI();
        console.log('[Alexandria] ✓ Global API installed (window.Alexandria available)');

        console.log('[Alexandria] ✓ Setup complete - Ready!');
      } catch (e) {
        console.error('[Alexandria] ✗ Error during setup():', e);
        throw e;
      }
    },

    /**
     * Called when a node is created
     */
    nodeCreated(node) {
      if (node.comfyClass === "AlexandriaControl") {
        console.log('[Alexandria] AlexandriaControl node created, adding widgets');
        Nodes.addControlNodeWidgets(node);
      }
      if (node.comfyClass === "AlexandriaSave") {
        console.log('[Alexandria] AlexandriaSave node created, styling');
        Nodes.styleSaveNode(node);
      }
    },
  });
  console.log('[Alexandria] ✓ Extension registered with ComfyUI');
} catch (e) {
  console.error('[Alexandria] ✗ Failed to register extension:', e);
}

console.log('[Alexandria] Module load complete');
