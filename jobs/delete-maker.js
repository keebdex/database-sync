require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const [_node, _path, ...rest] = process.argv

async function deleteMakers() {
    await supabase
        .from('colorways')
        .delete()
        .in('maker_id', rest)
        .then(({ status, statusText }) => {
            console.log(status, statusText)
        })
        .catch((error) => {
            console.error(error)
        })

    await supabase
        .from('sculpts')
        .delete()
        .in('maker_id', rest)
        .then(({ status, statusText }) => {
            console.log(status, statusText)
        })
        .catch((error) => {
            console.error(error)
        })

    await supabase
        .from('makers')
        .delete()
        .in('id', rest)
        .then(({ status, statusText }) => {
            console.log(status, statusText)
        })
        .catch((error) => {
            console.error(error)
        })
}

deleteMakers()
