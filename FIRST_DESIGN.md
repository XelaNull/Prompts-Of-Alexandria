# Prompts of Alexandria - Design Document v2.0

> *"The ancient Library of Alexandria preserved humanity's knowledge. This extension preserves your workflow's soul."*

## Executive Summary

**Prompts of Alexandria** is a ComfyUI extension for template-based backup and restoration of text prompts across workflows. It features robust multi-method prompt detection, automatic versioned backups with retention policies, and seamless UI integration via toolbar button or standalone node.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Detection Methodology](#detection-methodology)
3. [Node Designs](#node-designs)
4. [UI Architecture](#ui-architecture)
5. [Template & Storage System](#template--storage-system)
6. [Restoration Logic](#restoration-logic)
7. [Implementation Phases](#implementation-phases)

---

## Core Concepts

### What We're Solving

1. **Prompt swapping is tedious** - Changing from "Scene One" to "Scene Two" requires manual copy-paste across multiple nodes
2. **Workflow duplication is wasteful** - Maintaining separate workflow files that only differ in prompts
3. **No prompt history** - Previous prompt configurations are lost unless manually saved

### Design Principles

1. **Back up ALL prompts by default** - Comprehensive capture, user can exclude if needed
2. **Automatic conflict resolution** - If node exists, restore; if not, skip silently
3. **Small footprint** - Templates are tiny JSON, aggressive auto-retention
4. **No cloud, no bulk ops** - Keep it simple; restore IS the bulk operation
5. **Handle renamed nodes** - Users rename nodes constantly; detection must be resilient

---

## Detection Methodology

### The Detection Pipeline

Detection runs in priority order. Each method that finds a widget adds to the candidate list with its confidence score. Final confidence = highest score from any method that identified it.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DETECTION PIPELINE                                │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │   Method 1   │   │   Method 2   │   │   Method 3   │             │
│  │   Backward   │   │    Known     │   │   Output     │             │
│  │    Link      │──►│    Node      │──►│    Type      │──►...       │
│  │   Tracing    │   │    Types     │   │   Analysis   │             │
│  │  (Conf: 95)  │   │  (Conf: 90)  │   │  (Conf: 85)  │             │
│  └──────────────┘   └──────────────┘   └──────────────┘             │
│         │                  │                  │                      │
│         ▼                  ▼                  ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              CANDIDATE AGGREGATOR                            │    │
│  │   Merges results, keeps highest confidence per widget        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              FINAL PROMPT LIST                               │    │
│  │   All detected prompts with confidence scores                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Detection Philosophy

**Back up ALL prompt nodes, connected or not.**

The Alexandria Save Node is simply a *trigger mechanism* - when it executes, it captures every prompt in the workflow. Users often have multiple prompt nodes:
- One connected (currently active)
- Others disconnected (alternative scenes, variations, backups)

All of these should be captured. The detection methods below work together to find everything:
- **Backward link tracing** gives highest confidence for *connected* prompts
- **Other methods** catch *disconnected* prompts that aren't in the active chain

A disconnected CLIPTextEncode is still a prompt node worth backing up - it's just not currently wired into the generation pipeline.

---

### Method 1: Backward Link Tracing (Confidence: 95%)

**Highest confidence for connected prompts.** Traces actual data flow from samplers back to prompt sources.

#### Algorithm

```javascript
function traceBackwardFromSamplers() {
  const promptNodes = new Set();

  // Find all sampler nodes (KSampler, SamplerCustom, etc.)
  const samplers = findNodesByOutputType('LATENT')
    .filter(n => hasInputSlot(n, 'positive') || hasInputSlot(n, 'negative'));

  for (const sampler of samplers) {
    // Trace positive conditioning chain
    traceConditioningChain(sampler, 'positive', promptNodes);
    // Trace negative conditioning chain
    traceConditioningChain(sampler, 'negative', promptNodes);
  }

  return promptNodes;
}

function traceConditioningChain(node, inputName, results) {
  const link = getInputLink(node, inputName);
  if (!link) return;

  const sourceNode = getNodeById(link.origin_id);

  // Is this a text encoder? Found a prompt!
  if (isTextEncoder(sourceNode)) {
    results.add({
      node: sourceNode,
      widgets: getTextWidgets(sourceNode),
      confidence: 95,
      method: 'backward_link_tracing',
      path: `${node.title || node.type}.${inputName}`
    });
    return;
  }

  // Is this a conditioning combiner? Recurse into its inputs
  if (isConditioningCombiner(sourceNode)) {
    // Trace all conditioning inputs
    for (const input of sourceNode.inputs) {
      if (input.type === 'CONDITIONING') {
        traceConditioningChain(sourceNode, input.name, results);
      }
    }
  }

  // Is this a conditioning modifier (ControlNet, etc.)?
  // Continue tracing through its conditioning input
  if (hasConditioningPassthrough(sourceNode)) {
    traceConditioningChain(sourceNode, 'conditioning', results);
  }
}
```

#### What This Catches

| Node Type | How It's Found |
|-----------|----------------|
| CLIPTextEncode | Direct trace from sampler positive/negative |
| CLIPTextEncodeSDXL | Direct trace |
| Regional prompt nodes | Trace through ConditioningCombine |
| ControlNet prompts | Trace through ControlNetApply |
| IP-Adapter prompts | Trace through IPAdapter nodes |
| Any custom encoder | If it outputs CONDITIONING and has text widget |

#### Conditioning Combiners to Traverse

```javascript
const CONDITIONING_COMBINERS = [
  'ConditioningCombine',
  'ConditioningConcat',
  'ConditioningAverage',
  'ConditioningSetArea',
  'ConditioningSetMask',
  'ControlNetApply',
  'ControlNetApplyAdvanced',
  'IPAdapterApply',
  'IPAdapterApplyAdvanced',
  // ... extensible
];
```

---

### Method 2: Known Node Types (Confidence: 90%)

**Direct lookup of definitively known prompt nodes.**

```javascript
const KNOWN_PROMPT_NODES = {
  // Core Stable Diffusion
  'CLIPTextEncode': ['text'],
  'CLIPTextEncodeSDXL': ['text_g', 'text_l'],
  'CLIPTextEncodeSDXLRefiner': ['text'],
  'CLIPTextEncodeSD3': ['text', 'text_g', 'text_l', 'text_t5xxl'],
  'CLIPTextEncodeFlux': ['text'],
  'CLIPTextEncodeHunyuanDiT': ['text'],

  // Common custom nodes
  'WildcardEncode': ['text'],
  'ImpactWildcardEncode': ['wildcard_text', 'populated_text'],
  'easy positive': ['positive'],
  'easy negative': ['negative'],
  'CR Prompt Text': ['prompt'],
  'CR Multi-Line Prompt': ['prompt'],
  'ShowText|pysssss': ['text'],
  'StringFunction|pysssss': ['text'],

  // Add more as discovered...
};

function detectByKnownNodeType(node) {
  const widgetNames = KNOWN_PROMPT_NODES[node.type];
  if (!widgetNames) return null;

  return {
    node: node,
    widgets: node.widgets.filter(w => widgetNames.includes(w.name)),
    confidence: 90,
    method: 'known_node_type'
  };
}
```

**Why 90% not 100%?** Because the widget might be empty or the node might be disconnected/unused.

---

### Method 3: Output Type Analysis (Confidence: 85%)

**Nodes that output CONDITIONING and have text inputs are almost certainly prompt encoders.**

```javascript
function detectByOutputType(node) {
  // Must output CONDITIONING
  const outputsConditioning = node.outputs?.some(o => o.type === 'CONDITIONING');
  if (!outputsConditioning) return null;

  // Must have CLIP input (indicates it's an encoder, not combiner)
  const hasClipInput = node.inputs?.some(i => i.type === 'CLIP');
  if (!hasClipInput) return null;

  // Find text widgets
  const textWidgets = node.widgets?.filter(w =>
    isTextWidget(w) && w.value !== undefined
  );

  if (textWidgets.length === 0) return null;

  return {
    node: node,
    widgets: textWidgets,
    confidence: 85,
    method: 'output_type_analysis'
  };
}
```

---

### Method 4: Input Slot Pattern Analysis (Confidence: 80%)

**Nodes with a "clip" input and text widgets are likely encoders.**

```javascript
function detectByInputPattern(node) {
  // Has CLIP input?
  const hasClipInput = node.inputs?.some(i =>
    i.name.toLowerCase() === 'clip' || i.type === 'CLIP'
  );
  if (!hasClipInput) return null;

  // Has substantial text widget?
  const textWidgets = node.widgets?.filter(w =>
    isTextWidget(w) &&
    (w.options?.multiline || w.type === 'customtext')
  );

  if (textWidgets.length === 0) return null;

  return {
    node: node,
    widgets: textWidgets,
    confidence: 80,
    method: 'input_slot_pattern'
  };
}
```

---

### Method 5: Widget Name Pattern Matching (Confidence: 75%)

**Match widget names against known prompt-related patterns.**

```javascript
const WIDGET_NAME_PATTERNS = [
  // Exact matches (higher confidence within this method)
  { pattern: /^text$/i, boost: 5 },
  { pattern: /^prompt$/i, boost: 5 },
  { pattern: /^positive$/i, boost: 5 },
  { pattern: /^negative$/i, boost: 5 },

  // Partial matches
  { pattern: /prompt/i, boost: 0 },
  { pattern: /^positive_/i, boost: 0 },
  { pattern: /^negative_/i, boost: 0 },
  { pattern: /_prompt$/i, boost: 0 },
  { pattern: /caption/i, boost: 0 },
  { pattern: /description/i, boost: 0 },
  { pattern: /wildcard/i, boost: 0 },
];

function detectByWidgetName(node) {
  const matches = [];

  for (const widget of node.widgets || []) {
    for (const { pattern, boost } of WIDGET_NAME_PATTERNS) {
      if (pattern.test(widget.name) && isTextWidget(widget)) {
        matches.push({
          widget: widget,
          confidence: 75 + boost,
        });
        break; // One match per widget
      }
    }
  }

  if (matches.length === 0) return null;

  return {
    node: node,
    widgets: matches.map(m => m.widget),
    confidence: Math.max(...matches.map(m => m.confidence)),
    method: 'widget_name_pattern'
  };
}
```

---

### Method 6: Widget Type Heuristics (Confidence: 60%)

**Multiline text widgets that aren't obviously non-prompts.**

```javascript
const NON_PROMPT_WIDGET_NAMES = [
  'filename', 'path', 'directory', 'folder',
  'prefix', 'suffix', 'delimiter', 'separator',
  'format', 'extension', 'comment', 'note',
  'json', 'yaml', 'config', 'settings',
  'code', 'script', 'expression', 'formula',
];

function detectByWidgetType(node) {
  const candidates = [];

  for (const widget of node.widgets || []) {
    // Must be multiline text
    if (!isMultilineTextWidget(widget)) continue;

    // Exclude obvious non-prompts
    const nameLower = widget.name.toLowerCase();
    if (NON_PROMPT_WIDGET_NAMES.some(n => nameLower.includes(n))) continue;

    // Exclude empty widgets
    if (!widget.value || widget.value.trim() === '') continue;

    candidates.push(widget);
  }

  if (candidates.length === 0) return null;

  return {
    node: node,
    widgets: candidates,
    confidence: 60,
    method: 'widget_type_heuristic'
  };
}
```

---

### Method 7: User Manual Selection (Confidence: 100%)

**User explicitly marked this widget for backup.**

```javascript
// Stored in localStorage
const manualSelections = {
  // Key: "nodeType:widgetName" for portability across workflows
  // Value: true (include) or false (exclude)
  "KSampler:seed": true,          // User wants to backup seeds
  "ShowText|pysssss:text": false, // User excluded this
};

function applyManualOverrides(candidates) {
  // Add manually included widgets not in candidates
  for (const [key, include] of Object.entries(manualSelections)) {
    if (!include) continue;

    const [nodeType, widgetName] = key.split(':');
    const nodes = findNodesByType(nodeType);

    for (const node of nodes) {
      const widget = node.widgets?.find(w => w.name === widgetName);
      if (widget && !candidatesContains(candidates, node, widget)) {
        candidates.push({
          node: node,
          widgets: [widget],
          confidence: 100,
          method: 'user_manual_selection'
        });
      }
    }
  }

  // Remove manually excluded widgets
  return candidates.filter(c => {
    const key = `${c.node.type}:${c.widgets[0].name}`;
    return manualSelections[key] !== false;
  });
}
```

---

### Detection Confidence Summary

| Method | Confidence | What It Catches | Notes |
|--------|------------|-----------------|-------|
| Backward Link Tracing | 95% | Connected prompts in active generation chain | Highest confidence for "live" prompts |
| Known Node Types | 90% | All instances of known prompt nodes (connected OR disconnected) | Primary method for catching everything |
| Output Type Analysis | 85% | Unknown encoders with CONDITIONING output + CLIP input | Catches custom/new encoder nodes |
| Input Slot Pattern | 80% | Encoders with CLIP input + text widgets | Backup detection method |
| Widget Name Pattern | 75% | Widgets named "prompt", "text", etc. | Catches non-standard nodes |
| Widget Type Heuristic | 60% | Any multiline text widget | Last resort, may have false positives |
| User Manual Selection | 100% | Exactly what user wants | Override for edge cases |

**How they work together:**
1. Run ALL detection methods on ALL nodes in the workflow
2. Aggregate results - if multiple methods find the same widget, keep the highest confidence
3. The result is a complete list of every prompt-like widget, connected or not
4. User can review and adjust via the Widget Browser UI

---

### Helper Functions

```javascript
function isTextWidget(widget) {
  return (
    widget.type === 'customtext' ||
    widget.type === 'string' ||
    widget.type === 'text' ||
    (widget.inputEl && widget.inputEl.tagName === 'TEXTAREA')
  );
}

function isMultilineTextWidget(widget) {
  return (
    widget.type === 'customtext' ||
    widget.options?.multiline === true ||
    (widget.inputEl && widget.inputEl.tagName === 'TEXTAREA')
  );
}

function isTextEncoder(node) {
  // Has CLIP input AND CONDITIONING output AND text widget
  const hasClipIn = node.inputs?.some(i => i.type === 'CLIP');
  const hasCondOut = node.outputs?.some(o => o.type === 'CONDITIONING');
  const hasTextWidget = node.widgets?.some(w => isTextWidget(w));

  return hasClipIn && hasCondOut && hasTextWidget;
}

function isConditioningCombiner(node) {
  // Multiple CONDITIONING inputs, one CONDITIONING output
  const condInputs = node.inputs?.filter(i => i.type === 'CONDITIONING') || [];
  const condOutputs = node.outputs?.filter(o => o.type === 'CONDITIONING') || [];

  return condInputs.length >= 2 && condOutputs.length >= 1;
}

function hasConditioningPassthrough(node) {
  // Has both CONDITIONING input and output (modifier node)
  const hasCondIn = node.inputs?.some(i => i.type === 'CONDITIONING');
  const hasCondOut = node.outputs?.some(o => o.type === 'CONDITIONING');

  return hasCondIn && hasCondOut;
}
```

---

## Node Designs

### Node 1: Alexandria Save Node

**Purpose**: Inline workflow node that auto-saves prompts at generation time with diff detection.

```
┌─────────────────────────────────────────┐
│         📜 Alexandria Save               │
├─────────────────────────────────────────┤
│                                         │
│  ○ any ─────────────────────────── any ○│
│                                         │
│  Template: [Scene One            ▼]     │
│                                         │
│  Auto-save: [✓]                         │
│                                         │
│  Status: Last saved 2 min ago           │
│          (no changes detected)          │
│                                         │
└─────────────────────────────────────────┘
```

#### Behavior

1. **Passthrough connection** - Wire it anywhere in your workflow (e.g., between sampler and output)
2. **Auto-save on execution** - When workflow runs and this node executes:
   - Capture all prompts using detection pipeline
   - Compare hash with last saved version
   - If different, save new version under selected template name
   - If same, do nothing (no duplicate saves)
3. **Template selector** - Choose which template slot to save to

#### Inputs/Outputs

| Direction | Name | Type | Description |
|-----------|------|------|-------------|
| Input | any | * | Passthrough - accepts any connection |
| Output | any | * | Passthrough - forwards input unchanged |

#### Widgets

| Widget | Type | Description |
|--------|------|-------------|
| template | COMBO | Template to save to (populated from library) |
| auto_save | BOOLEAN | Enable/disable auto-save on execution |
| status | STRING (readonly) | Shows last action and change detection |

#### Backend Logic (Python)

```python
class AlexandriaSaveNode:
    CATEGORY = "Prompts of Alexandria"
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("any",)
    FUNCTION = "execute"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "any": ("*",),
            },
            "optional": {
                "template_name": ("STRING", {"default": "Default"}),
                "auto_save": ("BOOLEAN", {"default": True}),
            },
            "hidden": {
                "prompt": "PROMPT",  # Full workflow prompt
                "extra_pnginfo": "EXTRA_PNGINFO",
            }
        }

    def execute(self, any, template_name="Default", auto_save=True,
                prompt=None, extra_pnginfo=None):
        if auto_save and prompt:
            # Send prompt data to frontend for processing
            # Frontend handles detection and storage
            PromptServer.instance.send_sync(
                "alexandria.save_request",
                {"template": template_name, "prompt": prompt}
            )

        return (any,)
```

---

### Node 2: Alexandria Control Node

**Purpose**: Standalone control panel node with no connections - alternative to toolbar button.

```
┌─────────────────────────────────────────┐
│       📜 Alexandria Controls             │
├─────────────────────────────────────────┤
│                                         │
│  Template: [Scene One            ▼]     │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌────────┐  │
│  │📂 Load  │  │💾 Save  │  │⚙️ Open │  │
│  └─────────┘  └─────────┘  └────────┘  │
│                                         │
│  Status: Ready                          │
│                                         │
└─────────────────────────────────────────┘
```

#### Behavior

1. **No connections** - Pure UI node, doesn't participate in workflow execution
2. **Template dropdown** - Select template to load or save to
3. **Load button** - Restore prompts from selected template
4. **Save button** - Save current prompts to selected template
5. **Open button** - Opens the full Alexandria panel

#### Implementation

```python
class AlexandriaControlNode:
    CATEGORY = "Prompts of Alexandria"
    RETURN_TYPES = ()  # No outputs
    FUNCTION = "execute"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "template_name": ("STRING", {"default": "Default"}),
            }
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Never cache - always allow button clicks
        return float("nan")

    def execute(self, template_name="Default"):
        # Buttons handled by frontend, this is just a shell
        return {}
```

---

## UI Architecture

### Toolbar Integration

**Single "Alexandria" button** mounted to the ComfyUI Manager toolbar area.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ComfyUI                                    [Queue] [Manager] [📜]  │
│                                                              ▲      │
│                                                    Alexandria button│
└─────────────────────────────────────────────────────────────────────┘
```

#### Toolbar Button Implementation

```javascript
// Mount to ComfyUI toolbar
function mountAlexandriaButton() {
  const toolbar = document.querySelector('.comfy-menu') ||
                  document.querySelector('#comfy-toolbar');

  if (!toolbar) {
    console.warn('Alexandria: Could not find toolbar, retrying...');
    setTimeout(mountAlexandriaButton, 1000);
    return;
  }

  const button = document.createElement('button');
  button.id = 'alexandria-toolbar-btn';
  button.className = 'comfy-btn';
  button.innerHTML = '📜';
  button.title = 'Prompts of Alexandria';
  button.onclick = () => alexandriaPanel.toggle();

  toolbar.appendChild(button);
}

// Initialize on app ready
app.registerExtension({
  name: 'Alexandria',
  async setup() {
    mountAlexandriaButton();
  }
});
```

---

### Main Panel Design

**Opened via toolbar button or Control Node's "Open" button.**

```
┌──────────────────────────────────────────────────────────────────────┐
│  📜 Prompts of Alexandria                                       [X]  │
├────────────────────────────┬─────────────────────────────────────────┤
│                            │                                         │
│  TEMPLATES                 │  DETECTED PROMPTS                       │
│  ─────────────────────     │  ─────────────────────────────────────  │
│                            │                                         │
│  ● Scene One               │  ☑ CLIPTextEncode #3 "Positive"        │
│    5 prompts │ 2 min ago   │    ├─ text (95% - link trace)          │
│                            │    │  "a beautiful sunset over..."      │
│  ○ Scene Two               │    │                                    │
│    5 prompts │ 1 hr ago    │  ☑ CLIPTextEncode #4 "Negative"        │
│                            │    ├─ text (95% - link trace)          │
│  ○ Character Test          │    │  "blurry, low quality..."          │
│    3 prompts │ 1 day ago   │    │                                    │
│                            │  ☑ WildcardEncode #7                    │
│  [+ New Template]          │    ├─ text (90% - known node)          │
│                            │    │  "__character__, standing..."      │
│  ─────────────────────     │    │                                    │
│                            │  ☑ RegionalPrompt #12                   │
│  SETTINGS                  │    ├─ prompt (75% - widget name)       │
│  ─────────────────────     │    │  "detailed face, expression"       │
│                            │    │                                    │
│  Retention:                │  ─────────────────────────────────────  │
│  [Keep last 20 ▼] versions │                                         │
│                            │  OTHER WIDGETS (click to include)       │
│  Auto-delete after:        │  ─────────────────────────────────────  │
│  [30 days       ▼]         │                                         │
│                            │  ○ KSampler #15 "Main"                  │
│  [Export Library]          │    ├─ seed: 12345678                    │
│  [Import Library]          │    ├─ steps: 20                         │
│                            │    ├─ cfg: 7.5                          │
│                            │    └─ ...                               │
│                            │                                         │
│                            │  ○ LoadCheckpoint #1                    │
│                            │    └─ ckpt_name: "sd_xl_base..."        │
│                            │                                         │
├────────────────────────────┴─────────────────────────────────────────┤
│                                                                      │
│  [Load Selected Template]              [Save Current as New]         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Panel Features

**Left Column - Templates**
- List of saved templates with metadata
- Click to select (radio button style)
- Shows prompt count and age
- "New Template" creates blank slot
- Settings section at bottom

**Right Column - Prompts/Widgets**
- **Top section**: Auto-detected prompts with checkboxes
  - Shows node title (user's name) and ID
  - Shows widget name and detection confidence
  - Shows preview of value (truncated)
  - Checkbox to include/exclude from backup

- **Bottom section**: All other widgets (collapsed by default)
  - Expandable nodes showing all widgets
  - Click checkbox to include in backup
  - Becomes "manual selection" (100% confidence)

**Settings**
- **Retention count**: Keep last N versions per template
- **Auto-delete**: Delete versions older than N days
- **Import/Export**: Full library JSON

---

### Widget Browser (Phase 1 Focus)

**Dedicated UI for exploring all nodes and widgets in the current workflow.**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browse Workflow Widgets                                        [X]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Search: [________________________] [Filter: All Types ▼]            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  📦 CLIPTextEncode #3 "Positive Prompt"                        │  │
│  │  ├── ☑ text: "a beautiful sunset over the ocean, golden..."   │  │
│  │  │        (95% confidence - backward link tracing)             │  │
│  │  │        [View Full] [Copy]                                   │  │
│  │  └── Type: CLIPTextEncode │ Position: (234, 156)               │  │
│  │                                                                │  │
│  │  ──────────────────────────────────────────────────────────    │  │
│  │                                                                │  │
│  │  📦 CLIPTextEncode #4 "Negative Prompt"                        │  │
│  │  ├── ☑ text: "blurry, low quality, watermark, text, ugly..."  │  │
│  │  │        (95% confidence - backward link tracing)             │  │
│  │  │        [View Full] [Copy]                                   │  │
│  │  └── Type: CLIPTextEncode │ Position: (234, 356)               │  │
│  │                                                                │  │
│  │  ──────────────────────────────────────────────────────────    │  │
│  │                                                                │  │
│  │  📦 KSampler #15 "Main Sampler"                                │  │
│  │  ├── ☐ seed: 12345678                                         │  │
│  │  ├── ☐ steps: 20                                              │  │
│  │  ├── ☐ cfg: 7.5                                               │  │
│  │  ├── ☐ sampler_name: "euler"                                  │  │
│  │  ├── ☐ scheduler: "normal"                                    │  │
│  │  ├── ☐ denoise: 1.0                                           │  │
│  │  └── Type: KSampler │ Position: (634, 256)                     │  │
│  │                                                                │  │
│  │  ──────────────────────────────────────────────────────────    │  │
│  │                                                                │  │
│  │  📦 WildcardEncode #7 "Character Prompt"                       │  │
│  │  ├── ☑ text: "__character__, standing in a field of..."       │  │
│  │  │        (90% confidence - known node type)                   │  │
│  │  │        [View Full] [Copy]                                   │  │
│  │  └── Type: WildcardEncode │ Position: (234, 556)               │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ──────────────────────────────────────────────────────────────────  │
│                                                                      │
│  LEGEND                                                              │
│  ☑ = Included in backup   ☐ = Not included (click to add)           │
│                                                                      │
│  Selected: 4 prompts, 0 other widgets                                │
│                                                                      │
│  [Select All Detected]  [Clear Selection]          [Done]            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Widget Browser Features

1. **Search** - Filter by node title, type, or widget value
2. **Type filter** - Show only certain node types
3. **Expandable nodes** - Each node shows all its widgets
4. **Checkbox selection** - Check widgets to include in backups
5. **Confidence display** - Shows detection method and confidence
6. **View Full** - Modal to see full prompt text
7. **Copy** - Copy widget value to clipboard
8. **Node metadata** - Type, position for identification

---

## Template & Storage System

### Template Schema v2

```typescript
interface Template {
  id: string;                    // UUID
  name: string;                  // "Scene One"
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp

  // Version history for retention
  versions: TemplateVersion[];

  // Current version pointer
  currentVersionIndex: number;
}

interface TemplateVersion {
  id: string;                    // UUID
  timestamp: string;             // ISO timestamp
  hash: string;                  // Content hash for diff detection
  entries: TemplateEntry[];
}

interface TemplateEntry {
  // Matching criteria (multiple for resilience)
  nodeType: string;              // "CLIPTextEncode" (most stable)
  nodeTitle: string;             // User's custom title (can change)
  nodeId: number;                // Runtime ID (least stable, but fastest)
  widgetName: string;            // "text"

  // Value
  value: any;                    // The actual widget value
  valueType: string;             // "string", "number", "boolean", etc.

  // Metadata
  detectionMethod: string;       // "backward_link_tracing", "known_node_type", etc.
  confidenceScore: number;       // 0-100
}
```

### Storage Keys

```javascript
const STORAGE = {
  TEMPLATES: 'alexandria_templates',        // Main template library
  MANUAL_SELECTIONS: 'alexandria_manual',   // User include/exclude overrides
  SETTINGS: 'alexandria_settings',          // Retention, preferences
};
```

### Retention System

```javascript
interface Settings {
  retention: {
    maxVersionsPerTemplate: number;  // Default: 20
    maxAgeDays: number;              // Default: 30 (0 = never delete)
  };
}

function applyRetention(template) {
  const settings = getSettings();
  const now = Date.now();

  // Remove old versions
  template.versions = template.versions.filter((v, i) => {
    // Always keep current version
    if (i === template.currentVersionIndex) return true;

    // Check age
    const ageDays = (now - new Date(v.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (settings.retention.maxAgeDays > 0 && ageDays > settings.retention.maxAgeDays) {
      return false;
    }

    return true;
  });

  // Trim to max count (keep newest)
  while (template.versions.length > settings.retention.maxVersionsPerTemplate) {
    // Remove oldest that isn't current
    const oldestIndex = template.versions.findIndex((v, i) =>
      i !== template.currentVersionIndex
    );
    if (oldestIndex >= 0) {
      template.versions.splice(oldestIndex, 1);
      // Adjust current index if needed
      if (template.currentVersionIndex > oldestIndex) {
        template.currentVersionIndex--;
      }
    } else {
      break;
    }
  }
}
```

### Auto-Diff Detection

```javascript
function computeTemplateHash(entries) {
  // Sort entries for consistent ordering
  const sorted = [...entries].sort((a, b) => {
    const keyA = `${a.nodeType}:${a.nodeTitle}:${a.widgetName}`;
    const keyB = `${b.nodeType}:${b.nodeTitle}:${b.widgetName}`;
    return keyA.localeCompare(keyB);
  });

  // Create hash of values
  const content = sorted.map(e =>
    `${e.nodeType}|${e.widgetName}|${JSON.stringify(e.value)}`
  ).join('\n');

  return simpleHash(content);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function shouldSaveNewVersion(template, newEntries) {
  if (template.versions.length === 0) return true;

  const currentVersion = template.versions[template.currentVersionIndex];
  const newHash = computeTemplateHash(newEntries);

  return newHash !== currentVersion.hash;
}
```

---

## Restoration Logic

### Automatic Conflict Resolution

**Simple rule**: If node exists → restore. If node doesn't exist → skip silently.

```javascript
async function restoreTemplate(template) {
  const version = template.versions[template.currentVersionIndex];
  const graph = app.graph;
  const results = { restored: [], skipped: [], failed: [] };

  for (const entry of version.entries) {
    const node = findMatchingNode(entry, graph._nodes);

    if (!node) {
      // Node doesn't exist - skip silently (automatic conflict resolution)
      results.skipped.push(entry);
      continue;
    }

    const widget = node.widgets?.find(w => w.name === entry.widgetName);

    if (!widget) {
      // Widget doesn't exist on node - skip
      results.skipped.push(entry);
      continue;
    }

    try {
      // Restore the value
      widget.value = entry.value;

      // Trigger node update
      if (widget.callback) widget.callback(widget.value);
      node.setDirtyCanvas(true);

      results.restored.push(entry);
    } catch (e) {
      results.failed.push({ entry, error: e.message });
    }
  }

  return results;
}
```

### Node Matching Strategy

**Priority order for finding the right node:**

```javascript
function findMatchingNode(entry, nodes) {
  // Strategy 1: Exact ID match (fastest, but IDs can change)
  let match = nodes.find(n => n.id === entry.nodeId);
  if (match && match.type === entry.nodeType) {
    return match;
  }

  // Strategy 2: Type + Title match (handles renamed nodes... if user kept title)
  match = nodes.find(n =>
    n.type === entry.nodeType &&
    (n.title || n.type) === entry.nodeTitle
  );
  if (match) {
    return match;
  }

  // Strategy 3: Type + widget name + unique (only one node of this type)
  const typeMatches = nodes.filter(n => n.type === entry.nodeType);
  if (typeMatches.length === 1) {
    return typeMatches[0];
  }

  // Strategy 4: Type + position proximity (for duplicated nodes)
  // Future enhancement: store position and find nearest

  // No match found
  return null;
}
```

### Handling Renamed Nodes

Users rename nodes all the time. Our matching handles this:

1. **Node title stored at save time** - We capture whatever the user named it
2. **Match by type + title first** - If user kept the same name, we find it
3. **Fall back to type-only** - If only one node of that type exists, use it
4. **Skip if ambiguous** - Multiple nodes of same type with different names? Skip.

**Key insight**: We store `nodeTitle` at save time. If user renames the node AFTER saving but BEFORE restoring, we won't find it by title... but we might by type if it's unique.

---

## Implementation Phases

### Phase 1: Detection Engine & Widget Browser UI (THIS PHASE)

**Goal**: Build the detection system and UI for viewing/selecting widgets.

**Deliverables**:
- [ ] Detection pipeline implementation (all 7 methods)
- [ ] Widget browser UI panel
- [ ] Node listing with expandable widget views
- [ ] Checkbox selection for include/exclude
- [ ] Confidence score display
- [ ] Manual selection persistence (localStorage)
- [ ] Basic toolbar button mounting

**Files to Create**:
```
prompts-of-alexandria/
├── __init__.py                          # ComfyUI registration
├── web/
│   └── js/
│       ├── alexandria_main.js           # Extension entry point
│       ├── detection_engine.js          # All detection methods
│       ├── widget_browser.js            # Widget browser UI
│       └── storage.js                   # LocalStorage helpers
```

**Success Criteria**:
- User can click button, see all nodes/widgets
- Auto-detected prompts are highlighted with confidence
- User can check/uncheck widgets to include

### Phase 2: Template Save/Load

**Goal**: Actually save and restore templates.

**Deliverables**:
- [ ] Template data structure
- [ ] Save current selection to named template
- [ ] Load template and restore widgets
- [ ] Template list UI in panel
- [ ] Basic conflict resolution (skip missing nodes)

### Phase 3: Nodes & Auto-Save

**Goal**: Add the two nodes for workflow integration.

**Deliverables**:
- [ ] Alexandria Save Node (passthrough with auto-diff)
- [ ] Alexandria Control Node (buttons only)
- [ ] Auto-save on workflow execution
- [ ] Diff detection to prevent duplicates

### Phase 4: Retention & Polish

**Goal**: Production-ready quality.

**Deliverables**:
- [ ] Version history per template
- [ ] Retention settings UI
- [ ] Auto-cleanup of old versions
- [ ] Import/export JSON
- [ ] Status messages and feedback

---

## File Structure (Final)

```
prompts-of-alexandria/
├── __init__.py                          # ComfyUI node registration
├── nodes/
│   ├── save_node.py                     # Alexandria Save Node
│   └── control_node.py                  # Alexandria Control Node
├── web/
│   └── js/
│       ├── alexandria_main.js           # Extension entry, toolbar button
│       ├── detection_engine.js          # Multi-method prompt detection
│       ├── widget_browser.js            # Browse all widgets UI
│       ├── template_manager.js          # Save/load/list templates
│       ├── panel_ui.js                  # Main panel layout
│       ├── storage.js                   # LocalStorage abstraction
│       └── utils.js                     # Helpers
├── FIRST_DESIGN.md                      # This document
└── README.md                            # User documentation
```

---

## Appendix: Node Type Reference

### Samplers to Trace From

```javascript
const SAMPLER_NODES = [
  'KSampler',
  'KSamplerAdvanced',
  'SamplerCustom',
  'SamplerCustomAdvanced',
  'SamplerDPMPP_2M_SDE',
  // Add custom sampler nodes...
];
```

### Conditioning Combiners to Traverse

```javascript
const CONDITIONING_COMBINERS = [
  'ConditioningCombine',
  'ConditioningConcat',
  'ConditioningAverage',
  'ConditioningSetArea',
  'ConditioningSetAreaPercentage',
  'ConditioningSetMask',
  'ConditioningSetTimestepRange',
  'ControlNetApply',
  'ControlNetApplyAdvanced',
  'ControlNetApplySD3',
  'IPAdapterApply',
  'IPAdapterApplyAdvanced',
  'IPAdapterApplyFaceID',
  // Regional nodes
  'ConditioningSetAreaStrength',
  // Impact Pack
  'ImpactCombineConditionings',
  // Add more...
];
```

### Known Text Encoder Nodes

```javascript
const KNOWN_TEXT_ENCODERS = {
  // Core
  'CLIPTextEncode': ['text'],
  'CLIPTextEncodeSDXL': ['text_g', 'text_l'],
  'CLIPTextEncodeSDXLRefiner': ['text'],
  'CLIPTextEncodeSD3': ['text', 'text_g', 'text_l', 'text_t5xxl'],
  'CLIPTextEncodeFlux': ['text'],
  'CLIPTextEncodeHunyuanDiT': ['text'],
  'CLIPTextEncodeBLIP': ['text'],

  // Wildcards
  'WildcardEncode': ['text'],
  'ImpactWildcardEncode': ['wildcard_text', 'populated_text'],
  'ImpactWildcardProcessor': ['wildcard_text'],

  // Easy Use
  'easy positive': ['positive'],
  'easy negative': ['negative'],
  'easy wildcards': ['text'],

  // Comfy Roll
  'CR Prompt Text': ['prompt'],
  'CR Multi-Line Prompt': ['prompt'],
  'CR Simple Prompt List': ['prompt1', 'prompt2', 'prompt3', 'prompt4', 'prompt5'],

  // pysssss
  'ShowText|pysssss': ['text'],
  'StringFunction|pysssss': ['text'],

  // Efficiency
  'Efficient Loader': ['positive', 'negative'],
  'Eff. Loader SDXL': ['positive', 'negative'],

  // KJNodes
  'ShowText': ['text'],

  // ComfyUI-Advanced-ControlNet
  'ACN_AdvancedControlNetApply': [], // No prompts, but traverses conditioning

  // Add more as discovered...
};
```

---

*Document Version: 2.0*
*Last Updated: 2025-01-09*
*Authors: Claude & Samantha*
