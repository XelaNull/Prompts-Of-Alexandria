# Prompts of Alexandria v0.5.0 - Sharing a tool I built for managing prompts

**TL;DR:** Got tired of notepad files, built a prompt organizer with version history. Zero dependencies, works on the new UI.

---

I got tired of organizing prompts. I've got like 15 different scene variations I rotate through, and I was copy-pasting from notepad files like a caveman, trying to remember which version had that perfect lighting setup.

So I built **Prompts of Alexandria** to solve it for myself.

Now I just click the book icon in the sidebar, pick a template, hit Load, and all my prompts go back to their original nodes. When I'm iterating, every change gets versioned automatically - so if I realize v5 was better than v7, I just load v5.

Built and tested on ComfyUI's new UI.

---

**What it does for me:**

- Auto-detects my prompt nodes so I don't have to manually track them
- Keeps templates organized per workflow - my portrait project doesn't mix with my landscape stuff
- Versions everything - I can always go back to what was working
- Auto-saves when I generate (only when something actually changes)
- Lives in the sidebar so it's always one click away

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

---

**Why "Alexandria"?** The ancient library tried to save all human knowledge. Prompts are spells that conjure beauty from nothing - figured they deserve saving too.

**Link:** https://github.com/XelaNull/Prompts-Of-Alexandria

Zero dependencies - just clone to custom_nodes and restart.

---

*Built with Claude Code (Opus) + Samantha, a custom AI persona handling code review. Not a single line written by human hands - just reviewed by one.*

Happy to answer questions if anyone finds it useful!
