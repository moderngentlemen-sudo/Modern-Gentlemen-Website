"""Use an explicit test browser, the existing CI Chromium, or Playwright's browser.

Does not reuse a user's browser profile. CHROMIUM_PATH is optional.
"""
from pathlib import Path
import os


def launch_chromium(playwright):
    executable = os.environ.get('CHROMIUM_PATH')
    if not executable and Path('/usr/bin/chromium').is_file():
        executable = '/usr/bin/chromium'
    options = {'headless': True, 'args': ['--no-sandbox']}
    if executable:
        options['executable_path'] = executable
    return playwright.chromium.launch(**options)
