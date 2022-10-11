require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const { writeFileSync } = require('fs')
const { downloader } = require('./utils/docs')
const { parser } = require('./utils/parser')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const isDevelopment = process.env.NODE_ENV !== 'production'

const getMakers = () => {
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

const updateDatabase = async (data) => {
    let colors = []
    const sculpts = data.map(({ colorways, ...rest }) => {
        colors = colors.concat(colorways)
        return rest
    })

    const { error } = await supabase.from('sculpts').upsert(sculpts)
    if (error) {
        console.error('update sculpts error', error)
    }

    const { error: err } = await supabase.from('colorways').upsert(colors)

    if (err) {
        console.error('update colorways error', err)
    }
}

getMakers().then((makers) => {
    makers.forEach((maker) => {
        console.log('start downloading:', maker.id)

        downloader(maker.document_id)
            .then((html) => parser(html, maker.id))
            .then((data) => {
                if (isDevelopment) {
                    writeFileSync(
                        `db/${maker.id}.json`,
                        JSON.stringify(data, null, 2),
                        () => {
                            console.log('done', maker.id)
                        }
                    )
                }

                updateDatabase(data)
            })
            .catch((err) => {
                console.error(
                    'catalogue deleted or sth went wrong',
                    maker.id,
                    err.message
                )
            })
    })
})
