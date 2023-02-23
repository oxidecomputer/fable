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

  createDirectoryContents(projectName, templatePath, projectName)
})

function createDirectoryContents(projectName, templatePath, newProjectPath) {
  const filesToCreate = fs.readdirSync(templatePath)

  filesToCreate.forEach((file) => {
    const origFilePath = `${templatePath}/${file}`

    // get stats about the current file
    const stats = fs.statSync(origFilePath)

    if (
      origFilePath.includes('node_modules') ||
      file === '.gitignore' ||
      file === 'package-lock.json' ||
      file === '.DS_Store'
    ) {
      return
    }

    if (stats.isFile()) {
      const writePath = `${CURR_DIR}/${newProjectPath}/${file}`

      if (file == 'package.json') {
        let contents = fs.readFileSync(origFilePath, 'utf8')
        // Generator uses npm version (when it exists)
        contents = contents.replace(
          `"@oxide/fable": "file:../../"`,
          `"@oxide/fable": "^0.0.1"`,
        )
        fs.writeFileSync(writePath, contents, 'utf8')
      } else if (file == 'index.html') {
        let contents = fs.readFileSync(origFilePath, 'utf8')
        // Replace title for user provided one
        contents = contents.replace('Fable – Presentation Generator', toTitle(projectName))
        fs.writeFileSync(writePath, contents, 'utf8')
      } else {
        fs.copyFileSync(origFilePath, writePath)
      }
    } else if (stats.isDirectory()) {
      fs.mkdirSync(`${CURR_DIR}/${newProjectPath}/${file}`)

      // recursive call
      createDirectoryContents(
        projectName,
        `${templatePath}/${file}`,
        `${newProjectPath}/${file}`,
      )
    }
  })
}

function toTitle(str) {
  let string = str.replace('-', ' ')

  return string.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}
