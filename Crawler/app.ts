import * as request from "request";
import * as cheerio from "cheerio";

let baseurl = 'https://sh.lianjia.com/ershoufang/pudong/pg';
let condition = 'l2bp200ep380/'; // 2房 200 - 380
let curpage = 1;

let trymarkHouse = () => {

}

let searchHouse = () => {
    request(baseurl + curpage.toString() + condition, (error, response, body: string) => {
        if (!error && response.statusCode == 200) {
            let tpsidx = body.indexOf('"totalPage":');
            let tpeidx = body.indexOf(',', tpsidx);
            let pagecount = Number(body.substr(tpsidx + 12, tpeidx - tpsidx - 12));

            const $ = cheerio.load(body);
            let v = $('.sellListContent');
            let houses = v.children();
            for (let i = 0; i < houses.length; i++) {
                let house = houses[0];
            }

            curpage += 1;
            if (curpage <= pagecount) {
                searchHouse();
            }
        }
    })
}

searchHouse();