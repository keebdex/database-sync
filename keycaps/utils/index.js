// Helper function to remove HTML tags from a string
const removeHtmlTags = (str) => {
    if (str === null || str === '') {
        return ''
    } else {
        return str.toString().replace(/<[^>]*>/g, '')
    }
}

// Simplified mapping of profile names to IDs
const profileIdMapping = {
    'GMK CYL': 'gmk',
    GMK: 'gmk',
    CYL: 'gmk',
    MTNU: 'gmk-mtnu',
    ePBT: 'epbt',
    JTK: 'jtk',
    'Key Kobo': 'keykobo',
    PBTfans: 'pbtfans',
    'Signature Plastics': 'sa',
    DCS: 'dcs',
    DSA: 'dsa',
    KAT: 'kat',
    KAM: 'kam',
    MT3: 'mt3',
    XDA: 'xda',
}

// Function to find the profile_id and clean the keycap name
const getProfileInfo = (keycapName) => {
    const normalizedName = keycapName.toUpperCase()
    let profileId = null
    let cleanedName = keycapName

    for (const name in profileIdMapping) {
        if (normalizedName.includes(name.toUpperCase())) {
            profileId = profileIdMapping[name]
            cleanedName = keycapName.replace(new RegExp(name, 'i'), '').trim()
            break
        }
    }

    return { profileId, cleanedName }
}

module.exports = { removeHtmlTags, getProfileInfo }
