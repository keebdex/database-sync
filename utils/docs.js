const docs = require('@googleapis/docs')
const drive = require('@googleapis/drive')
const path = require('path')

const downloadDoc = async (documentId) => {
    const auth = new docs.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: [
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive',
        ],
    })

    const authClient = await auth.getClient()

    const document = await docs
        .docs({
            version: 'v1',
            auth: authClient,
        })
        .documents.get({ documentId })

    const { data: metadata } = await drive
        .drive({
            version: 'v2',
            auth: authClient,
        })
        .files.get({ fileId: documentId })

    const contributors = metadata.owners
        .concat([metadata.lastModifyingUser])
        .map((u) => ({
            name: u.displayName,
            picture: u.picture.url,
        }))

    return {
        document,
        contributors,
        updated_at: metadata.modifiedDate,
    }
}

module.exports = { downloadDoc }
