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
import os
from pathlib import Path
from datetime import datetime

# Import server components safely
try:
    from server import PromptServer
    from aiohttp import web
    SERVER_AVAILABLE = True
except ImportError:
    SERVER_AVAILABLE = False
    print("Alexandria: PromptServer not available - nodes will have limited functionality")

# Default storage directory (relative to ComfyUI root)
DEFAULT_STORAGE_DIR = "alexandria_templates"

# Global storage directory (can be updated by Control node)
_current_storage_dir = None

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
    Templates are stored on the ComfyUI server for cross-PC access.
    Outputs template_name and timestamp for chaining or display.

    Inputs:
        - template_name: Name from connected node (e.g., Control Panel)
        - name_override: When enabled, use override_name instead of template_name
        - override_name: Custom name to use when name_override is enabled
        - path_override: When enabled, use custom_path instead of default
        - custom_path: Custom storage directory (when path_override is enabled)

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
                "path_override": ("BOOLEAN", {"default": False}),
                "custom_path": ("STRING", {
                    "default": DEFAULT_STORAGE_DIR,
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

    def execute(self, template_name, name_override, override_name, path_override, custom_path, unique_id=None):
        """
        Trigger a save and return template info.
        Templates are always saved to server file storage for cross-PC access.
        """
        global _current_storage_dir
        timestamp = datetime.now().isoformat()

        # Use override name if enabled, otherwise use the input template_name
        actual_name = override_name if name_override else template_name

        # Use custom path if override enabled, otherwise use default
        storage_dir = custom_path if path_override and custom_path else DEFAULT_STORAGE_DIR
        _current_storage_dir = storage_dir

        # Ensure the storage directory exists
        storage_path = Path(storage_dir)
        if not storage_path.is_absolute():
            storage_path = Path(os.getcwd()) / storage_path

        try:
            storage_path.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"Alexandria: Could not create storage directory {storage_path}: {e}")

        _send_to_frontend("alexandria.trigger_save", {
            "node_id": unique_id,
            "template_name": actual_name,
            "timestamp": timestamp,
            "storage_directory": str(_get_storage_path()),
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


# ============ File Storage Helper Functions ============

def _get_storage_path():
    """Get the current storage directory as an absolute Path."""
    global _current_storage_dir
    storage_dir = _current_storage_dir or DEFAULT_STORAGE_DIR
    storage_path = Path(storage_dir)
    if not storage_path.is_absolute():
        storage_path = Path(os.getcwd()) / storage_path
    return storage_path


def _sanitize_filename(name):
    """Sanitize a template name for use as a filename."""
    # Remove/replace invalid filename characters
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '_')
    return name.strip()


def _save_template_to_file(template_data):
    """Save a template to a JSON file in the storage directory."""
    storage_path = _get_storage_path()
    storage_path.mkdir(parents=True, exist_ok=True)

    template_name = template_data.get('name', 'Unnamed')
    safe_name = _sanitize_filename(template_name)
    file_path = storage_path / f"{safe_name}.json"

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(template_data, f, indent=2, ensure_ascii=False)

    return str(file_path)


def _load_templates_from_directory():
    """Load all templates from the storage directory."""
    storage_path = _get_storage_path()

    if not storage_path.exists():
        return []

    templates = []
    for file_path in storage_path.glob("*.json"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                template = json.load(f)
                # Ensure template has required fields
                if 'name' not in template:
                    template['name'] = file_path.stem
                if 'id' not in template:
                    template['id'] = hashlib.md5(file_path.stem.encode()).hexdigest()[:16]
                template['_file_path'] = str(file_path)
                templates.append(template)
        except Exception as e:
            print(f"Alexandria: Error loading template {file_path}: {e}")

    return templates


def _delete_template_file(template_name):
    """Delete a template file from the storage directory."""
    storage_path = _get_storage_path()
    safe_name = _sanitize_filename(template_name)
    file_path = storage_path / f"{safe_name}.json"

    if file_path.exists():
        file_path.unlink()
        return True
    return False


# ============ API Routes ============

if SERVER_AVAILABLE:
    routes = PromptServer.instance.routes

    @routes.get("/alexandria/storage-dir")
    async def get_storage_dir(request):
        """Get the current storage directory."""
        storage_path = _get_storage_path()
        return web.json_response({
            "status": "ok",
            "storage_directory": str(storage_path),
            "exists": storage_path.exists()
        })

    @routes.post("/alexandria/storage-dir")
    async def set_storage_dir(request):
        """Set the storage directory."""
        global _current_storage_dir
        try:
            data = await request.json()
            new_dir = data.get("storage_directory", DEFAULT_STORAGE_DIR)
            _current_storage_dir = new_dir

            storage_path = _get_storage_path()
            storage_path.mkdir(parents=True, exist_ok=True)

            return web.json_response({
                "status": "ok",
                "storage_directory": str(storage_path)
            })
        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            })

    @routes.get("/alexandria/templates")
    async def get_templates(request):
        """Get all templates from the storage directory."""
        try:
            templates = _load_templates_from_directory()
            return web.json_response({
                "status": "ok",
                "templates": templates,
                "count": len(templates),
                "storage_directory": str(_get_storage_path())
            })
        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            })

    @routes.post("/alexandria/templates/save")
    async def save_template_to_file(request):
        """Save a template to a file."""
        try:
            template_data = await request.json()

            if not template_data.get('name'):
                return web.json_response({
                    "status": "error",
                    "message": "Template name is required"
                })

            # Add timestamp if not present
            if 'updatedAt' not in template_data:
                template_data['updatedAt'] = datetime.now().isoformat()
            if 'createdAt' not in template_data:
                template_data['createdAt'] = template_data['updatedAt']

            file_path = _save_template_to_file(template_data)

            return web.json_response({
                "status": "ok",
                "message": f"Template saved to {file_path}",
                "file_path": file_path
            })

        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            })

    @routes.post("/alexandria/templates/delete")
    async def delete_template_file(request):
        """Delete a template file."""
        try:
            data = await request.json()
            template_name = data.get("name")

            if not template_name:
                return web.json_response({
                    "status": "error",
                    "message": "Template name is required"
                })

            if _delete_template_file(template_name):
                return web.json_response({
                    "status": "ok",
                    "message": f"Template '{template_name}' deleted"
                })
            else:
                return web.json_response({
                    "status": "error",
                    "message": f"Template '{template_name}' not found"
                })

        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            })

    @routes.post("/alexandria/templates/sync")
    async def sync_templates(request):
        """
        Sync templates between browser localStorage and file storage.
        Accepts templates from browser and merges with file storage.
        """
        try:
            data = await request.json()
            browser_templates = data.get("templates", [])

            # Load existing file templates
            file_templates = _load_templates_from_directory()
            file_template_names = {t['name'] for t in file_templates}

            # Save any browser templates not in files
            saved_count = 0
            for template in browser_templates:
                if template.get('name') and template['name'] not in file_template_names:
                    _save_template_to_file(template)
                    saved_count += 1

            # Return all templates (merged)
            all_templates = _load_templates_from_directory()

            return web.json_response({
                "status": "ok",
                "templates": all_templates,
                "saved_count": saved_count,
                "total_count": len(all_templates)
            })

        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            })

    @routes.post("/alexandria/save")
    async def save_template(request):
        """
        API endpoint for saving templates from nodes.
        Used for server-side diff detection to avoid duplicate saves.
        Also saves to file storage.
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

            # Also save to file
            template_data = {
                "name": template_name,
                "entries": entries,
                "hash": new_hash,
                "updatedAt": datetime.now().isoformat(),
            }
            file_path = _save_template_to_file(template_data)

            return web.json_response({
                "status": "ok",
                "template_name": template_name,
                "hash": new_hash,
                "entry_count": len(entries),
                "file_path": file_path
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
