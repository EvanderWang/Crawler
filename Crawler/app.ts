import * as request from "request";
import * as cheerio from "cheerio";
import xlsx from 'node-xlsx'; 
import * as fs from "fs";

let baseurl = 'https://sh.lianjia.com/ershoufang/pudong/pg';
let condition = 'l2bp200ep380/'; // 2房 200 - 380
let curpage = 1;

let pudongSheets = xlsx.parse('D:\\OneDrive\\2018ysx.xls');
let conatintest = ["福山", "六师", "明珠", "市实验东校", "新世界", "二中心", "外高桥", "北蔡", "东方", "昌邑"];

let filtered = new Array<Array<string>>();

function GetSchool( road: string , sheet: any ) : string {
    for (let i = 0; i < sheet.data.length; i++){
        if (sheet.data[i][5] == road || sheet.data[i][6] == road) {
            return sheet.data[i][3];
        }
    }
    return "";
}

let markHouse = (house: cheerio.Element) => {
    let detailurl = house.children[0].attribs["href"];
    let xiaoquname = house.children[1].children[1].children[0].children[1].children[0].data;
    filtered.push([xiaoquname, detailurl]);

    let buffer = xlsx.build([{ name: "result", data: filtered }]);
    fs.writeFileSync('D:\\result.xlsx', buffer);
}

let trymarkHouse = (house: cheerio.Element) => {
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
                        markHouse(house);
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
                //trymarkHouse(houses[0]);
                markHouse(houses[i]);
            }

            curpage += 1;
            if (curpage <= pagecount) {
                searchHouse();
            }
        }
    })
}

searchHouse();