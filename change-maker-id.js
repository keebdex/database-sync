require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const { crc32 } = require('crc')
const { default: slugify } = require('slugify')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const [_node, _path, old_maker_id, new_maker_id] = process.argv

const getAllColorways = () =>
    supabase.from('colorways').select().eq('maker_id', old_maker_id)

getAllColorways().then((colorways) => {
    console.log('found', colorways.data.length)

    colorways.data.forEach((clw) => {
        const slug = slugify(clw.name, { lower: true })

        clw.maker_id = new_maker_id

        const old_colorway_id = clw.colorway_id

        clw.colorway_id = crc32(
            `${new_maker_id}-${clw.sculpt_id}-${slug}-${clw.order}`
        ).toString(16)

        supabase
            .from('colorways')
            .update(clw)
            .eq('id', clw.id)
            .then(console.log('colorways updated', clw.name))
            .catch((err) => {
                console.error('err', clw.name)
            })

        supabase
            .from('user_collection_items')
            .update({
                colorway_id: clw.colorway_id,
            })
            .eq('colorway_id', old_colorway_id)
            .then(
                console.log(
                    'colorway_id updated',
                    old_colorway_id,
                    '=>',
                    clw.colorway_id
                )
            )
            .catch((err) => {
                console.error('err', clw.name)
            })
    })

    supabase
        .from('sculpts')
        .update({
            maker_id: new_maker_id,
        })
        .eq('maker_id', old_maker_id)
        .then(console.log('sculpts updated'))
        .catch((err) => {
            console.error('err')
        })

    supabase
        .from('makers')
        .update({
            id: new_maker_id,
        })
        .eq('id', old_maker_id)
        .then(console.log('maker updated'))
        .catch((err) => {
            console.error('err')
        })
})
