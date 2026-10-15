# Security practices

How the project protects you, why, and what is left. The guiding promise: **nothing leaves your device** unless you export it yourself ([Project rules](project-rules.md)).

The practices below follow widely used guidance, mainly from the **OWASP Cheat Sheet Series** (Content Security Policy, DOM-based XSS prevention, HTML5 security) and general GitHub repository hardening advice.

## What is in place

### 1. Nothing can phone home
- A strict **Content-Security-Policy** on every page denies everything by default and allows scripts, styles, images, connections and workers only from the site itself. Fonts, media, frames, plugins and manifests are denied outright. Even a mistake in the code could not send data to another address — the browser would refuse.
- **No form can submit** anywhere, and the page's base address can't be changed.
- The pages tell the browser **never to send a Referer** header, and the one external link (GitHub) opens with no access back to the page.
- **Automated tests** use both views for real while recording every request, fetch, beacon and socket, and scan the source for anything capable of reaching another site. See [Project rules](project-rules.md).

### 2. Untrusted text stays text
Everything from a log, a file or saved settings is escaped or built as plain text before it is shown. This follows OWASP's advice to prefer safe ways of putting text on a page. Hostile test logs (scripts, images, odd names) are part of the test suite.

### 3. Imports are rebuilt, not trusted
Each imported match is re-created from validated fields; bad entries are skipped and counted. Size limits protect against oversized files and "zip bomb" archives; parsing patterns are bounded so crafted text can't stall the page. The limits are listed in [Privacy and safety](privacy-and-safety.md#limits).

### 4. No third-party code
There are no libraries, frameworks, CDNs, trackers or fonts from elsewhere. That removes a whole class of supply-chain risk. The only dependency is the browser itself. (Test tooling is separate and never shipped.)

### 5. No powerful permissions
The site never asks for camera, microphone, location, notifications or similar, and never uses cookies. A test fails if code for those appears.

### 6. A careful offline cache
The service worker (offline copy) only handles same-origin GET requests inside its own folder, stores only the site's own files under a version name, only deletes caches carrying its own prefix, and never swaps versions while you work — you press **Reload**. A failed install leaves nothing behind. This follows OWASP's service-worker advice to restrict scope and keep it same-origin.

### 7. Exports are inert
An exported HTML report carries its own strict policy (nothing external, one nonce-tagged script) and no Referer. Exports contain only what you already see.

## Known limits and why
| Limit | Why it exists | What reduces the risk |
|---|---|---|
| **Policy is in a page tag, not an HTTP header** (GitHub Pages doesn't let a project set headers) | A page-tag policy can't set *frame-ancestors*, so the site could be shown inside someone else's frame ("clickjacking") | The tool performs no sensitive actions and sends nothing; nothing a framer could trick you into clicking leaves your device |
| **Inline styles are allowed** | The pages use some inline style attributes | Styles can't run code, and no external address can be loaded anyway |
| **Trusted Types not adopted** | The code builds pages with escaped text; enforcing Trusted Types would require rewriting much of the display code | Escaping and the policy are tested; it can be revisited |
| **Local storage isn't encrypted** | Browsers store site data in the clear for the logged-in user | Only match results are stored; no passwords or secrets. On a shared computer, use **Delete entire archive** or a private window |
| **The offline worker has a fixed file name** | It must stay at one address so updates can be found | It only runs the site's own code; see the recovery plan below |

## If the offline worker ever needs to be switched off
OWASP recommends having a documented way to remove a service worker. For this site: publish a new worker file at the same address that, when it installs, deletes the site's caches (the ones starting with the project's prefix) and unregisters itself; the next time people open the site, the old worker is replaced and the normal network loading resumes. Advanced users can also clear the site's data in their browser, which removes the worker and the offline copy (and the archive — export first).

## For the repository owner: GitHub settings worth switching on
These are settings only the owner can change:
- **Private vulnerability reporting** (Security tab) so reports reach you privately; the `SECURITY.md` file points people there.
- **Secret scanning with push protection**, so an accidental secret is blocked before it enters history (the site has no secrets and should never have any).
- **Branch protection on `main`**: require a pull request, block force pushes and deletion; require status checks if a test workflow is added.
- **Two-factor authentication** on the owner account (and on any collaborator's).
- **HTTPS enforced** in the GitHub Pages settings.
- **If a workflow is ever added:** give it the least permissions it needs and pin third-party actions to full commit identifiers. **Dependabot** only matters if dependencies are ever added (none are today).

## For users
- Export a raw backup now and then; keep it somewhere you trust. Exports contain your match results.
- On a shared device, delete the archive when done or use a private window.
- Only import files you made or trust.
- Report anything odd privately, as described in the policy in **SECURITY.md**.

## Sources
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [OWASP DOM based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP Clickjacking Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html)
- [GitHub Blog: 6 security settings every maintainer should enable](https://github.blog/security/6-security-settings-every-github-maintainer-should-enable-this-week/)
