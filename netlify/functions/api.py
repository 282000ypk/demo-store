import sys
import os

# Make the project root importable so we can import app.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from serverless_wsgi import handle_request
import app as flask_module


def handler(event, context):
    return handle_request(flask_module.app, event, context)
