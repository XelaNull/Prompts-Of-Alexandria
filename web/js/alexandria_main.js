/**
 * Prompts of Alexandria - Main Entry Point
 * @version 0.5.0
 */

console.log("[Alexandria] Main module loading...");

// ComfyUI API
const { app } = window.comfyAPI?.app ?? await import("../../../scripts/app.js");
console.log("[Alexandria] App loaded:", !!app);

// Import modules
import { injectStyles, injectSidebarStyles } from "./alexandria/styles.js";
import * as UI from "./alexandria/ui.js";
import * as Nodes from "./alexandria/nodes.js";
import * as Storage from "./alexandria/storage.js";
import { installGlobalAPI } from "./alexandria/api.js";

console.log("[Alexandria] Modules imported");

// ============ Sidebar Helpers ============

function getTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function loadTemplateVersion(templateId, versionIndex) {
  const template = Storage.getTemplate(templateId);
  if (!template) { UI.showToast("Template not found", "error"); return; }
  const version = template.versions[versionIndex];
  if (!version) { UI.showToast("Version not found", "error"); return; }
  const templateToLoad = { ...template, versions: [version], currentVersionIndex: 0 };
  const results = window.Alexandria.restoreTemplate(templateToLoad);
  if (results.restored.length === 0 && results.skipped.length > 0) {
    UI.showToast(`No prompts restored (${results.skipped.length} nodes not found)`, "warning");
  } else if (results.skipped.length > 0) {
    UI.showToast(`Restored ${results.restored.length} prompts (${results.skipped.length} skipped)`);
  } else {
    UI.showToast(`Restored ${results.restored.length} prompts!`);
  }
  setTimeout(() => refreshSidebarContent(), 100);
}

function loadTemplate(templateId) {
  const template = Storage.getTemplate(templateId);
  if (!template) { UI.showToast("Template not found", "error"); return; }
  loadTemplateVersion(templateId, template.currentVersionIndex);
}

let sidebarContainer = null;
let collapsedTemplates = new Set();
let userToggledTemplates = new Set();

function getCurrentTemplateName() {
  if (!app.graph) return null;
  const nodes = app.graph._nodes || [];
  for (const node of nodes) {
    if (node.comfyClass === "AlexandriaControl") {
      const widget = node.widgets?.find(w => w.name === "template_name");
      if (widget?.value) return widget.value;
    }
  }
  return null;
}

