require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const drive = require('@googleapis/drive')
const Promise = require('bluebird')
const { flattenDeep } = require('lodash')
const path = require('path')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const getDocIds = () => supabase
    .from('makers')
    .select('id, document_ids')
    .neq('deleted', true)
    .then(({ data }) => data.filter((r) => Array.isArray(r.document_ids)))
    .then(makers => flattenDeep(makers.map(m => m.document_ids)))

const syncMetadata = async fileId => {
    const auth = new drive.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: [
            'https://www.googleapis.com/auth/drive',
        ],
    })

    const authClient = await auth.getClient()
    const { data } = await drive
        .drive({
            version: 'v2',
            auth: authClient,
        })
        .files.get({ fileId })

    const metadata = {
        doc_id: data.id,
        title: data.title,
        owners: data.owners,
        created_at: data.createdDate,
        modified_at: data.modifiedDate,
        last_modifying_user: data.lastModifyingUser
    }

    await supabase.from('raw_document_metadata').insert(metadata)
}

getDocIds().then(docIds => Promise.map(docIds, syncMetadata, { concurrency: 1 }))