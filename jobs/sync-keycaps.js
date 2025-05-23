require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const Promise = require('bluebird')
const { uploadImage, deleteImage } = require('../utils/image')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const makeImageId = (k) => `keycap/${k.profile_keycap_id}`

const getKeycaps = async (rows = []) => {
    const { data } = await supabase
        .from('keycaps')
        .select('img, render_img, profile_keycap_id')
        .neq('render_img', '')
        .or('img.is.null, img.eq.""')
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getKeycaps(rows)
    }

    return rows
}

const syncNewKeycap = async (keycap) => {
    const filename = makeImageId(keycap)

    const promise = supabase
        .from('keycaps')
        .update({
            img: `https://imagedelivery.net/${process.env.CF_IMAGES_ACCOUNT_HASH}/keycap/${keycap.profile_keycap_id}/public`,
        })
        .eq('profile_keycap_id', keycap.profile_keycap_id)

    if (keycap.img === '') {
        await deleteImage(filename)
    }

    await uploadImage(filename, keycap.render_img, promise)
}

getKeycaps()
    .then(async (rows) => {
        /**
         * NOTE: for newly added keycaps, img is null
         * TODO: sync images for updated keycaps
         */

        if (rows.length) {
            await Promise.map(rows, syncNewKeycap, { concurrency: 5 })
        }
    })
    .catch(console.error)
