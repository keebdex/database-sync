const docs = require('@googleapis/docs')
const path = require('path')

const downloadDoc = async (documentId) => {
    const auth = new docs.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/documents'],
    })

    const authClient = await auth.getClient()

    const client = docs.docs({
        version: 'v1',
        auth: authClient,
    })

    const doc = await client.documents.get({ documentId })

    return doc
}

module.exports = { downloadDoc }
