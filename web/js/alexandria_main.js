/**
 * Prompts of Alexandria - Main Entry Point
 * ComfyUI extension for template-based prompt backup and restoration.
 *
 * This is the entry point that ComfyUI auto-loads.
 * All functionality is organized in the ./alexandria/ submodules.
 *
 * @version 1.0.0
 */

import { app } from "../../../scripts/app.js";

// Import all modules
import { injectStyles } from "./alexandria/styles.js";
import * as UI from "./alexandria/ui.js";
import * as Nodes from "./alexandria/nodes.js";
import { installGlobalAPI } from "./alexandria/api.js";

// ============ Sidebar Registration ============

// Cooldown to prevent rapid re-opens from sidebar render cycles
let lastSidebarOpen = 0;
const SIDEBAR_COOLDOWN_MS = 500;

/**
 * Immediately hide the ComfyUI sidebar panel
 * Called as soon as render() is invoked to prevent the brief flash
 */
function hideSidebarPanel() {
  // Hide any sidebar panel that might be showing
  const panels = document.querySelectorAll('.side-bar-panel, .comfyui-sidebar-content, [class*="sidebar-panel"]');
  panels.forEach(panel => {
    panel.classList.add('alexandria-hidden');
    panel.style.cssText = 'display: none !important; width: 0 !important; opacity: 0 !important; visibility: hidden !important; transition: none !important;';
  });

  // Also try to hide any container that might be expanding
  const containers = document.querySelectorAll('.side-bar-container, [class*="sidebar-container"]');
  containers.forEach(container => {
    const panel = container.querySelector('[class*="panel"]');
    if (panel) {
      panel.style.cssText = 'display: none !important; width: 0 !important; transition: none !important;';
    }
  });
}

/**
 * Deselect the Alexandria sidebar button
 * This removes the "pressed" state from the button
 */
function deselectAlexandriaButton() {
  const sidebarBtn = document.querySelector('[data-sidebar-id="alexandria"]');
  if (sidebarBtn) {
    // Remove active/selected classes that ComfyUI might add
    sidebarBtn.classList.remove('p-button-primary', 'active', 'selected');
  }
}

/**
 * Register Alexandria in ComfyUI's sidebar
 * Uses the extensionManager API to add an icon to the left sidebar
 * The sidebar button acts as a toggle for our popup - no sidebar panel is shown
 */
function registerSidebarTab() {
  // Wait for extensionManager to be available
  if (!app.extensionManager) {
    console.log('Alexandria: Waiting for extensionManager...');
    setTimeout(registerSidebarTab, 500);
    return;
  }

  // Check if registerSidebarTab exists
  if (typeof app.extensionManager.registerSidebarTab !== 'function') {
    console.log('Alexandria: registerSidebarTab not available');
    return;
  }

  try {
    app.extensionManager.registerSidebarTab({
      id: 'alexandria',
      icon: 'pi pi-book',  // PrimeVue icon - book
      title: 'Prompts',
      tooltip: 'Prompts',
      type: 'custom',
      render: (container) => {
        // IMMEDIATELY hide the sidebar panel - before any animation can start
        hideSidebarPanel();
        container.innerHTML = '';
        container.style.cssText = 'display: none !important; width: 0 !important;';

        // Guard: Don't open if we're in the process of closing
        if (window._alexandriaClosing) {
          return;
        }

        // Guard: Don't open if already open or if opened very recently
        const now = Date.now();
        if (UI.isOpenState() || (now - lastSidebarOpen) < SIDEBAR_COOLDOWN_MS) {
          return;
        }
        lastSidebarOpen = now;

        // Open our popup instead
        UI.open();

        // Deselect the sidebar button after a brief moment
        // This gives ComfyUI time to process but keeps the button from staying pressed
        setTimeout(() => {
          deselectAlexandriaButton();
          hideSidebarPanel(); // Hide again in case it tried to re-show
        }, 10);
      },
    });
    console.log('Alexandria: Sidebar tab registered');
  } catch (e) {
    console.error('Alexandria: Failed to register sidebar tab:', e);
  }
}

// ============ Register Extension ============

app.registerExtension({
  name: 'Prompts.of.Alexandria',

  async setup() {
    console.log('Alexandria: Initializing...');

    // Inject CSS styles
    injectStyles();

    // Initialize UI
    UI.init();

    // Register sidebar tab
    registerSidebarTab();

    // Setup WebSocket handlers for node communication
    Nodes.setupWebSocketHandlers();

    // Install global API
    installGlobalAPI();

    console.log('Alexandria: Ready');
  },

  /**
   * Called when a node is created
   * Used to add custom widgets and styling to Alexandria nodes
   */
  nodeCreated(node) {
    // Add custom widgets to Control node
    if (node.comfyClass === "AlexandriaControl") {
      Nodes.addControlNodeWidgets(node);
    }

    // Style Save nodes (green tint)
    if (node.comfyClass === "AlexandriaSave") {
      Nodes.styleSaveNode(node);
    }
  },
});

console.log('Alexandria: Extension module loaded');
