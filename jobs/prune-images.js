require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const Promise = require('bluebird')
const { difference } = require('lodash')
const { getListImages, deleteImage } = require('../utils/image')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const makeImageId = (c) =>
    `artisan/${c.maker_id}/${c.sculpt_id}/${c.colorway_id}`

const selfhostedMakers = ['alpha-keycaps', 'gooey-keys']

const getColorways = async (rows = []) => {
    const { data } = await supabase
        .from('colorways')
        .select('maker_id, sculpt_id, colorway_id')
        .not('maker_id', 'in', `(${selfhostedMakers.join()})`)
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getColorways(rows)
    }

    return rows
}

getColorways()
    .then((rows) => rows.map(makeImageId))
    .then(async (dbImages) => {
        let images = await getListImages()
        images = images.filter((i) => i.includes('artisan/'))

        const diff = difference(remoteImages, dbImages)

        console.log('db images', dbImages.length)
        console.log('remote images', remoteImages.length)
        console.log('prune images', diff.length, diff)

        return Promise.map(diff, deleteImage, { concurrency: 10 })
    })
    .catch(console.error)
