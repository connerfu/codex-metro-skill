// lib/config.js — 统一的城市配置和映射表
// 关键改动：集中管理所有城市配置、前缀、特殊线路、BBOX、调色板

const { skillPath, readJSON } = require("./io");

// ===== 城市前缀映射 =====
const PREFIX = {
  beijing: "BJ", shanghai: "SH", guangzhou: "GZ", shenzhen: "SZ",
  chengdu: "CD", chongqing: "CQ", hangzhou: "HZ", nanjing: "NJ",
  tianjin: "TJ", wuhan: "WH", shenyang: "SY", changchun: "CC",
  xian: "XA", zhengzhou: "ZZ", qingdao: "QD", suzhou: "SZ2",
  wuxi: "WX", xiamen: "XM", dalian: "DL", haerbin: "HEB",
  dongguan: "DG", nanning: "NN", foshan: "FS", shaoxing: "SX",
  zhuhai: "ZH", xianyang: "XY", wulumuqi: "WLMQ", zhongshan: "ZS"
};

// ===== 城市中文名映射 =====
const CITY_CHARS = {
  beijing: "北京", shanghai: "上海", guangzhou: "广州",
  shenzhen: "深圳", chengdu: "成都", chongqing: "重庆",
  hangzhou: "杭州", nanjing: "南京", tianjin: "天津",
  wuhan: "武汉", shenyang: "沈阳", changchun: "长春",
  xian: "西安", zhengzhou: "郑州", qingdao: "青岛",
  suzhou: "苏州", wuxi: "无锡", xiamen: "厦门",
  dalian: "大连", haerbin: "哈尔滨", dongguan: "东莞",
  nanning: "南宁", foshan: "佛山", shaoxing: "绍兴",
  zhuhai: "珠海", zhongshan: "中山", wulumuqi: "乌鲁木齐",
  xianyang: "咸阳"
};

// ===== BBOX 四至范围 =====
const BBOX = {
  beijing: [39.4, 41.0, 115.5, 117.5],
  shanghai: [30.5, 31.8, 120.8, 122.2],
  guangzhou: [22.3, 23.8, 112.8, 114.2],
  shenzhen: [22.3, 22.9, 113.7, 114.6],
  chengdu: [30.1, 31.0, 103.5, 104.8],
  chongqing: [28.0, 31.5, 105.0, 109.5],
  hangzhou: [29.8, 30.7, 119.5, 121.5],
  nanjing: [31.0, 32.6, 118.2, 119.3],
  tianjin: [38.5, 40.2, 116.5, 118.5],
  wuhan: [29.8, 31.0, 113.7, 115.5],
  shenyang: [41.5, 42.5, 122.8, 124.5],
  changchun: [43.5, 44.2, 125.0, 125.6],
  xian: [34.0, 34.6, 108.5, 109.3],
  zhengzhou: [34.3, 35.1, 113.0, 114.3],
  qingdao: [35.8, 36.6, 119.8, 121.2],
  suzhou: [30.9, 31.7, 120.3, 121.3],
  wuxi: [31.1, 31.9, 119.9, 120.8],
  xiamen: [24.2, 24.8, 117.8, 118.5],
  dalian: [38.6, 39.3, 121.1, 122.2],
  haerbin: [45.3, 46.2, 126.1, 127.2],
  dongguan: [22.6, 23.3, 113.4, 114.3],
  nanning: [22.3, 23.1, 107.8, 109.0],
  foshan: [22.6, 23.4, 112.6, 113.4],
  shaoxing: [29.7, 30.5, 120.1, 121.1],
  zhuhai: [22.0, 22.5, 113.1, 113.6],
  xianyang: [34.1, 34.6, 108.3, 109.1],
  wulumuqi: [43.4, 44.2, 87.1, 88.2],
  zhongshan: [22.3, 22.8, 113.1, 113.7]
};

// ===== 特殊线路 ID 映射 =====
const SPECIAL_LINE_IDS = {
  "guangfo-line": "GZ_GUANGFO_LINE", "apm-line": "GZ_APM_LINE",
  "tram-haizhu": "GZ_TRAM_HAIZHU", "pujiang-line": "SHPJ",
  "airport-link-line": "SH_AIRPORT_LINK", "jinshan-railway": "SH_JINSHAN",
  "maglev-line": "SH_MAGLEV", "pingshan-skyshuttle-line-1": "SZ_PINGSHAN",
  "foshan-line-2": "GZ_FOSHAN_LINE_2", "foshan-line-3": "GZ_FOSHAN_LINE_3",
  "nanhai-tram-line-1": "GZ_NANHAI_TRAM", "tram-huangpu-line-1": "GZ_TRAM_HP1",
  "tram-huangpu-line-2": "GZ_TRAM_HP2", "yizhuang-line": "BJYZ",
  "changping-line": "BJCP", "fangshan-line": "BJFS",
  "yanfang-line": "BJYF", "xijiao-line": "BJXJ",
  "capital-airport-express": "BJCA", "daxing-airport-express": "BJJX",
  "yizhuang-t1-line": "BJYZT1"
};

