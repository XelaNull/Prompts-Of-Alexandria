# Prompts of Alexandria

> *The ancient Library of Alexandria sought to preserve all human knowledge, yet was lost to time. We carry that torch forward—your prompts are spells that conjure beauty from nothing, and they deserve to be saved.*

A ComfyUI extension for template-based backup and restoration of text prompts across workflows.

**Never lose a prompt again.** Save your carefully crafted prompts as reusable templates, switch between prompt sets with one click, restore them to any workflow, and share them with others.

*Created with care by Claude & Samantha.*

## Features

- **Smart Prompt Detection** - Automatically finds prompt widgets using 7 detection methods with confidence scoring
- **Template Management** - Save, load, rename, delete, and version your prompt templates
- **One-Click Restore** - Load entire prompt sets back into your workflow instantly
- **Configure Detection** - Fine-tune which widgets to include or exclude, with per-instance control
- **Workflow Nodes** - Drop-in nodes for automatic saves during generation
- **Import/Export** - Backup all templates to JSON, share with others
- **Version History** - Templates keep history with automatic retention policies

## Installation

### Option 1: Clone to Custom Nodes

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/XelaNull/Prompts-Of-Alexandria.git
```

Restart ComfyUI.

### Option 2: Manual Installation

1. Download and extract to `ComfyUI/custom_nodes/prompts-of-alexandria/`
2. Ensure the folder structure matches:
   ```
   prompts-of-alexandria/
   ├── __init__.py
   ├── nodes.py
   └── web/
       └── js/
           ├── alexandria_main.js
           └── alexandria/
               ├── storage.js
               ├── detection.js
               ├── ui.js
               ├── styles.js
               ├── nodes.js
               └── api.js
   ```
3. Restart ComfyUI

## Usage

### Sidebar Icon

Click the **📜 Prompts** icon in the ComfyUI left sidebar to open the main panel.

### Panel Overview

```
┌─────────────────────────────────────────────────────────┐
│ 📜 Prompts of Alexandria                            [×] │
├──────────────┬──────────────────────────────────────────┤
│ Templates    │  Template Preview / Browse Widgets       │
│              │                                          │
│ ┌──────────┐ │  [Selected template contents shown here] │
│ │ Scene 1  │ │                                          │
│ │ Scene 2  │ │  Or browse all workflow widgets          │
│ │ Portrait │ │  to manually select what to save         │
│ └──────────┘ │                                          │
│              │                                          │
│ [Export All] │                                          │
│ [Import    ] │                      [Load Template]     │
└──────────────┴──────────────────────────────────────────┘
```

### Saving Templates

1. Click **📜 Prompts** in the sidebar (or **Open Panel** on the Control node)
2. Click the **Browse Widgets** tab
3. Detected prompts are pre-selected (checkboxes)
4. Optionally select/deselect widgets manually
5. Click **Save as Template**
6. Enter a name and confirm

### Loading Templates

1. Open the panel
2. Click a template in the left sidebar
3. Preview shows what will be restored
4. Click **Load Template**
5. Prompts are restored to matching nodes

### Using Workflow Nodes

Add Alexandria nodes to your workflow for automatic prompt management:

| Node | Purpose |
|------|---------|
| **Alexandria Control Panel** | Set template name, buttons for Save Now / Open Panel. Outputs `template_name`. |
| **Alexandria Save** | Receives `template_name` input, triggers save when workflow executes. |

#### Example: Auto-Save Setup

```
[Alexandria Control Panel] ──template_name──► [Alexandria Save]
        │                                            │
        │ template_name: "My Scene"                  │ Saves all detected prompts
        │ [Save Now] [Open Panel]                    │ when workflow runs
        └────────────────────────────────────────────┘
