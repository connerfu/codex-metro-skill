const fs = require("fs");
const slug = process.argv[2] || "beijing";
const file = "C:/Users/Conner/Downloads/" + slug + "_metro.json";

const SPECIAL_NAMES = {
    BJYZ: "\u4EA6\u5E84\u7EBF", BJCP: "\u660C\u5E73\u7EBF", BJFS: "\u623F\u5C71\u7EBF",
    BJYF: "\u71D5\u623F\u7EBF", BJXJ: "\u897F\u90CA\u7EBF", BJCA: "\u9996\u90FD\u673A\u573A\u7EBF",
    BJJX: "\u5927\u5174\u673A\u573A\u7EBF", BJYZT1: "\u4EA6\u5E84T1\u7EBF", BJ_LINE_S1: "\u5317\u4EAC\u5730\u94C1S1\u7EBF",
    GZ_GUANGFO_LINE: "\u5E7F\u4F5B\u7EBF", GZ_APM_LINE: "\u73E0\u6C5FAPM\u7EBF",
    SH_AIRPORT_LINK: "\u673A\u573A\u8054\u7EDC\u7EBF", SH_MAGLEV: "\u78C1\u6D6E\u6D6E\u7EBF",
    SHPJ: "\u6D66\u6C5F\u7EBF", SH_JINSHAN: "\u91D1\u5C71\u94C1\u8DEF",
    CQ_KONGGANG_LINE: "\u7A7A\u6E2F\u7EBF", CQ_GUOBO_LINE: "\u56FD\u535A\u7EBF",
    CQ_LOOP_LINE: "\u73AF\u7EBF", CQ_JIANGTIAO_LINE: "\u6C5F\u8DF3\u7EBF",
    CQ_BITONG_LINE: "\u74A7\u94DC\u7EBF", CQ_YUNBA: "\u4E91\u5DF4",
    TJ_JINJING_LINE: "\u6D25\u9759\u7EBF", TJ_LINE_Z4: "\u5929\u6D25\u5730\u94C1Z4\u7EBF",
    GZ_FOSHAN_LINE_2: "\u4F5B\u5C71\u5730\u94C12\u53F7\u7EBF", GZ_FOSHAN_LINE_3: "\u4F5B\u5C71\u5730\u94C13\u53F7\u7EBF",
    GZ_NANHAI_TRAM: "\u5357\u6D77\u6709\u8F68\u7535\u8F661\u53F7\u7EBF",
    GZ_TRAM_HAIZHU: "\u6D77\u73E0\u6709\u8F68\u7535\u8F66",
    GZ_TRAM_HP1: "\u9EC4\u57D4\u6709\u8F68\u7535\u8F661\u53F7\u7EBF", GZ_TRAM_HP2: "\u9EC4\u57D4\u6709\u8F68\u7535\u8F662\u53F7\u7EBF",
};

const CITY_CHARS = {
    beijing: "\u5317\u4EAC", shanghai: "\u4E0A\u6D77", guangzhou: "\u5E7F\u5DDE",
    shenzhen: "\u6DF1\u5733", chengdu: "\u6210\u90FD", chongqing: "\u91CD\u5E86",
    hangzhou: "\u676D\u5DDE", nanjing: "\u5357\u4EAC", tianjin: "\u5929\u6D25",
    wuhan: "\u6B66\u6C49", shenyang: "\u6C88\u9633", changchun: "\u957F\u6625",
    xian: "\u897F\u5B89", zhengzhou: "\u90D1\u5DDE", qingdao: "\u9752\u5C9B",
    suzhou: "\u82CF\u5DDE", wuxi: "\u65E0\u9521", xiamen: "\u53A6\u95E8",
    dalian: "\u5927\u8FDE", haerbin: "\u54C8\u5C14\u6EE8", dongguan: "\u4E1C\u839E",
    nanning: "\u5357\u5B81", foshan: "\u4F5B\u5C71", shaoxing: "\u7ECD\u5174",
    zhuhai: "\u73E0\u6D77", zhongshan: "\u4E2D\u5C71", wulumuqi: "\u4E4C\u9C81\u6728\u9F50",
    xianyang: "\u54B8\u9633",
};

function main() {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const lines = data.data.lines;
    const city = CITY_CHARS[slug] || slug;
    let fixed = 0;

    for (const l of lines) {
        if (SPECIAL_NAMES[l.id]) {
            l.name = SPECIAL_NAMES[l.id];
            fixed++;
        } else {
            const numMatch = l.id.match(/\d+$/);
            if (numMatch) {
                l.name = city + "\u5730\u94C1" + parseInt(numMatch[0]) + "\u53F7\u7EBF";
                fixed++;
            }
        }
    }

    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    console.log("Fixed " + fixed + "/" + lines.length + " line names");
}

main();