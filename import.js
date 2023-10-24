require('dotenv').config()

const fs = require('fs')
const files = fs.readdirSync('./importers')
const Promise = require('bluebird')
const { updateMakerDatabase } = require('./utils/database')

function scan(filename) {
    console.log('scanning', filename)
    const { scraper } = require(`./importers/${filename}`)

    return scraper().then(updateMakerDatabase)
}

Promise.map(files, scan, { concurrency: 1 })
