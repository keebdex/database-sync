require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const getGDocMakers = () =>
    supabase
        .from('makers')
        .select()
        .like('src', '%docs.google.com%')
        .neq('deleted', true)
        .then(({ data }) =>
            data.map((m) => {
                return {
                    id: m.id,
                    document_id: m.src.split('/')[5],
                }
            })
        )

const updateDatabase = async (maker_id, data) => {
    let colors = []
    const sculpts = data.map(({ colorways, ...rest }) => {
        colors = colors.concat(colorways)
        return rest
    })

    const sculpt = await supabase
        .from('sculpts')
        .upsert(sculpts, { returning: 'minimal' })

    if (sculpt.error) {
        console.error('update sculpts error', maker_id, sculpt.error)
    }

    const colorway = await supabase
        .from('colorways')
        .upsert(colors, { returning: 'minimal' })

    if (colorway.error) {
        console.error('update colorways error', maker_id, colorway.error)
    }

    console.log(
        'inserted/updated',
        maker_id,
        'sculpts',
        sculpts.length,
        'colorways',
        colors.length
    )
}

module.exports = { getGDocMakers, updateDatabase }
