const { crc32 } = require('crc')
const { default: slugify } = require('slugify')
const { writeFileSync } = require('fs')
const axios = require('axios')
const xpath = require('xpath-html')
const { findLast } = require('lodash')
const { updateDatabase } = require('../utils/database')

const baseUrl = 'https://alphakeycaps.com'
const maker_id = 'alpha-keycaps'

const sculptScraper = async ([sculpt_id, sculpt_name]) => {
    const { data } = await axios({
        method: 'get',
        url: `${baseUrl}/${sculpt_id}`,
    })

    const nodes = xpath.fromPageSource(data).findElements('//figure')

    return nodes.map((node) => {
        const text = xpath.fromNode(node).findElement('//strong').getText()
        const img = xpath
            .fromNode(node)
            .findElement('//img')
            .getAttribute('data-src')

        const name = text.replace(sculpt_name, '').trim()

        return {
            name,
            img,
            maker_id,
            sculpt_id,
            colorway_id: crc32(
                `${maker_id}-${sculpt_id}-${slugify(name, { lower: true })}`
            ).toString(16),
        }
    })
}

const catalogs = {
    'darth-looga': 'Darth Looga',
    'mf-belooga': 'MF Belooga',
    keypora: 'Keypora',
    'jedi-blinker': 'Jedi Blinker',
    blinker: 'Blinker',
    matapora: 'Matapora',
    'alpha-ape': 'Alpha Ape',
    cherep: 'Cherep',
    salvador: 'Salvador',
    albison: 'Albison',
    'mr-worldwide': 'Mr Worldwide',
    'boosted-gamer-set': 'Boosted Gamer Set',
    geekpora: 'Geekpora',
}

const downloader = async () => {
    const sculpts = await Promise.all(
        Object.entries(catalogs).map(async (sculpt) => {
            const colorways = await sculptScraper(sculpt)
            return {
                name: sculpt[1],
                maker_id,
                sculpt_id: sculpt[0],
                colorways,
                img: findLast(colorways).img,
            }
        })
    )

    if (process.env.NODE_ENV !== 'production') {
        writeFileSync(`db/${maker_id}.json`, JSON.stringify(sculpts, null, 2))
    }

    updateDatabase(maker_id, sculpts)
}

downloader()
