require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const { crc32 } = require('crc')
const { default: slugify } = require('slugify')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const [_node, _path, maker_id, sculpt_id, newname] = process.argv

const getColorways = () =>
    supabase
        .from('colorways')
        .select()
        .eq('maker_id', maker_id)
        .eq('sculpt_id', sculpt_id)

getColorways().then((colorways) => {
    colorways.data.forEach((clw) => {
        const slug = slugify(clw.name, { lower: true })

        clw.sculpt_id = new_sculpt_id
        clw.colorway_id = crc32(
            `${maker_id}-${new_sculpt_id}-${slug}-${clw.order}`
        ).toString(16)

        supabase
            .from('colorways')
            .update(clw)
            .eq('id', clw.id)
            .then(console.log('colorways updated', clw.name))
            .catch((err) => {
                console.error('err', clw.name)
            })
    })

    supabase
        .from('sculpts')
        .update({
            name: newname,
            sculpt_id: slugify(newname, { lower: true }),
        })
        .eq('sculpt_id', sculpt_id)
        .then(console.log('sculpt updated'))
        .catch((err) => {
            console.error('err')
        })
})
