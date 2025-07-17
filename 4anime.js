const BASE_URL = "https://4anime.gg";

function searchResults(html) {
    const results = [];
    const regex = /<a href="(\/anime\/[^"]+)"[^>]*class="name">([^<]+)<\/a>[\s\S]*?src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(html))) {
        results.push({
            title: match[2].trim(),
            href: BASE_URL + match[1],
            image: match[3].startsWith('http') ? match[3] : BASE_URL + match[3]
        });
    }
    return results;
}

function extractDetails(html) {
    const description = /<p class="description">([\s\S]*?)<\/p>/.exec(html)?.[1]?.trim() || '';
    const airdate = /<span class="year">([^<]+)<\/span>/.exec(html)?.[1] || '';
    return {
        description: description,
        airdate: airdate,
        aliases: null
    };
}

function extractEpisodes(html) {
    const episodes = [];
    const epRegex = /<a href="(\/episode\/[^"]+)"[^>]*>\s*Episode\s*(\d+)\s*<\/a>/g;
    let match;
    while ((match = epRegex.exec(html))) {
        episodes.push({
            number: match[2],
            href: BASE_URL + match[1]
        });
    }
    return episodes;
}

function extractStreamUrl(html) {
    // Regex to extract all stream qualities and subtitles if embedded
    const sources = [];
    const regex = /<source\s+src="([^"]+)"\s+label="([^"]+)"[^>]*>/g;
    let match;
    while ((match = regex.exec(html))) {
        sources.push({
            url: match[1],
            quality: match[2],
            isSoftSub: true, // Assume subs are soft by default (adjust if needed)
            subtitles: extractSubtitles(html)
        });
    }
    return sources.length > 0 ? sources : null;
}

function extractSubtitles(html) {
    // Example subtitle extractor
    const subs = [];
    const regex = /<track\s+kind="subtitles"\s+src="([^"]+)"\s+srclang="en"[^>]*>/g;
    let match;
    while ((match = regex.exec(html))) {
        subs.push({
            lang: 'en',
            url: match[1]
        });
    }
    return subs;
}

module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl
}; 
