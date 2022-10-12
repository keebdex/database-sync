const { google } = require('googleapis')

const downloader = async (documentId) => {
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
