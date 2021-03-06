﻿import request from "sync-request";
import * as asyncrequest from "request";
import * as cheerio from "cheerio";

import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";
import { VMetroInfoManager } from "./VMetroInfoManager";
import { VSchoolInfoManager } from "./VSchoolInfoManager";
import { VSDataChange, VHouse, VDataManager } from "./VDataManager";

let refuseSquare = 65;
let maxPrize = 451;
let minPrize = 200;

var lianjia_basepart = 'https://sh.lianjia.com/ershoufang/';
var lianjia_pagepart = '/pg';
var lianjia_condpart = 'l2l3l4l5l6ba' + refuseSquare + 'ea10000bp' + minPrize + 'ep' + maxPrize + '/';
var city = SS.Gaode_city_shanghai;


const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

class VRegionSearcher {
    constructor(public dMngr: VDataManager, public mMnrg: VMetroInfoManager) { }
    searchRegion(region_name: string, lianjia_url: string, done: () => void) {
        console.log("start search region : " + region_name);

        let regionUrl = lianjia_basepart + lianjia_url + lianjia_pagepart + "1" + lianjia_condpart;
        let regionUrlBody = request("GET", regionUrl).getBody().toString();
        let findidx = regionUrlBody.indexOf('"total fl"');
        let countsidx = regionUrlBody.indexOf('<span>', findidx) + 6;
        let counteidx = regionUrlBody.indexOf('</span>', findidx);
        let count = Number(regionUrlBody.substr(countsidx, counteidx - countsidx).trim());

        let pagecount = 0;
        if (count != 0) {
            pagecount = Math.ceil(count / 30);

            let curPage = 0;
            let search = () => {
                curPage += 1;
                console.log("start search page : " + curPage + " page count : " + pagecount);
                let pageListUrl = lianjia_basepart + lianjia_url + lianjia_pagepart + curPage + lianjia_condpart;
                let pageList$ = cheerio.load(request("GET", pageListUrl).getBody());

                this.searchListPage(pageList$, () => {
                    if (curPage == pagecount) {
                        done();
                    } else {
                        search();
                    }
                });
            }
            search();
        }

        if (pagecount == 0) {
            done();
        }
    }

    searchListPage(listpage$: CheerioStatic, done: () => void) {
        let list = listpage$('.sellListContent');
        let housescount = list.children().length;

        let waits = Vasync.createAWaitAll(housescount, done);
        //for (let i = 0; i < housescount; i++) {
        //    console.log("check item " + i);
        //    let curIdx = i;
        //    this.checkListItem(list.children()[curIdx], () => { waitObj.FinishFunc(); });
        //}

        let curHouse = 0;
        let search = () => {
            if (curHouse < housescount) {
                console.log("check item " + curHouse);
        
                let item = list.children()[curHouse];
                let waitObj = waits[curHouse];
                curHouse += 1;
                this.checkListItem(item, () => { waitObj.FinishFunc(); });

                sleep(20).then(search);
            }
        }
        search();
    }

    checkListItem(itemEle: CheerioElement, done: () => void) {
        if (itemEle.attribs["class"] == "list_guide") {
            done();
            return;
        }
        let houseUrl = itemEle.children[0].attribs["href"];
        if (!this.dMngr.datas.has(houseUrl)) {
            //let infoStr = itemEle.children[1].children[1].children[0].children[2].data;
            //let infos = infoStr.split('|');
            //let size = 0;
            //for (let i = 0; i < infos.length; i++) {
            //    let pos = infos[i].indexOf("平米");
            //    if (pos != -1) {
            //        size = Number(infos[i].slice(0, pos));
            //        break;
            //    }
            //}
            //
            //if (size < refuseSquare) {
            //    done();
            //    return;
            //} else {
                //console.log("start mark item");
                let trim = (s: string): string => {
                    return s.replace(/(^\s*)|(\s*$)/g, "");
                }
                let cellName = trim(itemEle.children[1].children[1].children[0].children[1].children[0].data);
                this.mMnrg.MarkMetro(cellName, city, () => {
                    this.markHouse(houseUrl, done);
                });
            //}
        } else {
            done();
            return;
        }
    }

    markHouse(houseUrl: string, done: () => void) {
        asyncrequest(houseUrl, (error: any, response: any, body: any) => {
            if (!error && response.statusCode == 200) {
                let housePage$ = cheerio.load(response.body);
                let house = new VHouse();
                house.loadFromPage(houseUrl, housePage$);
                this.dMngr.datas.set(houseUrl, [house, new VSDataChange()]);
                done();
            } else {
                console.log("error at request houseURL : " + houseUrl);
                done();
            }
        });
    }
}

var saveSubFolder = "results\\";
let schoolMngr = new VSchoolInfoManager(() => {
    let metroMngr = new VMetroInfoManager(() => {

        let done = () => {
            metroMngr.SaveMetroCells(() => {
                console.log("DONE.");
            });
        };

        let regionSearch = (rName: string, rPart: string, done: () => void) => {
            let dataMngr = new VDataManager(() => {
                let seacher = new VRegionSearcher(dataMngr, metroMngr);
                seacher.searchRegion(rName, rPart, () => {
                    metroMngr.SaveMetroCells(() => {
                        dataMngr.saveToExcel(metroMngr, schoolMngr, () => {
                            console.log("region finish : " + rName);
                            done();
                        });
                    });
                });
            }, saveSubFolder + "result_" + rName + ".xlsx");

        };

        //regionSearch("唐镇", "tangzhen", done);

        let workbook = new Excel.Workbook();
        workbook.xlsx.readFile(SS.OneDriveHouseFolder + 'search_region.xlsx').then(() => {
            let sheet = workbook.getWorksheet("Sheet1");
            let curRow = 1;
            let search = () => {
                if (curRow <= sheet.rowCount) {
                    let row = sheet.getRow(curRow);
                    if (row.actualCellCount != 2) {
                        done();
                        return;
                    }
                    let regionName = row.getCell(1).value.toString();
                    let regionPart = row.getCell(2).value.toString();
                    curRow += 1;
                    regionSearch(regionName, regionPart, () => {
                        search();
                    });
                } else {
                    done();
                }
            }
            search();
        });
    });
});