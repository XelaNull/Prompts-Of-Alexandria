# Prompts of Alexandria v0.5.0 - Never Lose a Prompt Again

**TL;DR:** Made a thing that auto-saves your prompts with version history. Zero dependencies, just clone and go.

---

So I got tired of losing prompts. You know the feeling - you spend 20 minutes getting that prompt *just right*, tweak one thing, queue another gen... and accidentally paste over it. Gone forever.

Or worse - you're juggling 15 different scene prompts and switching between them means digging through notepad files like a caveman.

**Prompts of Alexandria** fixes this. It auto-detects your prompt nodes, saves them as templates with full version history, and lets you restore any version with one click from a sidebar panel.

---

**The good stuff:**

- Smart detection that actually works - finds your prompts automatically across CLIPTextEncode, SDXL, custom nodes, whatever
- Full version history - overwrote something? just load the previous version
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
