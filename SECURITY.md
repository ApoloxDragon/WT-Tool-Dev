# Security policy

WT Session Readout is a **client-side only** tool: all processing happens in the user's browser and **nothing leaves the device** unless the user saves an export file themselves. Security reports are welcome and taken seriously, even though this is a small hobby project.

## What counts as a security problem
- Anything that makes user data (pasted logs, the archive, settings, exports) leave the browser, or that could.
- Cross-site scripting or any way text from a log, import file or saved setting can run as code or load something.
- Weakening or bypassing the Content-Security-Policy.
- A way for a crafted file to freeze, crash or fill the browser (zip bombs, runaway parsing, oversized data).
- Service-worker problems: caching something it shouldn't, taking over without the user clicking Reload, touching other sites' caches.
- Anything that quietly adds a third-party request, script, font or tracker.

## Not in scope
- Issues that need an attacker to already control the user's device or browser.
- Missing HTTP headers that a static GitHub Pages site cannot set (for example `frame-ancestors`, `Permissions-Policy`). These are known and listed in [docs/security-practices.md](docs/security-practices.md).
- Bugs in War Thunder, or wrong game numbers (use a normal issue for those).

## How to report
Use GitHub's **private vulnerability reporting** (the repository's *Security* tab → *Report a vulnerability*). If that is not available, open an issue titled "Security: please contact me" **without** technical details, and the owner will arrange a private channel. Please do not post exploits publicly before there is a fix.

Include: what you did, what happened, the browser/OS, and a minimal example file or text if you can. Never include real personal data.

## What to expect
This is a volunteer project: replies are best-effort, usually within a week or two. Fixes land on the Dev branch first. Credit is given if you want it.

## Supported versions
The **Dev** branch (this repository) and the stable release. Older copies of the site are not maintained.

## How security is built in
See [docs/security-practices.md](docs/security-practices.md) and the rules in [AGENTS.md](AGENTS.md). The `clientside` and `security` test suites check these properties on every run.
