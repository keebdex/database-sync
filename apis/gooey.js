const axios = require('axios')
const { crc32 } = require('crc')
const { writeFileSync } = require('fs')
const { findLast } = require('lodash')
const { updateMakerDatabase } = require('../utils/database')
const { urlSlugify } = require('../utils/slugify')

const maker_id = 'gooey-keys'

const downloader = async () => {
    const { data } = await axios({
        method: 'get',
        url: 'https://gooey.link/keycap-archivist.json',
    })

    const sculpts = data.sculpts.map((sculpt) => {
        const sculpt_id = urlSlugify(sculpt.name)

        const colorways = sculpt.colorways.map((colorway, order) => {
            const { name, img, releaseDate: release } = colorway

            return {
                name,
                img,
                maker_id,
                sculpt_id,
                release,
                giveaway: false,
                commissioned: false,
                colorway_id: crc32(
                    `${maker_id}-${sculpt_id}-${urlSlugify(name)}`
                ).toString(16),
                order,
            }
        })

        return {
            name: sculpt.name,
            release: sculpt.releaseDate,
            colorways,
            maker_id,
            sculpt_id,
            img: findLast(colorways).img,
        }
    })

    if (process.env.NODE_ENV !== 'production') {
        writeFileSync(`db/${maker_id}.json`, JSON.stringify(sculpts, null, 2))
    }

    updateMakerDatabase(sculpts)
}

downloader()
