const docs = require('@googleapis/docs')
const drive = require('@googleapis/drive')
const { JWT } = require('google-auth-library')
const path = require('path')

const credentials = require(path.join(__dirname, '..', '..', '/keebdex.json'))

const getAuth = async () => {
    const client = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive',
        ],
    })

    const tokens = await client.authorize()
    if (!tokens.access_token) {
        throw new Error('Error while trying to retrieve access token')
    }

    return client
}

const downloadDoc = async (documentId) => {
    const auth = await getAuth()

    const { data } = await docs
        .docs({ version: 'v1', auth })
        .documents.get({ documentId })

    return data
}

const getFile = async (fileId) => {
    const auth = await getAuth()

    const { data } = await drive
        .drive({ version: 'v3', auth })
        .files.get({ fileId, fields: '*' })

    return data
}

const getRevisions = async (fileId, revisions = [], pageToken) => {
    const auth = await getAuth()

    const { data } = await drive
        .drive({ version: 'v3', auth })
        .revisions.list({ fileId, fields: '*', pageToken })

    revisions = revisions.concat(data.revisions)

    if (data.nextPageToken) {
        return getRevisions(fileId, revisions, data.nextPageToken)
    }

    return revisions
}

module.exports = { downloadDoc, getFile, getRevisions }
