/**
 * Wire vocabulary shared by the host git service and the browser client:
 * request/response shapes of the /git/* routes and the stable error codes
 * the client maps onto bilingual copy. Pure types — no runtime code.
 * @module dsh-git-graph/core/types
 */
/** Parse output of `git for-each-ref refs/heads --format=...`. */
export function parseBranches(stdout) {
    const rows = [];
    for (const line of stdout.split('\n')) {
        if (line === '')
            continue;
        const [name, head, oid] = line.split('\u0000');
        if (name === undefined || head === undefined || oid === undefined)
            continue;
        rows.push({ name, current: head === '*' });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
}
/** Parse `git worktree list --porcelain` into the branch refs checked out (porcelain prints `branch refs/heads/<name>`). */
export function parseWorktreeBranches(stdout) {
    const branches = [];
    for (const line of stdout.split('\n')) {
        if (!line.startsWith('branch refs/heads/'))
            continue;
        const name = line.slice('branch refs/heads/'.length).trim();
        if (name !== '' && !branches.includes(name))
            branches.push(name);
    }
    return branches;
}
/**
 * Parse `git worktree list --porcelain` into full rows: blank-line-separated
 * records of `worktree <path>` / `HEAD <oid>` / `branch refs/heads/<name>`
 * (or `detached` / `bare`). The first record is the primary checkout.
 */
export function parseWorktrees(stdout) {
    const rows = [];
    let current = null;
    const flush = () => {
        if (current === null || current.path === undefined)
            return;
        rows.push({
            path: current.path,
            head: current.head ?? '',
            branch: current.branch ?? '',
            main: rows.length === 0,
        });
    };
    for (const line of stdout.split('\n')) {
        if (line === '') {
            flush();
            current = null;
            continue;
        }
        if (line.startsWith('worktree ')) {
            flush();
            current = { path: line.slice('worktree '.length).trim() };
            continue;
        }
        if (current === null)
            continue;
        if (line.startsWith('HEAD '))
            current.head = line.slice('HEAD '.length).trim();
        else if (line.startsWith('branch refs/heads/'))
            current.branch = line.slice('branch refs/heads/'.length).trim();
    }
    flush();
    return rows;
}
/** Parse the porcelain status into counts. */
export function parsePorcelain(stdout) {
    let dirtyFiles = 0;
    let untrackedFiles = 0;
    let conflicts = 0;
    // git's porcelain-v1 unmerged codes: DD, AU, UD, UA, DU, AA, UU.
    const unmerged = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
    for (const line of stdout.split('\n')) {
        if (line === '')
            continue;
        const xy = line.slice(0, 2);
        if (unmerged.has(xy))
            conflicts += 1;
        else if (xy.startsWith('??'))
            untrackedFiles += 1;
        else
            dirtyFiles += 1;
    }
    return { dirtyFiles, untrackedFiles, conflicts };
}
/**
 * Parse the graph format rows (`%H %P %an %at %D %s` split by \x1e). `git
 * log` (tformat) appends a newline after the record separator, so every
 * record except the first carries a leading `\n` — strip it or the oid gets
 * corrupted and a trailing `\n` would parse as a phantom commit.
 */
export function parseGraph(stdout) {
    const commits = [];
    for (const raw of stdout.split('\u001e')) {
        const entry = raw.replace(/^\n/, '');
        if (entry === '')
            continue;
        const [oid, parentsRaw, author, authorTimeRaw, decoration, subject] = entry.split('\u0000');
        if (oid === undefined || oid === '')
            continue;
        commits.push({
            oid,
            parents: parentsRaw === undefined || parentsRaw === '' ? [] : parentsRaw.split(' '),
            subject: subject ?? '',
            author: author ?? '',
            authorTime: Number(authorTimeRaw ?? '0'),
            refs: parseDecoration(decoration ?? ''),
        });
    }
    return commits;
}
/** Decoration → ref names: split entries, drop the `HEAD -> ` handoff prefix, drop a bare detached-`HEAD` entry, drop `tag: `. */
export function parseDecoration(decoration) {
    if (decoration === '')
        return [];
    return decoration.split(', ').map(part => {
        if (part === 'HEAD')
            return '';
        let name = part.replace(/^HEAD -> /, '').replace(/^tag: /, '');
        return name.trim();
    }).filter(name => name !== '');
}
/**
 * Minimal lane assignment over topo-ordered rows: each lane waits for one
 * commit; the first parent continues the node's lane, further parents start
 * (or join) lanes to the right. Correct for linear, branched, and merged
 * histories; the columns alone carry the topology (the renderer draws them
 * as monospace lane text).
 * @param rows - topo-ordered rows with parents (later rows = ancestors).
 * @returns per-row lane maps.
 */
export function computeLanes(rows) {
    const later = new Set();
    for (const row of rows) {
        for (const parent of row.parents)
            later.add(parent);
    }
    const lanes = [];
    const result = [];
    for (const row of rows) {
        let nodeColumn = lanes.findIndex(pending => pending === row.oid);
        if (nodeColumn === -1) {
            lanes.push(row.oid);
            nodeColumn = lanes.length - 1;
        }
        const columns = [];
        for (let i = 0; i < lanes.length; i += 1) {
            const pending = lanes[i];
            if (pending === null)
                columns.push('gap');
            else if (i === nodeColumn)
                columns.push(row.parents.length > 1 ? 'merge' : 'node');
            // A second lane waiting for this commit is a merge join: its line ends
            // into the node (rendered as a gap in this row).
            else if (pending === row.oid)
                columns.push('gap');
            else if (typeof pending === 'string' && later.has(pending))
                columns.push('pass');
            else
                columns.push('gap');
        }
        const parents = row.parents.filter(parent => later.has(parent));
        const [first, ...rest] = parents;
        // Join lanes are consumed by this row; the node lane continues with the
        // first parent.
        for (let i = 0; i < lanes.length; i += 1) {
            if (lanes[i] === row.oid && i !== nodeColumn)
                lanes[i] = null;
        }
        lanes[nodeColumn] = first ?? null;
        for (const parent of rest) {
            if (!lanes.includes(parent))
                lanes.push(parent);
        }
        while (lanes.length > 0 && lanes[lanes.length - 1] === null)
            lanes.pop();
        result.push({ columns, nodeColumn, merge: row.parents.length > 1 });
    }
    return result;
}
/**
 * Runtime narrowing for the wire types served to the browser. Zod is not a
 * dependency of this package, so each guard is a hand-written structural
 * check over the same shape the host service produces. The routes boundary
 * runs these before sending a view so a malformed service output can never
 * leak to the client as a typed envelope value.
 * @module dsh-git-graph/core/types
 */
/** Narrow an unknown value onto {@link RepoStatus}. */
export function isRepoStatus(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.root === 'string'
        && typeof record.branch === 'string'
        && typeof record.head === 'string'
        && typeof record.dirtyFiles === 'number'
        && typeof record.untrackedFiles === 'number'
        && typeof record.conflicts === 'number'
        && typeof record.operationInProgress === 'boolean';
}
/** Narrow an unknown value onto {@link BranchRow}. */
export function isBranchRow(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.name === 'string' && typeof record.current === 'boolean';
}
/** Narrow an unknown value onto {@link BranchesView}. */
export function isBranchesView(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.root === 'string'
        && typeof record.branch === 'string'
        && Array.isArray(record.branches) && record.branches.every(isBranchRow)
        && typeof record.dirtyFiles === 'number'
        && typeof record.untrackedFiles === 'number'
        && typeof record.conflicts === 'number'
        && typeof record.operationInProgress === 'boolean';
}
/** Narrow an unknown value onto {@link GraphCommit}. */
export function isGraphCommit(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.oid === 'string'
        && Array.isArray(record.parents) && record.parents.every(parent => typeof parent === 'string')
        && typeof record.subject === 'string'
        && typeof record.author === 'string'
        && typeof record.authorTime === 'number'
        && Array.isArray(record.refs) && record.refs.every(ref => typeof ref === 'string');
}
/** Narrow an unknown value onto {@link GraphView}. */
export function isGraphView(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.root === 'string'
        && typeof record.branch === 'string'
        && Array.isArray(record.commits) && record.commits.every(isGraphCommit)
        && typeof record.hasMore === 'boolean';
}
/** The set of stable {@link GitErrorCode} members the client maps onto copy. */
const GIT_ERROR_CODES = new Set([
    'conflicts-present',
    'operation-in-progress',
    'branch-in-other-worktree',
    'tracked-changes-would-be-overwritten',
    'untracked-changes-would-be-overwritten',
    'target-branch-not-found',
    'invalid-branch-name',
    'branch-already-exists',
    'workspace-unknown',
    'invalid-worktree-name',
    'worktree-already-exists',
    'worktree-dirty',
    'worktree-not-found',
    'worktree-is-main',
    'base-ref-not-found',
    'internal',
]);
/** Narrow an unknown value onto {@link WorktreeInfo}. */
export function isWorktreeInfo(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.path === 'string'
        && typeof record.head === 'string'
        && typeof record.branch === 'string'
        && typeof record.main === 'boolean';
}
/** Narrow an unknown value onto {@link WorktreeListView}. */
export function isWorktreeListView(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.root === 'string'
        && Array.isArray(record.worktrees) && record.worktrees.every(isWorktreeInfo);
}
/** Narrow an unknown value onto {@link GitFeatureConfig}. */
export function isGitFeatureConfig(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.autoIsolate === 'boolean'
        && (record.autoBaseline === 'current' || record.autoBaseline === 'default')
        && typeof record.worktreesHome === 'string';
}
/** Narrow an unknown value onto {@link GitErrorCode}. */
export function isGitErrorCode(value) {
    return typeof value === 'string' && GIT_ERROR_CODES.has(value);
}
/** Narrow an unknown value onto {@link GitError}. */
export function isGitError(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    if (!isGitErrorCode(record.code))
        return false;
    if (typeof record.message !== 'string')
        return false;
    if (record.paths !== undefined
        && (!Array.isArray(record.paths) || !record.paths.every(path => typeof path === 'string'))) {
        return false;
    }
    if (record.moreFiles !== undefined && typeof record.moreFiles !== 'number')
        return false;
    return true;
}
