async function search(query) {
  const res = await fetch(`https://4anime.gg/search?keyword=${encodeURIComponent(query)}`);
  const html = await res.text();
  const dom = new DOMParser().parseFromString(html, "text/html");

  const results = [...dom.querySelectorAll(".film-list .film-item")].map((el) => {
    const title = el.querySelector(".film-name a")?.textContent?.trim();
    const href = el.querySelector("a")?.getAttribute("href");
    const poster = el.querySelector("img")?.getAttribute("data-src") || "";

    return {
      title,
      url: href,
      poster,
    };
  });

  return results;
}

async function fetchAnimeInfo(url) {
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const title = doc.querySelector(".anime__details__title h3")?.textContent?.trim();
  const description = doc.querySelector(".anime__details__text p")?.textContent?.trim() || "";
  const episodes = [...doc.querySelectorAll(".ep-item a")].map((a) => ({
    title: a.textContent?.trim(),
    url: a.href,
  }));

  return {
    title,
    description,
    episodes,
  };
}

async function fetchVideoSources(episodeUrl) {
  const res = await fetch(episodeUrl);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const iframe = doc.querySelector("iframe");
  const embedUrl = iframe?.src;

  if (!embedUrl) return [];

  const sources = await extractSources(embedUrl);
  return sources;
}

async function extractSources(embedUrl) {
  const res = await fetch(embedUrl);
  const html = await res.text();
  const matches = [...html.matchAll(/file:\s*"(.*?)"/g)];

  const sources = matches.map((match) => ({
    url: match[1],
    quality: "Unknown",
    isM3U8: match[1].endsWith(".m3u8"),
  }));

  return sources;
}
async function fetchSubtitleTracks(embedUrl) {
  const res = await fetch(embedUrl);
  const html = await res.text();

  const subtitleMatches = [...html.matchAll(/tracks:\s*\[(.*?)\]/gs)];
  if (!subtitleMatches.length) return [];

  const trackJSON = `[${subtitleMatches[0][1]}]`;
  try {
    const tracks = JSON.parse(trackJSON.replace(/label/g, '"label"').replace(/file/g, '"file"'));
    return tracks.map((track) => ({
      label: track.label,
      url: track.file,
    }));
  } catch (e) {
    return [];
  }
}

function resolveMedia(sources, subtitles = []) {
  return sources.map((src) => ({
    url: src.url,
    quality: src.quality || "unknown",
    isM3U8: src.isM3U8,
    subtitles,
  }));
}

async function loadEpisode(episodeUrl) {
  const res = await fetch(episodeUrl);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const iframe = doc.querySelector("iframe");
  if (!iframe) throw new Error("Video iframe not found");

  const embedUrl = iframe.src;
  const sources = await extractSources(embedUrl);
  const subtitles = await fetchSubtitleTracks(embedUrl);

  return resolveMedia(sources, subtitles);
}

function getHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98 Safari/537.36",
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: getHeaders() });
  return await res.text();
}

function parseEpisodes(doc) {
  return [...doc.querySelectorAll(".ep-item a")].map((a) => ({
    title: a.textContent.trim(),
    url: a.href,
  }));
}

function parseMetadata(doc) {
  const title = doc.querySelector(".anime__details__title h3")?.textContent.trim() ?? "";
  const image = doc.querySelector(".anime__details__pic img")?.src ?? "";
  const description = doc.querySelector(".anime__details__text p")?.textContent.trim() ?? "";
  const genre = [...doc.querySelectorAll(".anime__details__widget ul li")]
    .map((li) => li.textContent.trim())
    .join(", ");

  return { title, image, description, genre };
}
export default {
  async search(query) {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchHtml(url);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const results = [...doc.querySelectorAll(".anime__item")].map((item) => {
      const title = item.querySelector(".anime__item__text h5 a")?.textContent.trim() ?? "";
      const url = item.querySelector("a")?.href ?? "";
      const image = item.querySelector("img")?.src ?? "";

      return { title, url, image };
    });

    return results;
  },

  async fetchMetadata(url) {
    const html = await fetchHtml(url);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const metadata = parseMetadata(doc);
    const episodes = parseEpisodes(doc);

    return {
      ...metadata,
      episodes,
    };
  },

  async fetchEpisodeSources(episodeUrl) {
    return await loadEpisode(episodeUrl);
  },
};
