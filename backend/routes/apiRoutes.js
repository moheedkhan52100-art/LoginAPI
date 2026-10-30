const express = require("express");
const router = express.Router();
const countryCatalog = require("../data/countries.json");

// All routes below require a logged-in session
router.use((req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Please log in." });
    }
    res.set("Cache-Control", "no-store");
    next();
});

async function fetchUpstream(url, asText = false) {
    const response = await fetch(url, {
        headers: { "User-Agent": "NexusAPI/1.0" },
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
        const err = new Error("Upstream error " + response.status);
        err.status = response.status;
        throw err;
    }
    return asText ? response.text() : response.json();
}

// ---------- Test ----------
router.get("/test", (req, res) => {
    res.json({ success: true, message: "NexusAPI API is working!" });
});

// ---------- Weather (Open-Meteo, no key) ----------
router.get("/weather", async (req, res) => {
    const city = String(req.query.city || "").trim();
    if (!city || city.length > 80) {
        return res.status(400).json({ message: "Please enter a city name." });
    }

    try {
        const geo = await fetchUpstream(
            "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" +
            encodeURIComponent(city)
        );

        if (!geo.results || geo.results.length === 0) {
            return res.status(404).json({ message: "City not found." });
        }

        const place = geo.results[0];

        const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${place.latitude}&longitude=${place.longitude}` +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
            "&timezone=auto&forecast_days=5";

        const data = await fetchUpstream(url);

        res.json({
            place: {
                name: place.name,
                country: place.country,
                region: place.admin1 || ""
            },
            current: data.current,
            daily: data.daily
        });
    } catch (error) {
        console.error("Weather error:", error.message);
        res.status(502).json({ message: "Weather service is unavailable. Try again." });
    }
});

// ---------- Countries (local open dataset) ----------
router.get("/countries", (req, res) => {
    const search = String(req.query.search || "").trim();
    if (search.length > 80) {
        return res.status(400).json({ message: "Search must be 80 characters or fewer." });
    }
    if (!search) return res.json(countryCatalog);

    const normalize = (value) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const query = normalize(search);
    const names = (country) => [country.name.common, country.name.official]
        .map(normalize);
    const exactMatches = countryCatalog.filter((country) =>
        names(country).some((name) => name === query));
    const results = exactMatches.length
        ? exactMatches.slice(0, 1)
        : countryCatalog
            .filter((country) => names(country).some((name) => name.includes(query)))
            .slice(0, 12);

    res.json(results);
});
// ---------- News (BBC RSS feeds, no key) ----------
const NEWS_FEEDS = {
    world: "world",
    technology: "technology",
    business: "business",
    science: "science_and_environment",
    health: "health"
};

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) && items.length < 20) {
        const block = match[1];
        const get = (tag) => {
            const found = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
            return found
                ? found[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()
                : "";
        };
        items.push({
            title: get("title"),
            link: get("link"),
            description: get("description"),
            published: get("pubDate")
        });
    }
    return items;
}

router.get("/news", async (req, res) => {
    const category = String(req.query.category || "world");
    const search = String(req.query.search || "").trim();
    const feed = NEWS_FEEDS[category];

    if (!feed) {
        return res.status(400).json({ message: "Unknown category." });
    }
    if (search.length > 100) {
        return res.status(400).json({ message: "Search must be 100 characters or fewer." });
    }

    try {
        const xml = await fetchUpstream(
            "https://feeds.bbci.co.uk/news/" + feed + "/rss.xml", true
        );
        const query = search.toLocaleLowerCase();
        const matches = parseRSS(xml).filter((article) =>
            (String(article.title || "") + " " + String(article.description || ""))
                .toLocaleLowerCase().includes(query)
        ).slice(0, 15);
        res.json(matches);
    } catch (error) {
        console.error("News error:", error.message);
        res.status(502).json({ message: "News service is unavailable. Try again." });
    }
});

module.exports = router;
