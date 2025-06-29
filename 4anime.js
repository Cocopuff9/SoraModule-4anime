/** @sora-module */
export default {
  id: "4anime",
  name: "4Anime",
  description: "Stream anime from 4anime.gg with English soft subtitles and multiple quality support",
  icon: "https://4anime.gg/favicon.ico",
  baseURL: "https://4anime.gg",
  version: 1,
  streamAsync: async (args) => {
    const fetch = args.fetch;
    const cheerio = args.cheerio;
    const query = args.query;
    const type = args.type;
    const page = args.page || 1;
    const id = args.id;

    const base = "https://4anime.gg";

    if (type === "search") {
      const searchURL = `${base}/?s=${encodeURIComponent(query)}`;
      const res = await fetch(searchURL);
      const $ = cheerio.load(res.text());

      const results = [];

      $("div#content article").each((_, el) => {
        const title = $(el).find("h3").text().trim();
        const url = $(el).find("a").attr("href");
        const img = $(el).find("img").attr("src");
        const desc = $(el).find("p").text().trim();

        results.push({
          id: url,
          title,
          image: img,
          description: desc,
          type: "series"
        });
      });

      return results;
    }
     } else if (type === "meta") {
      const res = await fetch(id);
      const $ = cheerio.load(res.text());

      const title = $("h1.entry-title").text().trim();
      const image = $("div.cover img").attr("src");
      const description = $("div.description > p").first().text().trim();

      const episodes = [];

      $("ul.episodes > li").each((_, el) => {
        const epURL = $(el).find("a").attr("href");
        const epTitle = $(el).find("a").text().trim();
        if (epURL) {
          episodes.push({
            id: epURL,
            title: epTitle
          });
        }
      });

      return {
        title,
        image,
        description,
        episodes
      };
    }   
    else if (type === "stream") {
      const res = await fetch(id);
      const html = res.text();

      const sources = [];
      const subtitles = [];

      // Extract HLS (.m3u8) master playlist using regex
      const hlsMatch = html.match(/file:\s*["'](https:\/\/[^"']+\.m3u8)["']/);
      if (hlsMatch) {
        const hlsUrl = hlsMatch[1];
        sources.push({
          url: hlsUrl,
          format: "hls",
          quality: "auto"
        });
      }

      // Extract MP4 fallback(s) — if any
      const mp4Matches = [...html.matchAll(/file:\s*["'](https:\/\/[^"']+\.mp4[^"']*)["']/g)];
      mp4Matches.forEach((match) => {
        sources.push({
          url: match[1],
          format: "mp4",
          quality: "unknown"
        });
      });

      // Subtitles (.vtt/.srt/.ass) if present
      const subMatches = [...html.matchAll(/tracks:\s*\[\s*\{\s*file:\s*["']([^"']+\.(vtt|srt|ass))["']/g)];
      subMatches.forEach((match) => {
        subtitles.push({
          url: match[1],
          lang: "English",
          type: match[2]
        });
      });

      return {
        sources,
        subtitles
      };
    }
    else {
      throw new Error("Unsupported request type: " + type);
    }
  }
};
// This Sora module supports the following:
// ✅ Anime search
// ✅ Metadata (title, image, description)
// ✅ Episode list
// ✅ Streaming (HLS and MP4)
// ✅ English soft subtitles

// Module by: Wisest Gamemaster 580 (with help from ChatGPT)
// Based on structure from AniCrush.js

// How to use:
// 1. Upload this JS file to GitHub or a raw host
// 2. In the Sora app, go to Modules > Add via URL
// 3. Paste the raw GitHub URL and enjoy streaming from 4anime.gg!
