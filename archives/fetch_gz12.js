const https = require("https");
const fs = require("fs");

// Fetch line-12 from metroman.cn
https.get("https://www.metroman.cn/cities/guangzhou/lines/line-12", {headers:{"User-Agent":"Mozilla/5.0"}}, res => {
    let d = "";
    res.on("data", c => d += c);
    res.on("end", () => {
        // Extract station names from the page
        var stationMatches = d.match(/station-name[^>]*>([^<]+)</g);
        if (stationMatches) {
            console.log("Found " + stationMatches.length + " station-name matches");
            stationMatches.forEach((m,i) => {
                var name = m.replace(/.*?>/, "").replace(/<.*/, "").trim();
                console.log("  [" + i + "] " + name);
            });
        } else {
            // Try alternate pattern
            var altMatches = d.match(/<a[^>]*href="[^"]*\/stations\/[^"]*"[^>]*>([^<]+)<\/a>/g);
            console.log("Alt matches: " + (altMatches ? altMatches.length : 0));
            if (altMatches) altMatches.forEach((m,i) => {
                console.log("  [" + i + "] " + m.replace(/.*?>/, "").replace(/<.*/, "").trim());
            });
        }
        
        // Also look for the line info
        var titleMatch = d.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) console.log("\nTitle: " + titleMatch[1]);
    });
}).on("error", e => console.error(e));