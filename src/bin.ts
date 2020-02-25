#! env node

import { removeRecycleRefs, createRecycleRefs } from '.'

const args = process.argv.slice(2)
const [ commandArg ] = args

if (args.some(arg => arg === '-h' || arg === '--help')) {
  console.log(
    'Usage:\n',
    'git-recycle [N]     Show recycle commits, limit N = 10 by default\n',
    'git-recycle hide    Hide recycle commits\n',
  )
} else if (commandArg === 'hide') {
  removeRecycleRefs()
} else {
  let count = 10
  if (/^\d+$/.test(commandArg)) {
    count = parseInt(commandArg, 10)
  }
  createRecycleRefs(count)
}