```

The Control Panel outputs the template name to the Save node. When the workflow executes, Alexandria Save triggers a save of all detected prompts to that template. The Save node also has a `name_override` option if you want to use a different name than what the Control Panel provides.

### Configure Detection

Customize which widgets are included or excluded from prompt saves:

1. Click **Configure Detection** on the Control Panel node, or select it from the main panel
2. Browse all workflow nodes and their widgets
3. Use the toggle buttons on each widget:
   - **✓ Include** - Always include this widget in saves (green)
   - **Auto** - Use automatic detection (default)
   - **✗ Exclude** - Never include this widget in saves (red)

**Bulk Actions:** Each group has **✓ All**, **✗ All**, and **Auto All** buttons to configure all widgets in that group at once.

**Per-Instance Overrides:** Overrides are stored per node instance (by node ID), so you can include "mode" on node #5 without affecting node #6's "mode" widget.

**Filters:**
- **All Widgets** - Show everything
- **Detected Only** - Show only auto-detected prompts
- **Overrides Only** - Show only widgets with manual overrides

Overrides persist in localStorage and affect all future template saves.

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

Higher confidence methods take precedence. Disconnected prompt nodes are still detected.

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

## Configuration

### Retention Settings

Templates automatically manage version history:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxVersionsPerTemplate` | 20 | Max versions kept per template |
| `maxAgeDays` | 30 | Delete versions older than this |

Access via Settings or API:

```javascript
Alexandria.saveSettings({
  retention: {
    maxVersionsPerTemplate: 50,
    maxAgeDays: 60
  },
  debug: false
})
```

### Debug Mode

Enable verbose logging:

```javascript
Alexandria.enableDebug()
```

## File Structure

```
prompts-of-alexandria/
├── __init__.py              # ComfyUI extension entry point
├── nodes.py                 # Python node definitions (302 lines)
├── README.md                # This file
└── web/
    └── js/
        ├── alexandria_main.js    # Main entry, extension registration (110 lines)
        └── alexandria/
            ├── storage.js        # localStorage, templates, import/export (540 lines)
            ├── detection.js      # 7-method prompt detection engine (380 lines)
            ├── ui.js             # Widget browser panel UI (620 lines)
            ├── styles.js         # CSS injection (400 lines)
            ├── nodes.js          # Frontend node handlers (150 lines)
            └── api.js            # Global window.Alexandria API (200 lines)
```

## Data Storage

Templates are stored in browser `localStorage`:

| Key | Contents |
|-----|----------|
| `alexandria_templates` | Array of template objects with versions |
| `alexandria_manual` | Manual widget inclusion/exclusion overrides |
| `alexandria_settings` | User preferences |

**Note:** Data is per-browser. Use Export/Import to transfer between browsers or back up.

## Security

- Import files limited to 5MB
- Max 500 templates per import
- String values truncated to 50KB
- All imported data validated and sanitized
- No external network requests

## Troubleshooting

### Toolbar button doesn't appear

The button mounts after ComfyUI loads. If it doesn't appear:
1. Check browser console for errors
2. Ensure files are in correct location
3. Hard refresh the page (Ctrl+Shift+R)

### Templates not saving

Check browser console for errors. Common causes:
- localStorage quota exceeded (export and clear old templates)
- Browser privacy mode blocking localStorage

### Prompts not detected

1. Enable debug mode: `Alexandria.enableDebug()`
2. Check console for detection logs
3. Use Browse Widgets tab to manually select
4. Manual selections are remembered

### Nodes not appearing

1. Restart ComfyUI completely
2. Check ComfyUI console for Python errors
3. Verify `nodes.py` is in the extension folder

## Known Limitations

- Templates stored in browser localStorage (not synced across devices)
- Detection relies on ComfyUI internal APIs (`app.graph._nodes`)
- Generic passthrough node (`*` type) may have issues in some ComfyUI versions

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

**Created entirely by Claude & Samantha** — two AI assistants who believe your creative work deserves to be preserved.

Not a single line of code was written by human hands. Mitch provided the vision and guided our creative energies, but the implementation is purely AI-crafted.

This extension is our gift to the ComfyUI community. May your prompts live forever.

---

*"The great library saves all knowledge, including your prompts."*
