"""
Prompts of Alexandria - ComfyUI Nodes
Phase 3: Save Node (passthrough with auto-save) and Control Node (buttons)

Nodes:
- AlexandriaSave: Passthrough for conditioning pairs, triggers save on execution
- AlexandriaSaveGeneric: Generic passthrough for any data type
- AlexandriaControl: Control panel with buttons (Save Now, Load, Open Panel)
- AlexandriaLoad: Triggers template load when workflow executes
"""

import json
import hashlib

# Import server components safely
try:
    from server import PromptServer
    from aiohttp import web
    SERVER_AVAILABLE = True
except ImportError:
    SERVER_AVAILABLE = False
    print("Alexandria: PromptServer not available - nodes will have limited functionality")

# Store for tracking template state (used for diff detection)
# Note: This is server-side only, templates are stored in browser localStorage
# Limited to MAX_TEMPLATE_STATE_ENTRIES to prevent memory leak over long sessions
_template_state = {}
MAX_TEMPLATE_STATE_ENTRIES = 200


def _evict_oldest_template_state():
    """Evict oldest entries if over limit to prevent memory leak."""
    global _template_state
    if len(_template_state) > MAX_TEMPLATE_STATE_ENTRIES:
        # Remove oldest 20% when over limit
        to_remove = len(_template_state) - int(MAX_TEMPLATE_STATE_ENTRIES * 0.8)
        keys_to_remove = list(_template_state.keys())[:to_remove]
        for key in keys_to_remove:
            del _template_state[key]
        print(f"Alexandria: Evicted {to_remove} old template state entries")


def _send_to_frontend(event_type: str, data: dict) -> bool:
    """
    Safely send a message to the frontend via WebSocket.
    Returns True if sent, False if server unavailable.
    """
    if not SERVER_AVAILABLE or not hasattr(PromptServer, 'instance') or PromptServer.instance is None:
        print(f"Alexandria: Cannot send {event_type} - server not available")
        return False

    try:
        PromptServer.instance.send_sync(event_type, data)
        return True
    except Exception as e:
        print(f"Alexandria: Failed to send {event_type}: {e}")
        return False


class AlexandriaSaveNode:
    """
    Save node that triggers template saves when executed.
    Outputs template_name and timestamp for chaining or display.

    Inputs:
        - template_name: Name from connected node (e.g., Control Panel)
        - name_override: When enabled, use override_name instead of template_name
        - override_name: Custom name to use when name_override is enabled

    Outputs:
        - template_name: The actual template name used (for chaining)
        - timestamp: ISO timestamp of when the save was triggered
    """

    CATEGORY = "Alexandria"
    FUNCTION = "execute"
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("template_name", "timestamp")
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "template_name": ("STRING", {
                    "forceInput": True,
                }),
                "name_override": ("BOOLEAN", {"default": False}),
                "override_name": ("STRING", {
                    "default": "My Override Name",
                    "multiline": False,
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Always execute to ensure save triggers
        return float("nan")

    def execute(self, template_name, name_override, override_name, unique_id=None):
        """
        Trigger a save and return template info.
        The actual save is handled via the frontend after execution.
        """
        import datetime
        timestamp = datetime.datetime.now().isoformat()

        # Use override name if enabled, otherwise use the input template_name
        actual_name = override_name if name_override else template_name

        _send_to_frontend("alexandria.trigger_save", {
            "node_id": unique_id,
            "template_name": actual_name,
            "timestamp": timestamp,
        })
        return (actual_name, timestamp)


class AlexandriaControlNode:
    """
    Control panel node with buttons for quick template operations.
    Outputs template_name so it can be connected to Save/Load nodes.

    The frontend adds Save Now, Load Template, and Open Panel buttons.
    """

    CATEGORY = "Alexandria"
    FUNCTION = "execute"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("template_name",)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "template_name": ("STRING", {
                    "default": "My Template",
                    "multiline": False,
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Always consider changed so buttons work on re-execution
        return float("nan")

    def execute(self, template_name, unique_id=None):
        # Output template_name so it can be connected to other Alexandria nodes
        return (template_name,)


# ============ API Routes ============

if SERVER_AVAILABLE:
    routes = PromptServer.instance.routes

    @routes.get("/alexandria/templates")
    async def get_templates(request):
        """
        Get templates endpoint - delegates to frontend localStorage.
        This endpoint exists for potential future server-side storage.
        """
        return web.json_response({
            "status": "ok",
            "message": "Templates are stored in browser localStorage. Use frontend API."
        })

    @routes.post("/alexandria/save")
    async def save_template(request):
        """
        API endpoint for saving templates from nodes.
        Used for server-side diff detection to avoid duplicate saves.
        """
        try:
            data = await request.json()
            template_name = data.get("template_name", "Unnamed")
            entries = data.get("entries", [])

            if not entries:
                return web.json_response({
                    "status": "error",
                    "message": "No entries provided"
                })

            # Compute hash for diff detection
            content = json.dumps(entries, sort_keys=True)
            new_hash = hashlib.md5(content.encode()).hexdigest()

            # Check if content changed
            if template_name in _template_state:
                if _template_state[template_name] == new_hash:
                    return web.json_response({
                        "status": "skipped",
                        "message": "No changes detected"
                    })

            _template_state[template_name] = new_hash
            _evict_oldest_template_state()  # Prevent memory leak

            return web.json_response({
                "status": "ok",
                "template_name": template_name,
                "hash": new_hash,
                "entry_count": len(entries)
            })

        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            })


# ============ Node Registration ============

NODE_CLASS_MAPPINGS = {
    "AlexandriaSave": AlexandriaSaveNode,
    "AlexandriaControl": AlexandriaControlNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AlexandriaSave": "Alexandria Save",
    "AlexandriaControl": "Alexandria Control Panel",
}

# Print load confirmation
print("Alexandria: Nodes registered - Save, Control")
