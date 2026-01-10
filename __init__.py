"""
Prompts of Alexandria - ComfyUI Extension
Template-based backup and restoration of text prompts across workflows.

Phase 1: Detection engine and widget browser UI
Phase 2: Template list, load/save/delete functionality
Phase 3: Alexandria Save Node and Control Node
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

# Extension info
__version__ = "1.1.0"
__author__ = "Claude & Samantha"

# Web directory for frontend files (relative to this module)
WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
