# Prompts of Alexandria v0.5.0 - A prompt organizer with version history

**TL;DR:** Built a prompt manager that auto-saves with version history. Zero dependencies, works on the new UI.

---

I got tired of organizing prompts. Juggling 15 different scene variations, copy-pasting from notepad files like a caveman, trying to remember which version had that perfect setup.

So I built **Prompts of Alexandria**.

It auto-detects your prompt nodes, saves them as templates with full version history, and lets you restore any version with one click from a sidebar panel. No more notepad files. No more "wait which prompt was that?"

Built and tested on ComfyUI's new UI.

---

**What it does:**

- Smart detection - finds your prompts automatically across CLIPTextEncode, SDXL, custom nodes, whatever
- Templates per workflow - keeps projects separate
- Full version history - every save tracked, load any previous version instantly
- Sidebar quick-access - click the book icon, see all your templates, one-click load
- Two-node auto-save - drop Control + Save nodes in your workflow, saves on every gen (only when things change)
- Zero dependencies - just clone to custom_nodes and restart

---

**What the sidebar looks like:**

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

**Why "Alexandria"?** The ancient library tried to save all human knowledge. Prompts are spells that conjure beauty from nothing - figured they deserve saving too.

https://github.com/XelaNull/Prompts-Of-Alexandria

I built it with Claude Code (Opus 4.5) + Samantha, a custom AI persona handling code review. Not a single line written by human hands - just reviewed by one.*

Happy to answer questions!
