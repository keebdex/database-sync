require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const Promise = require('bluebird')
const { difference, flattenDeep } = require('lodash')
const { getListImages, deleteImage } = require('../utils/image')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const selfhostedMakers = ['alpha-keycaps', 'gooey-keys']

const getColorways = async (rows = []) => {
    const { data } = await supabase
        .from('colorways')
        .select('img')
        .not('maker_id', 'in', `(${selfhostedMakers.join()})`)
        .neq('img', '')
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getColorways(rows)
    }

    return rows
}

const getKeycaps = async (rows = []) => {
    const { data } = await supabase
        .from('keycaps')
        .select('img')
        .neq('img', '')
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getKeycaps(rows)
    }

    return rows
}

Promise.all([getColorways(), getKeycaps()])
    .then(flattenDeep)
    .then(async (rows) => {
        const dbImages = rows.map((row) =>
            row.img
                .replace('/public', '')
                .replace(
                    `https://imagedelivery.net/${process.env.CF_IMAGES_ACCOUNT_HASH}/`,
                    ''
                )
        )

        const remoteImages = await getListImages()

        const diff = difference(remoteImages, dbImages)

        console.log('db images', dbImages.length)
        console.log('remote images', remoteImages.length)
        console.log('prune images', diff.length, diff)

        return Promise.map(diff, deleteImage, { concurrency: 5 })
    })
    .catch(console.error)
