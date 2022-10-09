const docs = require('@googleapis/docs')
const { google } = require('googleapis')

const downloader = async (documentId) => {
    // const docs = google.docs({
    //     version: 'v1',
    //     key: apikey,
    // })
    // const doc = await docs.documents.get({ documentId })

    // const client = docs.docs({
    //     version: 'v1',
    //     auth: apikey,
    // })
    // const doc = await client.documents.get({ documentId })

    const drive = google.drive({
        version: 'v3',
        auth: process.env.GOOGLE_API_KEY,
    })
    const doc = await drive.files.export({
        fileId: documentId,
        mimeType: 'text/html',
    })

    return doc.data
}

module.exports = { downloader }
