# Prompts of Alexandria v0.5.0 - Never Lose a Prompt Again

**TL;DR:** Made a thing that auto-saves your prompts with version history. Zero dependencies, just clone and go.

---

So I got tired of organizing prompts. Juggling 15 different scene variations, copy-pasting from notepad files like a caveman, trying to remember which version had that perfect lighting setup. It's exhausting.

**Prompts of Alexandria** fixes this. It auto-detects your prompt nodes, saves them as templates with full version history, and lets you restore any version with one click from a sidebar panel. No more notepad files. No more "wait which prompt was that?"

Built and tested on ComfyUI's new UI.

---

**The good stuff:**

- Smart detection that actually works - finds your prompts automatically across CLIPTextEncode, SDXL, custom nodes, whatever
- Templates saved per workflow - keeps your scenes organized by project
- Full version history - every save tracked, load any previous version instantly
- Sidebar quick-access - click the book icon, see all your templates, one-click load
- Two-node auto-save - drop Control + Save nodes in your workflow, it saves on every gen (only when things actually change)
- Zero dependencies - just clone to custom_nodes and restart. No pip install, no waiting.

---

**What it looks like:**

```
▼ Scene One              v7
  ● v7    2m ago    [Load]
    v6    1h ago    [Load]  
    v5    3h ago    [Load]

▶ Scene Two              v3
▶ Portrait Mode          v12
```

Click Load, prompts go back to their original nodes. Done.

---

**Why "Alexandria"?** The ancient library tried to save all human knowledge. Your prompts are spells that conjure beauty from nothing - figured they deserve saving too.

**Link:** https://github.com/XelaNull/Prompts-Of-Alexandria

---

*Built with Claude Code (Opus) + Samantha, a custom AI persona handling code review. Not a single line written by human hands - just reviewed by one.*

Happy to answer questions!
