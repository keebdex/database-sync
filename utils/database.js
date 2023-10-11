require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const upsert = async (table, data) => {
    const { error } = await supabase.from(table).upsert(data)
    if (error) {
        console.warn(`update table '${table}' error`, data[0].maker_id, error)
    }
}

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

const updateMaker = async (maker_id, data) => {
    let colors = []
    const sculpts = data.map(({ colorways, ...rest }) => {
        colors = colors.concat(colorways)
        return rest
    })

    /**
     * FIXME: need to find a better solution
     * with this fix, the crawler will not override the manual input data if empty
     * it might be wrong if the catalog maintainer input/remove wrong data
     */
    const releaseOnly = colors
        .filter((c) => c.release && !c.qty)
        .map(({ qty, ...rest }) => rest)
    const qtyOnly = colors
        .filter((c) => !c.release && c.qty)
        .map(({ release, ...rest }) => rest)
    const hasNoExtra = colors
        .filter((c) => !c.release && !c.qty)
        .map(({ release, qty, ...rest }) => rest)
    const hasExtra = colors.filter((c) => c.release && c.qty)

    await upsert('sculpts', sculpts)
    if (releaseOnly.length) {
        await upsert('colorways', releaseOnly)
    }
    if (qtyOnly.length) {
        await upsert('colorways', qtyOnly)
    }
    if (hasNoExtra.length) {
        await upsert('colorways', hasNoExtra)
    }
    if (hasExtra.length) {
        await upsert('colorways', hasExtra)
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

const getColorways = async (maker_id, rows = []) => {
    const { data } = await supabase
        .from('colorways')
        .select()
        .eq('maker_id', maker_id)
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getColorways(maker_id, rows)
    }

    return rows
}

module.exports = { getGDocMakers, updateMaker, getColorways }
