const { crc32 } = require('crc')
const { writeFileSync } = require('fs')
const axios = require('axios')
const xpath = require('xpath-html')
const { findLast } = require('lodash')
const { updateMaker } = require('../utils/database')
const { slugify } = require('../utils/slugify')

const baseUrl = 'https://alphakeycaps.com'
const maker_id = 'alpha-keycaps'

const sculptScraper = async (sculpt_id, sculpt_name) => {
    const { data } = await axios({
        method: 'get',
        url: `${baseUrl}/${sculpt_id}`,
    })

    const nodes = xpath.fromPageSource(data).findElements('//figure')

    return nodes.map((node, order) => {
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
                `${maker_id}-${sculpt_id}-${slugify(name)}`
            ).toString(16),
            order,
        }
    })
}

const catalogs = [
    'Darth Looga',
    'MF Belooga',
    'Keypora',
    'Jedi Blinker',
    'Blinker',
    'Matapora',
    'Alpha Ape',
    'Cherep',
    'Salvador',
    'Albison',
    'Mr Worldwide',
    'Boosted Gamer Set',
    'Geekpora',
    'Prayge',
    'Devoura'
]

const downloader = async () => {
    const sculpts = await Promise.all(
        catalogs.map(async (name) => {
            const sculpt_id = slugify(name)
            const colorways = await sculptScraper(sculpt_id, name)
            return {
                name,
                maker_id,
                sculpt_id,
                colorways,
                img: findLast(colorways).img,
            }
        })
    )

    if (process.env.NODE_ENV !== 'production') {
        writeFileSync(`db/${maker_id}.json`, JSON.stringify(sculpts, null, 2))
    }

    updateMaker(maker_id, sculpts)
}

downloader()
