require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const getGDocMakers = () => {
    return supabase
        .from('makers')
        .select()
        .then(({ data }) => {
            return data
                .filter((m) => m.src.includes('docs.google.com'))
                .map((m) => {
                    return {
                        id: m.id,
                        document_id: m.src.split('/')[5],
                    }
                })
        })
}

const updateDatabase = async (maker_id, data) => {
    let colors = []
    const sculpts = data.map(({ colorways, ...rest }) => {
        colors = colors.concat(colorways)
        return rest
    })

    const { error } = await supabase.from('sculpts').upsert(sculpts)
    if (error) {
        console.error('update sculpts error', maker_id, error)
    }

    const { error: err } = await supabase.from('colorways').upsert(colors)

    if (err) {
        console.error('update colorways error', maker_id, err)
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
