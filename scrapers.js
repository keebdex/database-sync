require('dotenv').config()

const fs = require('fs')
const files = fs.readdirSync('./scrapers')
const Promise = require('bluebird')
const { updateMakerDatabase } = require('./utils/database')

function scan(filename) {
    console.log('scanning', filename)
    const { scraper } = require(`./scrapers/${filename}`)

    return scraper().then(updateMakerDatabase)
}

Promise.map(files, scan, { concurrency: 1 })
