const { crc32 } = require('crc')
const axios = require('axios')
const xpath = require('xpath-html')
const { findLast } = require('lodash')
const { urlSlugify } = require('../utils/slugify')

const baseUrl = 'https://alphakeycaps.com'
const maker_id = 'alpha-keycaps'

const topre = '(T)'

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

        let name = text.replace(sculpt_name, '')
        let stem = null

        if (name.includes(topre)) {
            stem = ['topre']
            name = name.replace(topre, '')
        }

        return {
            name: name.trim(),
            img,
            maker_id,
            sculpt_id,
            giveaway: false,
            commissioned: false,
            colorway_id: crc32(
                `${maker_id}-${sculpt_id}-${urlSlugify(name)}`
            ).toString(16),
            order,
            stem,
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
    'Devoura',
    'Lickely',
    'Tut',
    'Tutré',
]

const scraper = async () => {
    const sculpts = await Promise.all(
        catalogs.map(async (name) => {
            const sculpt_id = urlSlugify(name)
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

    return sculpts
}

module.exports = { scraper }
