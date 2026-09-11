#! /usr/bin/env node
import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'
import * as url from 'url'
import { parseArgs } from 'util'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
const CURR_DIR = process.cwd()

const { values, positionals } = parseArgs({
  options: {
    template: { type: 'string', short: 't' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help) {
  process.stdout.write(
    `Usage: create-fable [project-name] [--template <name>]\n\n` +
      `Available templates: ${listTemplates().join(', ')}\n`,
  )
  process.exit(0)
}

function listTemplates() {
  return fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith('.') &&
        d.name !== 'node_modules' &&
        d.name !== 'dist',
    )
    .map((d) => d.name)
}

const availableTemplates = listTemplates()

if (values.template && !availableTemplates.includes(values.template)) {
  console.error(
    `🚨 Unknown template "${values.template}". Available: ${availableTemplates.join(', ')}`,
  )
  process.exit(1)
}

const questions = []
if (!positionals[0]) {
  questions.push({
    name: 'project-name',
    type: 'input',
    message: 'Project name:',
    validate: (input) =>
      /^([A-Za-z\-\_\d])+$/.test(input) ||
      'Project name may only include letters, numbers, underscores and hashes.',
  })
}
if (!values.template) {
  questions.push({
    name: 'template',
    type: 'list',
    message: 'Template:',
    choices: availableTemplates,
    default: availableTemplates.includes('main') ? 'main' : availableTemplates[0],
  })
}

inquirer.prompt(questions).then((answers) => {
  const projectName = positionals[0] ?? answers['project-name']
  const templateName = values.template ?? answers.template
  const templatePath = path.join(__dirname, templateName)

  fs.mkdirSync(`${CURR_DIR}/${projectName}`)

  try {
    createDirectoryContents(templatePath, projectName)

    console.log(`🎉 Presentation generated from the "${templateName}" template!`)
    console.log(
      `💿 \`cd\` into "${CURR_DIR}/${projectName}" and run \`npm install\` to install dependencies`,
    )
    console.log(`🪄 Run \`npm run dev\` and check out the README to get started`)
  } catch (err) {
    console.error('🚨 Something went wrong:', err.message)
    process.exit(1)
  }
})

function createDirectoryContents(templatePath, newProjectPath) {
  const filesToCreate = fs.readdirSync(templatePath)

  filesToCreate.forEach((file) => {
    if (
      file === 'node_modules' ||
      file === 'dist' ||
      file === '.gitignore' ||
      file === 'package-lock.json' ||
      file === '.DS_Store'
    ) {
      return
    }

    const origFilePath = path.join(templatePath, file)
    const stats = fs.statSync(origFilePath)

    if (stats.isFile()) {
      const writePath = `${CURR_DIR}/${newProjectPath}/${file}`

      if (file === 'package.json') {
        let contents = fs.readFileSync(origFilePath, 'utf8')
        // Generator uses npm version (when it exists)
        contents = contents.replace(
          `"@oxide/fable": "file:../../"`,
          `"@oxide/fable": "^0.2.0"`,
        )
        fs.writeFileSync(writePath, contents, 'utf8')
      } else if (file === 'deck.yml') {
        // Each new project gets its own Liveblocks room.
        let contents = fs.readFileSync(origFilePath, 'utf8')
        contents = contents.replace(/^room: .*$/m, `room: ${newProjectPath.split('/')[0]}`)
        fs.writeFileSync(writePath, contents, 'utf8')
      } else {
        fs.copyFileSync(origFilePath, writePath)
      }
    } else if (stats.isDirectory()) {
      fs.mkdirSync(`${CURR_DIR}/${newProjectPath}/${file}`)
      createDirectoryContents(origFilePath, `${newProjectPath}/${file}`)
    }
  })
}