function refreshSidebarContent() {
  if (sidebarContainer) renderSidebarContent(sidebarContainer);
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

async function renderSidebarContent(container) {
  sidebarContainer = container;

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
    container.querySelector("#alexandria-open-full").onclick = () => UI.open();
    await Storage.refreshTemplatesFromServer();
    renderSidebarContent(container);
    return;
  }

  const templates = Storage.getTemplatesSorted();
  const trackedWorkflow = Storage.getTrackedWorkflowName();
  // Filter out templates with invalid/missing versions array
  const validTemplates = templates.filter(t => t && Array.isArray(t.versions) && t.versions.length > 0);
  const workflowTemplates = validTemplates.filter(t => t.workflowName === trackedWorkflow || !t.workflowName);
  const otherTemplates = validTemplates.filter(t => t.workflowName && t.workflowName !== trackedWorkflow);
  const currentTemplateName = getCurrentTemplateName();

  workflowTemplates.forEach(t => {
    if (userToggledTemplates.has(t.id)) return;
    if (t.name === currentTemplateName) collapsedTemplates.delete(t.id);
    else collapsedTemplates.add(t.id);
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
      ` : ""}
      <div class="alexandria-sidebar-section">
        <div class="alexandria-sidebar-section-title">
          <i class="pi pi-history"></i> Templates & History
        </div>
        ${workflowTemplates.length === 0 ? `
          <div class="alexandria-sidebar-empty">
            No templates yet.<br>
            <span class="alexandria-sidebar-hint">Use Full Panel to create one.</span>
          </div>
        ` : ""}
        ${workflowTemplates.map(template => {
          const isCollapsed = collapsedTemplates.has(template.id);
          return `
            <div class="alexandria-sidebar-template ${isCollapsed ? "collapsed" : ""}" data-template-id="${template.id}">
              <div class="alexandria-sidebar-template-header" data-toggle-template="${template.id}">
                <span class="alexandria-sidebar-collapse-icon">${isCollapsed ? "▶" : "▼"}</span>
                <span class="alexandria-sidebar-template-name">${escapeHtml(template.name)}</span>
                <span class="alexandria-sidebar-template-count">v${template.versions.length}</span>
              </div>
              <div class="alexandria-sidebar-versions" style="${isCollapsed ? "display: none;" : ""}">
                ${template.versions.slice().reverse().map((version, revIdx) => {
                  const actualIdx = template.versions.length - 1 - revIdx;
                  const isCurrent = actualIdx === template.currentVersionIndex;
                  return `
                    <div class="alexandria-sidebar-version ${isCurrent ? "current" : ""}">
                      <div class="alexandria-sidebar-version-info">
                        <span class="alexandria-sidebar-version-label">${isCurrent ? "● " : ""}v${actualIdx + 1}</span>
                        <span class="alexandria-sidebar-version-time">${getTimeAgo(version.timestamp)}</span>
                      </div>
                      <button class="alexandria-sidebar-btn-load" data-template="${template.id}" data-version="${actualIdx}">Load</button>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
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
                <span class="alexandria-sidebar-other-workflow">${escapeHtml(template.workflowName || "Unknown")}</span>
              </div>
              <button class="alexandria-sidebar-btn-load" data-template="${template.id}">Load</button>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;

  container.querySelector("#alexandria-open-full")?.addEventListener("click", () => UI.open());

  container.querySelectorAll(".alexandria-sidebar-template-header[data-toggle-template]").forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest("button")) return;
      const templateId = header.dataset.toggleTemplate;
      const templateEl = container.querySelector(`.alexandria-sidebar-template[data-template-id="${templateId}"]`);
      const versionsEl = templateEl?.querySelector(".alexandria-sidebar-versions");
      const iconEl = header.querySelector(".alexandria-sidebar-collapse-icon");
      userToggledTemplates.add(templateId);
      if (collapsedTemplates.has(templateId)) {
        collapsedTemplates.delete(templateId);
        templateEl?.classList.remove("collapsed");
        if (versionsEl) versionsEl.style.display = "";
        if (iconEl) iconEl.textContent = "▼";
      } else {
        collapsedTemplates.add(templateId);
        templateEl?.classList.add("collapsed");
        if (versionsEl) versionsEl.style.display = "none";
        if (iconEl) iconEl.textContent = "▶";
      }
    };
  });

  container.querySelectorAll(".alexandria-sidebar-btn-load[data-version]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      loadTemplateVersion(btn.dataset.template, parseInt(btn.dataset.version, 10));
    };
  });

  container.querySelectorAll(".alexandria-sidebar-btn-load:not([data-version])").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      loadTemplate(btn.dataset.template);
    };
  });
}

function registerSidebarTab() {
  console.log("[Alexandria] Registering sidebar...");
  if (!app.extensionManager?.registerSidebarTab) {
    console.log("[Alexandria] Waiting for extensionManager...");
    setTimeout(registerSidebarTab, 200);
    return;
  }
  try {
    app.extensionManager.registerSidebarTab({
      id: "alexandria",
      icon: "pi pi-book",
      title: "Prompts",
      tooltip: "Prompts of Alexandria",
      type: "custom",
      render: (container) => {
        container.style.cssText = "height: 100%; overflow-y: auto;";
        renderSidebarContent(container);
      }
    });
    console.log("[Alexandria] Sidebar registered!");
  } catch (e) {
    console.error("[Alexandria] Failed to register sidebar:", e);
  }
}

// ============ Register Extension ============

app.registerExtension({
  name: "Prompts.of.Alexandria",
  async setup() {
    console.log("[Alexandria] setup() running...");
    injectStyles();
    injectSidebarStyles();
    UI.init();
    registerSidebarTab();
    Nodes.setupWebSocketHandlers();
    installGlobalAPI();
    console.log("[Alexandria] Ready!");
  },
  nodeCreated(node) {
    if (node.comfyClass === "AlexandriaControl") Nodes.addControlNodeWidgets(node);
    if (node.comfyClass === "AlexandriaSave") Nodes.styleSaveNode(node);
  }
});

console.log("[Alexandria] Extension registered");
