const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

// Look at GZ1 station 0
var s = lines[0].stations[0];
console.log("Name:", s.name);
console.log("Chars:", s.name.split("").map(function(c){ return c + "(" + c.charCodeAt(0).toString(16) + ")" }).join(" "));
console.log("Lat:", s.lat, "Lng:", s.lng);
console.log("Diff from 23.066:", Math.abs(s.lat - 23.066));