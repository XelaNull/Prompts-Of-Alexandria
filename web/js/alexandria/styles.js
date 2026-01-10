/**
 * Alexandria Styles Module
 * CSS injection for the Alexandria UI components.
 *
 * @module alexandria/styles
 */

/**
 * CSS Variables and Styles
 * Theme is designed to complement ComfyUI's dark interface
 */
const CSS = `
  /* ============ CSS Variables ============ */
  :root {
    --alexandria-bg: #1a1a2e;
    --alexandria-bg-secondary: #16213e;
    --alexandria-bg-tertiary: #0f0f1a;
    --alexandria-border: #2a2a4a;
    --alexandria-text: #e8e8e8;
    --alexandria-text-muted: #888;
    --alexandria-accent: #e94560;
    --alexandria-accent-hover: #ff6b6b;
    --alexandria-success: #4ade80;
    --alexandria-warning: #fbbf24;
    --alexandria-danger: #ef4444;
    --alexandria-info: #60a5fa;
  }

  /* ============ Sidebar Button ============ */
  .alexandria-sidebar-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
    padding: 4px !important;
    background: transparent !important;
    border: none !important;
    border-radius: 4px !important;
    color: var(--fg-color, #aaa) !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
  }
  .alexandria-sidebar-btn:hover {
    background: var(--comfy-input-bg, rgba(255,255,255,0.1)) !important;
    color: var(--fg-color, #fff) !important;
  }
  .alexandria-sidebar-btn svg {
    width: 20px !important;
    height: 20px !important;
    stroke: currentColor !important;
  }

  /* ============ Embedded Panel (Sidebar) ============ */
  .alexandria-embedded {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--alexandria-bg);
    color: var(--alexandria-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .alexandria-embedded-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-secondary);
  }
  .alexandria-embedded-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }
  .alexandria-embedded-sidebar {
    border-bottom: 1px solid var(--alexandria-border);
    max-height: 200px;
    overflow-y: auto;
  }
  .alexandria-embedded .alexandria-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .alexandria-embedded .alexandria-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }
  .alexandria-embedded .alexandria-footer {
    border-top: 1px solid var(--alexandria-border);
    padding: 8px 12px;
    flex-direction: column;
    gap: 8px;
  }
  .alexandria-embedded .alexandria-actions {
    flex-wrap: wrap;
    gap: 6px;
  }
  .alexandria-embedded .alexandria-btn {
    font-size: 12px;
    padding: 6px 10px;
  }

  /* ============ Main Panel ============ */
  .alexandria-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    min-width: 400px;
    max-width: 95vw;
    height: 600px;
    min-height: 300px;
    max-height: 95vh;
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--alexandria-text);
    resize: both;
    overflow: hidden;
  }
  .alexandria-panel.dragging {
    user-select: none;
    cursor: grabbing;
  }
  .alexandria-panel::after {
    content: '';
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 12px;
    height: 12px;
    background: linear-gradient(135deg, transparent 50%, var(--alexandria-text-muted) 50%, var(--alexandria-text-muted) 60%, transparent 60%, transparent 70%, var(--alexandria-text-muted) 70%, var(--alexandria-text-muted) 80%, transparent 80%);
    opacity: 0.5;
    pointer-events: none;
    border-radius: 0 0 8px 0;
  }
  .alexandria-panel-wide {
    width: 1000px;
  }

  /* ============ Header ============ */
  .alexandria-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-secondary);
    border-radius: 12px 12px 0 0;
    cursor: grab;
    user-select: none;
  }
  .alexandria-header:active {
    cursor: grabbing;
  }
  .alexandria-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
  }
  .alexandria-icon {
    font-size: 20px;
  }
  .alexandria-version {
    font-size: 10px;
    font-weight: 500;
    color: var(--alexandria-text-muted);
    background: var(--alexandria-bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 4px;
  }
  /* Stacked title for sub-pages */
  .alexandria-title-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .alexandria-title-main {
    font-size: 14px;
    font-weight: 600;
  }
  .alexandria-title-sub {
    font-size: 12px;
    color: var(--alexandria-text-muted);
    font-weight: 500;
  }
  .alexandria-close {
    background: none;
    border: none;
    color: var(--alexandria-text-muted);
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .alexandria-close:hover {
    color: var(--alexandria-accent);
  }
  .alexandria-back-btn {
    background: none;
    border: none;
    color: var(--alexandria-text);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    margin-right: 4px;
    border-radius: 4px;
    transition: background 0.2s;
  }
  .alexandria-back-btn:hover {
    background: var(--alexandria-bg-tertiary);
  }

  /* ============ Welcome Message ============ */
  .alexandria-welcome {
    padding: 20px 30px 0 30px;
    text-align: center;
  }
  .alexandria-welcome-text {
    font-size: 14px;
    color: var(--alexandria-text);
    line-height: 1.6;
    margin: 0 0 8px 0;
    font-style: italic;
    opacity: 0.9;
  }
  .alexandria-welcome-subtext {
    font-size: 12px;
    color: var(--alexandria-text-muted);
    margin: 0;
  }

  /* ============ Landing Page ============ */
  .alexandria-landing {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 20px;
    padding: 24px 30px;
    justify-content: center;
    align-items: center;
  }
  .alexandria-landing-card {
    flex: 1;
    max-width: 260px;
    padding: 28px 20px;
    background: var(--alexandria-bg-secondary);
    border: 2px solid var(--alexandria-border);
    border-radius: 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .alexandria-landing-card:hover {
    border-color: var(--alexandria-accent);
    background: var(--alexandria-bg-tertiary);
    transform: translateY(-2px);
  }
  .alexandria-landing-card-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .alexandria-landing-card-disabled:hover {
    border-color: var(--alexandria-border);
    background: var(--alexandria-bg-secondary);
    transform: none;
  }
  .alexandria-landing-card-secondary {
    flex-basis: 100%;
    max-width: 100%;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    text-align: left;
  }
  .alexandria-landing-card-secondary .alexandria-landing-icon {
    font-size: 28px;
    margin-bottom: 0;
  }
  .alexandria-landing-card-secondary .alexandria-landing-title {
    margin-bottom: 2px;
    font-size: 14px;
  }
  .alexandria-landing-card-secondary .alexandria-landing-desc {
    font-size: 11px;
  }
  .alexandria-landing-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }
  .alexandria-landing-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--alexandria-text);
  }
  .alexandria-landing-desc {
    font-size: 12px;
    color: var(--alexandria-text-muted);
    line-height: 1.5;
  }
  .alexandria-landing-desc strong {
    color: var(--alexandria-accent);
  }
  .alexandria-landing-footer {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 12px 20px;
    border-top: 1px solid var(--alexandria-border);
  }

  /* ============ Welcome Banner ============ */
  .alexandria-welcome {
    padding: 12px 20px;
    background: linear-gradient(135deg, rgba(233, 69, 96, 0.15) 0%, rgba(233, 69, 96, 0.05) 100%);
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-welcome-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--alexandria-text);
  }
  .alexandria-welcome-text strong {
    color: var(--alexandria-accent);
  }

  /* ============ Body Layout ============ */
  .alexandria-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ============ Sidebar ============ */
  .alexandria-sidebar {
    width: 260px;
    min-width: 260px;
    background: var(--alexandria-bg-secondary);
    border-right: 1px solid var(--alexandria-border);
    display: flex;
    flex-direction: column;
  }
  .alexandria-sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-sidebar-title {
    font-weight: 600;
    font-size: 14px;
  }
  .alexandria-sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--alexandria-border);
    display: flex;
    gap: 8px;
  }

  /* ============ Template List ============ */
  .alexandria-template-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .alexandria-template-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 150px;
    color: var(--alexandria-text-muted);
    text-align: center;
    padding: 16px;
  }
  .alexandria-template-empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  .alexandria-template-empty-text {
    font-size: 13px;
    margin-bottom: 4px;
  }
  .alexandria-template-empty-hint {
    font-size: 11px;
    opacity: 0.7;
  }
  .alexandria-template-item {
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 4px;
    transition: all 0.15s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .alexandria-template-item:hover {
    background: var(--alexandria-bg-tertiary);
  }
  /* Drag handle */
  .alexandria-drag-handle {
    cursor: grab;
    color: var(--alexandria-text-muted);
    font-size: 12px;
    letter-spacing: -2px;
    opacity: 0.4;
    transition: opacity 0.15s;
    user-select: none;
    padding: 4px 2px;
  }
  .alexandria-template-item:hover .alexandria-drag-handle {
    opacity: 0.8;
  }
  .alexandria-drag-handle:active {
    cursor: grabbing;
  }
  /* Drag states */
  .alexandria-template-item.alexandria-dragging {
    opacity: 0.5;
    background: var(--alexandria-bg-tertiary);
  }
  .alexandria-template-item.alexandria-drag-over {
    border-top: 2px solid var(--alexandria-accent);
    margin-top: -2px;
  }
  .alexandria-template-item.selected.alexandria-drag-over {
    border-top-color: white;
  }
  .alexandria-template-item.selected {
    background: var(--alexandria-accent);
    color: white;
  }
  .alexandria-template-item.selected .alexandria-template-meta {
    color: rgba(255, 255, 255, 0.8);
  }
  .alexandria-template-info {
    flex: 1;
    min-width: 0;
  }
  .alexandria-template-name {
    font-weight: 500;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .alexandria-template-meta {
    font-size: 11px;
    color: var(--alexandria-text-muted);
    margin-top: 2px;
  }
  .alexandria-template-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .alexandria-template-item:hover .alexandria-template-actions,
  .alexandria-template-item.selected .alexandria-template-actions {
    opacity: 1;
  }

  /* ============ Main Content Area ============ */
  .alexandria-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ============ Tabs ============ */
  .alexandria-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-tertiary);
  }
  .alexandria-tab {
    padding: 12px 20px;
    background: transparent;
    border: none;
    color: var(--alexandria-text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .alexandria-tab:hover {
    color: var(--alexandria-text);
  }
  .alexandria-tab.active {
    color: var(--alexandria-accent);
    border-bottom-color: var(--alexandria-accent);
  }

  /* ============ Toolbar ============ */
  .alexandria-toolbar {
    display: flex;
    gap: 16px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-tertiary);
  }
  .alexandria-search {
    flex: 1;
  }
  .alexandria-search-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    color: var(--alexandria-text);
    font-size: 14px;
  }
  .alexandria-search-input:focus {
    outline: none;
    border-color: var(--alexandria-accent);
  }
  .alexandria-search-input::placeholder {
    color: var(--alexandria-text-muted);
  }
  .alexandria-filters {
    display: flex;
    gap: 4px;
  }
  .alexandria-filter-btn {
    padding: 8px 14px;
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    color: var(--alexandria-text-muted);
    font-size: 13px;
    cursor: pointer;
  }
  .alexandria-filter-btn:hover {
    border-color: var(--alexandria-accent);
    color: var(--alexandria-text);
  }
  .alexandria-filter-btn.active {
    background: var(--alexandria-accent);
    border-color: var(--alexandria-accent);
    color: white;
  }

  /* ============ Content ============ */
  .alexandria-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 16px 20px;
  }
  .alexandria-content::-webkit-scrollbar {
    width: 8px;
  }
  .alexandria-content::-webkit-scrollbar-track {
    background: var(--alexandria-bg-tertiary);
  }
  .alexandria-content::-webkit-scrollbar-thumb {
    background: var(--alexandria-border);
    border-radius: 4px;
  }
  .alexandria-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--alexandria-text-muted);
    padding-top: 12px;
  }
  .alexandria-empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  .alexandria-empty-text {
    font-size: 14px;
    margin-bottom: 8px;
  }
  .alexandria-empty-hint {
    font-size: 12px;
    color: var(--alexandria-text-muted);
  }

  /* ============ Node Cards ============ */
  .alexandria-node {
    background: var(--alexandria-bg-secondary);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
  }
  .alexandria-node.has-detected {
    border-color: var(--alexandria-accent);
  }
  .alexandria-node-bypassed {
    opacity: 0.6;
  }
  .alexandria-node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--alexandria-bg-tertiary);
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-node-icon {
    font-size: 18px;
  }
  .alexandria-node-title {
    font-weight: 600;
    flex: 1;
  }
  .alexandria-node-id {
    color: var(--alexandria-text-muted);
    font-size: 12px;
  }
  .alexandria-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .badge-detected {
    background: var(--alexandria-accent);
    color: white;
  }
  .badge-bypassed {
    background: var(--alexandria-warning);
    color: black;
  }
  .alexandria-node-widgets {
    padding: 6px 12px;
  }
  .alexandria-node-meta {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    border-top: 1px solid var(--alexandria-border);
  }

  /* ============ Collapsible Groups ============ */
  .alexandria-group {
    margin-bottom: 8px;
  }
  .alexandria-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--alexandria-bg-tertiary);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .alexandria-group-header:hover {
    background: var(--alexandria-bg-secondary);
  }
  .alexandria-group.collapsed .alexandria-group-header {
    border-radius: 6px;
  }
  .alexandria-group:not(.collapsed) .alexandria-group-header {
    border-radius: 6px 6px 0 0;
    border-bottom: none;
  }
  .alexandria-group-title {
    font-weight: 600;
    flex: 1;
  }
  .alexandria-group-count {
    color: var(--alexandria-text-muted);
    font-size: 12px;
  }
  .alexandria-group-content {
    border: 1px solid var(--alexandria-border);
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 8px;
    background: var(--alexandria-bg);
  }

  /* ============ Collapse Icon ============ */
  .alexandria-collapse-icon {
    font-size: 10px;
    color: var(--alexandria-text-muted);
    width: 14px;
    text-align: center;
  }

  /* ============ Clickable Node Header ============ */
  .alexandria-node-header[data-node-id] {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease;
  }
  .alexandria-node-header[data-node-id]:hover {
    background: var(--alexandria-bg-secondary);
  }
  .alexandria-node.collapsed .alexandria-node-header {
    border-bottom: none;
  }
  .alexandria-widget-count {
    color: var(--alexandria-text-muted);
    font-size: 11px;
    margin-left: auto;
  }

  /* ============ Collapse Controls ============ */
  .alexandria-collapse-controls {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
    margin-bottom: 8px;
  }
  .alexandria-collapse-link {
    color: var(--alexandria-text-muted);
    text-decoration: none;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s ease;
  }
  .alexandria-collapse-link:hover {
    color: var(--alexandria-accent);
    background: var(--alexandria-bg-tertiary);
  }

  /* ============ Collapsed Saved Indicator ============ */
  .alexandria-collapsed-saved {
    color: var(--alexandria-success);
    font-size: 11px;
    font-weight: 500;
    margin-left: auto;
  }

  /* ============ Widget Rows ============ */
  .alexandria-widget {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 0;
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-widget:last-child {
    border-bottom: none;
  }
  .alexandria-widget.widget-detected {
    background: rgba(233, 69, 96, 0.1);
    margin: 0 -16px;
    padding: 10px 16px;
  }
  .alexandria-widget-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    min-width: 200px;
  }
  .alexandria-widget-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--alexandria-accent);
    cursor: pointer;
  }
  .alexandria-widget-name {
    font-weight: 500;
    font-size: 14px;
  }
  .alexandria-confidence {
    padding: 2px 6px;
    background: var(--alexandria-info);
    color: white;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .alexandria-widget-value {
    flex: 1;
    min-width: 200px;
    padding: 6px 10px;
    background: var(--alexandria-bg-tertiary);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    color: var(--alexandria-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400px;
  }
  .alexandria-widget-method {
    width: 100%;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    padding-left: 24px;
  }
  .alexandria-widget-actions {
    display: flex;
    gap: 4px;
  }

  /* ============ Configure Mode - Override Controls ============ */
  .alexandria-widget-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .alexandria-widget.widget-override {
    background: rgba(96, 165, 250, 0.08);
    border-left: 2px solid var(--alexandria-info);
  }
  .alexandria-override-controls {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }
  .alexandria-override-btn {
    padding: 4px 8px;
    font-size: 11px;
    border: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-tertiary);
    color: var(--alexandria-text-muted);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .alexandria-override-btn:hover {
    background: var(--alexandria-bg-secondary);
    color: var(--alexandria-text);
  }
  .alexandria-override-btn.active.include {
    background: rgba(74, 222, 128, 0.2);
    border-color: var(--alexandria-success);
    color: var(--alexandria-success);
  }
  .alexandria-override-btn.active.auto {
    background: var(--alexandria-bg-secondary);
    border-color: var(--alexandria-text-muted);
    color: var(--alexandria-text);
  }
  .alexandria-override-btn.active.exclude {
    background: rgba(239, 68, 68, 0.2);
    border-color: var(--alexandria-danger);
    color: var(--alexandria-danger);
  }
  .alexandria-node.has-override {
    border-left: 2px solid var(--alexandria-info);
  }
  .alexandria-badge.badge-override {
    background: rgba(96, 165, 250, 0.2);
    color: var(--alexandria-info);
  }
  .alexandria-group-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  .alexandria-btn-tiny {
    padding: 2px 6px;
    font-size: 10px;
    border: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-tertiary);
    color: var(--alexandria-text-muted);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .alexandria-btn-tiny:hover {
    background: var(--alexandria-bg-secondary);
    color: var(--alexandria-text);
    border-color: var(--alexandria-text-muted);
  }
  .alexandria-btn-tiny[data-action="include-all"]:hover {
    border-color: var(--alexandria-success);
    color: var(--alexandria-success);
  }
  .alexandria-btn-tiny[data-action="exclude-all"]:hover {
    border-color: var(--alexandria-danger);
    color: var(--alexandria-danger);
  }
  .alexandria-node-type-label {
    font-size: 11px;
    color: var(--alexandria-text-muted);
    font-style: italic;
    margin-left: auto;
    padding-right: 8px;
  }

  /* ============ Preview ============ */
  .alexandria-preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--alexandria-text-muted);
    text-align: center;
    padding-top: 12px;
  }
  .alexandria-preview-empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  .alexandria-preview-empty-text {
    font-size: 16px;
    margin-bottom: 8px;
  }
  .alexandria-preview-empty-hint {
    font-size: 13px;
    opacity: 0.7;
  }
  .alexandria-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--alexandria-bg-secondary);
    border-radius: 6px;
    margin-top: 12px;
    margin-bottom: 8px;
    position: sticky;
    top: 0;
    z-index: 11;
  }
  .alexandria-preview-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .alexandria-preview-title {
    font-weight: 600;
    font-size: 14px;
  }
  .alexandria-preview-stats {
    display: flex;
    gap: 8px;
    font-size: 11px;
  }
  .alexandria-match-good {
    color: var(--alexandria-success);
  }
  .alexandria-match-bad {
    color: var(--alexandria-warning);
  }
  .alexandria-preview-count {
    font-size: 12px;
    color: var(--alexandria-text-muted);
  }
  .alexandria-preview-node {
    background: var(--alexandria-bg-secondary);
    border: 1px solid var(--alexandria-border);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .alexandria-preview-node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--alexandria-bg-tertiary);
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-preview-node-title {
    font-weight: 600;
    font-size: 13px;
    flex: 1;
  }
  .alexandria-preview-node-type {
    font-size: 11px;
    color: var(--alexandria-text-muted);
  }
  .alexandria-preview-entries {
    padding: 10px 14px;
  }
  .alexandria-preview-entry {
    margin-bottom: 10px;
  }
  .alexandria-preview-entry:last-child {
    margin-bottom: 0;
  }
  .alexandria-preview-entry-name {
    font-size: 11px;
    color: var(--alexandria-info);
    font-weight: 500;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .alexandria-preview-entry-value {
    font-family: monospace;
    font-size: 12px;
    color: var(--alexandria-text-muted);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ============ Preview Node Matching ============ */
  .alexandria-node-type-badge {
    font-size: 10px;
    color: var(--alexandria-text-muted);
    background: var(--alexandria-bg);
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .alexandria-match-status {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
    margin-left: auto;
  }
  .alexandria-match-exact {
    color: var(--alexandria-success);
    background: rgba(74, 222, 128, 0.15);
  }
  .alexandria-match-title {
    color: var(--alexandria-success);
    background: rgba(74, 222, 128, 0.15);
  }
  .alexandria-match-type {
    color: var(--alexandria-info);
    background: rgba(96, 165, 250, 0.15);
  }
  .alexandria-match-none {
    color: var(--alexandria-warning);
    background: rgba(251, 191, 36, 0.15);
  }
  .alexandria-node-unmatched {
    opacity: 0.7;
    border-style: dashed;
  }
  .alexandria-group-warning .alexandria-group-header {
    border-color: var(--alexandria-warning);
    background: rgba(251, 191, 36, 0.1);
  }
  .alexandria-preview-collapsed-value {
    font-family: monospace;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
    margin-left: 8px;
  }
  .alexandria-preview-widget {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-preview-widget:last-child {
    border-bottom: none;
  }
  .alexandria-preview-widget-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--alexandria-info);
    min-width: 60px;
    text-transform: uppercase;
  }
  .alexandria-preview-widget-value {
    font-family: monospace;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .alexandria-preview-widgets {
    padding: 4px 12px;
  }
  .alexandria-preview-node-header {
    cursor: pointer;
  }
  .alexandria-preview-node-header:hover {
    background: var(--alexandria-bg-secondary);
  }

  /* ============ Footer ============ */
  .alexandria-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-top: 1px solid var(--alexandria-border);
    background: var(--alexandria-bg-secondary);
    border-radius: 0 0 12px 12px;
  }
  .alexandria-status {
    font-size: 13px;
    color: var(--alexandria-text-muted);
  }
  .alexandria-actions {
    display: flex;
    gap: 8px;
  }

  /* ============ Buttons ============ */
  .alexandria-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }
  .alexandria-btn-primary {
    background: var(--alexandria-accent);
    color: white;
  }
  .alexandria-btn-primary:hover {
    background: var(--alexandria-accent-hover);
  }
  .alexandria-btn-secondary {
    background: var(--alexandria-bg-tertiary);
    color: var(--alexandria-text);
    border: 1px solid var(--alexandria-border);
  }
  .alexandria-btn-secondary:hover {
    border-color: var(--alexandria-accent);
  }
  .alexandria-btn-danger {
    background: var(--alexandria-danger);
    color: white;
  }
  .alexandria-btn-danger:hover {
    background: #dc2626;
  }
  /* Disabled button states */
  .alexandria-btn:disabled,
  .alexandria-btn[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
  .alexandria-btn-icon {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--alexandria-text-muted);
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .alexandria-btn-icon:hover {
    background: var(--alexandria-bg-tertiary);
    color: var(--alexandria-text);
  }
  .alexandria-btn-small {
    padding: 4px 8px;
    background: var(--alexandria-bg-tertiary);
    border: 1px solid var(--alexandria-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .alexandria-btn-small:hover {
    border-color: var(--alexandria-accent);
  }
  .alexandria-btn-full {
    width: 100%;
  }

  /* ============ Modal ============ */
  .alexandria-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  }
  .alexandria-modal-content {
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 12px;
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }
  .alexandria-modal-small {
    width: 400px;
  }
  .alexandria-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--alexandria-border);
    font-weight: 600;
  }
  .alexandria-modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }
  .alexandria-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--alexandria-border);
  }
  .alexandria-value-textarea {
    width: 100%;
    height: 300px;
    padding: 12px;
    background: var(--alexandria-bg-tertiary);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    color: var(--alexandria-text);
    font-family: monospace;
    font-size: 13px;
    resize: none;
  }
  .alexandria-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    font-size: 14px;
  }
  .alexandria-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--alexandria-bg-tertiary);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    color: var(--alexandria-text);
    font-size: 14px;
  }
  .alexandria-input:focus {
    outline: none;
    border-color: var(--alexandria-accent);
  }
  .alexandria-input-error {
    border-color: var(--alexandria-danger) !important;
  }
  .alexandria-hint {
    margin-top: 12px;
    font-size: 13px;
    color: var(--alexandria-text-muted);
  }

  /* ============ Version Badge (Template List) ============ */
  .alexandria-version-badge {
    display: inline-block;
    background: var(--alexandria-info);
    color: white;
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 8px;
    margin-left: 6px;
    vertical-align: middle;
  }
  .alexandria-template-item.selected .alexandria-version-badge {
    background: rgba(255, 255, 255, 0.3);
  }

  /* ============ Template Workflow Sections ============ */
  .alexandria-template-section {
    margin-bottom: 8px;
  }
  .alexandria-template-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--alexandria-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .alexandria-template-section-collapsible {
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .alexandria-template-section-collapsible:hover {
    background: var(--alexandria-bg-tertiary);
  }
  .alexandria-template-section-icon {
    font-size: 12px;
  }
  .alexandria-template-section-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .alexandria-template-section-count {
    background: var(--alexandria-bg-tertiary);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
  }
  .alexandria-template-section-toggle {
    font-size: 8px;
    color: var(--alexandria-text-muted);
    margin-left: 4px;
  }
  .alexandria-template-section-other {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--alexandria-border);
  }
  .alexandria-template-workflow-tag {
    display: inline-block;
    background: var(--alexandria-bg-tertiary);
    color: var(--alexandria-text-muted);
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }

  /* ============ Version Bar (Preview) ============ */
  .alexandria-version-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--alexandria-bg-tertiary);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    margin-bottom: 8px;
    gap: 12px;
  }
  .alexandria-version-current {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .alexandria-version-label {
    font-size: 12px;
    font-weight: 500;
  }
  .alexandria-version-time {
    font-size: 11px;
    color: var(--alexandria-text-muted);
  }
  .alexandria-version-toggle {
    background: transparent;
    border: 1px solid var(--alexandria-border);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .alexandria-version-toggle:hover {
    border-color: var(--alexandria-accent);
    color: var(--alexandria-text);
  }
  .alexandria-btn-link {
    background: transparent;
    border: none;
    color: var(--alexandria-accent);
    text-decoration: underline;
    cursor: pointer;
    font-size: 11px;
    padding: 0;
  }
  .alexandria-btn-link:hover {
    color: var(--alexandria-accent-hover);
  }

  /* ============ Version History List ============ */
  .alexandria-version-history {
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    margin-bottom: 8px;
    max-height: 200px;
    overflow-y: auto;
  }
  .alexandria-version-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--alexandria-border);
    transition: background 0.15s;
  }
  .alexandria-version-item:last-child {
    border-bottom: none;
  }
  .alexandria-version-item:hover {
    background: var(--alexandria-bg-tertiary);
  }
  .alexandria-version-item.selected {
    background: var(--alexandria-accent);
    color: white;
  }
  .alexandria-version-item.selected .alexandria-version-item-meta {
    color: rgba(255, 255, 255, 0.8);
  }
  .alexandria-version-item.selected .alexandria-version-item-badge {
    background: rgba(255, 255, 255, 0.3);
  }
  .alexandria-version-item-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .alexandria-version-item-time {
    font-size: 12px;
    font-weight: 500;
  }
  .alexandria-version-item-badge {
    font-size: 9px;
    font-weight: 600;
    background: var(--alexandria-success);
    color: white;
    padding: 2px 6px;
    border-radius: 8px;
  }
  .alexandria-version-item-meta {
    font-size: 11px;
    color: var(--alexandria-text-muted);
  }

  /* ============ Diff View ============ */
  .alexandria-diff-toggle {
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .alexandria-diff-toggle:hover {
    border-color: var(--alexandria-accent);
    color: var(--alexandria-text);
  }
  .alexandria-diff-toggle.active {
    background: var(--alexandria-accent);
    border-color: var(--alexandria-accent);
    color: white;
  }
  .alexandria-version-bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .alexandria-diff-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(96, 165, 250, 0.1);
    border: 1px solid rgba(96, 165, 250, 0.3);
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .alexandria-diff-summary-icon {
    font-size: 16px;
  }
  .alexandria-diff-summary-text {
    font-size: 12px;
    color: var(--alexandria-text);
  }
  .alexandria-diff-no-changes {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }
  .alexandria-diff-no-changes-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  .alexandria-diff-no-changes-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--alexandria-success);
    margin-bottom: 8px;
  }
  .alexandria-diff-no-changes-hint {
    font-size: 13px;
    color: var(--alexandria-text-muted);
  }
  .alexandria-diff-section {
    margin-bottom: 16px;
    background: var(--alexandria-bg-secondary);
    border: 1px solid var(--alexandria-border);
    border-radius: 8px;
    overflow: hidden;
  }
  .alexandria-diff-section-warning {
    border-color: var(--alexandria-warning);
    background: rgba(251, 191, 36, 0.05);
  }
  .alexandria-diff-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--alexandria-bg-tertiary);
    border-bottom: 1px solid var(--alexandria-border);
  }
  .alexandria-diff-section-warning .alexandria-diff-section-header {
    background: rgba(251, 191, 36, 0.1);
    border-bottom-color: var(--alexandria-warning);
  }
  .alexandria-diff-section-icon {
    font-size: 14px;
  }
  .alexandria-diff-section-title {
    font-weight: 600;
    font-size: 13px;
    flex: 1;
  }
  .alexandria-diff-section-count {
    font-size: 11px;
    background: var(--alexandria-bg);
    padding: 2px 8px;
    border-radius: 10px;
    color: var(--alexandria-text-muted);
  }
  .alexandria-diff-section-content {
    padding: 8px;
  }
  .alexandria-diff-entry {
    background: var(--alexandria-bg);
    border: 1px solid var(--alexandria-border);
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .alexandria-diff-entry:last-child {
    margin-bottom: 0;
  }
  .alexandria-diff-entry-missing {
    opacity: 0.8;
    border-style: dashed;
  }
  .alexandria-diff-entry-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--alexandria-bg-tertiary);
    border-bottom: 1px solid var(--alexandria-border);
    flex-wrap: wrap;
  }
  .alexandria-diff-entry-node {
    font-weight: 600;
    font-size: 12px;
  }
  .alexandria-diff-entry-widget {
    font-size: 11px;
    color: var(--alexandria-info);
    font-weight: 500;
    text-transform: uppercase;
  }
  .alexandria-diff-entry-target {
    font-size: 10px;
    color: var(--alexandria-text-muted);
    margin-left: auto;
  }
  .alexandria-diff-entry-no-match {
    color: var(--alexandria-warning);
  }
  .alexandria-diff-entry-values {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .alexandria-diff-value {
    display: flex;
    gap: 8px;
    font-size: 12px;
  }
  .alexandria-diff-value-label {
    font-weight: 500;
    min-width: 60px;
    flex-shrink: 0;
  }
  .alexandria-diff-value-text {
    font-family: monospace;
    font-size: 11px;
    color: var(--alexandria-text-muted);
    word-break: break-word;
    line-height: 1.4;
  }
  .alexandria-diff-value-old .alexandria-diff-value-label {
    color: var(--alexandria-text-muted);
  }
  .alexandria-diff-value-old .alexandria-diff-value-text {
    text-decoration: line-through;
    opacity: 0.7;
  }
  .alexandria-diff-value-new .alexandria-diff-value-label {
    color: var(--alexandria-success);
  }
  .alexandria-diff-value-new .alexandria-diff-value-text {
    color: var(--alexandria-success);
    background: rgba(74, 222, 128, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .alexandria-diff-value-template .alexandria-diff-value-label {
    color: var(--alexandria-warning);
  }

  /* ============ Toast ============ */
  .alexandria-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    padding: 12px 24px;
    background: var(--alexandria-success);
    color: white;
    border-radius: 8px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 10002;
  }
  .alexandria-toast.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  .alexandria-toast-success {
    background: var(--alexandria-success);
    color: white;
  }
  .alexandria-toast-warning {
    background: var(--alexandria-warning);
    color: black;
  }
  .alexandria-toast-error {
    background: var(--alexandria-danger);
    color: white;
  }
`;

let stylesInjected = false;

/**
 * Inject CSS styles into the document
 * Only injects once, safe to call multiple times
 */
export function injectStyles() {
  if (stylesInjected) return;

  const style = document.createElement('style');
  style.id = 'alexandria-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
  stylesInjected = true;

  console.log('Alexandria: Styles injected');
}

/**
 * Remove injected styles (for cleanup/testing)
 */
export function removeStyles() {
  const style = document.getElementById('alexandria-styles');
  if (style) {
    style.remove();
    stylesInjected = false;
  }
}
