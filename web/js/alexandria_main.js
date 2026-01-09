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

/**
 * Register Alexandria in ComfyUI's sidebar
 * Uses the extensionManager API to add an icon to the left sidebar
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
      title: 'Prompts of Alexandria',
      tooltip: 'Prompts of Alexandria',
      type: 'custom',
      render: (container) => {
        // Immediately open the popup when this tab is selected
        UI.open();

        // Empty the container - we don't need sidebar content
        container.innerHTML = '';

        // Try to close/deselect this sidebar tab after a brief delay
        // This makes clicking the icon just open the popup without showing sidebar
        setTimeout(() => {
          // Find and click the same tab button to deselect it (toggle off)
          const sidebarBtn = document.querySelector('[data-sidebar-id="alexandria"]');
          if (sidebarBtn) {
            sidebarBtn.click();
          } else {
            // Alternative: try to find active sidebar and close it
            const activeSidebar = document.querySelector('.side-bar-panel');
            if (activeSidebar) {
              activeSidebar.style.display = 'none';
            }
          }
        }, 50);
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
