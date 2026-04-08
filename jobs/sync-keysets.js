require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const Promise = require('bluebird')
const { uploadImage, deleteImage } = require('../utils/image')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const makeImageId = (k) => `keyset/${k.profile_keyset_id}`

const getKeysets = async (rows = []) => {
    const { data } = await supabase
        .from('keysets')
        .select('img, render_img, profile_keyset_id')
        .neq('render_img', '')
        .or('img.is.null, img.eq.""')
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getKeysets(rows)
    }

    return rows
}

const syncNewKeyset = async (keyset) => {
    const filename = makeImageId(keyset)

    const promise = supabase
        .from('keysets')
        .update({
            img: `https://imagedelivery.net/${process.env.CF_IMAGES_ACCOUNT_HASH}/keyset/${keyset.profile_keyset_id}/public`,
        })
        .eq('profile_keyset_id', keyset.profile_keyset_id)

    if (keyset.img === '') {
        await deleteImage(filename)
    }

    await uploadImage(filename, keyset.render_img, promise)
}

getKeysets()
    .then(async (rows) => {
        /**
         * NOTE: for newly added keysets, img is null
         * TODO: sync images for updated keysets
         */

        if (rows.length) {
            await Promise.map(rows, syncNewKeyset, { concurrency: 5 })
        }
    })
    .catch(console.error)
