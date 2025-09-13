require('dotenv').config()

const glob = require('fast-glob')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

// Load adapters with priority order
function loadAdapters() {
    const files = glob.sync(path.join(__dirname, 'adapters/*.js'))
    const priorityMap = {
        NovelKeys: 1,
        ProtoTypist: 2,
    }

    return files
        .map((file) => {
            const adapter = require(file)
            const name = adapter.name
            const order = priorityMap[name] ?? 99
            return { ...adapter, order }
        })
        .sort((a, b) => a.order - b.order)
}

const syncKeycaps = async () => {
    console.log('🚀 Starting Keycap Sync Script')

    const adapters = loadAdapters()
    const allKeycaps = new Map() // key: profile_keycap_id, value: { keycap, kits }

    for (const { name, fetchKeycaps } of adapters) {
        console.log(`\n📦 Fetching from ${name}...`)

        try {
            const keycaps = await fetchKeycaps()

            for (const { keycap, kits } of keycaps) {
                const id = keycap.profile_keycap_id

                // Skip if already added from higher priority adapter
                if (allKeycaps.has(id)) continue

                allKeycaps.set(id, { keycap, kits })
            }
        } catch (err) {
            console.error(`‼️ Failed to fetch from ${name}:`, err.message)
        }
    }

    console.log(`\n📊 Total unique keycaps: ${allKeycaps.size}`)

    // Insert into Supabase
    for (const { keycap, kits } of allKeycaps.values()) {
        const { data: existing } = await supabase
            .from('keycaps')
            .select('profile_keycap_id')
            .eq('profile_keycap_id', keycap.profile_keycap_id)
            .single()

        if (existing) {
            console.log(`🔁 ${keycap.name} already exists. Skipping.`)
            continue
        }

        const { error: keycapError } = await supabase
            .from('keycaps')
            .insert([keycap])
        if (keycapError) {
            console.error(
                `‼️ Error inserting keycap: ${keycap.name}`,
                keycapError.message
            )
            continue
        }

        if (kits.length > 0) {
            const { error: kitError } = await supabase
                .from('keycap_kits')
                .insert(kits)
            if (kitError) {
                console.error(
                    `‼️ Error inserting kits for ${keycap.profile_keycap_id}`,
                    kitError.message
                )
            } else {
                console.log(
                    `✅ Inserted ${kits.length} kits for ${keycap.name}`
                )
            }
        }
    }

    console.log('\n🎉 All vendors synced!')
}

syncKeycaps()
