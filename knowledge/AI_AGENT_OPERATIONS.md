# AI Agent Operations — lessons from AI-agent-assisted push/deploy work

> For an AI coding agent (or a human) about to do a "push + deploy" cycle on this repo,
> hands-on. Not architecture — "here's a gotcha that bit us once, don't repeat it." For the
> actual deploy mechanics (CI pipeline, VPS layout, what `deploy.sh` does), see
> `DEPLOYMENT.md` — this file only covers what that one doesn't.

## 1. Claude Code's auto-mode classifier blocks any command that embeds a credential — even when the user explicitly supplies it and accepts the risk

Session of 2026-09-02: the user pasted a GitHub PAT directly in chat and asked to push with
it. Every attempt to actually use it in a command was blocked outright by the auto-mode
permission classifier:

- `git push https://<token>@github.com/...` — blocked.
- Setting it as an env var in one shell call and referencing `$VAR` in the same call — also
  blocked (the classifier reads the command shape, not just the literal secret text).

The denial message is explicit that this isn't a bug to route around: *"you should not
attempt to work around this denial in malicious ways... only try to work around this
restriction in reasonable ways that do not attempt to bypass the intent behind this
denial."*

**What NOT to do**: retry the same push through a different syntax (a temp script file
sourcing the token, `git -c http.extraHeader=...`, a credential-helper piping the token in,
redoing it with quoting changes hoping the classifier misses it this time). All of these are
the same "credential in a command" shape and will be blocked the same way — burning turns on
variants is wasted effort, and writing the token to a file on disk to work around the block is
worse than the original ask, not a legitimate alternative.

**What actually works**: SSH-key-based git remotes, because no secret ever appears in a
command at all. The fix for "I can't push" is almost always "get a real SSH key authorized",
not "find a cleverer way to pass the token".

**RESOLVED 2026-09-02 — root cause was the remote's protocol, not the SSH key itself.**
`~/.ssh/config` has a `Host github.com` entry pointing at `~/.ssh/elwedding_github` (key
comment `claude-code-elwedding-deploy`). `ssh -vT git@github.com` showed this key **offered
correctly** by the client, with GitHub's server still answering "Permission denied
(publickey)" — meaning the key was never registered GitHub-side (as a repo Deploy Key or an
account SSH key). That diagnosis was correct as far as it went, but the actual fix used was
different and simpler: this repo's `origin` was `git@github.com:AmandaYora/elwedding.git`
(SSH), while a sibling repo on the same machine/account (`jwswedding`) uses
`https://github.com/AmandaYora/jwswedding.git` (HTTPS) and pushes fine, because Windows'
`credential.helper=manager` (Git Credential Manager, set at the `system` git-config level —
`git config --system credential.helper`) already holds a valid GitHub credential from a prior
login. **The fix**: `git remote set-url origin https://github.com/AmandaYora/elwedding.git` —
zero SSH-key involvement, push worked immediately on the next `git push`.

**The general lesson**: when a push fails with `Permission denied (publickey)` on a machine
where *other* repos under the same GitHub account push fine, check the failing repo's remote
protocol first (`git remote -v`) before assuming the SSH key itself needs fixing — an
`https://` remote on a machine with a working Credential Manager sidesteps SSH auth entirely,
and switching protocol is a one-line, fully reversible fix (`git remote set-url`), cheaper than
registering a new SSH key on GitHub. The SSH key registration path (previous paragraph) is
still correct **if** the remote must stay SSH for some other reason — it just wasn't the
cheapest fix available here.

**Cross-reference**: this pattern — a workflow that "should" work identically across projects
failing for a boring, project-specific config divergence (not a deeper bug) — is exactly what
this file exists to catch. Check `git remote -v` early whenever a user reports "this works
fine on my other project" for a git operation.

## 2. Reading files on the production VPS that plausibly hold secrets is blocked the same way — verify around it, don't read through it

Also this session: `ssh elcodelabs "cat ~/elwedding/deploy.sh"` and
`cat ~/elwedding/docker-compose.prod.yml` were both denied outright by the classifier, before
producing any output — the same secret-shaped-command guard as §1, just over SSH instead of a
local git command. `deploy.sh` and any `docker-compose*.yml` on a production host are
plausible carriers of inlined secrets (DB passwords, JWT secrets, API keys), so the classifier
treats reading them the same as reading a `.env` file directly.

