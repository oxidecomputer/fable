import fs from 'fs'
import inquirer from 'inquirer'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const QUESTIONS = [
  {
    name: 'project-name',
    type: 'input',
    message: 'Project name:',
    validate: function (input) {
      if (/^([A-Za-z\-\_\d])+$/.test(input)) return true
      else return 'Project name may only include letters, numbers, underscores and hashes.'
    },
  },
]

const CURR_DIR = process.cwd()

inquirer.prompt(QUESTIONS).then((answers) => {
  const projectName = answers['project-name']
  const templateName = 'main'
  const templatePath = `${__dirname}${templateName}`

  fs.mkdirSync(`${CURR_DIR}/${projectName}`)

  createDirectoryContents(templatePath, projectName)
})

function createDirectoryContents(templatePath, newProjectPath) {
  const filesToCreate = fs.readdirSync(templatePath)

  filesToCreate.forEach((file) => {
    const origFilePath = `${templatePath}/${file}`

    // get stats about the current file
    const stats = fs.statSync(origFilePath)

    if (stats.isFile()) {
      const contents = fs.readFileSync(origFilePath, 'utf8')

      const writePath = `${CURR_DIR}/${newProjectPath}/${file}`
      fs.writeFileSync(writePath, contents, 'utf8')
    } else if (stats.isDirectory()) {
      fs.mkdirSync(`${CURR_DIR}/${newProjectPath}/${file}`)

      // recursive call
      createDirectoryContents(`${templatePath}/${file}`, `${newProjectPath}/${file}`)
    }
  })
}
