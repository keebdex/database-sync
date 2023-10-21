require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const { urlSlugify } = require('./utils/slugify')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const [_node, _path, maker_id, sculpt_id, newname] = process.argv
const new_sculpt_id = urlSlugify(newname, { lower: true })

async function changeSculptName() {
    await supabase
        .from('colorways')
        .update({
            sculpt_id: new_sculpt_id,
        })
        .eq('sculpt_id', sculpt_id)
        .eq('maker_id', maker_id)
        .then(console.log('colorways updated'))
        .catch((err) => {
            console.error('err', err.message)
        })

    await supabase
        .from('sculpts')
        .update({
            name: newname,
            sculpt_id: new_sculpt_id,
        })
        .eq('sculpt_id', sculpt_id)
        .eq('maker_id', maker_id)
        .then(console.log('sculpt updated'))
        .catch((err) => {
            console.error('err', err.message)
        })
}

changeSculptName()
