import { load } from "cheerio";
import fetch from "node-fetch";

const baseUrl = "https://4anime.gg";

function extractSlug(url) {
  const match = url.match(/\/(anime|watch)\/([^\/?#]+)/);
  return match ? match[2] : null;
}

async function getPopular(page = 1) {
  const res = await fetch(`${baseUrl}/?page=${page}`);
  const html = await res.text();
  const $ = load(html);
  const results = [];

  $("div#seriesList div.series").each((_, el) => {
    const title = $(el).find("h5 a").text().trim();
    const url = $(el).find("h5 a").attr("href");
    const image = $(el).find("img").attr("src");

    if (title && url && image) {
      results.push({
        title,
        url: baseUrl + url,
        img: image.startsWith("http") ? image : baseUrl + image,
      });
    }
  });

  return results;
}

async function search(query) {
  const res = await fetch(`${baseUrl}/search?keyword=${encodeURIComponent(query)}`);
  const html = await res.text();
  const $ = load(html);
  const results = [];

  $("div#seriesList div.series").each((_, el) => {
    const title = $(el).find("h5 a").text().trim();
    const url = $(el).find("h5 a").attr("href");
    const image = $(el).find("img").attr("src");

    if (title && url && image) {
      results.push({
        title,
        url: baseUrl + url,
        img: image.startsWith("http") ? image : baseUrl + image,
      });
    }
  });

  return results;
}
async function search(query) {
  const url = `https://4anime.gg/search?keyword=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const $ = cheerio.load(res);
  const results = [];

  $('.film_list-wrap .flw-item').each((i, elem) => {
    const title = $(elem).find('.film-name a').text().trim();
    const image = $(elem).find('.film-poster-img').attr('data-src') || '';
    const link = $(elem).find('a').attr('href');
    const idMatch = link?.match(/\/anime\/([^/]+)/);
    const id = idMatch ? idMatch[1] : link;

    results.push({
      id,
      title,
      image,
      url: 'https://4anime.gg' + link,
    });
  });

  return results;
}

async function getAnimeInfo(id) {
  const url = `https://4anime.gg/anime/${id}`;
  const res = await fetch(url);
  const $ = cheerio.load(res);

  const title = $('h2.film-name.dynamic-name').text().trim();
  const description = $('div.description').text().trim();
  const image = $('div.anisc-poster img').attr('src');
  const episodes = [];

  $('div.eps-list a.ep-item').each((i, el) => {
    const epUrl = $(el).attr('href');
    const epNum = $(el).find('.tick-item.tick-quality').text().trim();
    const epId = epUrl?.split('/').pop();

    episodes.push({
      id: epId,
      number: epNum || `${i + 1}`,
      title: `Episode ${epNum || i + 1}`,
      url: 'https://4anime.gg' + epUrl,
    });
  });

  return {
    title,
    description,
    image,
    episodes: episodes.reverse(),
  };
}
async function getSources(episodeId) {
  const epUrl = `https://4anime.gg/watch/${episodeId}`;
  const res = await fetch(epUrl);
  const html = res;
  
  // Regex to find streaming iframe URL
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
  if (!iframeMatch) throw new Error("Streaming iframe not found");

  const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : `https:${iframeMatch[1]}`;
  const embedRes = await fetch(iframeUrl);
  const embedHtml = embedRes;

  // Regex to find streaming .m3u8 HLS file
  const streamMatch = embedHtml.match(/(https:\/\/[^"']+\.m3u8[^"']*)/);
  if (!streamMatch) throw new Error("Stream URL not found");

  const streamUrl = streamMatch[1];

  // Regex to find subtitle tracks (vtt, srt, etc.)
  const subtitles = [];
  const subtitleRegex = /{file:"([^"]+)",label:"([^"]+)",kind:"captions"}/g;
  let match;
  while ((match = subtitleRegex.exec(embedHtml)) !== null) {
    subtitles.push({
      url: match[1],
      lang: match[2],
    });
  }

  return {
    stream: {
      url: streamUrl,
      type: "hls",
      quality: "auto",
    },
    subtitles,
  };
}
module.exports = {
  search,
  getAnimeInfo,
  getEpisodeList,
  getSources,
};
