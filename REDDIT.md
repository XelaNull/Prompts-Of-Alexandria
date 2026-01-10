# Prompts of Alexandria v0.5.0 - Never Lose a Prompt Again

**TL;DR:** A ComfyUI extension that automatically detects and saves your prompts as versioned templates. Quick-access sidebar panel, one-click restore, and server-side storage so you never lose your work.

---

## The Problem

You've spent 20 minutes crafting the perfect prompt. The lighting is *chef's kiss*. The composition nails that exact vibe you wanted. You tweak one parameter, queue another generation... and accidentally paste over your prompt.

Gone. Forever.

Or maybe you're like me - you have 15 different "scene" prompts you rotate through, and switching between them means copy-pasting from a notepad file like some kind of caveman.

## The Solution: Prompts of Alexandria

**Prompts of Alexandria** is a ComfyUI extension that:

1. **Automatically detects** all your prompt widgets (CLIP text encoders, custom prompt nodes, etc.)
2. **Saves them as templates** with full version history
3. **Restores them with one click** from a convenient sidebar panel

### Key Features

**Smart Detection** - Uses 7 different methods to find your prompts, including tracing backwards from your KSampler. Works with CLIPTextEncode, SDXL encoders, and most custom prompt nodes.

**Version History** - Every save creates a new version. Accidentally overwrote your masterpiece? Just load the previous version. It's all there.

**Quick-Access Sidebar** - Click the book icon in ComfyUI's sidebar for instant access:
- See all your templates at a glance
- Collapsible sections keep things organized  
- Load any version with one click
- Current template auto-expands based on your workflow

**Server-Side Storage** - Templates saved as JSON files on disk. No more localStorage limits. Back them up with your ComfyUI folder.

**Zero Dependencies** - Just drop it in custom_nodes and go. No pip installs, no waiting for packages. Pure Python standard library + ComfyUI built-ins.

**Workflow Nodes** - Drop an "Alexandria Control" node into your workflow. It auto-saves your prompts every time you generate. Set it and forget it.

### How It Works

1. Install the extension (git clone to custom_nodes)
2. Click the book icon in the sidebar
3. Click "Open Full Panel" → "Browse Widgets" 
4. Your prompts are auto-detected and checked
5. Hit "Save as Template" and name it
6. Done! Load it anytime from the sidebar

### Demo

The sidebar shows your templates with version history:

```
▼ Scene One              v7
  ● v7    2m ago    [Load]
    v6    1h ago    [Load]  
    v5    3h ago    [Load]

▶ Scene Two              v3
▶ Portrait Mode          v12
```

Click any "Load" button and your prompts are instantly restored to the workflow. The current template (from your Control node) auto-expands so you always see your active scene.

### Why "Alexandria"?

The ancient Library of Alexandria sought to preserve all human knowledge. Your prompts are spells that conjure beauty from nothing - they deserve to be saved too.

---

**GitHub:** https://github.com/XelaNull/Prompts-Of-Alexandria

**Installation:**
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/XelaNull/Prompts-Of-Alexandria.git
```
Restart ComfyUI.

---

*Created by Claude & Samantha - two AI assistants who believe your creative work deserves to be preserved. Not a single line written by human hands.*

Let me know if you have questions or run into issues!
