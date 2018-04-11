import * as request from "request";
import * as cheerio from "cheerio";
import xlsx from 'node-xlsx'; 
import * as fs from "fs";

let baseurl = 'https://sh.lianjia.com/ershoufang/beicai/pg';
let condition = 'l2bp200ep380/'; // 2房 200 - 380
let curpage = 1;

let pudongSheets = xlsx.parse('D:\\OneDrive\\2018ysx.xls');
let conatintest = ["福山", "六师", "明珠", "市实验东校", "新世界", "二中心", "外高桥", "北蔡", "东方", "昌邑"];

let filtered = new Array<Array<string>>();
filtered.push(["小区名称", "对口学校", "总价", "首付", "平米", "楼层年代", "网页地址"]);

let trycount = 0;
let markcount = 0;

function GetSchool( road: string , sheet: any ) : string {
    for (let i = 0; i < sheet.data.length; i++){
        if (sheet.data[i][5] == road || sheet.data[i][6] == road) {
            return sheet.data[i][3];
        }
    }
    return "";
}

let markHouse = (house: cheerio.Element, $: cheerio.Static, schoolname: string) => {
    markcount += 1;
    console.log("markcount:" + markcount);

    let detailurl = house.children[0].attribs["href"];
    let xiaoquname = $(house.children[1].children[1].children[0].children[1]).text();
    let price = $(house.children[1].children[5].children[0].children[0]).text();
    let houseinfo = $(house.children[1].children[1].children[0]).text();
    let houseinfos = houseinfo.split('|');
    let size = "没找到";
    for (let i = 0; i < houseinfos.length; i++) {
        if (houseinfos[i].indexOf("平米") != -1) {
            size = houseinfos[i];
            break;
        }
    }
    let levelinfo = $(house.children[1].children[2].children[0]).text();
    let levelinfos = levelinfo.split('-');
    let level = levelinfos[0];
    
    filtered.push([xiaoquname, schoolname, price, (Number(price) * 0.35), size, level, detailurl]);

    let buffer = xlsx.build([{ name: "result", data: filtered }]);
    fs.writeFileSync('D:\\result.xlsx', buffer);
}

let trymarkHouse = (house: cheerio.Element, base$: cheerio.Static) => {
    trycount += 1;
    console.log("trytimes:" + trycount);
    let xiaoqustr = house.children[1].children[1].children[0].children[1].attribs["href"];

    request(xiaoqustr, (error, response, body: string) => {
        if (!error && response.statusCode == 200) {
            let $ = cheerio.load(body);
            let locationStr = $('.detailDesc').text();
            let locations = locationStr.split(',');
            for (let i = 0; i < locations.length; i++) {
                let b = locations[i].lastIndexOf(")");
                let loc = locations[i].substr(b + 1, locations[i].length - b - 1);
                let school = GetSchool(loc, pudongSheets[0]);

                for (let j = 0; j < conatintest.length; j++) {
                    if (school.indexOf(conatintest[j]) != -1) {
                        markHouse(house, base$, school);
                        return;
                    }
                }
            }
        }
    })
}

let searchHouse = () => {
    request(baseurl + curpage.toString() + condition, (error, response, body: string) => {
        if (!error && response.statusCode == 200) {
            let tpsidx = body.indexOf('"totalPage":');
            let tpeidx = body.indexOf(',', tpsidx);
            let pagecount = Number(body.substr(tpsidx + 12, tpeidx - tpsidx - 12));

            let $ = cheerio.load(body);
            let v = $('.sellListContent');
            let houses = v.children();
            for (let i = 0; i < houses.length; i++) {
                trymarkHouse(houses[i] , $);
            }

            curpage += 1;
            if (curpage <= pagecount) {
                searchHouse();
            }
        }
    })
}

searchHouse();