// ===== 特殊线路中文名 =====
const SPECIAL_LINE_NAMES = {
  "GZ_GUANGFO_LINE": "广佛线", "GZ_APM_LINE": "珠江APM线",
  "GZ_TRAM_HAIZHU": "海珠有轨电车", "SHPJ": "浦江线",
  "SH_AIRPORT_LINK": "机场联络线", "SH_JINSHAN": "金山铁路",
  "SH_MAGLEV": "磁浮线", "SZ_PINGSHAN": "坪山云巴1号线",
  "GZ_FOSHAN_LINE_2": "佛山地铁2号线", "GZ_FOSHAN_LINE_3": "佛山地铁3号线",
  "GZ_NANHAI_TRAM": "南海有轨电车1号线",
  "GZ_TRAM_HP1": "黄埔有轨电车1号线", "GZ_TRAM_HP2": "黄埔有轨电车2号线",
  "BJYZ": "亦庄线", "BJCP": "昌平线", "BJFS": "房山线",
  "BJYF": "燕房线", "BJXJ": "西郊线", "BJCA": "首都机场线",
  "BJJX": "大兴机场线", "BJYZT1": "亦庄T1线", "BJ_LINE_S1": "北京地铁S1线",
  "CQ_KONGGANG_LINE": "空港线", "CQ_GUOBO_LINE": "国博线",
  "CQ_LOOP_LINE": "环线", "CQ_JIANGTIAO_LINE": "江跳线",
  "CQ_BITONG_LINE": "璧铜线", "CQ_YUNBA": "云巴",
  "TJ_JINJING_LINE": "津静线", "TJ_LINE_Z4": "天津地铁Z4线",
  "CD_TRAMWAY_RONG_2_LINE": "有轨电车蓉二线",
  "CD_TRAMWAY_RONG_2_LINE_BRANCH": "有轨电车蓉二线(支线)",
  "CD_LINE_S3": "资阳线(S3)"
};

/**
 * 获取城市配置（从 city_config.json 加载）
 * @param {string} slug
 * @returns {object|null}
 */

// ===== 环线列表（城市slug: [线路ID数组]） =====
const RING_LINES = {
  beijing: ["BJ2", "BJ10"],
  shanghai: ["SH4"],
  chengdu: ["CD7"],
  chongqing: ["CQ_LOOP_LINE"],
  wuhan: ["WH12"],
  zhengzhou: ["ZZ5"],
  xian: ["XA8"],
  shenzhen: ["SZ10"]
};



// ===== 线路名映射（slug: {lineId: displayName}） =====
// 用于修复参考文件编码损坏，确保anchors.js能查到正确的搜索词
const LINE_NAMES_BY_ID = {
  "beijing": {
    "BJ1": "北京地铁1号线",
    "BJ2": "北京地铁2号线",
    "BJ3": "北京地铁3号线",
    "BJ4": "北京地铁4号线",
    "BJ5": "北京地铁5号线",
    "BJ6": "北京地铁6号线",
    "BJ7": "北京地铁7号线",
    "BJ8": "北京地铁8号线",
    "BJ9": "北京地铁9号线",
    "BJ10": "北京地铁10号线",
    "BJ11": "北京地铁11号线",
    "BJ12": "北京地铁12号线",
    "BJ13": "北京地铁13号线",
    "BJ14": "北京地铁14号线",
    "BJ15": "北京地铁15号线",
    "BJ16": "北京地铁16号线",
    "BJ17": "北京地铁17号线",
    "BJ18": "北京地铁18号线",
    "BJ19": "北京地铁19号线",
    "BJYZ": "亦庄线",
    "BJCP": "昌平线",
    "BJFS": "房山线",
    "BJYF": "燕房线",
    "BJ_LINE_S1": "北京地铁S1线",
    "BJXJ": "西郊线",
    "BJCA": "首都机场线",
    "BJJX": "大兴机场线",
    "BJYZT1": "亦庄T1线"
  }
};

function getCityConfig(slug) {
  const config = readJSON(skillPath("city_config.json"));
  return config ? config[slug] : null;
}

/**
 * 获取所有城市 slug 列表
 * @returns {string[]}
 */
function getAllCitySlugs() {
  const config = readJSON(skillPath("city_config.json"));
  return config ? Object.keys(config) : Object.keys(BBOX);
}

module.exports = {
  PREFIX, CITY_CHARS, BBOX, SPECIAL_LINE_IDS, SPECIAL_LINE_NAMES,
  RING_LINES, LINE_NAMES_BY_ID, getCityConfig, getAllCitySlugs
};

