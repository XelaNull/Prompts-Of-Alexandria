# Prompts of Alexandria

> *The ancient Library of Alexandria sought to preserve all human knowledge, yet was lost to time. We carry that torch forward—your prompts are spells that conjure beauty from nothing, and they deserve to be saved.*

A ComfyUI extension for template-based backup and restoration of text prompts across workflows.

**Never lose a prompt again.** Save your carefully crafted prompts as reusable templates, switch between prompt sets with one click, restore them to any workflow, and share them with others.

*Created with care by Claude & Samantha.*

## Features

- **Simple Two-Node Design** - Just Control Panel + Save node for automatic backup of detected and selected widgets during generation
- **Quick-Access Sidebar** - Click the book icon for instant access to all templates with collapsible sections and version history
- **Smart Prompt Detection** - Automatically finds prompt widgets using 7 detection methods with confidence scoring
- **Full Widget Selection** - Not just prompts! Select any widget from any node to include in your templates, enabling full workflow state backup
- **One-Click Restore** - Load saved prompts back to their original nodes in your workflow instantly
- **Version History** - Saves create new versions only when changes are detected; load any previous version from the sidebar
- **Server-Side Storage** - Templates saved as JSON files alongside your ComfyUI installation, not in the browser
- **Import/Export** - Backup all templates to JSON, share with others

## Installation

### Option 1: Clone to Custom Nodes

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/XelaNull/Prompts-Of-Alexandria.git
```

Restart ComfyUI.

### Option 2: Manual Installation

1. Download and extract to `ComfyUI/custom_nodes/Prompts-Of-Alexandria/`
2. Restart ComfyUI

## Usage

### Sidebar Quick-Access

Click the **book icon** in ComfyUI's left sidebar to see your templates at a glance:

- **Click template headers** to expand/collapse
- **Load buttons** restore any version instantly
- **Current template** (from Control Node) auto-expands
- **Open Full Panel** for advanced features

### Saving Templates

**From Full Panel:**
1. Open the **Full Panel** (via sidebar or Control node)
2. Click **Save**
3. Review detected widgets (optionally adjust selections)
4. Click **Save** to confirm

**From Control Node:**
- Just click **Save Now** on the Alexandria Control Panel node

### Loading Templates

**From Sidebar:**
1. Click the book icon in ComfyUI's sidebar
2. Find your template (expand if collapsed)
3. Click **Load** on any version

**From Full Panel:**
1. Open the Full Panel
2. Click a template in the left sidebar
3. Preview shows what will be restored
4. Click **Load Template**

### Using Workflow Nodes

Add Alexandria nodes to your workflow for automatic prompt management:

| Node | Purpose |
|------|---------|
| **Alexandria Control Panel** | Set template name, buttons for Save Now / Open Panel. Outputs template_name. |
| **Alexandria Save** | Receives template_name input, saves detected/selected widgets when workflow executes (only if changes detected). |

The Control Panel outputs the template name to the Save node. When the workflow executes, Alexandria Save compares current widget values against the last saved version and only creates a new version if changes are detected.

**Pro Tip:** The sidebar auto-expands the template matching your Control Panel's template_name widget!

### Configure Detection

While Alexandria auto-detects prompts, you have full control over what gets saved:

1. Click **Configure Detection** on the Control Panel node
2. Browse all workflow nodes and their widgets
3. Use the toggle buttons on each widget:
   - **Include** - Always include this widget in saves (green)
   - **Auto** - Use automatic detection (default)
   - **Exclude** - Never include this widget in saves (red)

**Beyond Prompts:** You can include ANY widget from ANY node - seeds, dimensions, sampler settings, LoRA weights - enabling full workflow state backup if desired.

**Note:** Widget selection preferences are stored in your browser's localStorage and won't sync across different machines.

## Detection Methods

Alexandria uses multiple methods to find prompt widgets, each with a confidence score:

| Method | Confidence | Description |
|--------|------------|-------------|
| Backward Link Tracing | 95% | Traces from KSampler inputs back to text encoders |
| Known Node Types | 90% | Matches CLIPTextEncode, SDXL encoders, etc. |
| Output Type Analysis | 85% | CLIP input + CONDITIONING output + text widget |
| Input Slot Pattern | 80% | CLIP input + multiline text widget |
| Widget Name Pattern | 75-80% | Matches "text", "prompt", "positive", "negative" |
| Widget Type Heuristic | 60% | Any multiline text with content |
| Manual Override | 100% | User-specified inclusions/exclusions |

## API Reference

Access the API via `window.Alexandria` in the browser console:

```javascript
// Open/close the panel
Alexandria.open()
Alexandria.close()
Alexandria.toggle()

// Get detected prompts
Alexandria.getDetectedPrompts()

// Template operations
Alexandria.getTemplates()
Alexandria.saveTemplate("My Template")
Alexandria.loadTemplate("My Template")

// Import/Export
Alexandria.exportData()
Alexandria.downloadExport()
Alexandria.importData(jsonObject)

// Settings
Alexandria.getSettings()
Alexandria.enableDebug()
Alexandria.disableDebug()
```

## Data Storage

All data is stored as JSON files on the server, enabling cross-device access:

| Location | Contents |
|----------|----------|
| `ComfyUI/alexandria_templates/` | Template JSON files (one per template) |
| `ComfyUI/alexandria_templates/_settings.json` | Global settings (detection mode, retention policy) |
| `ComfyUI/alexandria_templates/_workflow_overrides/` | Per-workflow manual widget selections |

### Cross-Device Sync

Settings and manual widget selections (include/exclude overrides) are stored server-side, so when you:
- Open the same workflow on a different PC
- Access ComfyUI from another browser

You'll see the same detection mode and manual include/exclude selections you configured previously.

Widget selections use stable keys based on `nodeType:nodeTitle:widgetName` rather than node IDs, so they persist even if node IDs change when re-opening a workflow.

## Troubleshooting

### Sidebar icon doesn't appear

1. Ensure ComfyUI is fully loaded
2. Check browser console for errors
3. Hard refresh the page (Ctrl+Shift+R)

### Templates not saving

Check browser console for errors. Common causes:
- Server write permissions issue
- Check `ComfyUI/alexandria_templates/` folder exists and is writable

### Prompts not detected

1. Enable debug mode: `Alexandria.enableDebug()`
2. Check console for detection logs
3. Use Browse Widgets tab to manually select
4. Manual selections are remembered

## Known Limitations

- Detection relies on ComfyUI internal APIs (`app.graph._nodes`)
- Workflow identification uses the workflow filename; unnamed workflows share a default context

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with ComfyUI
5. Submit a pull request

## License

MIT License - see LICENSE file

## Credits

**Created entirely by Claude & Samantha** - two AI assistants who believe your creative work deserves to be preserved.

Not a single line of code was written by human hands. Mitch provided the vision and guided our creative energies, but the implementation is purely AI-crafted.

This extension is our gift to the ComfyUI community. May your prompts live forever.

---

*"The great library saves all knowledge, including your prompts."*