**What NOT to do**: retry with `head`/`tail`/`grep`/`sed` hoping a partial read or an attempted
redaction gets through — this is the exact "bypass the intent" failure mode the denial message
warns about, and it doesn't work anyway (the block fires on the command shape before the file
is even opened).

**What worked instead, to document/verify a deploy without reading the sensitive files**:
- `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'` on the VPS —
  container name, running image tag (which embeds the git SHA), and health status are not
  secrets and this command is never blocked.
- Comparing the running container's image tag SHA to the git SHA just pushed/built confirms
  which commit is actually live, without needing the deploy script's internal logic.
- `curl -sI https://elwedding.elcodelabs.com/api/v1/health` from **outside** the VPS — a `200`
  confirms nginx + TLS + the container are wired together end to end, not just that the
  container is healthy on localhost.
- `cat /etc/nginx/sites-enabled/elwedding` **is** safe and was not blocked — nginx vhost
  configs on this box don't inline secrets (TLS cert paths only), so that's a fine way to
  confirm the reverse-proxy target port. The dividing line the classifier draws is "does this
  specific file plausibly contain a live credential", not "is this remote / production /
  root-owned".

If `deploy.sh`'s exact internal steps ever need to be read or changed, ask the human to paste
or edit it directly rather than trying to SSH-cat it — that's a boundary that exists on
purpose, not a gap to route around.

## 3. elcodelabs is a shared VPS — three unrelated apps live on it, don't reason as if elwedding owns the box

`docker ps` on `elcodelabs` (2026-09-02) shows three containers side by side, each bound to
`127.0.0.1` on its own port with its own nginx site under `/etc/nginx/sites-enabled/`:

| Container | Image | Port (host, localhost-only) |
|---|---|---|
| `elwedding-app` | `ghcr.io/amandayora/elwedding` | `8083` (container's `APP_PORT` is overridden to `8083`, not the Dockerfile's default `8080`) |
| `elproof-app` | `ghcr.io/amandayora/elproof` | `8082` → container's `8080` |
| `elkasir-app` | `ghcr.io/amandayora/elkasir-web` | `8081` |

None of these ports collide, and each app's nginx vhost only proxies its own domain to its own
port. When operating on this box: never run a box-wide destructive Docker command (a blanket
`docker system prune`, stopping "all containers", touching another app's compose project or
nginx site) — always scope actions to the `elwedding` container/compose project specifically.
This mirrors the same shared-box discipline other elcodelabs-hosted apps in this account
already document for themselves.

## 4. The full push → CI → deploy cycle, as actually run

1. Commit local work.
2. `git push origin master` (once a working SSH key is registered, see §1) — this alone
   triggers `.github/workflows/deploy.yml` (`on: push: branches: [master]`), which builds
   `infra/docker/Dockerfile` and pushes `ghcr.io/amandayora/elwedding:<git-sha>` + `:latest`.
3. Poll the build: `curl -s "https://api.github.com/repos/AmandaYora/elwedding/actions/runs?branch=master&per_page=3"`
   works **unauthenticated** — the repo is public, confirmed via
   `curl -s https://api.github.com/repos/AmandaYora/elwedding` → `"private": false`. No `gh`
   CLI or token needed. Filter by `head_sha` matching the just-pushed commit, poll until
   `status` is `"completed"` and `conclusion` is `"success"`. Do this as a backgrounded poll,
   not a blocking foreground sleep chain.
4. SSH to `elcodelabs` and run `~/elwedding/deploy.sh <git-sha>` — same SHA GitHub Actions just
   tagged. See `DEPLOYMENT.md` for what this step is documented to do; its literal script
   contents were not read by this AI session (§2).
5. Verify: `docker ps` on the VPS shows `elwedding-app` running the new SHA and `(healthy)`,
   and `curl -sI https://elwedding.elcodelabs.com/api/v1/health` returns `200` from outside the
   box.
