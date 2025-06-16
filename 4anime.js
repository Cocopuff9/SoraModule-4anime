const BASE_URL = 'https://4anime.gg';
const SEARCH_URL = `${BASE_URL}/search`;

async function areRequiredServersUp() {
    const requiredHosts = ['https://4anime.gg'];

    try {
        let results = await Promise.allSettled(requiredHosts.map(host =>
            soraFetch(host, { method: 'HEAD' }).then(response => {
                response.host = host;
                return response;
            })
        ));

        for (let res of results) {
            if (res.status === 'rejected' || res.value?.status !== 200) {
                let message = 'Required source ' + res.value?.host + ' is currently down.';
                console.log(message);
                return {
                    success: false,
                    error: encodeURIComponent(message),
                    searchTitle: `Error: Cannot access ${res.value?.host}. Server might be down.`
                };
            }
        }

        return { success: true, error: null, searchTitle: null };
    } catch (err) {
        console.log('Server check failed: ' + err.message);
        return {
            success: false,
            error: encodeURIComponent('Server check failed'),
            searchTitle: 'Error: Server check failed. Please try again later.'
        };
    }
}

async function searchResults(keyword) {
    const serversUp = await areRequiredServersUp();

    if (!serversUp.success) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/main/sora_host_down.png',
            href: '#' + serversUp.error
        }]);
    }

    try {
        const res = await soraFetch(`${BASE_URL}/search?query=${encodeURIComponent(keyword)}`);
        const html = typeof res === 'object' ? await res.text() : res;
        const $ = cheerio.load(html);
        const results = [];

        $('.film-list .flw-item').each((i, el) => {
            const title = $(el).find('.film-name a').attr('title')?.trim();
            const href = BASE_URL + $(el).find('.film-name a').attr('href');
            const image = $(el).find('img').attr('data-src')?.trim();

            if (title && href && image) {
                results.push({ title, href, image });
            }
        });

        return JSON.stringify(results);
    } catch (err) {
        console.log('Search error: ' + err.message);
        return JSON.stringify([]);
    }
}
async function extractDetails(url) {
    if (url.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(url.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    try {
        const res = await soraFetch(url);
        const html = typeof res === 'object' ? await res.text() : res;
        const $ = cheerio.load(html);

        const description = $('div.synopsis > p').first().text().trim() || 'No description available.';
        const aliases = $('div.infox > h1').text().trim();
        const airdate = $('span.date').first().text().trim() || 'Unknown';

        return JSON.stringify([{
            description,
            aliases,
            airdate
        }]);
    } catch (err) {
        console.log('Details error: ' + err.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Aliases unknown',
            airdate: 'Airdate unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    if (url.startsWith('#')) {
        console.log('Cannot get episodes — host down');
        return JSON.stringify([]);
    }

    try {
        const res = await soraFetch(url);
        const html = typeof res === 'object' ? await res.text() : res;
        const $ = cheerio.load(html);

        const episodes = [];
        const idMatch = url.match(/\/([^/]+)\/?$/);
        const slug = idMatch ? idMatch[1] : null;

        $('ul.episodes li a').each((i, el) => {
            const epLink = $(el).attr('href');
            const epNum = parseFloat($(el).text().trim().replace('Episode', '').trim());
            if (epLink && !isNaN(epNum)) {
                episodes.push({
                    href: epLink,
                    number: epNum
                });
            }
        });

        if (episodes.length === 0) {
            // fallback to default player if episode list is not present
            episodes.push({ href: url, number: 1 });
        }

        return JSON.stringify(episodes.reverse());
    } catch (err) {
        console.log('Episode extraction failed: ' + err.message);
        return JSON.stringify([]);
    }
}
async function extractStreamUrl(url) {
    try {
        if (url.startsWith('#')) throw new Error('Invalid URL – site down');

        const pageRes = await soraFetch(url);
        const pageHtml = typeof pageRes === 'object' ? await pageRes.text() : pageRes;
        const $ = cheerio.load(pageHtml);

        let embedUrl = $('iframe[src*="stream"]').attr('src');

        if (!embedUrl) {
            // fallback for older embeds
            const scriptContent = $('script').filter((i, el) => {
                return $(el).html().includes('var player_');
            }).first().html();

            const sourceMatch = /"file":"(.*?)"/.exec(scriptContent);
            embedUrl = sourceMatch ? sourceMatch[1].replace(/\\/g, '') : null;
        }

        if (!embedUrl) throw new Error('Could not locate stream embed URL');

        const embedRes = await soraFetch(embedUrl);
        const embedHtml = typeof embedRes === 'object' ? await embedRes.text() : embedRes;

        const m3u8Match = embedHtml.match(/(https?:\/\/[^"'<>\\\s]+\.m3u8[^"'<>\\\s]*)/);
        if (!m3u8Match) throw new Error('HLS (.m3u8) stream not found');

        const m3u8Url = m3u8Match[1];
        const subtitles = [];

        // Check for VTT or closed caption links
        const vttRegex = /"file":"(https?:\/\/[^"]+\.vtt)"/g;
        let match;
        while ((match = vttRegex.exec(embedHtml)) !== null) {
            const subUrl = match[1];
            const isEnglish = /en|english/i.test(subUrl);
            if (isEnglish) {
                subtitles.push({ label: 'English', file: subUrl, kind: 'captions' });
            }
        }

        // Optionally allow quality selection here (if multiple m3u8 variants exist)
        // Many players handle this automatically

        return JSON.stringify({
            stream: m3u8Url,
            subtitles: subtitles.length > 0 ? subtitles[0].file : null
        });

    } catch (err) {
        console.log('Stream extraction failed: ' + err.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}
/**
 * soraFetch attempts to use fetchv2 and falls back to normal fetch
 * This increases the reliability across environments (e.g., webview, proxy, or CLI)
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e1) {
        try {
            return await fetch(url, options);
        } catch (e2) {
            console.log(`Both fetch methods failed for ${url}`);
            return null;
        }
    }
}

// Optional: Headers to help bypass anti-bot filters
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': '*/*',
    'Referer': 'https://4anime.gg/',
};

/**
 * Helper: Clean title by removing special characters
 */
function cleanTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Helper: Resolve full URL from relative href
 */
function resolveUrl(path) {
    if (path.startsWith('http')) return path;
    return `https://4anime.gg${path}`;
}
const Scraper = {
    /**
     * Sora standard module endpoints
     */
    async search(keyword) {
        return await searchResults(keyword);
    },

    async getDetails(url) {
        return await extractDetails(url);
    },

    async getEpisodes(url) {
        return await extractEpisodes(url);
    },

    async getVideo(url) {
        return await extractStreamUrl(url);
    },
};

// Export to Sora
globalThis.scraper = Scraper;
