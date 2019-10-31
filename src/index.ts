import { execFile } from 'child_process'
import { promisify } from 'util'
import chalk from 'chalk'
import ora from 'ora'
import { forEachSeries, filterSeries, someSeries } from 'p-iteration'

const branchPrefix = '_recycles_/'

function filterArray<T>(
  array: ReadonlyArray<T | null | undefined>,
) {
  return array.filter(x => x != null) as T[]
}

async function git(...command: Array<string | number>) {
  const { stdout } = await promisify(execFile)(
    'git', [
      '--no-pager', ...command.map(String),
    ], {
      encoding: 'utf-8',
    }
  )

  return stdout
}

async function gitIsAncestor(ancestor: string, child: string) {
  return git('merge-base', '--is-ancestor', ancestor, child)
    .then(() => true, () => false)
}

async function gitReflog(count: number) {
  const output = await git('reflog', '-n', count, '--no-color')
  return filterArray(output.trim().split('\n').map(line => {
    const match = line.match(/^(\w+) (.+)$/)
    if (!match) return null
    return {
      hash: match[1],
      rest: match[2],
    }
  }))
}

async function gitListRefs() {
  const result = await git('for-each-ref')
  return filterArray(result.trim().split('\n').map(line => {
    const match = line.match(/^(\w+)\s+(\w+)\s+refs\/(.+)$/)
    if (!match) return null
    const ref = match[3]
    return {
      hash: match[1],
      type: match[2],
      ref,
      remote: ref.startsWith('remotes/'),
      branch: ref.replace(/^\w+\//, ''),
    }
  }))
}

async function gitNewBranch(name: string, commit: string) {
  return git('branch', name, commit)
}

export async function createRecycleRefs(num: number) {
  const logRefs = await gitReflog(num)
  const logRefHashs = Array.from(new Set(logRefs.map(item => item.hash)))
  const refs = Array.from(new Set(await gitListRefs()))

  const spinner = ora('Analysis reflog').start()
  const hiddenHashs = await filterSeries(logRefHashs, async (log, i) => {
    spinner.text = `Analysis reflog ${i + 1} of ${logRefHashs.length}...`
    return !await someSeries(refs, ref => gitIsAncestor(log, ref.hash))
  })
  const { length } = hiddenHashs

  spinner.succeed('Analysis done!\n')

  console.log(chalk.green(`${length} branch${length > 1 ? 'es' : ''} created${length ? ':' : '.'}\n`))

  await forEachSeries(hiddenHashs, hash => {
    const branch = `${branchPrefix}${hash.slice(0, 6)}`
    console.log(chalk.green(`* ${branch}`))
    return gitNewBranch(branch, hash)
  })

  console.log(chalk.green(`\nUse \`git-recycle hide\` to clean up.`))
}

export async function removeRecycleRefs() {
  const allRefs = await gitListRefs()
  const refs = allRefs.filter(ref => ref.branch.startsWith(branchPrefix))

  if (!refs.length) {
    console.log(chalk.yellow('Nothing to delete'))
  } else {
    const branchs = refs.map(ref => ref.branch)
    console.log(chalk.red(`${branchs.length} branch${branchs.length > 1 ? 'es' : ''} removed${branchs.length ? ':' : '.'}\n`))
    console.log(chalk.red(branchs.map(x => `* ${x}`).join('\n')))
    git('branch', '-D', ...branchs)
  }
}
